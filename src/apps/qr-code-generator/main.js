import { createAppShell } from '../shared/appShell.js';
import './styles.css';
import QRCode from 'qrcode';

const ECC_LEVELS = [
  { key: 'L', label: 'Low', blurb: 'Fast scans, ~7% recovery', accent: '#6df6b5' },
  { key: 'M', label: 'Medium', blurb: 'Balanced, ~15% recovery', accent: '#60ddff' },
  { key: 'Q', label: 'Quartile', blurb: 'Logo-friendly, ~25% recovery', accent: '#9f8cff' },
  { key: 'H', label: 'High', blurb: 'Max safety, ~30% recovery', accent: '#ff9adf' }
];

const QUIET_ZONE_MODULES = 4;
const DEFAULT_TEXT = 'https://example.com';
const MODULE_MM = 0.4; // 0.4mm per module is a common print guideline
const FRAME_CLEAR_RATIO = 0.3;

const { body } = createAppShell({
  title: 'Local QR Studio',
  description:
    'Generate QR codes entirely in-browser with instant previews. Tweak redundancy, export as PNG or SVG, and reveal advanced controls when you need them.',
  accent: '#64d7ff'
});

const state = {
  text: DEFAULT_TEXT,
  format: 'png',
  background: 'transparent',
  pixelsPerModule: 9,
  frame: false,
  debounce: null,
  loading: false,
  token: 0,
  outputs: new Map()
};

const ui = buildUI();
body.append(ui.container, ui.previewGrid, ui.status);

triggerRender();

