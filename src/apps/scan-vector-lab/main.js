import { createAppShell } from '../shared/appShell.js';
import './styles.css';
import * as Comlink from 'comlink';
import { PDFDocument, rgb } from 'pdf-lib';

const ACCENT = '#1f7a8c';
const DETECTION_INTERVAL_MS = 110;
const FPS_SMOOTHING = 0.25;
const CAMERA_CONSTRAINTS = {
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 }
  }
};

const REFERENCE_TAGS = [
  { id: 0, asset: 'assets/apriltags/tag36_11_00000.png', label: 'Top-left' },
  { id: 1, asset: 'assets/apriltags/tag36_11_00001.png', label: 'Top-right' },
  { id: 2, asset: 'assets/apriltags/tag36_11_00002.png', label: 'Bottom-right' },
  { id: 3, asset: 'assets/apriltags/tag36_11_00003.png', label: 'Bottom-left' }
];

const PAGE_SIZES = [
  { id: 'a4', label: 'A4 · 210 × 297 mm', widthMm: 210, heightMm: 297 },
  { id: 'sra3', label: 'SRA3 · 320 × 450 mm', widthMm: 320, heightMm: 450 },
  { id: 'letter', label: 'US Letter · 215.9 × 279.4 mm', widthMm: 215.9, heightMm: 279.4 },
  { id: 'tabloid', label: 'Tabloid · 279.4 × 431.8 mm', widthMm: 279.4, heightMm: 431.8 }
];

const { body } = createAppShell({
  title: 'Dimension Scan Lab',
  description:
    'Print a calibrated AprilTag board, align it under your camera, and capture dimensionally accurate SVG, DXF, or PDF outlines of whatever sits on the page.',
  accent: ACCENT,
  status: 'Experimental CV + CAD'
});

const ui = buildLayout();
body.appendChild(ui.root);

const captureCanvas = document.createElement('canvas');
const captureCtx = captureCanvas.getContext('2d', { willReadFrequently: true });
const overlayCtx = ui.overlay.getContext('2d');

const state = {
  workerUrl: buildAssetUrl('vendor/apriltag/apriltag.js'),
  detectorClass: null,
  detectorPromise: null,
  detector: null,
  detectorReady: false,
  stream: null,
  rafId: null,
  processing: false,
  lastDetectionAt: 0,
  fps: null,
  lastFrameTimestamp: 0,
  grayBuffer: null,
  layout: buildLayoutSpec(PAGE_SIZES[0], 'portrait', 18, 48),
  pageOption: PAGE_SIZES[0].id,
  orientation: 'portrait',
  marginMm: 18,
  tagSizeMm: 48,
  pxPerMm: 4.5,
  tagAssetCache: new Map(),
  latestDetections: [],
  latestFrame: null,
  lastHomography: null,
  scan: null,
  contours: [],
  binaryField: null,
  processorSettings: {
    threshold: 0.28,
    blur: 2,
    closing: 1
  }
};

ui.pageSelect.value = state.pageOption;
ui.orientationToggle.value = state.orientation;
ui.marginInput.value = state.marginMm;
ui.tagSizeInput.value = state.tagSizeMm;
ui.resolutionInput.value = state.pxPerMm.toFixed(1);
updateLayoutSummary();

ui.pageSelect.addEventListener('change', () => {
  const next = PAGE_SIZES.find((size) => size.id === ui.pageSelect.value) ?? PAGE_SIZES[0];
  state.pageOption = next.id;
  rebuildLayout();
});

ui.orientationToggle.addEventListener('change', () => {
  state.orientation = ui.orientationToggle.value;
  rebuildLayout();
});

ui.marginInput.addEventListener('input', () => {
  const value = clamp(parseFloat(ui.marginInput.value), 5, 80);
  state.marginMm = Number.isFinite(value) ? value : state.marginMm;
  ui.marginInput.value = state.marginMm;
  rebuildLayout();
});

ui.tagSizeInput.addEventListener('input', () => {
  const value = clamp(parseFloat(ui.tagSizeInput.value), 20, 90);
  state.tagSizeMm = Number.isFinite(value) ? value : state.tagSizeMm;
  ui.tagSizeInput.value = state.tagSizeMm;
  rebuildLayout();
});

ui.resolutionInput.addEventListener('input', () => {
  const value = clamp(parseFloat(ui.resolutionInput.value), 2, 12);
  state.pxPerMm = Number.isFinite(value) ? value : state.pxPerMm;
  ui.resolutionInput.value = state.pxPerMm.toFixed(1);
});

ui.downloadSvgButton.addEventListener('click', async () => {
  try {
    ui.downloadSvgButton.disabled = true;
    ui.downloadSvgButton.textContent = 'Building SVG…';
    const svg = await buildReferenceSvg(state.layout);
    triggerDownload(svg, `${state.layout.label}-calibration.svg`, 'image/svg+xml');
  } finally {
    ui.downloadSvgButton.disabled = false;
    ui.downloadSvgButton.textContent = 'Download SVG';
  }
});

ui.downloadPdfButton.addEventListener('click', async () => {
  try {
    ui.downloadPdfButton.disabled = true;
    ui.downloadPdfButton.textContent = 'Building PDF…';
    const pdfBytes = await buildReferencePdf(state.layout);
    triggerDownload(pdfBytes, `${state.layout.label}-calibration.pdf`, 'application/pdf');
  } finally {
    ui.downloadPdfButton.disabled = false;
    ui.downloadPdfButton.textContent = 'Download PDF';
  }
});

ui.cameraButton.addEventListener('click', () => {
  if (state.stream) {
    stopCamera();
  } else {
    startCamera();
  }
});

ui.captureButton.addEventListener('click', () => {
  if (state.processing || !state.detectorReady) {
    return;
  }
  captureCalibratedScan();
});

ui.resetScanButton.addEventListener('click', () => {
  resetScan();
});

ui.thresholdSlider.addEventListener('input', () => {
  const value = Number(ui.thresholdSlider.value);
  state.processorSettings.threshold = value / 100;
  ui.thresholdValue.textContent = `${value}`;
  if (state.scan) {
    processContours();
  }
});

ui.blurSlider.addEventListener('input', () => {
  const value = Number(ui.blurSlider.value);
  state.processorSettings.blur = value;
  ui.blurValue.textContent = `${value}`;
  if (state.scan) {
    processContours();
  }
});

