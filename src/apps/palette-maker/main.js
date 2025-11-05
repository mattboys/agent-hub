import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const ACCENT = '#f6b44e';

const { body } = createAppShell({
  title: 'Palette Maker',
  description:
    'Explore harmonious palettes backed by color theory, math-driven spacing, and accessibility checks. Tap the wheel to add colours, then accept smart suggestions or spin up fresh inspiration.',
  accent: ACCENT
});

const state = {
  selected: [
    createColorFromHex('#f6b44e', 'Sunrise Base'),
    createColorFromHex('#1f4f99', 'Deep Accent')
  ],
  suggestions: [],
  lastPicked: null
};

const baseCanvas = document.createElement('canvas');
baseCanvas.width = 360;
baseCanvas.height = 360;

const layout = document.createElement('div');
layout.className = 'palette-maker';

const wheelPanel = document.createElement('section');
wheelPanel.className = 'panel wheel-panel';

const wheelHeader = document.createElement('div');
wheelHeader.className = 'panel-header';
wheelHeader.innerHTML = `
  <h2>Colour wheel</h2>
  <p>Select hues directly on the wheel. Vector guides show harmony relationships and suggestions.</p>
`;

const wheelCanvas = document.createElement('canvas');
wheelCanvas.width = 360;
wheelCanvas.height = 360;
wheelCanvas.className = 'color-wheel';
wheelCanvas.setAttribute('role', 'img');
wheelCanvas.setAttribute('aria-label', 'Interactive color wheel for selecting palette colours');

const wheelActions = document.createElement('div');
wheelActions.className = 'wheel-actions';

const randomButton = document.createElement('button');
randomButton.type = 'button';
randomButton.className = 'chip-btn';
randomButton.textContent = 'Add a random colour';

const acceptTopButton = document.createElement('button');
acceptTopButton.type = 'button';
acceptTopButton.className = 'chip-btn primary';
acceptTopButton.textContent = 'Accept top suggestion';

const lastPickedBadge = document.createElement('span');
lastPickedBadge.className = 'last-picked';
updateLastPickedBadge();

wheelActions.append(randomButton, acceptTopButton, lastPickedBadge);
wheelPanel.append(wheelHeader, wheelCanvas, wheelActions);

const selectionPanel = document.createElement('section');
selectionPanel.className = 'panel selection-panel';
selectionPanel.innerHTML = `
  <div class="panel-header">
    <h2>Selected palette</h2>
    <p>Edit or remove colours. Inputs sync with the wheel overlays automatically.</p>
  </div>
`;

const selectedList = document.createElement('div');
selectedList.className = 'color-list';

selectionPanel.appendChild(selectedList);

const suggestionPanel = document.createElement('section');
suggestionPanel.className = 'panel suggestion-panel';
suggestionPanel.innerHTML = `
  <div class="panel-header">
    <h2>Smart suggestions</h2>
    <p>Based on complementary, triadic, midpoint and accessibility analysis.</p>
  </div>
`;

const suggestionList = document.createElement('div');
suggestionList.className = 'suggestion-list';
suggestionPanel.appendChild(suggestionList);

const previewPanel = document.createElement('section');
previewPanel.className = 'panel preview-panel';
previewPanel.innerHTML = `
  <div class="panel-header">
    <h2>Readability & logo preview</h2>
    <p>See text contrast in light/dark modes and a quick logo mock with your palette.</p>
  </div>
`;

const ratingWrap = document.createElement('div');
ratingWrap.className = 'rating-wrap';

const ratingStars = document.createElement('div');
ratingStars.className = 'star-rating';

const ratingReason = document.createElement('p');
ratingReason.className = 'rating-reason';

ratingWrap.append(ratingStars, ratingReason);

const contrastWrap = document.createElement('div');
contrastWrap.className = 'contrast-wrap';

const lightSample = document.createElement('div');
lightSample.className = 'contrast-sample light';
lightSample.innerHTML = `
  <span class="sample-label">Light mode sample</span>
  <p class="sample-text">“Good design is finding the perfect balance between intuition and science.”</p>
  <span class="contrast-note"></span>
`;

