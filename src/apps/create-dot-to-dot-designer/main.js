import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const ACCENT = '#7ad7ff';
const LINE_COLORS = ['#7ad7ff', '#ff9fb2'];
const VIEWBOX = { width: 1200, height: 800 };
const SVG_NS = 'http://www.w3.org/2000/svg';

const { body } = createAppShell({
  title: 'Dot-to-Dot Designer',
  description:
    'Plot numbered dots on a blank canvas, preview the next segment as you drag, then tidy up your connect-the-dots artwork with undo and clear controls.',
  accent: ACCENT
});

const app = document.createElement('div');
app.className = 'dot-app';

const toolbar = document.createElement('div');
toolbar.className = 'dot-toolbar';

const hint = document.createElement('p');
hint.className = 'dot-hint';
hint.textContent = 'Click or tap anywhere on the canvas. Drag to preview the line before releasing to lock the dot.';

const buttonGroup = document.createElement('div');
buttonGroup.className = 'dot-button-group';

const undoButton = createButton('Undo last dot');
const clearButton = createButton('Clear canvas');

buttonGroup.append(undoButton, clearButton);
toolbar.append(hint, buttonGroup);

const stats = createStats();
const stage = createStage();

app.append(toolbar, stats.wrapper, stage.wrap);
body.appendChild(app);

const state = {
  points: [],
  preview: null,
  pointerId: null
};

undoButton.addEventListener('click', handleUndo);
clearButton.addEventListener('click', handleClear);

stage.svg.addEventListener('pointerdown', handlePointerDown);
stage.svg.addEventListener('pointermove', handlePointerMove);
stage.svg.addEventListener('pointerup', handlePointerUp);
stage.svg.addEventListener('pointercancel', handlePointerCancel);

renderScene();
updatePreview();

function handlePointerDown(event) {
  if (state.preview || (event.pointerType === 'mouse' && event.button !== 0)) {
    return;
  }
  event.preventDefault();
  state.preview = getSvgCoords(event);
  state.pointerId = event.pointerId;
  stage.svg.setPointerCapture(event.pointerId);
  updatePreview();
}

function handlePointerMove(event) {
  if (!state.preview || event.pointerId !== state.pointerId) {
    return;
  }
  event.preventDefault();
  state.preview = getSvgCoords(event);
  updatePreview();
}

function handlePointerUp(event) {
  if (!state.preview || event.pointerId !== state.pointerId) {
    return;
  }
  event.preventDefault();
  stage.svg.releasePointerCapture(event.pointerId);
  const nextPoint = { ...state.preview };
  state.points.push(nextPoint);
  state.preview = null;
  state.pointerId = null;
  renderScene();
  updatePreview();
}

function handlePointerCancel(event) {
  if (event.pointerId !== state.pointerId) {
    return;
  }
  stage.svg.releasePointerCapture(event.pointerId);
  state.preview = null;
  state.pointerId = null;
  updatePreview();
}

function handleUndo() {
  if (!state.points.length) {
    return;
  }
  state.points.pop();
  renderScene();
  updatePreview();
}

function handleClear() {
  if (!state.points.length) {
    return;
  }
  state.points = [];
  renderScene();
  updatePreview();
}

function renderScene() {
  stage.lineLayer.innerHTML = '';
  stage.pointLayer.innerHTML = '';

  state.points.forEach((point, index) => {
    if (index > 0) {
      const prev = state.points[index - 1];
      const line = createLine(prev, point, index - 1);
      stage.lineLayer.appendChild(line);
    }

    const dot = createDot(point, index + 1);
    stage.pointLayer.appendChild(dot);
  });

  stats.update(state.points.length);
  const hasPoints = state.points.length > 0;
  undoButton.disabled = !hasPoints;
  clearButton.disabled = !hasPoints;
  stage.wrap.dataset.hasPoints = hasPoints ? 'true' : 'false';
}

function updatePreview() {
  if (!state.preview) {
    stage.previewGroup.dataset.active = 'false';
    stage.previewLine.dataset.active = 'false';
    return;
  }

  stage.previewGroup.dataset.active = 'true';
  stage.previewDot.setAttribute('cx', state.preview.x);
  stage.previewDot.setAttribute('cy', state.preview.y);
  stage.previewLabel.setAttribute('x', state.preview.x);
  stage.previewLabel.setAttribute('y', state.preview.y);
  stage.previewLabel.textContent = state.points.length + 1;

  const lastPoint = state.points[state.points.length - 1];
  if (lastPoint) {
    stage.previewLine.dataset.active = 'true';
    stage.previewLine.setAttribute('x1', lastPoint.x);
    stage.previewLine.setAttribute('y1', lastPoint.y);
    stage.previewLine.setAttribute('x2', state.preview.x);
    stage.previewLine.setAttribute('y2', state.preview.y);
    const previewColor = LINE_COLORS[state.points.length % LINE_COLORS.length];
    stage.previewLine.setAttribute('stroke', previewColor);
  } else {
    stage.previewLine.dataset.active = 'false';
  }
}

