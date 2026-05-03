import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const ACCENT = '#00d4aa';

const FFT_SIZE = 2048;
const HEATMAP_COLS = 480;
const HEATMAP_FREQ_ROWS = 256;
const GRAPH_MAX_BINS = 1024;
const AVG_ALPHA = 0.92;

const MIN_DB = -100;
const MAX_DB = 0;

const { body } = createAppShell({
  title: 'Audio Spectrum Analyser',
  description:
    'Microphone FFT: scrolling spectrum heatmap, live spectrum with max and smoothed average, and a single-frequency meter. Choose dB or more intuitive display units.',
  accent: ACCENT
});

const root = document.createElement('div');
root.className = 'spectrum-app';
body.appendChild(root);

const toolbar = document.createElement('div');
toolbar.className = 'toolbar';

const startBtn = document.createElement('button');
startBtn.type = 'button';
startBtn.className = 'primary-button';
startBtn.textContent = 'Start microphone';

const stopBtn = document.createElement('button');
stopBtn.type = 'button';
stopBtn.className = 'ghost-button';
stopBtn.textContent = 'Stop';
stopBtn.disabled = true;

const resetBtn = document.createElement('button');
resetBtn.type = 'button';
resetBtn.className = 'ghost-button';
resetBtn.textContent = 'Reset max & averages';
resetBtn.disabled = true;

const unitGroup = document.createElement('div');
unitGroup.className = 'toolbar-group';
unitGroup.innerHTML = '<label for="unit-select">Display units</label>';
const unitSelect = document.createElement('select');
unitSelect.id = 'unit-select';
unitSelect.innerHTML = `
  <option value="db">dB (full scale)</option>
  <option value="percent">% full scale</option>
  <option value="linear">Linear (0–1)</option>
`;
unitGroup.appendChild(unitSelect);

toolbar.appendChild(startBtn);
toolbar.appendChild(stopBtn);
toolbar.appendChild(resetBtn);
toolbar.appendChild(unitGroup);

const statusText = document.createElement('p');
statusText.className = 'status-text';
statusText.textContent = 'Idle. Press Start to capture from your microphone.';

root.appendChild(toolbar);
root.appendChild(statusText);

function makePanel(title, hint) {
  const block = document.createElement('section');
  block.className = 'panel-block';
  const h2 = document.createElement('h2');
  h2.textContent = title;
  block.appendChild(h2);
  if (hint) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = hint;
    block.appendChild(p);
  }
  return block;
}

const heatmapPanel = makePanel(
  'Spectrum heatmap (time scrolls left)',
  'Each column is one analysis frame. Frequency runs bottom (low) to top (high).'
);
const heatmapWrap = document.createElement('div');
heatmapWrap.className = 'canvas-wrap';
const heatmapCanvas = document.createElement('canvas');
heatmapCanvas.width = HEATMAP_COLS;
heatmapCanvas.height = HEATMAP_FREQ_ROWS;
heatmapWrap.appendChild(heatmapCanvas);
const heatmapLegend = document.createElement('div');
heatmapLegend.className = 'canvas-legend';
heatmapLegend.innerHTML = '<span>Older ←</span><span>→ Newer</span>';
heatmapPanel.appendChild(heatmapWrap);
heatmapPanel.appendChild(heatmapLegend);
root.appendChild(heatmapPanel);

const graphPanel = makePanel(
  'Current spectrum (FFT)',
  'Green: live. Amber: session max. Violet: exponential average (reset clears max and averages).'
);
const graphWrap = document.createElement('div');
graphWrap.className = 'canvas-wrap';
const graphCanvas = document.createElement('canvas');
graphCanvas.width = 900;
graphCanvas.height = 280;
graphWrap.appendChild(graphCanvas);
const graphLegend = document.createElement('div');
graphLegend.className = 'canvas-legend';
graphLegend.innerHTML = '<span id="graph-freq-low">0 Hz</span><span id="graph-freq-high">—</span>';
graphPanel.appendChild(graphWrap);
graphPanel.appendChild(graphLegend);
root.appendChild(graphPanel);

const binPanel = makePanel(
  'Single frequency',
  'Enter a target frequency in Hz. Live and averaged levels use the nearest FFT bin (same units as above).'
);
const binRow = document.createElement('div');
binRow.className = 'readout-row';
binRow.innerHTML = `
  <div class="toolbar-group">
    <label for="target-hz">Frequency (Hz)</label>
    <input id="target-hz" type="number" min="1" step="0.1" value="1000" />
  </div>
`;
const readouts = document.createElement('div');
readouts.className = 'bin-readout';
readouts.innerHTML = `
  <div class="readout-card">
    <p class="label">Live at bin</p>
    <p class="value" id="bin-live">—</p>
  </div>
  <div class="readout-card">
    <p class="label">Average at bin</p>
    <p class="value" id="bin-avg">—</p>
  </div>
  <div class="readout-card">
    <p class="label">Nearest bin</p>
    <p class="value" id="bin-index">—</p>
  </div>
`;
binPanel.appendChild(binRow);
binPanel.appendChild(readouts);
root.appendChild(binPanel);

