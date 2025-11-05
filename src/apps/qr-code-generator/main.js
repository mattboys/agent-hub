import { createAppShell } from '../shared/appShell.js';
import './styles.css';
import QRCode from 'qrcode';

const ECC_LEVELS = [
  { key: 'L', label: 'Low', blurb: 'Fast scans, ~7% recovery', accent: '#6df6b5', size: 'large' },
  { key: 'H', label: 'High', blurb: 'Max safety, ~30% recovery', accent: '#ff9adf', size: 'large' },
  { key: 'Q', label: 'Quartile', blurb: 'Logo-friendly, ~25% recovery', accent: '#9f8cff', size: 'compact' },
  { key: 'M', label: 'Medium', blurb: 'Balanced, ~15% recovery', accent: '#60ddff', size: 'compact' }
];

const QUIET_ZONE_MODULES = 4;
const DEFAULT_TEXT = 'https://example.com';

const PREVIEW_COPY = {
  segments: 'Segments: 21×21 (total 441)',
  printSize: 'Recommended minimum print size: 10 mm (1 mm/module)',
  redundancy: {
    L: 'Redundancy: 7% (Low)',
    M: 'Redundancy: 15% (Medium)',
    Q: 'Redundancy: 25% (Quartile)',
    H: 'Redundancy: 30% (High)'
  },
  application: {
    L: 'Application: Small printing size',
    H: 'Application: Overlay a logo',
    Q: 'Application: Overlay demo logo preview',
    M: 'Application: Everyday scans'
  }
};

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
  debounce: null,
  loading: false,
  token: 0,
  outputs: new Map(),
  loadingResetTimer: null
};

// Verify QRCode library is loaded
console.log('[QR] Initializing QR Code Generator...');
console.log('[QR] QRCode library loaded:', typeof QRCode !== 'undefined');
console.log('[QR] QRCode.create available:', typeof QRCode?.create === 'function');

const ui = buildUI();
body.append(ui.container, ui.previewGrid, ui.status);