const darkSample = document.createElement('div');
darkSample.className = 'contrast-sample dark';
darkSample.innerHTML = `
  <span class="sample-label">Dark mode sample</span>
  <p class="sample-text">“Accessible contrast lets every story be read with ease.”</p>
  <span class="contrast-note"></span>
`;

contrastWrap.append(lightSample, darkSample);

const logoPreview = document.createElement('div');
logoPreview.className = 'logo-preview';
logoPreview.innerHTML = `
  <div class="logo-mark" aria-hidden="true"></div>
  <div class="logo-title">Palette Studio</div>
`;

previewPanel.append(ratingWrap, contrastWrap, logoPreview);

const resourcesPanel = document.createElement('section');
resourcesPanel.className = 'panel resources-panel';
resourcesPanel.innerHTML = `
  <div class="panel-header">
    <h2>Why these suggestions?</h2>
    <p>Learn how the maths and theory behind Palette Maker guide your next brand system.</p>
  </div>
  <ul class="resource-links">
    <li><a href="https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html" target="_blank" rel="noreferrer">WCAG contrast guidelines →</a></li>
    <li><a href="https://color.adobe.com/create/color-wheel" target="_blank" rel="noreferrer">Adobe colour wheel theory →</a></li>
    <li><a href="https://www.tigercolor.com/color-lab/color-theory/color-harmonies.htm" target="_blank" rel="noreferrer">Colour harmony cheat-sheet →</a></li>
  </ul>
`;

layout.append(wheelPanel, selectionPanel, suggestionPanel, previewPanel, resourcesPanel);
body.appendChild(layout);

drawWheelBase();
renderAll();

wheelCanvas.addEventListener('pointerdown', (event) => {
  const rect = wheelCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const picked = pickColorFromWheel(x, y);
  if (!picked) {
    return;
  }
  addColorToPalette(picked);
});

randomButton.addEventListener('click', () => {
  const randomColour = generateRandomStrategicColour();
  addColorToPalette(randomColour);
});

acceptTopButton.addEventListener('click', () => {
  if (!state.suggestions.length) {
    return;
  }
  const best = [...state.suggestions].sort((a, b) => b.score - a.score)[0];
  if (best) {
    addColorToPalette(createColorFromHex(best.hex, best.label));
  }
});

function addColorToPalette(color) {
  if (state.selected.find((entry) => entry.hex === color.hex)) {
    state.lastPicked = color;
    updateLastPickedBadge();
    renderAll();
    return;
  }

  const labelled = {
    ...color,
    label: color.label || `Colour ${state.selected.length + 1}`
  };

  state.selected.push(labelled);
  state.lastPicked = labelled;
  updateLastPickedBadge();
  renderAll();
}

function removeColorFromPalette(index) {
  state.selected.splice(index, 1);
  state.lastPicked = state.selected[state.selected.length - 1] || null;
  updateLastPickedBadge();
  renderAll();
}

function updateColourAt(index, hex) {
  const normal = normalizeHex(hex);
  const updated = createColorFromHex(normal, state.selected[index].label);
  state.selected[index] = { ...updated, label: state.selected[index].label };
  state.lastPicked = state.selected[index];
  updateLastPickedBadge();
  renderAll();
}

function renderAll() {
  state.suggestions = buildSuggestions(state.selected);
  const hasSuggestions = state.suggestions.length > 0;
  acceptTopButton.disabled = !hasSuggestions;
  acceptTopButton.setAttribute('aria-disabled', hasSuggestions ? 'false' : 'true');
  drawWheelOverlay();
  renderSelectedList();
  renderSuggestionList();
  renderContrastSamples();
  renderLogoPreview();
  renderRating();
}