ui.closingSlider.addEventListener('input', () => {
  const value = Number(ui.closingSlider.value);
  state.processorSettings.closing = value;
  ui.closingValue.textContent = `${value}`;
  if (state.scan) {
    processContours();
  }
});

ui.exportSvgButton.addEventListener('click', () => {
  if (!state.contours.length) {
    return;
  }
  const svg = buildVectorSvg(state.layout, state.contours);
  triggerDownload(svg, 'scan-outline.svg', 'image/svg+xml');
});

ui.exportDxfButton.addEventListener('click', () => {
  if (!state.contours.length) {
    return;
  }
  const dxf = buildDxf(state.layout, state.contours);
  triggerDownload(dxf, 'scan-outline.dxf', 'application/dxf');
});

ui.exportPdfButton.addEventListener('click', async () => {
  if (!state.contours.length) {
    return;
  }
  const pdfBytes = await buildVectorPdf(state.layout, state.contours);
  triggerDownload(pdfBytes, 'scan-outline.pdf', 'application/pdf');
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseLoop();
  } else if (state.stream) {
    scheduleLoop();
  }
});

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    ui.cameraStatus.set('Camera unavailable', 'danger');
    ui.stage.dataset.state = 'error';
    return;
  }
  clearOverlay();
  ui.cameraButton.disabled = true;
  ui.cameraButton.textContent = 'Requesting camera…';
  ui.cameraStatus.set('Requesting permission…', 'info');
  try {
    const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
    state.stream = stream;
    ui.video.srcObject = stream;
    await ui.video.play();
    ui.stage.dataset.state = 'live';
    ui.cameraButton.textContent = 'Stop camera';
    ui.cameraButton.disabled = false;
    ui.cameraStatus.set('Streaming', 'success');
    await ensureDetector();
    scheduleLoop();
  } catch (error) {
    console.error(error);
    ui.cameraStatus.set('Permission blocked', 'danger');
    ui.cameraButton.textContent = 'Enable camera';
    ui.cameraButton.disabled = false;
  }
}

function stopCamera() {
  pauseLoop();
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
  }
  state.stream = null;
  ui.video.srcObject = null;
  ui.cameraButton.textContent = 'Enable camera';
  ui.cameraStatus.set('Camera idle', 'neutral');
  ui.stage.dataset.state = 'idle';
  ui.overlayMessage.textContent = 'Enable the camera to detect the reference sheet.';
  clearOverlay();
  updateDetections([]);
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
  ui.detectorStatus.set('Loading AprilTag WASM…', 'info');
  try {
    const worker = new Worker(state.workerUrl, { name: 'dimension-scan-detector' });
    state.detectorClass = Comlink.wrap(worker);
    state.detectorPromise = new state.detectorClass(
      Comlink.proxy(() => {
        state.detectorReady = true;
        ui.detectorStatus.set('Detector ready', 'success');
      })
    );
    state.detector = await state.detectorPromise;
  } catch (error) {
    console.error(error);
    ui.detectorStatus.set('Detector failed', 'danger');
  }
  return state.detector;
}

async function processFrame(now) {
  const frame = captureFrame();
  if (!frame) {
    return;
  }
  try {
    const detector = await ensureDetector();
    if (!detector) {
      return;
    }
    await configurePose(frame.width, frame.height);
    const detections = await detector.detect(frame.gray, frame.width, frame.height);
    state.latestDetections = detections;
    state.latestFrame = frame;
    renderOverlay(frame.width, frame.height, detections);
    updateDetections(detections);
    updateStats(detections, now);
    const coverage = computeCoverageConfidence(detections);
    if (coverage.ready) {
      ui.captureButton.disabled = false;
      ui.stage.dataset.tags = '4';
      ui.overlayMessage.textContent = 'Sheet locked — capture when ready.';
    } else {
      ui.captureButton.disabled = true;
      ui.stage.dataset.tags = `${coverage.count}`;
      ui.overlayMessage.textContent = coverage.message;
    }
  } catch (error) {
    console.error(error);
    ui.overlayMessage.textContent = 'Detection failed. Check lighting and focus.';
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
    gray[j] = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) | 0;
  }
  return {
    width,
    height,
    gray,
    rgba: new Uint8ClampedArray(data)
  };
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
    return;
  }
  overlayCtx.lineWidth = Math.max(2, width * 0.004);
  detections.forEach((det) => {
    overlayCtx.strokeStyle = colorForId(det.id);
    overlayCtx.beginPath();
    det.corners.forEach((corner, index) => {
      if (index === 0) {
        overlayCtx.moveTo(corner.x, corner.y);
      } else {
        overlayCtx.lineTo(corner.x, corner.y);
      }
    });
    overlayCtx.closePath();
    overlayCtx.stroke();
    overlayCtx.fillStyle = 'rgba(6, 8, 15, 0.9)';
    overlayCtx.font = `600 ${Math.max(14, width * 0.02)}px 'Plus Jakarta Sans', sans-serif`;
    overlayCtx.textAlign = 'center';
    overlayCtx.textBaseline = 'middle';
    overlayCtx.fillText(`#${det.id}`, det.center.x, det.center.y);
  });
}

function clearOverlay() {
  overlayCtx.clearRect(0, 0, ui.overlay.width, ui.overlay.height);
}

function updateDetections(detections = []) {
  if (!detections.length) {
    ui.detectionsList.dataset.state = 'empty';
    ui.detectionsList.innerHTML = '';
    ui.detectionsList.appendChild(ui.emptyDetections);
    return;
  }
  ui.detectionsList.dataset.state = 'ready';
  ui.detectionsList.innerHTML = '';
  detections.slice(0, 4).forEach((det) => {
    const card = document.createElement('div');
    card.className = 'tag-pill';
    card.innerHTML = `<strong>#${det.id}</strong> <span>${formatPoint(det.center)}</span>`;
    ui.detectionsList.appendChild(card);
  });
}

