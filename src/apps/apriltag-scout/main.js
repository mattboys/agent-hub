import { createAppShell } from '../shared/appShell.js';
import './styles.css';
import * as Comlink from 'comlink';

/**
 * AprilTag detection is powered by the BSD-3 licensed WASM build published by
 * https://github.com/arenaxr/apriltag-js-standalone.
 */

const ACCENT = '#ff914d';
const DETECTION_INTERVAL_MS = 90;
const FPS_SMOOTHING = 0.2;
const DETECTION_RETENTION_MS = 350;
const SUPPORTED_TAG_FAMILIES = [
  'tag16h5',
  'tag25h9',
  'tag36h11',
  'tagCircle21h7',
  'tagCircle49h12',
  'tagCustom48h12',
  'tagStandard41h12',
  'tagStandard52h13'
];
const CAMERA_CONSTRAINTS = {
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 }
  }
};

const { body } = createAppShell({
  title: 'AprilTag Scout',
  description: 'Watch a live camera feed as AprilTags are outlined with IDs, family metadata, pose hints, and orientation arrows.',
  accent: ACCENT,
  status: 'Live computer vision'
});

const ui = buildLayout();
body.appendChild(ui.root);
ui.fullscreenButton.addEventListener('click', () => {
  toggleFullscreen();
});
handleFullscreenChange();

const captureCanvas = document.createElement('canvas');
const captureCtx = captureCanvas.getContext('2d', { willReadFrequently: true });

const overlayCtx = ui.overlay.getContext('2d');

const state = {
  workerUrl: buildAssetUrl('vendor/apriltag/apriltag.js'),
  detectorClass: null,
  detector: null,
  detectorReady: false,
  detectorPromise: null,
  stream: null,
  rafId: null,
  processing: false,
  lastDetectionAt: 0,
  fps: null,
  lastFrameTimestamp: 0,
  grayBuffer: null,
  poseConfiguredFor: null,
  pendingError: null,
  activeDetections: new Map()
};

ui.cameraButton.addEventListener('click', () => {
  if (state.stream) {
    stopCamera();
  } else {
    startCamera();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseLoop();
  } else if (state.stream) {
    scheduleLoop();
  }
});

document.addEventListener('fullscreenchange', () => {
  handleFullscreenChange();
});

function toggleFullscreen() {
  if (isStageFullscreen()) {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    return;
  }
  const target = ui.stageView;
  if (target?.requestFullscreen) {
    target.requestFullscreen({ navigationUI: 'hide' }).catch((error) => {
      console.warn('Unable to enter fullscreen', error);
    });
  }
}

function handleFullscreenChange() {
  const active = isStageFullscreen();
  ui.fullscreenButton.textContent = active ? 'Exit full screen' : 'Full screen';
  ui.fullscreenButton.dataset.state = active ? 'active' : '';
}

function isStageFullscreen() {
  return document.fullscreenElement === ui.stageView;
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setError('Camera API is not supported in this browser.');
    ui.cameraStatus.set('Camera unavailable', 'danger');
    return;
  }

  ui.cameraButton.disabled = true;
  ui.cameraButton.textContent = 'Requesting camera…';
  ui.cameraStatus.set('Requesting permission…', 'info');
  clearError();

  try {
    const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
    state.stream = stream;
    ui.video.srcObject = stream;
    await ui.video.play();
    ui.stage.dataset.state = 'live';
    ui.cameraButton.textContent = 'Stop camera';
    ui.cameraButton.disabled = false;
    ui.cameraStatus.set('Streaming', 'success');
    ui.overlayMessage.textContent = 'Looking for AprilTags…';
    await ensureDetector();
    scheduleLoop();
  } catch (error) {
    setError('Unable to access the camera. Please allow permissions or pick a different input.');
    ui.cameraStatus.set('Permission blocked', 'danger');
    ui.cameraButton.textContent = 'Enable camera';
    ui.cameraButton.disabled = false;
    console.error(error);
  }
}

