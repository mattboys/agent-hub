import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const ACCENT = '#ff6f61';
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 620;
const MAX_SHAPES = 24;

const { body } = createAppShell({
  title: 'Nesting Algorithm Lab',
  description:
    'Generate convex polygons, then watch a bottom-left skyline heuristic with rotation search pack them onto the sheet. Adjust parameters or add new shapes and the solver reruns instantly.',
  accent: ACCENT
});

const state = {
  shapes: [],
  placements: [],
  failed: [],
  stats: {
    attempts: 0,
    runtime: 0,
    utilisation: 0,
    placedArea: 0
  },
  config: {
    shapeCount: 9,
    maxSides: 8,
    maxRadius: 110,
    translationStep: 6,
    rotationStep: 15,
    padding: 24,
    allowRotation: true,
    autoRerun: true
  },
  colorIndex: 0,
  rerunToken: 0
};

const ui = buildInterface();
state.ui = ui;

registerEventHandlers();
generatePopulation(state.config.shapeCount);
queueSolve('initialise');

function buildInterface() {
  const lab = document.createElement('div');
  lab.className = 'nesting-lab';

  const controls = document.createElement('section');
  controls.className = 'lab-controls';

  const controlsHeader = document.createElement('header');
  controlsHeader.className = 'controls-header';
  controlsHeader.innerHTML = `
    <h2>Controls</h2>
    <p>Alter constraints and rerun to compare layouts. Adding or removing a polygon triggers a fresh solve.</p>
  `;
  controls.appendChild(controlsHeader);

  const controlList = document.createElement('div');
  controlList.className = 'control-list';
  controls.appendChild(controlList);

  const summary = document.createElement('section');
  summary.className = 'solve-summary';
  summary.innerHTML = `
    <h3>Solver snapshot</h3>
    <dl>
      <div>
        <dt>Placed</dt>
        <dd data-field="placed">0</dd>
      </div>
      <div>
        <dt>Failed</dt>
        <dd data-field="failed">0</dd>
      </div>
      <div>
        <dt>Utilisation</dt>
        <dd data-field="utilisation">0%</dd>
      </div>
      <div>
        <dt>Attempts</dt>
        <dd data-field="attempts">0</dd>
      </div>
      <div>
        <dt>Runtime</dt>
        <dd data-field="runtime">0 ms</dd>
      </div>
    </dl>
  `;
  controls.appendChild(summary);

  const actions = document.createElement('div');
  actions.className = 'control-actions';
  controlList.appendChild(actions);

  const canvasWrapper = document.createElement('section');
  canvasWrapper.className = 'canvas-panel';

  const canvasHeader = document.createElement('header');
  canvasHeader.className = 'canvas-header';
  canvasHeader.innerHTML = `
    <h2>Sheet simulation</h2>
    <p>Polygons are coloured by generation order. Hover to inspect IDs.</p>
  `;
  canvasWrapper.appendChild(canvasHeader);

  const canvas = document.createElement('canvas');
  canvas.className = 'nesting-canvas';
  setupHiDPICanvas(canvas, CANVAS_WIDTH, CANVAS_HEIGHT);

  const canvasOverlay = document.createElement('div');
  canvasOverlay.className = 'canvas-overlay';

  const overlayList = document.createElement('ul');
  overlayList.className = 'overlay-list';
  canvasOverlay.appendChild(overlayList);

  canvasWrapper.append(canvas, canvasOverlay);

  lab.append(controls, canvasWrapper);
  body.appendChild(lab);

  const controlElements = {
    shapeCount: createRangeControl('Shape count', {
      min: 3,
      max: MAX_SHAPES,
      step: 1,
      value: state.config.shapeCount,
      hint: 'Number of polygons generated per run.'
    }),
    maxSides: createRangeControl('Max sides per polygon', {
      min: 3,
      max: 10,
      step: 1,
      value: state.config.maxSides,
      hint: 'Upper bound on random convex polygon complexity.'
    }),
    size: createRangeControl('Polygon radius (px)', {
      min: 30,
      max: 140,
      step: 5,
      value: state.config.maxRadius,
      hint: 'Average distance from centre to vertex. Larger shapes make fitting harder.'
    }),
    translationStep: createRangeControl('Translation step (px)', {
      min: 2,
      max: 30,
      step: 1,
      value: state.config.translationStep,
      hint: 'Grid spacing for searching possible placements.'
    }),
    rotationStep: createRangeControl('Rotation step (°)', {
      min: 0,
      max: 45,
      step: 5,
      value: state.config.rotationStep,
      hint: 'Angle increment for orientation search. Set to 0 for no rotation.'
    }),
    padding: createRangeControl('Sheet padding (px)', {
      min: 0,
      max: 80,
      step: 2,
      value: state.config.padding,
      hint: 'Mandatory margin between polygons and sheet edges.'
    })
  };

  actions.append(
    controlElements.shapeCount.group,
    controlElements.maxSides.group,
    controlElements.size.group,
    controlElements.translationStep.group,
    controlElements.rotationStep.group,
    controlElements.padding.group
  );

  const toggleList = document.createElement('div');
  toggleList.className = 'toggle-list';

  const rotationToggle = createCheckboxControl('Allow rotation search', state.config.allowRotation, (checked) => {
    state.config.allowRotation = checked;
    queueSolve('rotation-toggle');
  });

  const autoplayToggle = createCheckboxControl('Auto rerun on adjustments', state.config.autoRerun, (checked) => {
    state.config.autoRerun = checked;
  });

  toggleList.append(rotationToggle.group, autoplayToggle.group);
  controlList.appendChild(toggleList);

  const buttonBar = document.createElement('div');
  buttonBar.className = 'button-bar';

  const regenerateButton = createButton('Regenerate shapes', ACCENT, () => {
    regeneratePopulation();
  });
  const rerunButton = createButton('Rerun solver', '#334155', () => {
    queueSolve('manual-rerun', { immediate: true });
  });
  const addButton = createButton('Add shape', '#22c55e', () => {
    addShape();
  });
  const removeButton = createButton('Remove shape', '#ef4444', () => {
    removeShape();
  });

  buttonBar.append(regenerateButton, rerunButton, addButton, removeButton);
  controlList.appendChild(buttonBar);

  const failureList = document.createElement('ul');
  failureList.className = 'failure-list';
  canvasWrapper.appendChild(failureList);

  for (const key of Object.keys(controlElements)) {
    const control = controlElements[key];
    control.input.addEventListener('input', () => {
      const value = parseInt(control.input.value, 10);
      control.output.textContent = control.input.value;
      if (key === 'shapeCount') {
        adjustShapeCount(value);
      } else if (key === 'maxSides') {
        state.config.maxSides = value;
        if (state.config.autoRerun) {
          regeneratePopulation();
        }
      } else if (key === 'size') {
        state.config.maxRadius = value;
        if (state.config.autoRerun) {
          regeneratePopulation();
        }
      } else if (key === 'translationStep') {
        state.config.translationStep = value;
        queueSolve('translation-step');
      } else if (key === 'rotationStep') {
        state.config.rotationStep = value;
        queueSolve('rotation-step');
      } else if (key === 'padding') {
        state.config.padding = value;
        queueSolve('padding-step');
      }
    });
  }

  return {
    lab,
    controls,
    canvas,
    ctx: canvas.getContext('2d'),
    overlayList,
    failureList,
    summaryFields: {
      placed: summary.querySelector('[data-field="placed"]'),
      failed: summary.querySelector('[data-field="failed"]'),
      utilisation: summary.querySelector('[data-field="utilisation"]'),
      attempts: summary.querySelector('[data-field="attempts"]'),
      runtime: summary.querySelector('[data-field="runtime"]')
    },
    sliders: controlElements,
    buttons: {
      regenerateButton,
      rerunButton,
      addButton,
      removeButton
    }
  };
}