const targetHzInput = binRow.querySelector('#target-hz');
const elBinLive = readouts.querySelector('#bin-live');
const elBinAvg = readouts.querySelector('#bin-avg');
const elBinIndex = readouts.querySelector('#bin-index');
const elGraphLow = graphLegend.querySelector('#graph-freq-low');
const elGraphHigh = graphLegend.querySelector('#graph-freq-high');

let audioCtx = null;
let mediaStream = null;
let sourceNode = null;
let analyser = null;
let rafId = null;

const freqData = new Float32Array(FFT_SIZE / 2);
const maxSpectrum = new Float32Array(FFT_SIZE / 2);
const avgSpectrum = new Float32Array(FFT_SIZE / 2);
let maxInitialized = false;

const heatCtx = heatmapCanvas.getContext('2d', { alpha: false });
const graphCtx = graphCanvas.getContext('2d', { alpha: false });

function dbToDisplay(db, unit) {
  const clamped = Math.min(MAX_DB, Math.max(MIN_DB, db));
  if (unit === 'db') return { text: `${clamped.toFixed(1)} dBFS`, numeric: clamped };
  const t = (clamped - MIN_DB) / (MAX_DB - MIN_DB);
  if (unit === 'percent') return { text: `${(t * 100).toFixed(1)} %`, numeric: t * 100 };
  return { text: t.toFixed(3), numeric: t };
}

function magnitudeToHeatColor(db) {
  const t = (Math.min(MAX_DB, Math.max(MIN_DB, db)) - MIN_DB) / (MAX_DB - MIN_DB);
  const hue = (1 - t) * 0.78;
  const sat = 0.85 + t * 0.1;
  const light = 0.12 + t * 0.58;
  return hslToRgb(hue, sat, light);
}