function renderSelectedList() {
  selectedList.innerHTML = '';
  if (!state.selected.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Tap the wheel or add a random colour to begin.';
    selectedList.appendChild(empty);
    return;
  }

  state.selected.forEach((color, index) => {
    const item = document.createElement('article');
    item.className = 'color-item';

    const swatch = document.createElement('span');
    swatch.className = 'color-swatch';
    swatch.style.setProperty('--swatch-color', color.hex);
    swatch.setAttribute('aria-hidden', 'true');

    const meta = document.createElement('div');
    meta.className = 'color-meta';

    const titleRow = document.createElement('div');
    titleRow.className = 'color-meta__header';

    const label = document.createElement('h3');
    label.textContent = color.label || `Colour ${index + 1}`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'icon-btn';
    removeBtn.setAttribute('aria-label', `Remove ${label.textContent}`);
    removeBtn.textContent = '⌫';
    removeBtn.addEventListener('click', () => removeColorFromPalette(index));

    titleRow.append(label, removeBtn);

    const controlsRow = document.createElement('div');
    controlsRow.className = 'color-meta__controls';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = color.hex;
    colorInput.setAttribute('aria-label', `Choose a new colour for ${label.textContent}`);
    colorInput.addEventListener('input', (event) => updateColourAt(index, event.target.value));

    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.value = color.hex;
    hexInput.spellcheck = false;
    hexInput.maxLength = 7;
    hexInput.addEventListener('blur', (event) => updateColourAt(index, event.target.value));
    hexInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        updateColourAt(index, event.target.value);
      }
    });

    controlsRow.append(colorInput, hexInput);

    const metrics = document.createElement('dl');
    metrics.className = 'color-metrics';

    const { h, s, l } = color;
    const hueItem = makeMetric('Hue', `${Math.round(h)}°`);
    const satItem = makeMetric('Sat', `${Math.round(s)}%`);
    const lightItem = makeMetric('Light', `${Math.round(l)}%`);
    metrics.append(hueItem, satItem, lightItem);

    meta.append(titleRow, controlsRow, metrics);

    const contrast = describeContrast(color, state.selected.filter((_, i) => i !== index));
    if (contrast) {
      const contrastItem = document.createElement('p');
      contrastItem.className = 'contrast-summary';
      contrastItem.innerHTML = `<strong>${contrast.label}</strong> · ${contrast.details}`;
      meta.append(contrastItem);
    }
    item.append(swatch, meta);
    selectedList.appendChild(item);
  });
}

function renderSuggestionList() {
  suggestionList.innerHTML = '';

  if (!state.suggestions.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Add more base colours to unlock theory-backed suggestions.';
    suggestionList.appendChild(empty);
    return;
  }

  state.suggestions
    .slice(0, 6)
    .sort((a, b) => b.score - a.score)
    .forEach((suggestion) => {
      const card = document.createElement('article');
      card.className = 'suggestion-card';

      const swatch = document.createElement('span');
      swatch.className = 'color-swatch';
      swatch.style.setProperty('--swatch-color', suggestion.hex);

      const info = document.createElement('div');
      info.className = 'suggestion-info';

      const title = document.createElement('h3');
      title.textContent = suggestion.label;

      const rationale = document.createElement('p');
      rationale.textContent = suggestion.reason;

      const metaLine = document.createElement('p');
      metaLine.className = 'suggestion-meta';
      const tagLabel = suggestion.tags.length ? `${suggestion.tags.join(' • ')} · ` : '';
      metaLine.textContent = `${tagLabel}contrast ${suggestion.contrast.toFixed(1)}×`;

      const acceptBtn = document.createElement('button');
      acceptBtn.type = 'button';
      acceptBtn.className = 'chip-btn';
      acceptBtn.textContent = 'Add to palette';
      acceptBtn.addEventListener('click', () => {
        addColorToPalette(createColorFromHex(suggestion.hex, suggestion.label));
      });

      info.append(title, rationale, metaLine, acceptBtn);
      card.append(swatch, info);
      suggestionList.appendChild(card);
    });
}

function renderContrastSamples() {
  const combos = computeBestHighContrastPairs(state.selected);
  const [lightPair, darkPair] = combos;

  applySample(lightSample, lightPair, 'light');
  applySample(darkSample, darkPair, 'dark');
}