function updateStats(rawDetections, now) {
  const fps = computeFps(now);
  ui.fpsMetric.textContent = fps ? `${fps.toFixed(1)} fps` : '—';
  ui.tagMetric.textContent = rawDetections.length ? `${rawDetections.length} tags` : '0 tags';
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

function computeCoverageConfidence(detections = []) {
  const requiredIds = new Set(REFERENCE_TAGS.map((tag) => tag.id));
  const found = new Map();
  detections.forEach((det) => {
    if (requiredIds.has(det.id)) {
      found.set(det.id, det);
    }
  });
  if (found.size < 4) {
    return { ready: false, count: found.size, message: 'Align all four tags within view.' };
  }
  const spans = Array.from(found.values()).map((det) => averageEdgeLength(det.corners));
  const maxSpan = Math.max(...spans);
  if (maxSpan < 90) {
    return { ready: false, count: found.size, message: 'Move the camera closer for detail.' };
  }
  return { ready: true, count: found.size, message: 'Ready.' };
}

async function captureCalibratedScan() {
  if (!state.latestFrame || !state.latestDetections.length) {
    return;
  }
  const mapping = matchTags(state.latestDetections);
  if (!mapping) {
    ui.captureStatus.textContent = 'All four sheet tags must be visible.';
    return;
  }
  ui.captureButton.disabled = true;
  ui.captureButton.textContent = 'Capturing…';
  ui.captureStatus.textContent = 'Warping scan to page coordinates…';
  try {
    const homography = solveHomography(mapping.cameraPoints, mapping.pagePoints);
    state.lastHomography = homography;
    const warped = await warpToPage(state.latestFrame, homography, state.layout, state.pxPerMm);
    state.scan = warped;
    ui.captureStatus.textContent = `Captured at ${warped.canvas.width}×${warped.canvas.height}px (${state.pxPerMm.toFixed(
      1
    )} px/mm)`;
    drawResultPreview(warped.canvas);
    processContours();
    ui.panelScan.dataset.state = 'ready';
  } catch (error) {
    console.error(error);
    ui.captureStatus.textContent = 'Warp failed. Try again with flatter lighting.';
  } finally {
    ui.captureButton.disabled = false;
    ui.captureButton.textContent = 'Capture calibrated scan';
  }
}

function resetScan() {
  state.scan = null;
  state.contours = [];
  state.binaryField = null;
  ui.panelScan.dataset.state = 'empty';
  ui.resultCtx.clearRect(0, 0, ui.resultCanvas.width, ui.resultCanvas.height);
  ui.contourList.innerHTML = '';
  ui.exportSummary.textContent = 'Capture a scan to unlock exports.';
}

function matchTags(detections) {
  const found = [];
  const required = new Map(
    REFERENCE_TAGS.map((tag, index) => [
      tag.id,
      { tag, target: state.layout.tags[index] ?? state.layout.tags.find((t) => t.id === tag.id) }
    ])
  );
  detections.forEach((det) => {
    if (required.has(det.id)) {
      found.push({
        id: det.id,
        corners: det.corners,
        target: required.get(det.id).target
      });
    }
  });
  if (found.length !== 4) {
    return null;
  }
  const cameraPoints = [];
  const pagePoints = [];
  found.forEach(({ corners, target }) => {
    corners.forEach((corner, index) => {
      cameraPoints.push({ x: corner.x, y: corner.y });
      pagePoints.push(target.corners[index]);
    });
  });
  return { cameraPoints, pagePoints };
}

async function warpToPage(frame, homography, layout, pxPerMm) {
  const widthMm = layout.widthMm;
  const heightMm = layout.heightMm;
  const destWidth = Math.round(widthMm * pxPerMm);
  const destHeight = Math.round(heightMm * pxPerMm);
  const canvas = document.createElement('canvas');
  canvas.width = destWidth;
  canvas.height = destHeight;
  const ctx = canvas.getContext('2d');
  const destData = ctx.createImageData(destWidth, destHeight);
  const inverse = invertHomography(homography);
  const source = frame.rgba;
  const srcWidth = frame.width;
  const srcHeight = frame.height;
  for (let y = 0; y < destHeight; y++) {
    for (let x = 0; x < destWidth; x++) {
      const mmPoint = { x: x / pxPerMm, y: y / pxPerMm };
      const sourcePoint = applyHomography(inverse, mmPoint);
      const sx = sourcePoint.x;
      const sy = sourcePoint.y;
      if (sx < 0 || sy < 0 || sx >= srcWidth - 1 || sy >= srcHeight - 1) {
        continue;
      }
      const rgba = sampleBilinear(source, srcWidth, srcHeight, sx, sy);
      const offset = (y * destWidth + x) * 4;
      destData.data[offset] = rgba[0];
      destData.data[offset + 1] = rgba[1];
      destData.data[offset + 2] = rgba[2];
      destData.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(destData, 0, 0);
  return { canvas, data: destData, width: destWidth, height: destHeight };
}

function drawResultPreview(canvas) {
  const { width, height } = canvas;
  const maxWidth = 640;
  const scale = Math.min(1, maxWidth / width);
  ui.resultCanvas.width = width * scale;
  ui.resultCanvas.height = height * scale;
  ui.resultCtx.clearRect(0, 0, ui.resultCanvas.width, ui.resultCanvas.height);
  ui.resultCtx.drawImage(canvas, 0, 0, ui.resultCanvas.width, ui.resultCanvas.height);
}

function processContours() {
  if (!state.scan) {
    return;
  }
  const grayscale = toGrayscale(state.scan.data);
  const blurred = applyGaussian(grayscale, state.scan.width, state.scan.height, state.processorSettings.blur);
  const gradient = sobel(blurred, state.scan.width, state.scan.height);
  const thresholdValue = state.processorSettings.threshold;
  const binary = applyThreshold(gradient, thresholdValue);
  const smoothed = morphologicalClosing(binary, state.scan.width, state.scan.height, state.processorSettings.closing);
  state.binaryField = smoothed;
  const contours = traceContours(smoothed, state.scan.width, state.scan.height, 1 / state.pxPerMm);
  state.contours = contours;
  drawContoursOnPreview(contours);
  renderContourList(contours);
  ui.exportSummary.textContent = contours.length
    ? `Ready to export ${contours.length} traced outline${contours.length > 1 ? 's' : ''}.`
    : 'No solid outlines detected yet.';
  const canExport = contours.length > 0;
  ui.exportSvgButton.disabled = !canExport;
  ui.exportDxfButton.disabled = !canExport;
  ui.exportPdfButton.disabled = !canExport;
}

function drawContoursOnPreview(contours) {
  if (!state.scan) {
    return;
  }
  ui.resultCtx.clearRect(0, 0, ui.resultCanvas.width, ui.resultCanvas.height);
  ui.resultCtx.save();
  ui.resultCtx.globalAlpha = 0.9;
  ui.resultCtx.drawImage(state.scan.canvas, 0, 0, ui.resultCanvas.width, ui.resultCanvas.height);
  ui.resultCtx.restore();
  if (!contours.length) {
    return;
  }
  const scaleX = ui.resultCanvas.width / state.scan.width;
  const scaleY = ui.resultCanvas.height / state.scan.height;
  ui.resultCtx.lineWidth = 2;
  contours.forEach((poly, index) => {
    ui.resultCtx.strokeStyle = colorForId(index + 1);
    ui.resultCtx.beginPath();
    poly.forEach((point, idx) => {
      const x = (point.x * state.pxPerMm) * scaleX;
      const y = (point.y * state.pxPerMm) * scaleY;
      if (idx === 0) {
        ui.resultCtx.moveTo(x, y);
      } else {
        ui.resultCtx.lineTo(x, y);
      }
    });
    ui.resultCtx.closePath();
    ui.resultCtx.stroke();
  });
}

function renderContourList(contours) {
  ui.contourList.innerHTML = '';
  if (!contours.length) {
    ui.contourList.textContent = 'Contours will appear once edges are detected.';
    return;
  }
  contours
    .map((points) => ({
      points,
      perimeter: polygonPerimeter(points),
      area: Math.abs(polygonArea(points))
    }))
    .sort((a, b) => b.area - a.area)
    .forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'contour-row';
      row.innerHTML = `
        <strong>Outline ${index + 1}</strong>
        <span>${item.points.length} pts · ${item.area.toFixed(1)} mm² · ${item.perimeter.toFixed(1)} mm</span>
      `;
      ui.contourList.appendChild(row);
    });
}

function rebuildLayout() {
  const size = PAGE_SIZES.find((entry) => entry.id === state.pageOption) ?? PAGE_SIZES[0];
  state.layout = buildLayoutSpec(size, state.orientation, state.marginMm, state.tagSizeMm);
  drawSheetPreview();
  updateLayoutSummary();
}

function updateLayoutSummary() {
  ui.sheetSummary.innerHTML = `
    <strong>${state.layout.label}</strong>
    <span>${state.layout.widthMm.toFixed(1)} × ${state.layout.heightMm.toFixed(1)} mm · Tags ${state.tagSizeMm.toFixed(
      1
    )} mm · Margin ${state.marginMm.toFixed(1)} mm</span>
  `;
}

function drawSheetPreview() {
  const { widthMm, heightMm, tags } = state.layout;
  const canvas = ui.sheetPreview;
  canvas.width = 420;
  canvas.height = 420 * (heightMm / widthMm);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fefefe';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#c9cfd6';
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#a0a8b4';
  ctx.font = '12px "Plus Jakarta Sans"';
  ctx.fillText(`${widthMm.toFixed(1)} mm`, canvas.width / 2 - 40, canvas.height - 10);
  ctx.save();
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`${heightMm.toFixed(1)} mm`, -canvas.height / 2 - 40, 14);
  ctx.restore();
  tags.forEach((tag) => {
    ctx.save();
    const scaleX = canvas.width / widthMm;
    const scaleY = canvas.height / heightMm;
    const x = tag.corners[0].x * scaleX;
    const y = tag.corners[0].y * scaleY;
    const sizePx = state.tagSizeMm * scaleX;
    ctx.translate(x, y);
    ctx.fillStyle = '#0f1827';
    ctx.fillRect(0, 0, sizePx, sizePx);
    ctx.fillStyle = '#fff';
    ctx.fillRect(3, 3, sizePx - 6, sizePx - 6);
    ctx.fillStyle = '#0f1827';
    ctx.fillRect(6, 6, sizePx - 12, sizePx - 12);
    ctx.restore();
  });
}