function registerEventHandlers() {
  window.addEventListener('resize', () => {
    setupHiDPICanvas(state.ui.canvas, CANVAS_WIDTH, CANVAS_HEIGHT);
    draw();
  });
}

function adjustShapeCount(target) {
  target = Math.max(3, Math.min(MAX_SHAPES, target));
  state.config.shapeCount = target;
  const current = state.shapes.length;
  if (target > current) {
    for (let i = current; i < target; i += 1) {
      state.shapes.push(createShape());
    }
    queueSolve('shape-count-increase', { immediate: state.config.autoRerun });
  } else if (target < current) {
    state.shapes.splice(target);
    queueSolve('shape-count-decrease', { immediate: state.config.autoRerun });
  } else {
    queueSolve('shape-count-adjust', { immediate: state.config.autoRerun });
  }
  updateOverlay();
}

function regeneratePopulation() {
  state.colorIndex = 0;
  state.shapes = [];
  generatePopulation(state.config.shapeCount);
  queueSolve('regenerate-population', { immediate: true });
}

function generatePopulation(count) {
  for (let i = 0; i < count; i += 1) {
    state.shapes.push(createShape());
  }
  updateOverlay();
}

function addShape() {
  if (state.shapes.length >= MAX_SHAPES) return;
  state.shapes.push(createShape());
  state.config.shapeCount = state.shapes.length;
  state.ui.sliders.shapeCount.input.value = String(state.config.shapeCount);
  state.ui.sliders.shapeCount.output.textContent = String(state.config.shapeCount);
  updateOverlay();
  queueSolve('add-shape', { immediate: true });
}