function renderLogoPreview() {
  const mark = logoPreview.querySelector('.logo-mark');
  mark.innerHTML = '';

  if (!state.selected.length) {
    const placeholder = document.createElement('div');
    placeholder.className = 'logo-dot';
    placeholder.style.background = ACCENT;
    mark.appendChild(placeholder);
    return;
  }

  state.selected.forEach((color, index) => {
    const dot = document.createElement('div');
    dot.className = 'logo-dot';
    dot.style.background = color.hex;
    dot.style.setProperty('--offset', index);
    mark.appendChild(dot);
  });
}

function renderRating() {
  const { rating, description } = gradePalette(state.selected);
  ratingStars.innerHTML = '';
  const stars = 5;
  const filled = Math.round(rating);
  for (let i = 0; i < stars; i += 1) {
    const star = document.createElement('span');
    star.textContent = i < filled ? '★' : '☆';
    star.setAttribute('aria-hidden', 'true');
    ratingStars.appendChild(star);
  }
  ratingStars.dataset.value = rating.toFixed(1);
  ratingStars.setAttribute('aria-label', `Palette rating ${rating.toFixed(1)} out of 5`);
  ratingReason.textContent = description;
}

function drawWheelBase() {
  const ctx = baseCanvas.getContext('2d');
  const { width, height } = baseCanvas;
  const cx = width / 2;
  const cy = height / 2;
  const radius = width / 2 - 4;

  for (let angle = 0; angle < 360; angle += 1) {
    const start = ((angle - 1) * Math.PI) / 180;
    const end = ((angle + 1) * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, `hsl(${angle}, 20%, 96%)`);
    gradient.addColorStop(0.6, `hsl(${angle}, 70%, 60%)`);
    gradient.addColorStop(1, `hsl(${angle}, 100%, 50%)`);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.stroke();
}

function drawWheelOverlay() {
  const ctx = wheelCanvas.getContext('2d');
  ctx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);
  ctx.drawImage(baseCanvas, 0, 0);

  const { width, height } = wheelCanvas;
  const center = { x: width / 2, y: height / 2 };
  const maxRadius = width / 2 - 12;

  const drawMarker = (color, options = {}) => {
    const { h, s } = color;
    const radians = (h * Math.PI) / 180;
    const radius = maxRadius * (Math.max(Math.min(s, 95), 10) / 100);
    const x = center.x + Math.cos(radians) * radius;
    const y = center.y + Math.sin(radians) * radius;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = options.stroke || color.hex;
    ctx.lineWidth = options.width || 2.5;
    if (options.dashed) {
      ctx.setLineDash([8, 6]);
    }
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(x, y, options.radius || 8, 0, Math.PI * 2);
    ctx.fillStyle = color.hex;
    ctx.strokeStyle = 'rgba(16, 18, 32, 0.65)';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  state.suggestions.forEach((suggestion) => {
    const temp = createColorFromHex(suggestion.hex, suggestion.label);
    drawMarker(temp, { stroke: 'rgba(255,255,255,0.25)', dashed: true, width: 1.5, radius: 6 });
  });

  state.selected.forEach((color) => {
    drawMarker(color, { stroke: 'rgba(16,18,32,0.75)' });
  });
}

function pickColorFromWheel(x, y) {
  const { width, height } = wheelCanvas;
  const cx = width / 2;
  const cy = height / 2;
  const dx = x - cx;
  const dy = y - cy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const maxRadius = width / 2 - 12;

  if (distance > maxRadius) {
    return null;
  }

  const hue = (Math.atan2(dy, dx) * 180) / Math.PI;
  const wrappedHue = (hue + 360) % 360;
  const saturation = clamp((distance / maxRadius) * 100, 5, 95);
  const lightness = clamp(70 - (saturation / 100) * 25, 15, 80);

  const hex = hslToHex(wrappedHue, saturation, lightness);
  return createColorFromHex(hex, 'Wheel pick');
}

function buildSuggestions(selected) {
  const seen = new Set(selected.map((c) => c.hex));
  const list = [];

  const pushSuggestion = (hex, label, reason, tags = []) => {
    const normalHex = normalizeHex(hex);
    if (seen.has(normalHex)) {
      return;
    }
    const metrics = scoreSuggestion(normalHex, selected);
    list.push({
      hex: normalHex,
      label,
      reason,
      tags,
      score: metrics.score,
      contrast: metrics.bestContrast
    });
    seen.add(normalHex);
  };

  selected.forEach((color) => {
    pushSuggestion(
      hslToHex(wrapHue(color.h + 180), color.s, reflectLightness(color.l)),
      'Complementary partner',
      'Direct opposite on the colour wheel balances energy with tension.',
      ['Complementary']
    );

    pushSuggestion(
      hslToHex(wrapHue(color.h + 120), clamp(color.s * 0.9, 35, 90), color.l),
      'Triadic swing',
      'Triadic spacing keeps contrast lively while staying cohesive.',
      ['Triadic']
    );

    pushSuggestion(
      hslToHex(wrapHue(color.h - 120), clamp(color.s * 1.05, 30, 95), reflectLightness(color.l)),
      'Triadic counterpoint',
      'Completes the triad family for brand depth.',
      ['Triadic']
    );

    pushSuggestion(
      hslToHex(wrapHue(color.h + 30), clamp(color.s, 35, 95), clamp(color.l + 10, 20, 80)),
      'Analogous warm',
      'Analogous hues create smooth gradients and UI states.',
      ['Analogous']
    );

    pushSuggestion(
      hslToHex(wrapHue(color.h - 30), clamp(color.s, 35, 95), clamp(color.l - 8, 18, 78)),
      'Analogous cool',
      'Neighbouring hue softens transitions and backgrounds.',
      ['Analogous']
    );
  });

  if (selected.length >= 2) {
    for (let i = 0; i < selected.length; i += 1) {
      for (let j = i + 1; j < selected.length; j += 1) {
        const a = selected[i];
        const b = selected[j];
        const midpointHue = wrapHue((a.h + b.h) / 2);
        const midpointSat = clamp((a.s + b.s) / 2, 25, 90);
        const midpointLight = clamp((a.l + b.l) / 2, 20, 80);
        pushSuggestion(
          hslToHex(midpointHue, midpointSat, midpointLight),
          'Midpoint blend',
          'Bridges two anchors and smooths gradient transitions.',
          ['Midpoint']
        );
      }
    }
  }

  if (selected.length) {
    const luminosityAnchor = [...selected].sort((a, b) => getLuminance(a.hex) - getLuminance(b.hex));
    const darkest = luminosityAnchor[0];
    const lightest = luminosityAnchor[luminosityAnchor.length - 1];
    if (darkest) {
      pushSuggestion(
        hslToHex(darkest.h, clamp(darkest.s * 0.8, 25, 90), clamp(darkest.l - 28, 10, 40)),
        'Deep contrast anchor',
        'Boosts text-on-light contrast for WCAG AA headlines.',
        ['Accessibility']
      );
    }

    if (lightest) {
      pushSuggestion(
        hslToHex(lightest.h, clamp(lightest.s * 0.65, 20, 80), clamp(lightest.l + 25, 55, 95)),
        'Soft highlight',
        'Elevates dark UI blocks while staying on-brand.',
        ['Accessibility']
      );
    }
  }

  return list;
}

function scoreSuggestion(hex, selected) {
  if (!selected.length) {
    return { score: 2.5, bestContrast: 1 };
  }
  const { h, s, l } = createColorFromHex(hex, 'score');
  const hueDistance = Math.min(
    ...selected.map((color) => Math.min(Math.abs(color.h - h), 360 - Math.abs(color.h - h)))
  );

  const contrasts = selected.map((color) => getContrastRatio(color.hex, hex));
  const bestContrast = Math.max(...contrasts);
  const avgContrast = contrasts.reduce((sum, value) => sum + value, 0) / contrasts.length;

  const contrastScore = Math.min(bestContrast / 7, 1);
  const spacingScore = Math.min(hueDistance / 60, 1);
  const balanceScore = 1 - Math.abs(l - 52) / 52;
  const saturationScore = s / 100;

  const score = 1.5 + (contrastScore * 0.35 + spacingScore * 0.3 + balanceScore * 0.2 + saturationScore * 0.15) * 3.5;
  return { score, bestContrast: bestContrast || avgContrast };
}

function computeBestHighContrastPairs(selected) {
  if (!selected.length) {
    return [
      { background: '#ffffff', foreground: '#1a1d2b', ratio: getContrastRatio('#ffffff', '#1a1d2b') },
      { background: '#10121c', foreground: '#f1f5ff', ratio: getContrastRatio('#10121c', '#f1f5ff') }
    ];
  }

  const pool = [...selected];

  if (selected.length < 2) {
    const complement = createColorFromHex(hslToHex(wrapHue(selected[0].h + 180), selected[0].s, reflectLightness(selected[0].l)), 'Auto complement');
    pool.push(complement);
  }

  let best = null;
  for (let i = 0; i < pool.length; i += 1) {
    for (let j = i + 1; j < pool.length; j += 1) {
      const a = pool[i];
      const b = pool[j];
      const ratio = getContrastRatio(a.hex, b.hex);
      const record = { background: a.hex, foreground: b.hex, ratio };
      if (!best || ratio > best.ratio) {
        best = record;
      }
    }
  }

  if (!best) {
    return [
      { background: '#ffffff', foreground: '#1a1d2b', ratio: getContrastRatio('#ffffff', '#1a1d2b') },
      { background: '#10121c', foreground: '#f1f5ff', ratio: getContrastRatio('#10121c', '#f1f5ff') }
    ];
  }

  const backgroundLighter = getLuminance(best.background) > getLuminance(best.foreground);
  const lightPair = backgroundLighter
    ? best
    : { background: best.foreground, foreground: best.background, ratio: best.ratio };

  const darkPair = getLuminance(lightPair.background) < 0.5
    ? lightPair
    : {
        background: lightenHex(lightPair.foreground, -55),
        foreground: lightenHex(lightPair.foreground, 80),
        ratio: getContrastRatio(lightenHex(lightPair.foreground, -55), lightenHex(lightPair.foreground, 80))
      };

  return [lightPair, darkPair];
}

function applySample(container, pair, mode) {
  const sampleText = container.querySelector('.sample-text');
  const note = container.querySelector('.contrast-note');
  container.style.background = pair.background;
  sampleText.style.color = pair.foreground;
  const ratio = pair.ratio;
  note.textContent = `${ratio.toFixed(2)}× contrast • ${ratio >= 4.5 ? 'Passes' : ratio >= 3 ? 'AA large' : 'Needs improvement'}`;

  container.dataset.state = ratio >= 4.5 ? 'pass' : 'warn';

  if (mode === 'light') {
    container.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.2)';
  } else {
    container.style.boxShadow = 'inset 0 1px 0 rgba(0,0,0,0.4)';
  }
}