async function buildReferenceSvg(layout) {
  const tagData = await Promise.all(
    REFERENCE_TAGS.map(async (tag) => ({
      id: tag.id,
      dataUrl: await loadTagData(tag.asset)
    }))
  );
  const tagMap = new Map(tagData.map((entry) => [entry.id, entry.dataUrl]));
  const svgParts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.widthMm}mm" height="${layout.heightMm}mm" viewBox="0 0 ${layout.widthMm} ${layout.heightMm}">`,
    `<rect width="100%" height="100%" fill="#fff"/>`,
    `<text x="${layout.widthMm / 2}" y="15" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" fill="#0b111a" text-anchor="middle">Dimension Scan Lab reference board · ${layout.label}</text>`
  ];
  layout.tags.forEach((tag) => {
    const dataUrl = tagMap.get(tag.id);
    if (!dataUrl) {
      return;
    }
    svgParts.push(
      `<image href="${dataUrl}" x="${tag.corners[0].x.toFixed(3)}" y="${tag.corners[0].y.toFixed(3)}" width="${state.tagSizeMm.toFixed(
        3
      )}" height="${state.tagSizeMm.toFixed(3)}" />`,
      `<text x="${(tag.corners[0].x + state.tagSizeMm / 2).toFixed(3)}" y="${(tag.corners[0].y - 1).toFixed(
        3
      )}" font-size="5" text-anchor="middle" fill="#384355">#${tag.id}</text>`
    );
  });
  svgParts.push(
    `<text x="${layout.widthMm / 2}" y="${layout.heightMm - 4}" font-size="4" text-anchor="middle" fill="#656f7d">AprilTag assets © AprilRobotics (MIT). App by Dimension Scan Lab.</text>`,
    '</svg>'
  );
  return svgParts.join('');
}