function stopCamera() {
  pauseLoop();
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
  }
  if (document.fullscreenElement === ui.stageView && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
  state.stream = null;
  ui.video.srcObject = null;
  ui.stage.dataset.state = 'idle';
  ui.cameraButton.textContent = 'Enable camera';
  ui.cameraStatus.set('Camera idle', 'neutral');
  ui.overlayMessage.textContent = 'Enable your camera to see live detections.';
  clearOverlay();
  state.activeDetections.clear();
  updateDetections([], performance.now());
}

function pauseLoop() {
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
  state.processing = false;
}

function scheduleLoop() {
  if (state.rafId) {
    return;
  }
  const loop = (timestamp) => {
    state.rafId = requestAnimationFrame(loop);
    if (!state.detectorReady || !state.stream || document.hidden) {
      return;
    }
    if (state.processing) {
      return;
    }
    if (timestamp - state.lastDetectionAt < DETECTION_INTERVAL_MS) {
      return;
    }
    state.processing = true;
    state.lastDetectionAt = timestamp;
    processFrame(timestamp).finally(() => {
      state.processing = false;
    });
  };
  state.rafId = requestAnimationFrame(loop);
}

async function ensureDetector() {
  if (state.detectorPromise) {
    return state.detectorPromise;
  }
  ui.detectorStatus.set('Loading detector…', 'info');
  try {
    const worker = new Worker(state.workerUrl, { name: 'apriltag-detector' });
    state.detectorClass = Comlink.wrap(worker);
    state.detectorPromise = new state.detectorClass(
      Comlink.proxy(() => {
        state.detectorReady = true;
        ui.detectorStatus.set('WASM ready', 'success');
      })
    );
    state.detector = await state.detectorPromise;
  } catch (error) {
    setError('Failed to load the AprilTag WASM engine. Check your connection and reload.');
    ui.detectorStatus.set('Detector failed', 'danger');
    console.error(error);
  }
  return state.detector;
}

async function processFrame(now) {
  const frame = captureFrame();
  if (!frame) {
    return;
  }

  try {
    await configurePose(frame.width, frame.height);
    const detector = await ensureDetector();
    if (!detector) {
      return;
    }

    const detections = await detector.detect(frame.gray, frame.width, frame.height);
      renderOverlay(frame.width, frame.height, detections);
      updateDetections(detections, now);
    updateStats(detections, now);
  } catch (error) {
    setError('AprilTag detection failed.');
    console.error(error);
  }
}

function captureFrame() {
  const width = ui.video.videoWidth;
  const height = ui.video.videoHeight;
  if (!width || !height) {
    return null;
  }

  if (captureCanvas.width !== width || captureCanvas.height !== height) {
    captureCanvas.width = width;
    captureCanvas.height = height;
    ui.overlay.width = width;
    ui.overlay.height = height;
    state.grayBuffer = null;
  }

  captureCtx.drawImage(ui.video, 0, 0, width, height);
  const { data } = captureCtx.getImageData(0, 0, width, height);
  const pixelCount = width * height;

  if (!state.grayBuffer || state.grayBuffer.length !== pixelCount) {
    state.grayBuffer = new Uint8Array(pixelCount);
  }

  const gray = state.grayBuffer;
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
  }

  return { width, height, gray };
}

async function configurePose(width, height) {
  if (!state.detector || state.poseConfiguredFor === `${width}x${height}`) {
    return;
  }
  const focal = Math.max(width, height) * 1.2;
  try {
    await state.detector.set_camera_info(focal, focal, width / 2, height / 2);
    state.poseConfiguredFor = `${width}x${height}`;
  } catch (error) {
    console.warn('Unable to configure pose info', error);
  }
}