function gradePalette(selected) {
  if (!selected.length) {
    return {
      rating: 0,
      description: 'Add at least two colours for a first assessment.'
    };
  }

  const hueDiffs = [];
  const colours = [...selected].sort((a, b) => a.h - b.h);
  for (let i = 0; i < colours.length; i += 1) {
    const current = colours[i];
    const next = colours[(i + 1) % colours.length];
    const diff = Math.min(Math.abs(next.h - current.h), 360 - Math.abs(next.h - current.h));
    hueDiffs.push(diff);
  }
  const minDiff = Math.min(...hueDiffs);
  const spacingScore = Math.min(minDiff / (360 / Math.max(colours.length, 3)), 1);

  let bestContrast = 0;
  for (let i = 0; i < selected.length; i += 1) {
    for (let j = i + 1; j < selected.length; j += 1) {
      bestContrast = Math.max(bestContrast, getContrastRatio(selected[i].hex, selected[j].hex));
    }
  }

  const contrastScore = Math.min(bestContrast / 7, 1);
  const sizeScore = Math.min(selected.length / 5, 1);

  const rating = Math.max(1, (spacingScore * 0.4 + contrastScore * 0.4 + sizeScore * 0.2) * 5);

  let description = 'Great balance of spacing and contrast.';
  if (bestContrast < 3) {
    description = 'Add a deeper anchor for accessible text contrast.';
  } else if (spacingScore < 0.35) {
    description = 'Spread hues further apart to avoid crowding.';
  } else if (selected.length < 3) {
    description = 'Add one more colour to unlock richer harmonies.';
  }

  return { rating: Math.min(5, rating), description };
}