// Test QR generation on load
try {
  console.log('[QR] Testing QRCode.create with sample data...');
  const testQR = QRCode.create('test', { errorCorrectionLevel: 'M' });
  console.log('[QR] Test QR created successfully:', testQR);
} catch (error) {
  console.error('[QR] Failed to create test QR code:', error);
  ui.status.textContent = 'Error: QR Code library failed to load. Please refresh the page.';
  ui.status.style.color = 'red';
}

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
      <span class="status-icon" aria-hidden="true">✓</span>
      <span class="loading-text">Regenerating previews…</span>
    `;
  loadingBanner.hidden = true;

  const advanced = buildAdvancedControls();

  container.append(field, formatGroup, loadingBanner, advanced);

  const previewGrid = document.createElement('div');
  previewGrid.className = 'qr-preview-grid';

  const primaryRow = document.createElement('div');
  primaryRow.className = 'qr-preview-row qr-preview-row--primary';

  const secondaryRow = document.createElement('div');
  secondaryRow.className = 'qr-preview-row qr-preview-row--secondary';

  previewGrid.append(primaryRow, secondaryRow);

  const previewCards = new Map();
  ECC_LEVELS.forEach((level) => {
    const card = document.createElement('article');
    card.className = `qr-preview-card qr-preview-card--${level.size}`;
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

    const info = document.createElement('div');
    info.className = 'qr-info';

    const segmentsLine = document.createElement('p');
    segmentsLine.className = 'qr-info-line';
    segmentsLine.textContent = PREVIEW_COPY.segments;

    const applicationLine = document.createElement('p');
    applicationLine.className = 'qr-info-line';
    applicationLine.textContent = PREVIEW_COPY.application[level.key] || '';

    const redundancyLine = document.createElement('p');
    redundancyLine.className = 'qr-info-line';
    redundancyLine.textContent = PREVIEW_COPY.redundancy[level.key] || '';

    const printLine = document.createElement('p');
    printLine.className = 'qr-info-line';
    printLine.textContent = PREVIEW_COPY.printSize;

    info.append(segmentsLine);
    if (applicationLine.textContent) {
      info.append(applicationLine);
    }
    if (redundancyLine.textContent) {
      info.append(redundancyLine);
    }
    info.append(printLine);

    const footer = document.createElement('footer');
    footer.className = 'preview-footer';
    footer.innerHTML = `
      <span class="download-hint">Click to download</span>
    `;

    card.append(header, canvas, info, footer);

    if (level.size === 'large') {
      primaryRow.append(card);
    } else {
      secondaryRow.append(card);
    }

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
      info,
      downloadHint: footer.querySelector('.download-hint')
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

    details.append(summary, backgroundField, pixelField);
    return details;
  }
}

function setLoading(isLoading) {
  state.loading = isLoading;
  const spinner = ui.loadingBanner.querySelector('.spinner');
  const statusIcon = ui.loadingBanner.querySelector('.status-icon');
  const loadingText = ui.loadingBanner.querySelector('.loading-text');

  if (state.loadingResetTimer) {
    clearTimeout(state.loadingResetTimer);
    state.loadingResetTimer = null;
  }

  ui.loadingBanner.hidden = false;
  ui.loadingBanner.dataset.state = isLoading ? 'pending' : 'ready';

  if (spinner) {
    spinner.hidden = !isLoading;
  }
  if (statusIcon) {
    statusIcon.hidden = isLoading;
  }
  if (loadingText) {
    loadingText.textContent = isLoading ? 'Regenerating previews…' : 'Previews ready';
  }

  if (!isLoading) {
    state.loadingResetTimer = setTimeout(() => {
      ui.loadingBanner.hidden = true;
      ui.loadingBanner.dataset.state = 'idle';
      if (statusIcon) {
        statusIcon.hidden = true;
      }
      state.loadingResetTimer = null;
    }, 1800);
  }

  ui.previewGrid.dataset.state = isLoading ? 'pending' : 'ready';
}

function triggerRender() {
  if (state.debounce) {
    clearTimeout(state.debounce);
    state.debounce = null;
  }

  const token = ++state.token;
  console.log(`[QR] triggerRender called with token ${token}`);
  setLoading(true);
  
  // Add timeout detection
  const timeoutId = setTimeout(() => {
    if (state.loading && token === state.token) {
      console.error('[QR] Generation timeout - operation took longer than 10 seconds');
      ui.status.textContent = 'QR generation timed out. This may be a browser compatibility issue. Check console for details.';
      ui.status.style.color = 'orange';
    }
  }, 10000);
  
  generatePreviews(token)
    .then((result) => {
      clearTimeout(timeoutId);
      console.log(`[QR] generatePreviews completed for token ${token}:`, result);
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
      clearTimeout(timeoutId);
      console.error('[QR] Error in triggerRender:', error);
      console.error('[QR] Error stack:', error.stack);
      if (token === state.token) {
        setLoading(false);
        ui.status.textContent = 'Oops, that input is too large for a QR code.';
        showErrorFeedback();
      }
    });
}

async function generatePreviews(token) {
  console.log(`[QR] generatePreviews called with token ${token}`);
  const text = state.text.trim();
  if (!text) {
    ui.status.textContent = 'Enter text to generate QR codes.';
    clearPreviews();
    return { empty: true, hasErrors: false };
  }
  console.log(`[QR] Generating previews for text: "${text.substring(0, 50)}..."`);

  state.outputs.clear();
  const errors = [];

  const promises = ECC_LEVELS.map(async (level) => {
    const preview = ui.previewCards.get(level.key);
    if (!preview) return;

    preview.card.classList.add('is-working');
    const hint = preview.downloadHint;
    if (hint) {
      hint.textContent = `Click to download ${state.format.toUpperCase()}`;
    }
    try {
      console.log(`[QR] Generating QR code for level ${level.key}...`);
      const qr = QRCode.create(text, {
        errorCorrectionLevel: level.key
      });
      console.log(`[QR] QR created for level ${level.key}:`, qr);

      if (token !== state.token) {
        console.log(`[QR] Token mismatch for level ${level.key}, aborting`);
        return;
      }

      console.log(`[QR] Rendering to canvas for level ${level.key}...`);
      await renderToCanvas(preview.canvas, qr, { overlayLogo: level.key === 'Q' });
      console.log(`[QR] Canvas rendered for level ${level.key}`);
      
      if (token !== state.token) {
        console.log(`[QR] Token mismatch after canvas for level ${level.key}, aborting`);
        return;
      }

      console.log(`[QR] Building assets for level ${level.key}...`);
      const assets = await buildAssets(qr);
      console.log(`[QR] Assets built for level ${level.key}:`, { hasPng: !!assets.png, hasSvg: !!assets.svg });
      
      state.outputs.set(level.key, assets);
      preview.card.dataset.ready = 'true';
      preview.card.title = `Download ${state.format.toUpperCase()} (${level.label})`;
      console.log(`[QR] Successfully completed level ${level.key}`);
    } catch (error) {
      console.error(`[QR] Error generating QR for level ${level.key}:`, error);
      console.error(`[QR] Error stack:`, error.stack);
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
    preview.card.dataset.ready = 'false';
    if (preview.downloadHint) {
      preview.downloadHint.textContent = 'Click to download';
    }
  });
}

async function renderToCanvas(canvas, qr, options = {}) {
  const { overlayLogo = false } = options;
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

  if (overlayLogo) {
    drawPreviewLogo(ctx, { moduleCount, margin, scale });
  }

  return canvas;
}

function drawPreviewLogo(ctx, { moduleCount, margin, scale }) {
  const maxLogoModules = Math.floor(moduleCount * 0.3);
  const computedModules = Math.floor(moduleCount * 0.28);
  const logoModules = Math.max(4, Math.min(maxLogoModules, computedModules));
  const radius = (logoModules * scale) / 2;
  const center = margin * scale + (moduleCount * scale) / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.lineWidth = Math.max(1, Math.round(scale * 0.9));
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(20, 32, 52, 0.85)';
  ctx.font = `600 ${Math.max(14, Math.round(radius * 0.9))}px "Inter", "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LOGO', center, center);

  ctx.restore();
}