async function buildReferencePdf(layout) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([mmToPoints(layout.widthMm), mmToPoints(layout.heightMm)]);
  const tagData = await Promise.all(
    REFERENCE_TAGS.map(async (tag) => ({
      id: tag.id,
      bytes: await loadTagBytes(tag.asset)
    }))
  );
  const tagMap = new Map(
    await Promise.all(
      tagData.map(async (entry) => [entry.id, await pdf.embedPng(entry.bytes)])
    )
  );
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb256(255, 255, 255) });
  page.drawText(`Dimension Scan Lab · ${layout.label}`, {
    x: width / 2 - 120,
    y: height - 28,
    size: 12,
    color: rgb256(20, 28, 38)
  });
  layout.tags.forEach((tag) => {
    const png = tagMap.get(tag.id);
    if (!png) {
      return;
    }
    const tagWidth = mmToPoints(state.tagSizeMm);
    const tagHeight = mmToPoints(state.tagSizeMm);
    page.drawImage(png, {
      x: mmToPoints(tag.corners[0].x),
      y: height - mmToPoints(tag.corners[0].y + state.tagSizeMm),
      width: tagWidth,
      height: tagHeight
    });
    page.drawText(`#${tag.id}`, {
      x: mmToPoints(tag.corners[0].x + state.tagSizeMm / 2) - 10,
      y: height - mmToPoints(tag.corners[0].y) - 10,
      size: 10,
      color: rgb256(32, 40, 54)
    });
  });
  const footer = 'AprilTag assets © AprilRobotics (MIT). Generated with Dimension Scan Lab.';
  page.drawText(footer, {
    x: width / 2 - footer.length * 2.5,
    y: 12,
    size: 9,
    color: rgb256(90, 103, 118)
  });
  return pdf.save();
}

function buildVectorSvg(layout, contours) {
  const viewBox = `0 0 ${layout.widthMm} ${layout.heightMm}`;
  const paths = contours
    .map((poly) => {
      const commands = poly
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${(point.x).toFixed(3)} ${(point.y).toFixed(3)}`)
        .join(' ');
      return `${commands} Z`;
    })
    .join(' ');
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${layout.widthMm}mm" height="${layout.heightMm}mm" viewBox="${viewBox}">
  <rect width="100%" height="100%" fill="none" stroke="#e6e7eb" stroke-width="0.25"/>
  <path d="${paths}" fill="none" stroke="#ff914d" stroke-width="0.35" />
</svg>`;
}

function buildDxf(layout, contours) {
  const header = `0
SECTION
2
ENTITIES
`;
  const footer = `0
ENDSEC
0
EOF`;
  const entities = contours
    .map((poly) => {
      const points = poly.map((pt) => `10
${pt.x.toFixed(4)}
20
${pt.y.toFixed(4)}`).join('\n');
      return `0
LWPOLYLINE
90
${poly.length}
70
1
${points}
`;
    })
    .join('');
  return `${header}${entities}${footer}`;
}

async function buildVectorPdf(layout, contours) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([mmToPoints(layout.widthMm), mmToPoints(layout.heightMm)]);
  contours.forEach((poly) => {
    for (let i = 0; i < poly.length; i++) {
      const current = poly[i];
      const next = poly[(i + 1) % poly.length];
      page.drawLine({
        start: { x: mmToPoints(current.x), y: mmToPoints(current.y) },
        end: { x: mmToPoints(next.x), y: mmToPoints(next.y) },
        thickness: 0.5,
        color: rgb256(35, 109, 221)
      });
    }
  });
  return pdf.save();
}

function buildLayoutSpec(size, orientation, margin, tagSize) {
  const isLandscape = orientation === 'landscape';
  const widthMm = isLandscape ? size.heightMm : size.widthMm;
  const heightMm = isLandscape ? size.widthMm : size.heightMm;
  const tags = [
    {
      id: 0,
      corners: buildSquare(margin, margin, tagSize)
    },
    {
      id: 1,
      corners: buildSquare(widthMm - margin - tagSize, margin, tagSize)
    },
    {
      id: 2,
      corners: buildSquare(widthMm - margin - tagSize, heightMm - margin - tagSize, tagSize)
    },
    {
      id: 3,
      corners: buildSquare(margin, heightMm - margin - tagSize, tagSize)
    }
  ];
  return {
    widthMm,
    heightMm,
    label: size.label + (isLandscape ? ' · landscape' : ''),
    tags
  };
}

function buildSquare(x, y, size) {
  return [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size }
  ];
}

function loadTagData(assetPath) {
  const absolute = buildAssetUrl(assetPath);
  if (state.tagAssetCache.has(absolute)) {
    return Promise.resolve(state.tagAssetCache.get(absolute));
  }
  return fetch(absolute)
    .then((res) => res.blob())
    .then((blob) => blobToDataUrl(blob))
    .then((dataUrl) => {
      state.tagAssetCache.set(absolute, dataUrl);
      return dataUrl;
    });
}

function loadTagBytes(assetPath) {
  const absolute = buildAssetUrl(assetPath);
  return fetch(absolute).then((res) => res.arrayBuffer());
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

function solveHomography(sourcePoints, destPoints) {
  if (sourcePoints.length !== destPoints.length) {
    throw new Error('Point mismatch');
  }
  const n = sourcePoints.length;
  const A = [];
  const b = [];
  for (let i = 0; i < n; i++) {
    const { x, y } = sourcePoints[i];
    const { x: u, y: v } = destPoints[i];
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }
  const h = gaussianSolve(A, b);
  return [
    h[0],
    h[1],
    h[2],
    h[3],
    h[4],
    h[5],
    h[6],
    h[7],
    1
  ];
}

function gaussianSolve(A, b) {
  const rows = A.length;
  const cols = A[0].length;
  const matrix = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < cols; col++) {
    let pivot = col;
    for (let row = col + 1; row < rows; row++) {
      if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) {
        pivot = row;
      }
    }
    if (Math.abs(matrix[pivot][col]) < 1e-10) {
      throw new Error('Matrix is singular');
    }
    [matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]];
    const pivotValue = matrix[col][col];
    for (let j = col; j <= cols; j++) {
      matrix[col][j] /= pivotValue;
    }
    for (let row = 0; row < rows; row++) {
      if (row === col) {
        continue;
      }
      const factor = matrix[row][col];
      for (let j = col; j <= cols; j++) {
        matrix[row][j] -= factor * matrix[col][j];
      }
    }
  }
  return matrix.map((row) => row[cols]);
}