function describeContrast(color, others) {
  if (!others.length) {
    return null;
  }
  const scores = others.map((other) => ({
    label: other.label,
    ratio: getContrastRatio(color.hex, other.hex)
  }));
  const best = scores.sort((a, b) => b.ratio - a.ratio)[0];
  return {
    label: `Best contrast with ${best.label}`,
    details: `${best.ratio.toFixed(2)}×`
  };
}

function makeMetric(label, value) {
  const wrapper = document.createElement('div');
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = value;
  wrapper.append(dt, dd);
  return wrapper;
}

function updateLastPickedBadge() {
  if (!state.lastPicked) {
    lastPickedBadge.textContent = 'Waiting for a fresh pick';
    lastPickedBadge.style.setProperty('--badge-color', ACCENT);
    return;
  }
  lastPickedBadge.textContent = `Latest: ${state.lastPicked.hex}`;
  lastPickedBadge.style.setProperty('--badge-color', state.lastPicked.hex);
}

function createColorFromHex(hex, label) {
  const normalized = normalizeHex(hex);
  const { h, s, l } = hexToHsl(normalized);
  return { hex: normalized, h, s, l, label };
}

function normalizeHex(value) {
  if (!value) return '#000000';
  const str = value.trim().toLowerCase();
  const prefixed = str.startsWith('#') ? str : `#${str}`;
  if (/^#([0-9a-f]{3}){1,2}$/.test(prefixed)) {
    if (prefixed.length === 4) {
      return `#${prefixed[1]}${prefixed[1]}${prefixed[2]}${prefixed[2]}${prefixed[3]}${prefixed[3]}`;
    }
    return prefixed;
  }
  return '#000000';
}