function removeShape() {
  if (state.shapes.length <= 3) return;
  state.shapes.pop();
  state.config.shapeCount = state.shapes.length;
  state.ui.sliders.shapeCount.input.value = String(state.config.shapeCount);
  state.ui.sliders.shapeCount.output.textContent = String(state.config.shapeCount);
  updateOverlay();
  queueSolve('remove-shape', { immediate: true });
}

function queueSolve(reason, options = {}) {
  const { immediate = false } = options;
  state.rerunToken += 1;
  const currentToken = state.rerunToken;

  if (!state.config.autoRerun && !immediate) {
    return;
  }

  const run = () => {
    const result = runSolver(state.shapes, state.config);
    state.placements = result.placed;
    state.failed = result.failed;
    state.stats = {
      attempts: result.attempts,
      runtime: result.runtime,
      utilisation: result.utilisation,
      placedArea: result.placedArea
    };
    updateSummary();
    updateOverlay();
    updateFailureList();
    draw();
  };

  if (immediate || !state.config.autoRerun) {
    run();
    return;
  }

  window.clearTimeout(queueSolve.timer);
  queueSolve.timer = window.setTimeout(() => {
    if (currentToken === state.rerunToken) {
      run();
    }
  }, 140);
}

function runSolver(shapes, config) {
  const placed = [];
  const failed = [];
  let attempts = 0;
  const start = performance.now();

  const sorted = [...shapes].sort((a, b) => b.area - a.area);
  const angles = computeAngleCandidates(config);
  const width = CANVAS_WIDTH;
  const height = CANVAS_HEIGHT;
  const padding = config.padding;
  const translationStep = Math.max(1, config.translationStep);

  for (const shape of sorted) {
    const placedShape = placeShape(shape, angles, placed, {
      width,
      height,
      padding,
      translationStep
    });
    attempts += placedShape.attempts;
    if (placedShape.success) {
      placed.push(placedShape.payload);
    } else {
      failed.push({
        id: shape.id,
        area: shape.area
      });
    }
  }

  const runtime = Math.round(performance.now() - start);
  const sheetArea = width * height;
  const placedArea = placed.reduce((sum, item) => sum + item.area, 0);
  const utilisation = sheetArea ? Math.min(100, Math.round((placedArea / sheetArea) * 1000) / 10) : 0;

  // Restore input order for rendering overlays.
  placed.sort((a, b) => a.order - b.order);

  return {
    placed,
    failed,
    attempts,
    runtime,
    utilisation,
    placedArea
  };
}