function invertHomography(matrix) {
  const [a, b, c, d, e, f, g, h, i] = matrix;
  const det =
    a * (e * i - f * h) -
    b * (d * i - f * g) +
    c * (d * h - e * g);
  if (Math.abs(det) < 1e-10) {
    throw new Error('Homography not invertible');
  }
  const invDet = 1 / det;
  return [
    (e * i - f * h) * invDet,
    (c * h - b * i) * invDet,
    (b * f - c * e) * invDet,
    (f * g - d * i) * invDet,
    (a * i - c * g) * invDet,
    (c * d - a * f) * invDet,
    (d * h - e * g) * invDet,
    (b * g - a * h) * invDet,
    (a * e - b * d) * invDet
  ];
}

function applyHomography(matrix, point) {
  const [a, b, c, d, e, f, g, h, i] = matrix;
  const denom = g * point.x + h * point.y + i;
  return {
    x: (a * point.x + b * point.y + c) / denom,
    y: (d * point.x + e * point.y + f) / denom
  };
}

function sampleBilinear(source, width, height, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const dx = x - x0;
  const dy = y - y0;
  const offset = (x0 + y0 * width) * 4;
  const offsetX = (x1 + y0 * width) * 4;
  const offsetY = (x0 + y1 * width) * 4;
  const offsetXY = (x1 + y1 * width) * 4;
  const result = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const top = source[offset + i] * (1 - dx) + source[offsetX + i] * dx;
    const bottom = source[offsetY + i] * (1 - dx) + source[offsetXY + i] * dx;
    result[i] = top * (1 - dy) + bottom * dy;
  }
  return result;
}

function toGrayscale(imageData) {
  const gray = new Float32Array(imageData.width * imageData.height);
  const data = imageData.data;
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
  }
  return { data: gray, width: imageData.width, height: imageData.height };
}

function applyGaussian(gray, width, height, radius) {
  if (radius <= 0) {
    return gray.data;
  }
  const kernel = buildGaussianKernel(radius);
  const tmp = new Float32Array(width * height);
  const output = new Float32Array(width * height);
  convolve1D(gray.data, tmp, width, height, kernel, true);
  convolve1D(tmp, output, width, height, kernel, false);
  return output;
}

function buildGaussianKernel(radius) {
  const sigma = radius;
  const size = Math.max(3, radius * 2 + 1);
  const kernel = [];
  const center = Math.floor(size / 2);
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - center;
    const value = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernel.push(value);
    sum += value;
  }
  return kernel.map((v) => v / sum);
}

function convolve1D(input, output, width, height, kernel, horizontal) {
  const half = Math.floor(kernel.length / 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -half; k <= half; k++) {
        const idx = horizontal ? clampIndex(x + k, width) : clampIndex(y + k, height);
        const sample = horizontal ? input[y * width + idx] : input[idx * width + x];
        sum += sample * kernel[k + half];
      }
      output[y * width + x] = sum;
    }
  }
}

function clampIndex(value, max) {
  if (value < 0) {
    return 0;
  }
  if (value >= max) {
    return max - 1;
  }
  return value;
}

function sobel(data, width, height) {
  const output = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tl = data[(y - 1) * width + (x - 1)];
      const tc = data[(y - 1) * width + x];
      const tr = data[(y - 1) * width + (x + 1)];
      const ml = data[y * width + (x - 1)];
      const mr = data[y * width + (x + 1)];
      const bl = data[(y + 1) * width + (x - 1)];
      const bc = data[(y + 1) * width + x];
      const br = data[(y + 1) * width + (x + 1)];
      const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      output[y * width + x] = magnitude / 255;
    }
  }
  return output;
}

function applyThreshold(field, threshold) {
  const binary = new Uint8Array(field.length);
  for (let i = 0; i < field.length; i++) {
    binary[i] = field[i] >= threshold ? 1 : 0;
  }
  return binary;
}

function morphologicalClosing(field, width, height, iterations) {
  if (iterations <= 0) {
    return field;
  }
  let current = field;
  for (let i = 0; i < iterations; i++) {
    current = dilate(current, width, height);
  }
  for (let i = 0; i < iterations; i++) {
    current = erode(current, width, height);
  }
  return current;
}

function dilate(field, width, height) {
  const output = new Uint8Array(field.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
            if (field[ny * width + nx]) {
              value = 1;
            }
          }
        }
      }
      output[y * width + x] = value;
    }
  }
  return output;
}

function erode(field, width, height) {
  const output = new Uint8Array(field.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 1;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !field[ny * width + nx]) {
            value = 0;
          }
        }
      }
      output[y * width + x] = value;
    }
  }
  return output;
}

function traceContours(binary, width, height, mmPerPx) {
  const segments = [];
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const idx = y * width + x;
      const a = binary[idx];
      const b = binary[idx + 1];
      const c = binary[idx + width + 1];
      const d = binary[idx + width];
      const squareIndex = (a << 0) | (b << 1) | (c << 2) | (d << 3);
      const cellSegments = marchingCase(squareIndex, x, y, mmPerPx);
      segments.push(...cellSegments);
    }
  }
  return linkSegments(segments);
}

function marchingCase(caseIndex, x, y, scale) {
  const left = { x: x * scale, y: (y + 0.5) * scale };
  const right = { x: (x + 1) * scale, y: (y + 0.5) * scale };
  const top = { x: (x + 0.5) * scale, y: y * scale };
  const bottom = { x: (x + 0.5) * scale, y: (y + 1) * scale };
  switch (caseIndex) {
    case 0:
    case 15:
      return [];
    case 1:
    case 14:
      return [{ start: left, end: bottom }];
    case 2:
    case 13:
      return [{ start: bottom, end: right }];
    case 3:
    case 12:
      return [{ start: left, end: right }];
    case 4:
    case 11:
      return [{ start: top, end: right }];
    case 5:
      return [
        { start: top, end: left },
        { start: bottom, end: right }
      ];
    case 10:
      return [
        { start: left, end: bottom },
        { start: top, end: right }
      ];
    case 6:
    case 9:
      return [{ start: top, end: bottom }];
    case 7:
    case 8:
      return [{ start: top, end: left }];
    default:
      return [];
  }
}