function hslToRgb(h, s, l) {
  let r;
  let g;
  let b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function resetPeaks() {
  maxInitialized = false;
  for (let i = 0; i < maxSpectrum.length; i++) {
    maxSpectrum[i] = MIN_DB;
    avgSpectrum[i] = MIN_DB;
  }
}

function shiftHeatmap() {
  const w = heatmapCanvas.width;
  const h = heatmapCanvas.height;
  const imageData = heatCtx.getImageData(1, 0, w - 1, h);
  heatCtx.putImageData(imageData, 0, 0);
  heatCtx.fillStyle = '#05060d';
  heatCtx.fillRect(w - 1, 0, 1, h);
}

function drawHeatmapColumn(sampleRate) {
  const nyquist = sampleRate / 2;
  const binCount = freqData.length;
  const w = heatmapCanvas.width;
  const h = heatmapCanvas.height;
  const imageData = heatCtx.createImageData(1, h);
  const data = imageData.data;

  for (let row = 0; row < h; row++) {
    const f = (row / (h - 1)) * nyquist;
    const binFloat = (f / nyquist) * (binCount - 1);
    const i0 = Math.floor(binFloat);
    const i1 = Math.min(binCount - 1, i0 + 1);
    const frac = binFloat - i0;
    const db = freqData[i0] * (1 - frac) + freqData[i1] * frac;
    const [r, g, b] = magnitudeToHeatColor(db);
    const o = (h - 1 - row) * 4;
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = 255;
  }
  heatCtx.putImageData(imageData, w - 1, 0);
}

function drawGraph(sampleRate, unit) {
  const w = graphCanvas.width;
  const h = graphCanvas.height;
  const padL = 48;
  const padR = 16;
  const padT = 14;
  const padB = 36;
  const gw = w - padL - padR;
  const gh = h - padT - padB;
  const binCount = freqData.length;
  const nyquist = sampleRate / 2;

  graphCtx.fillStyle = '#05060d';
  graphCtx.fillRect(0, 0, w, h);

  graphCtx.strokeStyle = 'rgba(255,255,255,0.08)';
  graphCtx.lineWidth = 1;
  const gridLines = 5;
  for (let g = 0; g <= gridLines; g++) {
    const y = padT + (gh * g) / gridLines;
    graphCtx.beginPath();
    graphCtx.moveTo(padL, y);
    graphCtx.lineTo(padL + gw, y);
    graphCtx.stroke();
  }

  function yForDb(db) {
    const t = (Math.min(MAX_DB, Math.max(MIN_DB, db)) - MIN_DB) / (MAX_DB - MIN_DB);
    return padT + gh * (1 - t);
  }

  graphCtx.fillStyle = 'rgba(247,245,255,0.45)';
  graphCtx.font = '11px Plus Jakarta Sans, sans-serif';
  for (let g = 0; g <= gridLines; g++) {
    const db = MIN_DB + ((MAX_DB - MIN_DB) * (gridLines - g)) / gridLines;
    const y = yForDb(db);
    const label = unit === 'db' ? `${db}` : dbToDisplay(db, unit).text;
    graphCtx.fillText(label, 6, y + 4);
  }

  const displayBins = Math.min(binCount, GRAPH_MAX_BINS);

  function trace(getter, color, lineWidth) {
    graphCtx.beginPath();
    graphCtx.strokeStyle = color;
    graphCtx.lineWidth = lineWidth;
    for (let x = 0; x < gw; x++) {
      const bin = Math.floor((x / (gw - 1)) * (displayBins - 1));
      const db = getter(bin);
      const y = yForDb(db);
      if (x === 0) graphCtx.moveTo(padL + x, y);
      else graphCtx.lineTo(padL + x, y);
    }
    graphCtx.stroke();
  }

  trace((b) => maxSpectrum[b], 'rgba(255, 180, 90, 0.85)', 1.5);
  trace((b) => avgSpectrum[b], 'rgba(180, 140, 255, 0.9)', 1.5);
  trace((b) => freqData[b], 'rgba(0, 212, 170, 0.95)', 2);

  graphCtx.fillStyle = 'rgba(247,245,255,0.5)';
  graphCtx.font = '12px Plus Jakarta Sans, sans-serif';
  graphCtx.fillText('Hz →', padL + gw - 28, h - 10);

  elGraphLow.textContent = `0 Hz`;
  elGraphHigh.textContent = `${Math.round(nyquist)} Hz`;
}

function hzToBin(hz, sampleRate) {
  const nyquist = sampleRate / 2;
  const clamped = Math.max(0, Math.min(nyquist, hz));
  const binCount = freqData.length;
  return Math.round((clamped / nyquist) * (binCount - 1));
}

function updateBinReadouts(sampleRate, unit) {
  const hz = Number.parseFloat(targetHzInput.value);
  if (!Number.isFinite(hz) || hz <= 0) {
    elBinLive.textContent = '—';
    elBinAvg.textContent = '—';
    elBinIndex.textContent = '—';
    return;
  }
  const bin = hzToBin(hz, sampleRate);
  const actualHz = (bin / (freqData.length - 1)) * (sampleRate / 2);
  elBinIndex.textContent = `${bin} (${actualHz.toFixed(1)} Hz)`;
  elBinLive.textContent = dbToDisplay(freqData[bin], unit).text;
  elBinAvg.textContent = dbToDisplay(avgSpectrum[bin], unit).text;
}

function tick() {
  if (!analyser) return;
  analyser.getFloatFrequencyData(freqData);

  const sr = audioCtx.sampleRate;

  if (!maxInitialized) {
    for (let i = 0; i < freqData.length; i++) {
      maxSpectrum[i] = freqData[i];
      avgSpectrum[i] = freqData[i];
    }
    maxInitialized = true;
  } else {
    for (let i = 0; i < freqData.length; i++) {
      if (freqData[i] > maxSpectrum[i]) maxSpectrum[i] = freqData[i];
      avgSpectrum[i] = AVG_ALPHA * avgSpectrum[i] + (1 - AVG_ALPHA) * freqData[i];
    }
  }

  shiftHeatmap();
  drawHeatmapColumn(sr);

  const unit = unitSelect.value;
  drawGraph(sr, unit);
  updateBinReadouts(sr, unit);

  rafId = requestAnimationFrame(tick);
}

async function start() {
  statusText.textContent = 'Requesting microphone…';
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (e) {
    statusText.textContent = `Microphone blocked or unavailable: ${e?.message || e}`;
    return;
  }

  audioCtx = new AudioContext();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0.35;
  sourceNode = audioCtx.createMediaStreamSource(mediaStream);
  sourceNode.connect(analyser);

  resetPeaks();
  heatCtx.fillStyle = '#05060d';
  heatCtx.fillRect(0, 0, heatmapCanvas.width, heatmapCanvas.height);

  startBtn.disabled = true;
  stopBtn.disabled = false;
  resetBtn.disabled = false;
  statusText.textContent = 'Listening. Levels are relative (not calibrated SPL).';

  rafId = requestAnimationFrame(tick);
}

function stop() {
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (sourceNode) {
    try {
      sourceNode.disconnect();
    } catch {
      /* ignore */
    }
    sourceNode = null;
  }
  if (analyser) {
    try {
      analyser.disconnect();
    } catch {
      /* ignore */
    }
    analyser = null;
  }
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
  if (mediaStream) {
    for (const t of mediaStream.getTracks()) t.stop();
    mediaStream = null;
  }

  startBtn.disabled = false;
  stopBtn.disabled = true;
  resetBtn.disabled = true;
  statusText.textContent = 'Stopped.';
}

startBtn.addEventListener('click', () => {
  void start();
});
stopBtn.addEventListener('click', () => {
  stop();
});
resetBtn.addEventListener('click', () => {
  resetPeaks();
});

unitSelect.addEventListener('change', () => {
  if (audioCtx && analyser) {
    const unit = unitSelect.value;
    drawGraph(audioCtx.sampleRate, unit);
    updateBinReadouts(audioCtx.sampleRate, unit);
  }
});

targetHzInput.addEventListener('input', () => {
  if (audioCtx && analyser) updateBinReadouts(audioCtx.sampleRate, unitSelect.value);
});

window.addEventListener('beforeunload', () => {
  stop();
});