function renderOverlay(width, height, detections) {
  overlayCtx.clearRect(0, 0, width, height);
  if (!detections?.length) {
    ui.overlayMessage.textContent = 'No AprilTags in view yet.';
    ui.stage.dataset.tags = '0';
    return;
  }

  ui.overlayMessage.textContent = '';
  ui.stage.dataset.tags = String(detections.length);

  detections.forEach((detection) => {
    const color = colorForId(detection.id);
    overlayCtx.strokeStyle = color;
    overlayCtx.lineWidth = Math.max(2, width * 0.002);
    overlayCtx.beginPath();
    detection.corners.forEach((corner, index) => {
      if (index === 0) {
        overlayCtx.moveTo(corner.x, corner.y);
      } else {
        overlayCtx.lineTo(corner.x, corner.y);
      }
    });
    overlayCtx.closePath();
    overlayCtx.stroke();

    // Orientation arrow
    const angle = extractOrientation(detection.corners);
    const radians = (angle * Math.PI) / 180;
    const arrowLength = Math.max(width, height) * 0.08;
    overlayCtx.beginPath();
    overlayCtx.moveTo(detection.center.x, detection.center.y);
    overlayCtx.lineTo(
      detection.center.x + Math.cos(radians) * arrowLength,
      detection.center.y + Math.sin(radians) * arrowLength
    );
    overlayCtx.stroke();

    overlayCtx.fillStyle = 'rgba(7, 9, 17, 0.85)';
    overlayCtx.font = `600 ${Math.max(14, width * 0.018)}px 'Plus Jakarta Sans', sans-serif`;
    overlayCtx.textAlign = 'center';
    overlayCtx.textBaseline = 'bottom';
    overlayCtx.fillText(`#${detection.id}`, detection.center.x, detection.center.y - 8);
  });
}

function clearOverlay() {
  overlayCtx?.clearRect(0, 0, ui.overlay.width, ui.overlay.height);
}

function updateStats(rawDetections, now) {
  const fps = computeFps(now);
  if (fps) {
    ui.fpsMetric.textContent = `${fps.toFixed(1)} fps`;
  } else {
    ui.fpsMetric.textContent = '—';
  }

  ui.tagMetric.textContent = rawDetections.length ? `${rawDetections.length} tags` : '0 tags';

  const closest = rawDetections.reduce((acc, det) => {
    const z = det.pose?.t?.[2];
    if (typeof z !== 'number') {
      return acc;
    }
    if (!acc || z < acc.pose?.t?.[2]) {
      return det;
    }
    return acc;
  }, null);

  if (closest?.pose?.t) {
    ui.rangeMetric.textContent = formatMeters(closest.pose.t[2]);
  } else {
    ui.rangeMetric.textContent = '—';
  }
}

function computeFps(now) {
  if (!state.lastFrameTimestamp) {
    state.lastFrameTimestamp = now;
    return null;
  }
  const delta = now - state.lastFrameTimestamp;
  state.lastFrameTimestamp = now;
  if (!delta) {
    return state.fps;
  }
  const instantaneous = 1000 / delta;
  state.fps = state.fps ? state.fps * (1 - FPS_SMOOTHING) + instantaneous * FPS_SMOOTHING : instantaneous;
  return state.fps;
}

function updateDetections(rawDetections = [], now = performance.now()) {
  if (!state.activeDetections) {
    state.activeDetections = new Map();
  }

  rawDetections.forEach((det) => {
    state.activeDetections.set(buildDetectionKey(det), { data: det, lastSeen: now });
  });

  for (const [key, entry] of state.activeDetections) {
    if (now - entry.lastSeen > DETECTION_RETENTION_MS) {
      state.activeDetections.delete(key);
    }
  }

  const persisted = Array.from(state.activeDetections.values())
    .sort((a, b) => compareDetections(a.data, b.data))
    .map((entry) => entry.data);

  if (!persisted.length) {
    ui.detectionsList.dataset.state = 'empty';
    ui.detectionsList.innerHTML = '';
    ui.detectionsList.appendChild(ui.emptyDetections);
    return;
  }

  ui.detectionsList.dataset.state = 'ready';
  ui.detectionsList.innerHTML = '';
  persisted.forEach((det) => {
    ui.detectionsList.appendChild(renderDetectionCard(det));
  });
}