function linkSegments(segments) {
  const paths = [];
  const lookup = new Map();
  const precision = 1e-3;
  const key = (point) => `${Math.round(point.x / precision) * precision},${Math.round(point.y / precision) * precision}`;
  segments.forEach((segment) => {
    const startKey = key(segment.start);
    const endKey = key(segment.end);
    if (!lookup.has(startKey)) {
      lookup.set(startKey, []);
    }
    if (!lookup.has(endKey)) {
      lookup.set(endKey, []);
    }
    lookup.get(startKey).push({ to: segment.end, start: segment.start });
    lookup.get(endKey).push({ to: segment.start, start: segment.end });
  });
  const visited = new Set();
  lookup.forEach((edges, startKey) => {
    edges.forEach((edge) => {
      const segmentKey = `${key(edge.start)}->${key(edge.to)}`;
      if (visited.has(segmentKey)) {
        return;
      }
      const path = [];
      let current = edge.start;
      let currentKey = key(current);
      path.push(current);
      visited.add(segmentKey);
      let next = edge.to;
      while (next && (next.x !== path[0].x || next.y !== path[0].y)) {
        path.push(next);
        const nextKey = key(next);
        const possibilities = lookup.get(nextKey) || [];
        const nextEdge = possibilities.find((candidate) => {
          const candidateKey = `${nextKey}->${key(candidate.to)}`;
          if (visited.has(candidateKey)) {
            return false;
          }
          return true;
        });
        if (!nextEdge) {
          break;
        }
        visited.add(`${nextKey}->${key(nextEdge.to)}`);
        currentKey = nextKey;
        next = nextEdge.to;
      }
      if (path.length > 2) {
        paths.push(simplifyPolygon(path));
      }
    });
  });
  return paths;
}

function simplifyPolygon(points, tolerance = 0.2) {
  if (points.length <= 3) {
    return points;
  }
  const sqTolerance = tolerance * tolerance;
  const simplified = [points[0]];
  let prevPoint = points[0];
  let prevSqDist = 0;
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    const dx = point.x - prevPoint.x;
    const dy = point.y - prevPoint.y;
    prevSqDist += dx * dx + dy * dy;
    if (prevSqDist > sqTolerance) {
      simplified.push(point);
      prevPoint = point;
      prevSqDist = 0;
    }
  }
  if (simplified[simplified.length - 1] !== points[points.length - 1]) {
    simplified.push(points[points.length - 1]);
  }
  return simplified;
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const { x: x1, y: y1 } = points[i];
    const { x: x2, y: y2 } = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function polygonPerimeter(points) {
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    perimeter += Math.hypot(next.x - current.x, next.y - current.y);
  }
  return perimeter;
}

function colorForId(id) {
  return `hsl(${(id * 54) % 360}, 75%, 55%)`;
}

function averageEdgeLength(corners = []) {
  if (!corners.length) {
    return 0;
  }
  let total = 0;
  for (let i = 0; i < corners.length; i++) {
    const current = corners[i];
    const next = corners[(i + 1) % corners.length];
    total += Math.hypot(current.x - next.x, current.y - next.y);
  }
  return total / corners.length;
}