function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h, s, l) {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex).replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16) / 255,
    g: parseInt(normalized.slice(2, 4), 16) / 255,
    b: parseInt(normalized.slice(4, 6), 16) / 255
  };
}

function hslToRgb(h, s, l) {
  const hue = ((h % 360) + 360) % 360 / 360;
  const sat = clamp(s, 0, 100) / 100;
  const light = clamp(l, 0, 100) / 100;

  if (sat === 0) {
    return { r: light, g: light, b: light };
  }

  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;

  const r = hueToRgb(p, q, hue + 1 / 3);
  const g = hueToRgb(p, q, hue);
  const b = hueToRgb(p, q, hue - 1 / 3);

  return { r, g, b };
}

function rgbToHex(r, g, b) {
  const toHex = (value) => Math.round(value * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hueToRgb(p, q, t) {
  let temp = t;
  if (temp < 0) temp += 1;
  if (temp > 1) temp -= 1;
  if (temp < 1 / 6) return p + (q - p) * 6 * temp;
  if (temp < 1 / 2) return q;
  if (temp < 2 / 3) return p + (q - p) * (2 / 3 - temp) * 6;
  return p;
}

function getLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const a = [r, g, b].map((value) => {
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function getContrastRatio(hexA, hexB) {
  const lumA = getLuminance(hexA);
  const lumB = getLuminance(hexB);
  const brightest = Math.max(lumA, lumB);
  const darkest = Math.min(lumA, lumB);
  return (brightest + 0.05) / (darkest + 0.05);
}

function wrapHue(value) {
  return ((value % 360) + 360) % 360;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function reflectLightness(lightness) {
  return clamp(100 - lightness, 18, 82);
}

function generateRandomStrategicColour() {
  const hue = Math.floor(Math.random() * 360);
  const saturation = clamp(40 + Math.random() * 55, 40, 95);
  const lightness = clamp(35 + Math.random() * 35, 15, 85);
  return createColorFromHex(hslToHex(hue, saturation, lightness), 'Random pick');
}

function lightenHex(hex, amount) {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, s, clamp(l + amount, 0, 100));
}