async function buildAssets(qr) {
  console.log('[QR] buildAssets called');
  try {
    const offscreenCanvas = document.createElement('canvas');
    await renderToCanvas(offscreenCanvas, qr, { overlayLogo: false });
    const [png, svg] = await Promise.all([
      canvasToBlob(offscreenCanvas),
      buildSvgText(qr)
    ]);
    console.log('[QR] buildAssets completed:', { hasPng: !!png, svgLength: svg?.length });
    return {
      png,
      svg
    };
  } catch (error) {
    console.error('[QR] Error in buildAssets:', error);
    throw error;
  }
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      // Check if toBlob is supported
      if (!canvas.toBlob) {
        console.error('canvas.toBlob is not supported in this browser');
        // Fallback to dataURL for older browsers
        try {
          const dataURL = canvas.toDataURL('image/png');
          const binaryString = atob(dataURL.split(',')[1]);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'image/png' });
          resolve(blob);
          return;
        } catch (fallbackError) {
          console.error('Fallback to dataURL failed:', fallbackError);
          reject(new Error('Failed to create PNG blob using fallback'));
          return;
        }
      }

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create PNG blob'));
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error in canvasToBlob:', error);
      reject(error);
    }
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

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">
  ${hasBackground ? `<rect width="${size}" height="${size}" fill="#fff" />` : ''}
  <path d="${pathData}" fill="#0b0c10" />
</svg>`;

  return svg;
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