function createLine(start, end, lineIndex) {
  const line = createSvgElement('line');
  line.classList.add('dot-line');
  line.setAttribute('x1', start.x);
  line.setAttribute('y1', start.y);
  line.setAttribute('x2', end.x);
  line.setAttribute('y2', end.y);
  const color = LINE_COLORS[lineIndex % LINE_COLORS.length];
  line.setAttribute('stroke', color);
  return line;
}

function createDot(point, number) {
  const group = createSvgElement('g');
  group.classList.add('dot-node');

  const halo = createSvgElement('circle');
  halo.classList.add('dot-node-halo');
  halo.setAttribute('cx', point.x);
  halo.setAttribute('cy', point.y);
  halo.setAttribute('r', 16);

  const circle = createSvgElement('circle');
  circle.classList.add('dot-node-point');
  circle.setAttribute('cx', point.x);
  circle.setAttribute('cy', point.y);
  circle.setAttribute('r', 6);

  const label = createSvgElement('text');
  label.classList.add('dot-node-label');
  label.setAttribute('x', point.x);
  label.setAttribute('y', point.y - 18);
  label.textContent = number;

  group.append(halo, circle, label);
  return group;
}

function createButton(label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dot-button';
  button.textContent = label;
  return button;
}

function createStats() {
  const wrapper = document.createElement('div');
  wrapper.className = 'dot-stats';

  const dots = createStatCard('Dots placed');
  const lines = createStatCard('Lines drawn');

  wrapper.append(dots.card, lines.card);

  return {
    wrapper,
    update(count) {
      dots.value.textContent = count;
      lines.value.textContent = Math.max(count - 1, 0);
    }
  };
}

function createStatCard(label) {
  const card = document.createElement('article');
  card.className = 'dot-stat-card';

  const value = document.createElement('strong');
  value.textContent = '0';

  const caption = document.createElement('span');
  caption.textContent = label;

  card.append(value, caption);
  return { card, value };
}

function createStage() {
  const wrap = document.createElement('div');
  wrap.className = 'dot-stage';
  wrap.dataset.hasPoints = 'false';

  const message = document.createElement('div');
  message.className = 'dot-stage-message';
  message.innerHTML = '<strong>Blank canvas</strong><span>Drag to preview your first dot, then release.</span>';

  const svg = createSvgElement('svg');
  svg.classList.add('dot-canvas');
  svg.setAttribute('viewBox', `0 0 ${VIEWBOX.width} ${VIEWBOX.height}`);
  svg.setAttribute('role', 'presentation');
  svg.setAttribute('aria-label', 'Dot-to-dot canvas');

  const background = createSvgElement('rect');
  background.classList.add('dot-canvas-bg');
  background.setAttribute('x', '0');
  background.setAttribute('y', '0');
  background.setAttribute('width', VIEWBOX.width);
  background.setAttribute('height', VIEWBOX.height);
  svg.appendChild(background);

  const lineLayer = createSvgElement('g');
  lineLayer.classList.add('dot-line-layer');

  const pointLayer = createSvgElement('g');
  pointLayer.classList.add('dot-point-layer');

  const previewGroup = createSvgElement('g');
  previewGroup.classList.add('dot-preview');
  previewGroup.dataset.active = 'false';

  const previewLine = createSvgElement('line');
  previewLine.classList.add('dot-preview-line');
  previewLine.dataset.active = 'false';

  const previewDot = createSvgElement('circle');
  previewDot.classList.add('dot-preview-dot');
  previewDot.setAttribute('r', 8);

  const previewLabel = createSvgElement('text');
  previewLabel.classList.add('dot-preview-label');
  previewLabel.setAttribute('text-anchor', 'middle');
  previewLabel.setAttribute('alignment-baseline', 'middle');

  previewGroup.append(previewLine, previewDot, previewLabel);

  svg.append(lineLayer, pointLayer, previewGroup);
  wrap.append(message, svg);

  return {
    wrap,
    svg,
    lineLayer,
    pointLayer,
    previewGroup,
    previewLine,
    previewDot,
    previewLabel
  };
}

function getSvgCoords(event) {
  const point = stage.svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const ctm = stage.svg.getScreenCTM();
  if (!ctm) {
    return { x: 0, y: 0 };
  }
  const transformed = point.matrixTransform(ctm.inverse());
  return {
    x: clamp(transformed.x, 0, VIEWBOX.width),
    y: clamp(transformed.y, 0, VIEWBOX.height)
  };
}

function createSvgElement(tag) {
  return document.createElementNS(SVG_NS, tag);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