function renderDetectionCard(detection) {
  const angle = extractOrientation(detection.corners);
  const color = colorForId(detection.id);
  const familyName = detectionFamily(detection);
  const sizeLabel = formatMillimeters(detection.pose?.size ?? detection.size);

  const card = document.createElement('article');
  card.className = 'detection-card';
  card.style.setProperty('--tag-color', color);

  const header = document.createElement('header');
  header.innerHTML = `
    <div>
      <p class="detection-label">Tag #${detection.id}</p>
      <h3>${familyName}</h3>
    </div>
    <span class="chip">${sizeLabel}</span>
  `;

  const dial = document.createElement('div');
  dial.className = 'orientation-dial';
  dial.style.setProperty('--angle', `${angle}deg`);
  dial.innerHTML = `
    <span class="dial-arrow"></span>
    <span class="dial-value">${angle.toFixed(0)}°</span>
    <span class="dial-caption">Orientation</span>
  `;

  const stats = document.createElement('dl');
  stats.className = 'detection-stats';
  stats.innerHTML = `
    <div>
      <dt>Center</dt>
      <dd>${formatPoint(detection.center)}</dd>
    </div>
    <div>
      <dt>Edge length</dt>
      <dd>${Math.round(averageEdgeLength(detection.corners))} px</dd>
    </div>
    <div>
      <dt>Pose Z</dt>
      <dd>${detection.pose?.t ? formatMeters(detection.pose.t[2]) : '—'}</dd>
    </div>
    <div>
      <dt>Pose error</dt>
      <dd>${formatError(detection.pose?.e)}</dd>
    </div>
  `;

  card.append(header, dial, stats);
  return card;
}

function extractOrientation(corners = []) {
  if (!corners.length) {
    return 0;
  }
  const first = corners[0];
  const second = corners[1] || first;
  let angle = (Math.atan2(second.y - first.y, second.x - first.x) * 180) / Math.PI;
  if (angle < 0) {
    angle += 360;
  }
  return angle;
}

function averageEdgeLength(corners = []) {
  if (!corners.length) {
    return 0;
  }
  let total = 0;
  for (let i = 0; i < corners.length; i++) {
    const current = corners[i];
    const next = corners[(i + 1) % corners.length];
    const dx = current.x - next.x;
    const dy = current.y - next.y;
    total += Math.hypot(dx, dy);
  }
  return total / corners.length;
}

function buildLayout() {
  const root = document.createElement('div');
  root.className = 'scout-grid';

  const stage = document.createElement('article');
  stage.className = 'detector-card stage-card';
  stage.dataset.state = 'idle';

  const header = document.createElement('div');
  header.className = 'card-header';
  header.innerHTML = `
    <div>
      <h2>Live detector</h2>
      <p>Request your camera to see AprilTags outlined with ID, family, pose hints, and heading arrows in real time.</p>
    </div>
  `;

  const statusGrid = document.createElement('div');
  statusGrid.className = 'status-grid';
  const cameraStatus = createStatusChip('Camera idle');
  const detectorStatus = createStatusChip('Detector not loaded');
  statusGrid.append(cameraStatus.element, detectorStatus.element);

  const stageView = document.createElement('div');
  stageView.className = 'stage-view';

  const video = document.createElement('video');
  video.className = 'stage-video';
  video.playsInline = true;
  video.muted = true;
  video.autoplay = true;

  const overlay = document.createElement('canvas');
  overlay.className = 'stage-overlay';

  const overlayMessage = document.createElement('p');
  overlayMessage.className = 'stage-overlay-message';
  overlayMessage.textContent = 'Enable your camera to begin detecting AprilTags.';

  stageView.append(video, overlay, overlayMessage);

  const controlBar = document.createElement('div');
  controlBar.className = 'control-bar';
  const cameraButton = document.createElement('button');
  cameraButton.type = 'button';
  cameraButton.className = 'primary-button';
  cameraButton.textContent = 'Enable camera';

  const fullscreenButton = document.createElement('button');
  fullscreenButton.type = 'button';
  fullscreenButton.className = 'ghost-button';
  fullscreenButton.textContent = 'Full screen';

  const familyIndicator = document.createElement('span');
  familyIndicator.className = 'family-pill';
  familyIndicator.innerHTML = `<strong>Families:</strong> ${SUPPORTED_TAG_FAMILIES.join(' • ')}`;
  familyIndicator.title = SUPPORTED_TAG_FAMILIES.join(', ');

  controlBar.append(cameraButton, fullscreenButton, familyIndicator);

  const metrics = document.createElement('div');
  metrics.className = 'metrics-row';
  const tagMetric = createMetric('Detections', '0 tags');
  const fpsMetric = createMetric('Loop FPS', '—');
  const rangeMetric = createMetric('Nearest tag (Z)', '—');
  metrics.append(tagMetric.wrapper, fpsMetric.wrapper, rangeMetric.wrapper);

  stage.append(header, statusGrid, stageView, controlBar, metrics);

  const detectionsCard = document.createElement('article');
  detectionsCard.className = 'detector-card detections-card';
  const detectionsHeader = document.createElement('div');
  detectionsHeader.className = 'card-header';
  detectionsHeader.innerHTML = `
    <div>
      <h2>Detections</h2>
      <p>Each AprilTag displays its center, average edge length, estimated Z range, and pose accuracy.</p>
    </div>
  `;

  const detectionsList = document.createElement('div');
  detectionsList.className = 'detection-list';
  detectionsList.dataset.state = 'empty';
  const empty = document.createElement('p');
  empty.className = 'empty-state';
  empty.textContent = 'Tags will appear here once the detector spots them.';
  detectionsList.append(empty);

  const attribution = document.createElement('p');
  attribution.className = 'attribution';
  attribution.innerHTML =
    'Detection powered by the <a href="https://github.com/arenaxr/apriltag-js-standalone" target="_blank" rel="noopener noreferrer">ArenaXR apriltag-js-standalone</a> WASM build.';

  detectionsCard.append(detectionsHeader, detectionsList, attribution);

  root.append(stage, detectionsCard);

  return {
    root,
    stage,
    stageView,
    video,
    overlay,
    overlayMessage,
    cameraButton,
    fullscreenButton,
    cameraStatus,
    detectorStatus,
    detectionsList,
    emptyDetections: empty,
    tagMetric: tagMetric.value,
    fpsMetric: fpsMetric.value,
    rangeMetric: rangeMetric.value
  };
}