function formatPoint(point) {
  if (!point) {
    return '—';
  }
  return `${Math.round(point.x)}, ${Math.round(point.y)}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function triggerDownload(blobLike, filename, mimeType) {
  const blob = blobLike instanceof Blob ? blobLike : new Blob([blobLike], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildAssetUrl(path) {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const url = new URL(normalizedBase, window.location.origin);
  return new URL(path.replace(/^\//, ''), url).href;
}

function mmToPoints(mm) {
  return (mm / 25.4) * 72;
}

function rgb256(r, g, b) {
  return rgb(r / 255, g / 255, b / 255);
}

function buildLayout() {
  const root = document.createElement('div');
  root.className = 'scan-lab-grid';

  const sheetCard = document.createElement('article');
  sheetCard.className = 'panel-card';
  sheetCard.innerHTML = `
    <header>
      <h2>1. Print the reference board</h2>
      <p>Select a paper size and download a PDF or SVG with tags fixed in each corner.</p>
    </header>
  `;

  const controls = document.createElement('div');
  controls.className = 'sheet-controls';

  const pageSelect = document.createElement('select');
  PAGE_SIZES.forEach((size) => {
    const option = document.createElement('option');
    option.value = size.id;
    option.textContent = size.label;
    pageSelect.appendChild(option);
  });

  const orientationToggle = document.createElement('select');
  orientationToggle.innerHTML = `
    <option value="portrait">Portrait</option>
    <option value="landscape">Landscape</option>
  `;

  const marginInput = document.createElement('input');
  marginInput.type = 'number';
  marginInput.min = 5;
  marginInput.max = 80;
  marginInput.step = 0.5;
  marginInput.placeholder = 'Margin (mm)';

  const tagSizeInput = document.createElement('input');
  tagSizeInput.type = 'number';
  tagSizeInput.min = 20;
  tagSizeInput.max = 90;
  tagSizeInput.step = 0.5;
  tagSizeInput.placeholder = 'Tag size (mm)';

  const resolutionInput = document.createElement('input');
  resolutionInput.type = 'number';
  resolutionInput.min = 2;
  resolutionInput.max = 12;
  resolutionInput.step = 0.1;
  resolutionInput.placeholder = 'Capture px/mm';

  controls.append(
    createField('Paper size', pageSelect),
    createField('Orientation', orientationToggle),
    createField('Margin (mm)', marginInput),
    createField('Tag size (mm)', tagSizeInput),
    createField('Scan resolution (px/mm)', resolutionInput)
  );

  const sheetPreview = document.createElement('canvas');
  sheetPreview.className = 'sheet-preview';

  const downloadRow = document.createElement('div');
  downloadRow.className = 'download-row';

  const downloadSvgButton = document.createElement('button');
  downloadSvgButton.type = 'button';
  downloadSvgButton.className = 'secondary-button';
  downloadSvgButton.textContent = 'Download SVG';

  const downloadPdfButton = document.createElement('button');
  downloadPdfButton.type = 'button';
  downloadPdfButton.className = 'primary-button';
  downloadPdfButton.textContent = 'Download PDF';

  downloadRow.append(downloadSvgButton, downloadPdfButton);

  const sheetSummary = document.createElement('div');
  sheetSummary.className = 'sheet-summary';

  sheetCard.append(controls, sheetPreview, downloadRow, sheetSummary);

  const captureCard = document.createElement('article');
  captureCard.className = 'panel-card';
  captureCard.innerHTML = `
    <header>
      <h2>2. Align the camera</h2>
      <p>Place the printed board flat, add your object, and keep all four AprilTags in view.</p>
    </header>
  `;

  const stage = document.createElement('div');
  stage.className = 'capture-stage';
  stage.dataset.state = 'idle';

  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;
  video.autoplay = true;

  const overlay = document.createElement('canvas');
  overlay.className = 'stage-overlay';

  const overlayMessage = document.createElement('p');
  overlayMessage.className = 'stage-message';
  overlayMessage.textContent = 'Enable the camera to detect the reference sheet.';

  const stageControls = document.createElement('div');
  stageControls.className = 'stage-controls';

  const cameraButton = document.createElement('button');
  cameraButton.type = 'button';
  cameraButton.className = 'primary-button';
  cameraButton.textContent = 'Enable camera';

  const captureButton = document.createElement('button');
  captureButton.type = 'button';
  captureButton.className = 'primary-button ghost';
  captureButton.textContent = 'Capture calibrated scan';
  captureButton.disabled = true;

  const resetScanButton = document.createElement('button');
  resetScanButton.type = 'button';
  resetScanButton.className = 'ghost-button';
  resetScanButton.textContent = 'Clear scan';

  stageControls.append(cameraButton, captureButton, resetScanButton);

  stage.append(video, overlay, overlayMessage);

  const chipRow = document.createElement('div');
  chipRow.className = 'chip-row';
  const cameraStatus = createStatusChip('Camera idle');
  const detectorStatus = createStatusChip('Detector not loaded');
  chipRow.append(cameraStatus.element, detectorStatus.element);

  const metrics = document.createElement('div');
  metrics.className = 'metrics';
  const tagMetric = createMetric('Tags in view', '0 tags');
  const fpsMetric = createMetric('Detection loop', '—');
  metrics.append(tagMetric.wrapper, fpsMetric.wrapper);

  const detectionsList = document.createElement('div');
  detectionsList.className = 'detections';
  detectionsList.dataset.state = 'empty';
  const emptyDetections = document.createElement('p');
  emptyDetections.className = 'empty';
  emptyDetections.textContent = 'Live tag IDs will appear here.';
  detectionsList.append(emptyDetections);

  const captureStatus = document.createElement('p');
  captureStatus.className = 'capture-status';
  captureStatus.textContent = 'No capture yet.';

  captureCard.append(stage, stageControls, chipRow, metrics, detectionsList, captureStatus);

  const processorCard = document.createElement('article');
  processorCard.className = 'panel-card';
  processorCard.dataset.state = 'empty';
  processorCard.innerHTML = `
    <header>
      <h2>3. Edge detect and export</h2>
      <p>Tune the thresholds until the outline snaps to your object.</p>
    </header>
  `;

  const resultCanvas = document.createElement('canvas');
  resultCanvas.className = 'result-canvas';
  const resultCtx = resultCanvas.getContext('2d');

  const sliders = document.createElement('div');
  sliders.className = 'slider-grid';

  const thresholdSlider = createSlider('Edge threshold', 10, 90, 28);
  const blurSlider = createSlider('Gaussian blur radius', 0, 6, 2);
  const closingSlider = createSlider('Morphological closing', 0, 4, 1);
  sliders.append(thresholdSlider.wrapper, blurSlider.wrapper, closingSlider.wrapper);

  const contourList = document.createElement('div');
  contourList.className = 'contour-list';
  contourList.textContent = 'Contours will appear once edges are detected.';

  const exportSummary = document.createElement('p');
  exportSummary.className = 'export-summary';
  exportSummary.textContent = 'Capture a scan to unlock exports.';

  const exportRow = document.createElement('div');
  exportRow.className = 'download-row';
  const exportSvgButton = document.createElement('button');
  exportSvgButton.type = 'button';
  exportSvgButton.className = 'secondary-button';
  exportSvgButton.textContent = 'Download SVG';
  exportSvgButton.disabled = true;

  const exportDxfButton = document.createElement('button');
  exportDxfButton.type = 'button';
  exportDxfButton.className = 'secondary-button';
  exportDxfButton.textContent = 'Download DXF';
  exportDxfButton.disabled = true;

  const exportPdfButton = document.createElement('button');
  exportPdfButton.type = 'button';
  exportPdfButton.className = 'primary-button';
  exportPdfButton.textContent = 'Download PDF';
  exportPdfButton.disabled = true;

  exportRow.append(exportSvgButton, exportDxfButton, exportPdfButton);

  processorCard.append(resultCanvas, sliders, contourList, exportSummary, exportRow);

  root.append(sheetCard, captureCard, processorCard);

  return {
    root,
    sheetPreview,
    pageSelect,
    orientationToggle,
    marginInput,
    tagSizeInput,
    resolutionInput,
    downloadSvgButton,
    downloadPdfButton,
    sheetSummary,
    stage,
    video,
    overlay,
    overlayMessage,
    cameraButton,
    captureButton,
    resetScanButton,
    cameraStatus,
    detectorStatus,
    tagMetric: tagMetric.value,
    fpsMetric: fpsMetric.value,
    detectionsList,
    emptyDetections,
    captureStatus,
    panelScan: processorCard,
    resultCanvas,
    resultCtx,
    thresholdSlider: thresholdSlider.input,
    thresholdValue: thresholdSlider.value,
    blurSlider: blurSlider.input,
    blurValue: blurSlider.value,
    closingSlider: closingSlider.input,
    closingValue: closingSlider.value,
    contourList,
    exportSummary,
    exportSvgButton,
    exportDxfButton,
    exportPdfButton
  };
}

function createField(label, control) {
  const wrapper = document.createElement('label');
  const span = document.createElement('span');
  span.textContent = label;
  wrapper.append(span, control);
  return wrapper;
}

function createStatusChip(initial) {
  const element = document.createElement('span');
  element.className = 'status-chip';
  element.textContent = initial;
  return {
    element,
    set(text, tone = 'neutral') {
      element.textContent = text;
      element.dataset.tone = tone;
    }
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

function createSlider(label, min, max, value) {
  const wrapper = document.createElement('label');
  wrapper.className = 'slider-field';
  const span = document.createElement('span');
  span.textContent = label;
  const indicator = document.createElement('strong');
  indicator.textContent = value;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = min;
  input.max = max;
  input.value = value;
  wrapper.append(span, indicator, input);
  return { wrapper, input, value: indicator };
}

drawSheetPreview();