function buildUI() {
  const container = document.createElement('div');
  container.className = 'qr-studio-controls';

  const field = document.createElement('label');
  field.className = 'qr-field';
  field.innerHTML = `
    <span class="field-label">Text or URL</span>
    <textarea rows="3" spellcheck="false" placeholder="Paste a link or type any text…"></textarea>
    <p class="field-hint">Updates after a short pause so you can keep typing without a redraw.</p>
  `;

  const textarea = field.querySelector('textarea');
  textarea.value = state.text;
  textarea.addEventListener('input', () => {
    setLoading(true);
    if (state.debounce) {
      clearTimeout(state.debounce);
    }
    state.debounce = setTimeout(() => {
      state.text = textarea.value;
      triggerRender();
    }, 420);
  });

  const formatGroup = document.createElement('fieldset');
  formatGroup.className = 'qr-format-group';
  formatGroup.innerHTML = `
    <legend>Download format</legend>
    <label class="chip">
      <input type="radio" name="qr-format" value="png" checked />
      <span>PNG</span>
    </label>
    <label class="chip">
      <input type="radio" name="qr-format" value="svg" />
      <span>SVG</span>
    </label>
  `;

  formatGroup.addEventListener('change', (event) => {
    if (event.target instanceof HTMLInputElement && event.target.name === 'qr-format') {
      state.format = event.target.value;
      reflectFormat();
      triggerRender();
    }
  });

  const loadingBanner = document.createElement('div');
  loadingBanner.className = 'qr-loading';
  loadingBanner.innerHTML = `
    <span class="spinner" aria-hidden="true"></span>
    <span class="loading-text">Regenerating previews…</span>
  `;
  loadingBanner.hidden = true;

  const advanced = buildAdvancedControls();

  container.append(field, formatGroup, loadingBanner, advanced);

  const previewGrid = document.createElement('div');
  previewGrid.className = 'qr-preview-grid';

  const previewCards = new Map();
  ECC_LEVELS.forEach((level) => {
    const card = document.createElement('article');
    card.className = 'qr-preview-card';
    card.tabIndex = 0;
    card.dataset.level = level.key;
    card.style.setProperty('--card-accent', level.accent);

    const header = document.createElement('header');
    header.className = 'preview-header';
    header.innerHTML = `
      <span class="preview-title">${level.label}</span>
      <span class="preview-sub">${level.blurb}</span>
    `;

    const canvas = document.createElement('canvas');
    canvas.width = 0;
    canvas.height = 0;
    canvas.className = 'qr-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${level.label} redundancy QR preview`);

    const stats = document.createElement('dl');
    stats.className = 'qr-stats';
    stats.innerHTML = `
      <div>
        <dt>Segments</dt>
        <dd data-stat="segments">–</dd>
      </div>
      <div>
        <dt>Version</dt>
        <dd data-stat="version">–</dd>
      </div>
      <div>
        <dt>Min print</dt>
        <dd data-stat="print">–</dd>
      </div>
    `;

    const footer = document.createElement('footer');
    footer.className = 'preview-footer';
    footer.innerHTML = `
      <span class="download-hint">Click to download</span>
    `;

    card.append(header, canvas, stats, footer);
    previewGrid.append(card);

    card.addEventListener('click', () => downloadLevel(level.key));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        downloadLevel(level.key);
      }
    });

    previewCards.set(level.key, {
      card,
      canvas,
      stats: {
        segments: stats.querySelector('[data-stat="segments"]'),
        version: stats.querySelector('[data-stat="version"]'),
        print: stats.querySelector('[data-stat="print"]')
      }
    });
  });

  previewGrid.dataset.state = 'idle';

  const status = document.createElement('div');
  status.className = 'qr-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  reflectFormat();

  return { container, previewGrid, loadingBanner, previewCards, status };

  function reflectFormat() {
    previewGrid.querySelectorAll('.download-hint').forEach((hint) => {
      hint.textContent = `Click to download ${state.format.toUpperCase()}`;
    });
  }

  function buildAdvancedControls() {
    const details = document.createElement('details');
    details.className = 'qr-advanced';

    const summary = document.createElement('summary');
    summary.textContent = 'Advanced settings';

    const backgroundField = document.createElement('label');
    backgroundField.className = 'qr-field';
    backgroundField.innerHTML = `
      <span class="field-label">Background</span>
      <div class="segmented">
        <label>
          <input type="radio" name="qr-bg" value="transparent" checked />
          <span>Transparent</span>
        </label>
        <label>
          <input type="radio" name="qr-bg" value="white" />
          <span>White</span>
        </label>
      </div>
    `;

    backgroundField.addEventListener('change', (event) => {
      if (event.target instanceof HTMLInputElement && event.target.name === 'qr-bg') {
        state.background = event.target.value;
        triggerRender();
      }
    });

    const pixelField = document.createElement('label');
    pixelField.className = 'qr-field slider-field';
    pixelField.innerHTML = `
      <span class="field-label">Pixels per module (PNG)</span>
      <div class="range-row">
        <input type="range" min="4" max="24" value="${state.pixelsPerModule}" step="1" />
        <span class="range-value">${state.pixelsPerModule}px</span>
      </div>
    `;

    const pixelInput = pixelField.querySelector('input[type="range"]');
    const pixelValue = pixelField.querySelector('.range-value');

    pixelInput.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      state.pixelsPerModule = value;
      pixelValue.textContent = `${value}px`;
      setLoading(true);
      if (state.debounce) {
        clearTimeout(state.debounce);
      }
      state.debounce = setTimeout(() => {
        triggerRender();
      }, 220);
    });

    const frameField = document.createElement('label');
    frameField.className = 'qr-field toggle-field';
    frameField.innerHTML = `
      <span class="field-label">Frame version</span>
      <label class="switch">
        <input type="checkbox" />
        <span class="track"></span>
      </label>
      <p class="field-hint">Reserve a centred window for logos. Combines best with Quartile or High redundancy.</p>
    `;

    const frameToggle = frameField.querySelector('input[type="checkbox"]');
    frameToggle.addEventListener('change', (event) => {
      state.frame = event.target.checked;
      triggerRender();
    });

    details.append(summary, backgroundField, pixelField, frameField);
    return details;
  }
}

function setLoading(isLoading) {
  state.loading = isLoading;
  ui.loadingBanner.hidden = !isLoading;
  ui.previewGrid.dataset.state = isLoading ? 'pending' : 'ready';
}