function placeShape(shape, angles, alreadyPlaced, board) {
  let attempts = 0;
  const { width, height, padding, translationStep } = board;
  let resolved = null;

  const angleList = angles.length && state.config.allowRotation ? angles : [0];

  outer: for (const angle of angleList) {
    const rotated = rotatePolygon(shape.basePoints, angle);
    const bounds = getBounds(rotated);
    const offsetX = -bounds.minX;
    const offsetY = -bounds.minY;
    const adjusted = translatePolygon(rotated, offsetX, offsetY);
    const maxX = width - (bounds.maxX - bounds.minX) - padding;
    const maxY = height - (bounds.maxY - bounds.minY) - padding;

    for (let y = padding; y <= maxY; y += translationStep) {
      for (let x = padding; x <= maxX; x += translationStep) {
        attempts += 1;
        const candidate = translatePolygon(adjusted, x, y);
        if (!fitsWithin(candidate, width, height, padding)) continue;
        if (hasOverlap(candidate, alreadyPlaced)) continue;
        resolved = {
          success: true,
          payload: {
            id: shape.id,
            order: shape.order,
            color: shape.color,
            points: candidate,
            rotation: angle,
            area: shape.area,
            centroid: shape.centroid
          },
          attempts
        };
        break outer;
      }
    }
  }

  if (!resolved) {
    resolved = {
      success: false,
      attempts
    };
  }

  return resolved;
}

function computeAngleCandidates(config) {
  const maxAngle = 180;
  const step = Math.max(0, Math.min(90, config.rotationStep));
  if (!config.allowRotation || step === 0) {
    return [0];
  }
  const angles = [0];
  for (let angle = step; angle <= maxAngle; angle += step) {
    angles.push(angle);
  }
  return angles;
}