function createMetric(label, value) {
  const wrapper = document.createElement('div');
  wrapper.className = 'metric';
  const title = document.createElement('p');
  title.textContent = label;
  const strong = document.createElement('strong');
  strong.textContent = value;
  wrapper.append(title, strong);
  return { wrapper, value: strong };
}

function createStatusChip(initialText) {
  const element = document.createElement('span');
  element.className = 'status-chip';
  element.textContent = initialText;
  return {
    element,
    set(text, tone = 'neutral') {
      element.textContent = text;
      element.dataset.tone = tone;
    }
  };
}

function setError(message) {
  state.pendingError = message;
  ui.overlayMessage.textContent = message;
  ui.stage.dataset.state = 'error';
}

function clearError() {
  state.pendingError = null;
  ui.stage.dataset.state = state.stream ? 'live' : 'idle';
  if (!state.stream) {
    ui.overlayMessage.textContent = 'Enable your camera to begin detecting AprilTags.';
  }
}

function formatPoint(point) {
  if (!point) {
    return '—';
  }
  return `${Math.round(point.x)}, ${Math.round(point.y)}`;
}

function formatMeters(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  if (Math.abs(value) >= 1) {
    return `${value.toFixed(2)} m`;
  }
  return `${(value * 100).toFixed(1)} cm`;
}

function formatMillimeters(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return `${Math.round(value * 1000)} mm`;
}

function formatError(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  if (value === 0) {
    return '0';
  }
  const exponent = value.toExponential(2);
  return exponent.replace('e', '×10^');
}

function colorForId(id) {
  return `hsl(${(id * 47) % 360}, 78%, 60%)`;
}

function detectionFamily(detection = {}) {
  return detection.family || 'tag36h11';
}

function buildDetectionKey(detection = {}) {
  return `${detectionFamily(detection)}:${detection.id ?? 'unknown'}`;
}

function compareDetections(a = {}, b = {}) {
  const familyDiff = detectionFamily(a).localeCompare(detectionFamily(b));
  if (familyDiff) {
    return familyDiff;
  }
  return (a.id ?? 0) - (b.id ?? 0);
}

function buildAssetUrl(path) {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const url = new URL(normalizedBase, window.location.origin);
  return new URL(path.replace(/^\//, ''), url).href;
}