function triggerRender() {
  if (state.debounce) {
    clearTimeout(state.debounce);
    state.debounce = null;
  }

  const token = ++state.token;
  setLoading(true);
  generatePreviews(token)
    .then((result) => {
      if (token === state.token) {
        setLoading(false);
        if (result?.empty) {
          ui.previewGrid.dataset.state = 'idle';
          return;
        }
        if (result?.hasErrors) {
          ui.previewGrid.dataset.state = 'error';
          ui.status.textContent = 'Some tiers could not encode this much data. Try a shorter message or lower redundancy.';
        } else {
          ui.previewGrid.dataset.state = 'ready';
          ui.status.textContent = `Updated ${new Date().toLocaleTimeString()} • ${state.format.toUpperCase()} ready`;
        }
      }
    })
    .catch((error) => {
      console.error(error);
      if (token === state.token) {
        setLoading(false);
        ui.status.textContent = 'Oops, that input is too large for a QR code.';
        showErrorFeedback();
      }
    });
}

async function generatePreviews(token) {
  const text = state.text.trim();
  if (!text) {
    ui.status.textContent = 'Enter text to generate QR codes.';
    clearPreviews();
    return { empty: true, hasErrors: false };
  }

  state.outputs.clear();
  const errors = [];

  const promises = ECC_LEVELS.map(async (level) => {
    const preview = ui.previewCards.get(level.key);
    if (!preview) return;

    preview.card.classList.add('is-working');
    const hint = preview.card.querySelector('.download-hint');
    if (hint) {
      hint.textContent = `Click to download ${state.format.toUpperCase()}`;
    }
    try {
      const qr = QRCode.create(text, {
        errorCorrectionLevel: level.key
      });

      if (token !== state.token) {
        return;
      }

      await renderToCanvas(preview.canvas, qr);
      if (token !== state.token) {
        return;
      }

      const metadata = extractStats(qr);
      preview.stats.segments.textContent = metadata.segments;
      preview.stats.version.textContent = metadata.version;
      preview.stats.print.textContent = metadata.printSize;

      const assets = await buildAssets(qr, preview.canvas);
      state.outputs.set(level.key, assets);
      preview.card.dataset.ready = 'true';
      preview.card.title = `Download ${state.format.toUpperCase()} (${level.label})`;
    } catch (error) {
      console.error(error);
      preview.stats.segments.textContent = 'Err';
      preview.stats.version.textContent = '—';
      preview.stats.print.textContent = '—';
      preview.card.dataset.ready = 'false';
      if (hint) {
        hint.textContent = 'Input too long for this tier';
      }
      errors.push(error);
    } finally {
      preview.card.classList.remove('is-working');
    }
  });

  await Promise.all(promises);

  return { empty: false, hasErrors: errors.length > 0 };
}

function clearPreviews() {
  state.outputs.clear();
  ui.previewCards.forEach((preview) => {
    preview.canvas.getContext('2d')?.clearRect(0, 0, preview.canvas.width, preview.canvas.height);
    preview.stats.segments.textContent = '—';
    preview.stats.version.textContent = '—';
    preview.stats.print.textContent = '—';
    preview.card.dataset.ready = 'false';
  });
}

async function renderToCanvas(canvas, qr) {
  const matrix = qr.modules;
  const moduleCount = matrix.size;
  const margin = QUIET_ZONE_MODULES;
  const scale = Math.max(1, state.pixelsPerModule);
  const size = (moduleCount + margin * 2) * scale;

  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context unavailable');
  }

  ctx.imageSmoothingEnabled = false;
  if (state.background === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
  } else {
    ctx.clearRect(0, 0, size, size);
  }

  ctx.fillStyle = '#0b0c10';
  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!matrix.get(row, col)) continue;
      const x = (col + margin) * scale;
      const y = (row + margin) * scale;
      ctx.fillRect(x, y, scale, scale);
    }
  }

  if (state.frame) {
    const frameSize = Math.max(6, Math.floor(moduleCount * FRAME_CLEAR_RATIO));
    const start = Math.floor((moduleCount - frameSize) / 2);
    const px = (start + margin) * scale;
    const dimension = frameSize * scale;
    ctx.fillStyle = state.background === 'transparent' ? 'rgba(255, 255, 255, 0.92)' : '#ffffff';
    ctx.fillRect(px, px, dimension, dimension);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.lineWidth = Math.max(1, Math.round(scale / 2));
    ctx.strokeRect(px + ctx.lineWidth / 2, px + ctx.lineWidth / 2, dimension - ctx.lineWidth, dimension - ctx.lineWidth);
  }

  return canvas;
}