function createShape() {
  const sides = randomInt(3, state.config.maxSides);
  const maxRadius = state.config.maxRadius;
  const minRadius = Math.max(18, Math.round(maxRadius * 0.45));
  const base = createConvexPolygon(sides, minRadius, maxRadius);
  const centroid = computeCentroid(base);
  const centered = base.map((point) => ({
    x: point.x - centroid.x,
    y: point.y - centroid.y
  }));
  const area = Math.abs(polygonArea(centered));

  return {
    id: `poly-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    order: state.colorIndex += 1,
    basePoints: centered,
    centroid,
    area,
    color: pickColor(state.colorIndex)
  };
}

function createConvexPolygon(sides, minRadius, maxRadius) {
  const angles = [];
  for (let i = 0; i < sides; i += 1) {
    angles.push(Math.random() * Math.PI * 2);
  }
  angles.sort((a, b) => a - b);

  const points = angles.map((angle) => {
    const radius = lerp(minRadius, maxRadius, Math.random());
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    };
  });

  return points;
}

function draw() {
  const ctx = state.ui.ctx;
  const canvas = state.ui.canvas;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground(ctx, canvas);

  for (const placement of state.placements) {
    drawPolygon(ctx, placement);
  }

  ctx.restore();
}

function drawBackground(ctx, canvas) {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(0.5, 0.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x <= canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = state.config.padding ? 2 : 1;
  ctx.strokeRect(
    state.config.padding,
    state.config.padding,
    canvas.width - state.config.padding * 2,
    canvas.height - state.config.padding * 2
  );
}

function drawPolygon(ctx, placement) {
  const points = placement.points;
  if (!points.length) return;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = placement.color;
  ctx.globalAlpha = 0.85;
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.7)';
  ctx.stroke();

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  const centroid = computeCentroid(points);
  ctx.font = '12px "JetBrains Mono", Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(placement.id, centroid.x, centroid.y);

  ctx.restore();
}

function updateSummary() {
  const { summaryFields } = state.ui;
  summaryFields.placed.textContent = `${state.placements.length} / ${state.shapes.length}`;
  summaryFields.failed.textContent = String(state.failed.length);
  summaryFields.utilisation.textContent = `${state.stats.utilisation.toFixed(1)}%`;
  summaryFields.attempts.textContent = state.stats.attempts.toLocaleString();
  summaryFields.runtime.textContent = `${state.stats.runtime} ms`;
}

function updateOverlay() {
  const list = state.ui.overlayList;
  list.innerHTML = '';
  state.shapes.forEach((shape) => {
    const item = document.createElement('li');
    item.style.setProperty('--swatch', shape.color);
    item.textContent = `${shape.id} · ${shape.area.toFixed(0)}px²`;
    list.appendChild(item);
  });
}

function updateFailureList() {
  const list = state.ui.failureList;
  list.innerHTML = '';
  if (!state.failed.length) {
    const success = document.createElement('p');
    success.className = 'all-fit';
    success.textContent = 'All polygons fitted inside the sheet.';
    list.appendChild(success);
    return;
  }
  const headline = document.createElement('p');
  headline.className = 'fail-headline';
  headline.textContent = 'Unplaced polygons';
  list.appendChild(headline);
  state.failed.forEach((entry) => {
    const li = document.createElement('li');
    li.textContent = `${entry.id} (${entry.area.toFixed(0)}px²)`;
    list.appendChild(li);
  });
}

function fitsWithin(points, width, height, padding) {
  for (const point of points) {
    if (point.x < padding || point.y < padding) return false;
    if (point.x > width - padding) return false;
    if (point.y > height - padding) return false;
  }
  return true;
}

function hasOverlap(candidate, placed) {
  for (const existing of placed) {
    if (boundingBoxesOverlap(candidate, existing.points) && polygonsOverlap(candidate, existing.points)) {
      return true;
    }
  }
  return false;
}

function boundingBoxesOverlap(aPoints, bPoints) {
  const a = getBounds(aPoints);
  const b = getBounds(bPoints);
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

function polygonsOverlap(aPoints, bPoints) {
  return !hasSeparatingAxis(aPoints, bPoints) && !hasSeparatingAxis(bPoints, aPoints);
}

function hasSeparatingAxis(aPoints, bPoints) {
  for (let i = 0; i < aPoints.length; i += 1) {
    const p1 = aPoints[i];
    const p2 = aPoints[(i + 1) % aPoints.length];
    const axis = { x: -(p2.y - p1.y), y: p2.x - p1.x };
    const normalised = normalise(axis);
    const [amin, amax] = projectPolygon(aPoints, normalised);
    const [bmin, bmax] = projectPolygon(bPoints, normalised);
    if (amax < bmin || bmax < amin) {
      return true;
    }
  }
  return false;
}

function projectPolygon(points, axis) {
  let min = Infinity;
  let max = -Infinity;
  for (const point of points) {
    const projection = point.x * axis.x + point.y * axis.y;
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }
  return [min, max];
}

function normalise(vector) {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return {
    x: vector.x / length,
    y: vector.y / length
  };
}

function rotatePolygon(points, angleDegrees) {
  const angle = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return points.map((point) => ({
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos
  }));
}

function translatePolygon(points, dx, dy) {
  return points.map((point) => ({
    x: point.x + dx,
    y: point.y + dy
  }));
}

function getBounds(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY };
}

function polygonArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}

function computeCentroid(points) {
  const area = polygonArea(points);
  let cx = 0;
  let cy = 0;
  let factor;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    factor = current.x * next.y - next.x * current.y;
    cx += (current.x + next.x) * factor;
    cy += (current.y + next.y) * factor;
  }
  const scaledArea = area * 6 || 1;
  return {
    x: cx / scaledArea,
    y: cy / scaledArea
  };
}

function setupHiDPICanvas(canvas, width, height) {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function createRangeControl(label, { min, max, step, value, hint }) {
  const group = document.createElement('label');
  group.className = 'control-group';
  group.innerHTML = `
    <div>
      <span class="control-label">${label}</span>
      <span class="control-value">${value}</span>
    </div>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" />
    <p class="control-hint">${hint}</p>
  `;
  const input = group.querySelector('input');
  const output = group.querySelector('.control-value');
  return { group, input, output };
}

function createCheckboxControl(label, checked, onChange) {
  const group = document.createElement('label');
  group.className = 'toggle-control';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));

  const span = document.createElement('span');
  span.textContent = label;

  group.append(input, span);
  return { group, input };
}

function createButton(label, background, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'lab-button';
  button.style.setProperty('--btn-color', background);
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function pickColor(index) {
  const goldenRatio = 0.61803398875;
  const hue = (index * goldenRatio * 360) % 360;
  return `hsl(${hue.toFixed(1)}, 64%, 62%)`;
}