function extractStats(qr) {
  const moduleCount = qr.modules.size;
  const segments = qr.segments || [];
  const segmentSummary = segments.length
    ? `${segments.length} (${segments.map((seg) => seg.mode?.id || 'Byte').join(', ')})`
    : '1 (Byte)';
  const totalModules = moduleCount + QUIET_ZONE_MODULES * 2;
  const minPrint = Math.round((totalModules * MODULE_MM + (state.frame ? 1.5 : 0)) * 10) / 10;
  const versionLabel = `v${qr.version} (${moduleCount} modules)`;

  return {
    segments: segmentSummary,
    version: versionLabel,
    printSize: `${minPrint} mm`
  };
}

async function buildAssets(qr, canvas) {
  const [png, svg] = await Promise.all([
    state.format === 'png' ? canvasToBlob(canvas) : Promise.resolve(null),
    buildSvgText(qr)
  ]);

  return {
    png,
    svg
  };
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to create PNG blob'));
      }
    }, 'image/png');
  });
}

async function buildSvgText(qr) {
  const matrix = qr.modules;
  const moduleCount = matrix.size;
  const size = moduleCount + QUIET_ZONE_MODULES * 2;
  const margin = QUIET_ZONE_MODULES;
  const parts = [];

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!matrix.get(row, col)) continue;
      const x = col + margin;
      const y = row + margin;
      parts.push(`M${x} ${y}h1v1h-1z`);
    }
  }

  const pathData = parts.join('');
  const hasBackground = state.background === 'white';
  const frameElements = state.frame ? buildFrameElements(moduleCount, margin) : '';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">
  ${hasBackground ? `<rect width="${size}" height="${size}" fill="#fff" />` : ''}
  <path d="${pathData}" fill="#0b0c10" />
  ${frameElements}
</svg>`;

  return svg;
}

function buildFrameElements(moduleCount, margin) {
  const frameSize = Math.max(6, Math.floor(moduleCount * FRAME_CLEAR_RATIO));
  const start = Math.floor((moduleCount - frameSize) / 2) + margin;
  const fill = state.background === 'transparent' ? '#ffffff' : '#ffffff';
  const opacity = state.background === 'transparent' ? ' fill-opacity="0.92"' : '';
  const borderOpacity = state.background === 'transparent' ? ' stroke-opacity="0.38"' : ' stroke-opacity="0.22"';
  return `<rect x="${start}" y="${start}" width="${frameSize}" height="${frameSize}" fill="${fill}"${opacity} rx="1" />
  <rect x="${start}" y="${start}" width="${frameSize}" height="${frameSize}" fill="none" stroke="#222" stroke-width="0.35"${borderOpacity}></rect>`;
}

function downloadLevel(levelKey) {
  const assets = state.outputs.get(levelKey);
  if (!assets) {
    ui.status.textContent = 'Still generating that preview…';
    return;
  }

  const fileStem = slugify(state.text).slice(0, 36) || 'qr-code';
  if (state.format === 'png') {
    if (!assets.png) {
      ui.status.textContent = 'PNG output is disabled for SVG mode.';
      return;
    }
    downloadBlob(assets.png, `${fileStem}-${levelKey}.png`);
    ui.status.textContent = `Downloaded ${levelKey} PNG`;
  } else {
    const blob = new Blob([assets.svg], { type: 'image/svg+xml' });
    downloadBlob(blob, `${fileStem}-${levelKey}.svg`);
    ui.status.textContent = `Downloaded ${levelKey} SVG`;
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function showErrorFeedback() {
  ui.previewGrid.dataset.state = 'error';
}

