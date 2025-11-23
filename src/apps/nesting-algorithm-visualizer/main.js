import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const ACCENT = '#ff6f61';
const MIN_RECTANGLES = 3;
const MAX_RECTANGLES = 42;
const MIN_CANVAS_SIZE = 320;
const MAX_CANVAS_SIZE = 1800;
const MIN_RECT_SIZE = 20;
const ANIMATION_STEP_MS = 240;

const algorithmChoices = [
  { value: 'bottom-left', label: 'Bottom-left skyline' },
  { value: 'shelf', label: 'Shelf (next fit)' },
  { value: 'binary-tree', label: 'Binary split' }
];

const heuristicChoices = [
  { value: 'area-desc', label: 'Largest area first' },
  { value: 'height-desc', label: 'Tallest first' },
  { value: 'width-desc', label: 'Widest first' },
  { value: 'input-order', label: 'Creation order' }
];

const { body } = createAppShell({
  title: 'Nesting Algorithm Lab',
  description:
    'Play with rectangle nesting strategies, constrain the sheet, and watch each packing approach animate its placements step-by-step.',
  accent: ACCENT
});

const state = {
  rectangles: [],
  placements: [],
  failed: [],
  stats: {
    attempts: 0,
    runtime: 0,
    utilisation: 0,
    placedArea: 0
  },
  config: {
    rectangleCount: 10,
    minWidth: 60,
    maxWidth: 220,
    minHeight: 40,
    maxHeight: 160,
    padding: 18,
    canvasWidth: 960,
    canvasHeight: 540,
    gridSize: 24,
    snapToGrid: false,
    autoRerun: true,
    algorithm: algorithmChoices[0].value,
    heuristic: heuristicChoices[0].value,
    animationSpeed: ANIMATION_STEP_MS
  },
  colorIndex: 0,
  nextLabel: 1,
  rerunToken: 0,
  animation: null,
  ui: null
};

const ui = buildInterface();
state.ui = ui;

registerEventHandlers();
seedRectangles(state.config.rectangleCount);
queueSolve('initialise', { immediate: true });

function buildInterface() {
  const lab = document.createElement('div');
  lab.className = 'nesting-lab';

  const controls = document.createElement('section');
  controls.className = 'lab-controls';

  const controlsHeader = document.createElement('header');
  controlsHeader.className = 'controls-header';
  controlsHeader.innerHTML = `
    <h2>Controls</h2>
    <p>Generate rectangles, tune the sheet, and compare different packing and ordering heuristics.</p>
  `;
  controls.appendChild(controlsHeader);

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

  const controlList = document.createElement('div');
  controlList.className = 'control-list';
  controls.appendChild(controlList);

  const sliders = {
    rectangleCount: createRangeControl('Rectangles per run', {
      min: MIN_RECTANGLES,
      max: MAX_RECTANGLES,
      step: 1,
      value: state.config.rectangleCount,
      hint: 'How many rectangles to keep in the pool.'
    }),
    minWidth: createRangeControl('Minimum width (px)', {
      min: MIN_RECT_SIZE,
      max: 400,
      step: 4,
      value: state.config.minWidth,
      hint: 'Lower bound for random rectangle width.'
    }),
    maxWidth: createRangeControl('Maximum width (px)', {
      min: 40,
      max: 420,
      step: 4,
      value: state.config.maxWidth,
      hint: 'Upper bound for random rectangle width.'
    }),
    minHeight: createRangeControl('Minimum height (px)', {
      min: MIN_RECT_SIZE,
      max: 360,
      step: 4,
      value: state.config.minHeight,
      hint: 'Lower bound for random rectangle height.'
    }),
    maxHeight: createRangeControl('Maximum height (px)', {
      min: 40,
      max: 400,
      step: 4,
      value: state.config.maxHeight,
      hint: 'Upper bound for random rectangle height.'
    }),
    padding: createRangeControl('Sheet padding (px)', {
      min: 0,
      max: 120,
      step: 2,
      value: state.config.padding,
      hint: 'Keep rectangles away from the sheet edge.'
    }),
    gridSize: createRangeControl('Grid size (px)', {
      min: 8,
      max: 120,
      step: 4,
      value: state.config.gridSize,
      hint: 'Spacing for snap-to-grid placements.'
    })
  };

  const rangeWrapper = document.createElement('div');
  rangeWrapper.className = 'control-actions';
  rangeWrapper.append(
    sliders.rectangleCount.group,
    sliders.minWidth.group,
    sliders.maxWidth.group,
    sliders.minHeight.group,
    sliders.maxHeight.group,
    sliders.padding.group,
    sliders.gridSize.group
  );
  controlList.appendChild(rangeWrapper);

  const selectors = {
    algorithm: createSelectControl('Packing algorithm', algorithmChoices, state.config.algorithm),
    heuristic: createSelectControl('Rectangle ordering', heuristicChoices, state.config.heuristic)
  };

  const selectorGrid = document.createElement('div');
  selectorGrid.className = 'packing-controls';
  selectorGrid.append(selectors.algorithm.group, selectors.heuristic.group);
  controlList.appendChild(selectorGrid);

  const canvasSettings = document.createElement('div');
  canvasSettings.className = 'canvas-settings';
  const numberInputs = {
    canvasWidth: createNumberControl('Canvas width (px)', {
      min: MIN_CANVAS_SIZE,
      max: MAX_CANVAS_SIZE,
      value: state.config.canvasWidth
    }),
    canvasHeight: createNumberControl('Canvas height (px)', {
      min: MIN_CANVAS_SIZE,
      max: MAX_CANVAS_SIZE,
      value: state.config.canvasHeight
    })
  };
  canvasSettings.append(numberInputs.canvasWidth.group, numberInputs.canvasHeight.group);
  controlList.appendChild(canvasSettings);

  const toggleList = document.createElement('div');
  toggleList.className = 'toggle-list';
  const toggles = {
    snapToGrid: createCheckboxControl('Snap everything to the grid', state.config.snapToGrid, (checked) => {
      state.config.snapToGrid = checked;
      sliders.gridSize.input.disabled = !checked;
      resnapRectangles();
      queueSolve('snap-toggle', { immediate: true });
    }),
    autoRerun: createCheckboxControl('Auto rerun on adjustments', state.config.autoRerun, (checked) => {
      state.config.autoRerun = checked;
    })
  };
  toggleList.append(toggles.snapToGrid.group, toggles.autoRerun.group);
  controlList.appendChild(toggleList);

  const buttonBar = document.createElement('div');
  buttonBar.className = 'button-bar';
  const buttons = {
    regenerate: createButton('Regenerate rectangles', ACCENT, () => regenerateRectangles()),
    rerun: createButton('Rerun solver', '#334155', () => queueSolve('manual-rerun', { immediate: true })),
    remove: createButton('Remove last rectangle', '#ef4444', () => {
      removeRectangle();
    })
  };
  buttonBar.append(buttons.regenerate, buttons.rerun, buttons.remove);
  controlList.appendChild(buttonBar);

  const addRectPanel = createAddRectanglePanel();
  controlList.appendChild(addRectPanel.form);

  const inventoryPanel = document.createElement('section');
  inventoryPanel.className = 'inventory-panel';
  inventoryPanel.innerHTML = `
    <header>
      <h3>Rectangle roster</h3>
      <p>Use colour + label to find each rectangle on the canvas.</p>
    </header>
    <ul class="inventory-list"></ul>
  `;
  const inventoryList = inventoryPanel.querySelector('.inventory-list');
  controls.appendChild(inventoryPanel);

  const canvasPanel = document.createElement('section');
  canvasPanel.className = 'canvas-panel';
  const canvasHeader = document.createElement('header');
  canvasHeader.className = 'canvas-header';
  canvasHeader.innerHTML = `
    <h2>Sheet simulation</h2>
    <p>Every solve animates through its placements so you can compare heuristics visually.</p>
  `;
  canvasPanel.appendChild(canvasHeader);

  const canvasViewport = document.createElement('div');
  canvasViewport.className = 'canvas-viewport';
  const canvas = document.createElement('canvas');
  canvas.className = 'nesting-canvas';
  canvasViewport.appendChild(canvas);
  setupHiDPICanvas(canvas, state.config.canvasWidth, state.config.canvasHeight);
  canvasPanel.appendChild(canvasViewport);

  const failureList = document.createElement('ul');
  failureList.className = 'failure-list';
  canvasPanel.appendChild(failureList);

  lab.append(controls, canvasPanel);
  body.appendChild(lab);

  sliders.gridSize.input.disabled = !state.config.snapToGrid;

  wireRangeControls(sliders);
  wireSelectorControls(selectors);
  wireNumberControls(numberInputs);
  wireAddRectanglePanel(addRectPanel);

  return {
    lab,
    controls,
    canvas,
    ctx: canvas.getContext('2d'),
    inventoryList,
    failureList,
    addRectPanel,
    summaryFields: {
      placed: summary.querySelector('[data-field="placed"]'),
      failed: summary.querySelector('[data-field="failed"]'),
      utilisation: summary.querySelector('[data-field="utilisation"]'),
      attempts: summary.querySelector('[data-field="attempts"]'),
      runtime: summary.querySelector('[data-field="runtime"]')
    },
    sliders,
    buttons,
    toggles,
    selectors,
    numberInputs
  };
}

function registerEventHandlers() {
  window.addEventListener('resize', () => {
    setupHiDPICanvas(state.ui.canvas, state.config.canvasWidth, state.config.canvasHeight);
    draw();
  });
}

function wireRangeControls(sliders) {
  Object.entries(sliders).forEach(([key, control]) => {
    control.input.addEventListener('input', () => {
      const value = parseInt(control.input.value, 10);
      control.output.textContent = control.input.value;
      if (key === 'rectangleCount') {
        adjustRectangleCount(value);
        return;
      }
      if (key === 'padding') {
        state.config.padding = value;
        queueSolve('padding-change');
        return;
      }
      if (key === 'gridSize') {
        state.config.gridSize = value;
        if (state.config.snapToGrid) {
          resnapRectangles();
          queueSolve('grid-size-change', { immediate: true });
        }
        return;
      }
      if (key === 'minWidth' || key === 'maxWidth' || key === 'minHeight' || key === 'maxHeight') {
        updateDimensionRange(key, value);
        return;
      }
    });
  });
}

function wireSelectorControls(selectors) {
  selectors.algorithm.select.addEventListener('change', () => {
    state.config.algorithm = selectors.algorithm.select.value;
    queueSolve('algorithm-change');
  });
  selectors.heuristic.select.addEventListener('change', () => {
    state.config.heuristic = selectors.heuristic.select.value;
    queueSolve('heuristic-change');
  });
}

function wireNumberControls(numberInputs) {
  ['canvasWidth', 'canvasHeight'].forEach((key) => {
    numberInputs[key].input.addEventListener('change', () => {
      const value = clamp(numberInputs[key].input.valueAsNumber || 0, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE);
      numberInputs[key].input.value = String(value);
      state.config[key] = state.config.snapToGrid ? snapToGrid(value, state.config.gridSize) : value;
      applyCanvasSize();
    });
  });
}

function wireAddRectanglePanel(panel) {
  panel.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const width = panel.width.valueAsNumber || state.config.minWidth;
    const height = panel.height.valueAsNumber || state.config.minHeight;
    const count = clamp(panel.count.valueAsNumber || 1, 1, 5);
    addCustomRectangles(width, height, count);
    panel.form.reset();
  });
}

function updateDimensionRange(key, value) {
  if (key === 'minWidth') {
    state.config.minWidth = Math.min(value, state.config.maxWidth - 4);
  } else if (key === 'maxWidth') {
    state.config.maxWidth = Math.max(value, state.config.minWidth + 4);
  } else if (key === 'minHeight') {
    state.config.minHeight = Math.min(value, state.config.maxHeight - 4);
  } else if (key === 'maxHeight') {
    state.config.maxHeight = Math.max(value, state.config.minHeight + 4);
  }
  clampDimensionSliders();
  regenerateRectangles({ keepCount: true, silent: true });
  queueSolve('dimension-range', { immediate: true });
}

function clampDimensionSliders() {
  const { minWidth, maxWidth, minHeight, maxHeight } = state.ui.sliders;
  minWidth.input.value = String(state.config.minWidth);
  minWidth.output.textContent = minWidth.input.value;
  maxWidth.input.value = String(state.config.maxWidth);
  maxWidth.output.textContent = maxWidth.input.value;
  minHeight.input.value = String(state.config.minHeight);
  minHeight.output.textContent = minHeight.input.value;
  maxHeight.input.value = String(state.config.maxHeight);
  maxHeight.output.textContent = maxHeight.input.value;
}

function applyCanvasSize() {
  const width = clamp(state.config.canvasWidth, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE);
  const height = clamp(state.config.canvasHeight, MIN_CANVAS_SIZE, MAX_CANVAS_SIZE);
  state.config.canvasWidth = width;
  state.config.canvasHeight = height;
  setupHiDPICanvas(state.ui.canvas, width, height);
  queueSolve('canvas-size', { immediate: true });
}

function adjustRectangleCount(target) {
  const safeTarget = clamp(target, MIN_RECTANGLES, MAX_RECTANGLES);
  state.config.rectangleCount = safeTarget;
  const current = state.rectangles.length;
  if (safeTarget > current) {
    for (let i = current; i < safeTarget; i += 1) {
      state.rectangles.push(createRectangle());
    }
  } else if (safeTarget < current) {
    state.rectangles.splice(safeTarget);
  }
  syncRectangleCountControl();
  updateInventory();
  queueSolve('rect-count', { immediate: state.config.autoRerun });
}

function syncRectangleCountControl() {
  const slider = state.ui.sliders.rectangleCount;
  slider.input.value = String(state.rectangles.length);
  slider.output.textContent = slider.input.value;
}

function seedRectangles(count) {
  state.colorIndex = 0;
  state.nextLabel = 1;
  state.rectangles = [];
  for (let i = 0; i < count; i += 1) {
    state.rectangles.push(createRectangle());
  }
  syncRectangleCountControl();
  updateInventory();
}

function regenerateRectangles(options = {}) {
  const { keepCount = false, silent = false } = options;
  if (!keepCount) {
    state.config.rectangleCount = clamp(state.config.rectangleCount, MIN_RECTANGLES, MAX_RECTANGLES);
  }
  seedRectangles(state.config.rectangleCount);
  if (!silent) {
    queueSolve('regenerate', { immediate: true });
  }
}

function addCustomRectangles(width, height, count) {
  const additions = Math.min(count, MAX_RECTANGLES - state.rectangles.length);
  for (let i = 0; i < additions; i += 1) {
    state.rectangles.push(createRectangle({ width, height }));
  }
  state.config.rectangleCount = state.rectangles.length;
  syncRectangleCountControl();
  updateInventory();
  queueSolve('custom-add', { immediate: true });
}

function removeRectangle() {
  if (state.rectangles.length <= MIN_RECTANGLES) return;
  state.rectangles.pop();
  state.config.rectangleCount = state.rectangles.length;
  syncRectangleCountControl();
  updateInventory();
  queueSolve('remove-rectangle', { immediate: true });
}

function resnapRectangles() {
  if (!state.config.snapToGrid) return;
  state.rectangles = state.rectangles.map((rect) => {
    const width = snapDimension(rect.width);
    const height = snapDimension(rect.height);
    return {
      ...rect,
      width,
      height,
      area: width * height
    };
  });
  updateInventory();
}

function queueSolve(reason, options = {}) {
  const { immediate = false } = options;
  state.rerunToken += 1;
  const currentToken = state.rerunToken;

  if (!state.config.autoRerun && !immediate) {
    return;
  }

  const run = () => {
    cancelAnimation();
    const result = runSolver(state.rectangles, state.config);
    state.placements = result.placed;
    state.failed = result.failed;
    state.stats = {
      attempts: result.attempts,
      runtime: result.runtime,
      utilisation: result.utilisation,
      placedArea: result.placedArea
    };
    updateSummary();
    updateInventory();
    updateFailureList();
    if (state.placements.length) {
      startAnimation(state.placements);
    } else {
      draw();
    }
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
  }, 130);
}

function runSolver(rectangles, config) {
  const ordered = orderRectangles(rectangles, config.heuristic);
  const board = {
    width: config.canvasWidth,
    height: config.canvasHeight,
    padding: config.padding,
    gridSize: config.gridSize,
    snapToGrid: config.snapToGrid
  };
  let result;
  const start = performance.now();
  if (config.algorithm === 'shelf') {
    result = runShelfPacking(ordered, board);
  } else if (config.algorithm === 'binary-tree') {
    result = runBinaryPacking(ordered, board);
  } else {
    result = runBottomLeftPacking(ordered, board);
  }

  const runtime = Math.round(performance.now() - start);
  const placedArea = result.placements.reduce((sum, rect) => sum + rect.width * rect.height, 0);
  const sheetArea = board.width * board.height;
  const utilisation = sheetArea ? Math.min(100, (placedArea / sheetArea) * 100) : 0;

  return {
    placed: result.placements,
    failed: result.failed,
    attempts: result.attempts,
    runtime,
    utilisation,
    placedArea
  };
}

function orderRectangles(rectangles, heuristic) {
  const ordered = rectangles.map((rect) => ({ ...rect }));
  switch (heuristic) {
    case 'height-desc':
      ordered.sort((a, b) => b.height - a.height || b.width - a.width);
      break;
    case 'width-desc':
      ordered.sort((a, b) => b.width - a.width || b.height - a.height);
      break;
    case 'input-order':
      ordered.sort((a, b) => a.order - b.order);
      break;
    default:
      ordered.sort((a, b) => b.area - a.area);
  }
  return ordered;
}

function runBottomLeftPacking(rectangles, board) {
  const placements = [];
  const failed = [];
  let attempts = 0;
  const step = board.snapToGrid ? board.gridSize : Math.max(4, Math.round(Math.min(board.width, board.height) / 160));
  for (const rect of rectangles) {
    let placed = false;
    const limitX = board.width - board.padding - rect.width;
    const limitY = board.height - board.padding - rect.height;
    for (let y = board.padding; y <= limitY; y += step) {
      for (let x = board.padding; x <= limitX; x += step) {
        attempts += 1;
        const candidate = {
          ...rect,
          x: board.snapToGrid ? snapToGrid(x, board.gridSize) : x,
          y: board.snapToGrid ? snapToGrid(y, board.gridSize) : y
        };
        if (!fitsWithinBoard(candidate, board)) continue;
        if (rectanglesOverlap(candidate, placements)) continue;
        placements.push(candidate);
        placed = true;
        break;
      }
      if (placed) break;
    }
    if (!placed) {
      failed.push(summariseRect(rect));
    }
  }
  return { placements, failed, attempts };
}

function runShelfPacking(rectangles, board) {
  const placements = [];
  const failed = [];
  let attempts = 0;
  let shelfY = board.padding;
  let shelfHeight = 0;
  let cursorX = board.padding;
  const usableWidth = board.width - board.padding;

  for (const rect of rectangles) {
    if (cursorX + rect.width > usableWidth) {
      shelfY += shelfHeight + (board.snapToGrid ? board.gridSize : 8);
      cursorX = board.padding;
      shelfHeight = 0;
    }
    if (shelfY + rect.height > board.height - board.padding) {
      failed.push(summariseRect(rect));
      continue;
    }
    const candidate = {
      ...rect,
      x: board.snapToGrid ? snapToGrid(cursorX, board.gridSize) : cursorX,
      y: board.snapToGrid ? snapToGrid(shelfY, board.gridSize) : shelfY
    };
    if (!fitsWithinBoard(candidate, board) || rectanglesOverlap(candidate, placements)) {
      failed.push(summariseRect(rect));
      continue;
    }
    placements.push(candidate);
    cursorX = candidate.x + rect.width + (board.snapToGrid ? 0 : 4);
    shelfHeight = Math.max(shelfHeight, rect.height);
    attempts += 1;
  }
  return { placements, failed, attempts };
}

function runBinaryPacking(rectangles, board) {
  const placements = [];
  const failed = [];
  let attempts = 0;
  const root = {
    x: board.padding,
    y: board.padding,
    width: board.width - board.padding * 2,
    height: board.height - board.padding * 2,
    used: false,
    right: null,
    down: null
  };

  for (const rect of rectangles) {
    const node = findNode(root, rect.width, rect.height);
    if (node) {
      const split = splitNode(node, rect.width, rect.height);
      const candidate = {
        ...rect,
        x: board.snapToGrid ? snapToGrid(split.x, board.gridSize) : split.x,
        y: board.snapToGrid ? snapToGrid(split.y, board.gridSize) : split.y
      };
      placements.push(candidate);
      attempts += 1;
    } else {
      failed.push(summariseRect(rect));
    }
  }
  return { placements, failed, attempts };
}

function findNode(node, width, height) {
  if (!node) return null;
  if (node.used) {
    return findNode(node.right, width, height) || findNode(node.down, width, height);
  }
  if (width <= node.width && height <= node.height) {
    return node;
  }
  return null;
}

function splitNode(node, width, height) {
  node.used = true;
  node.down = {
    x: node.x,
    y: node.y + height,
    width: node.width,
    height: node.height - height,
    used: false,
    right: null,
    down: null
  };
  node.right = {
    x: node.x + width,
    y: node.y,
    width: node.width - width,
    height,
    used: false,
    right: null,
    down: null
  };
  return node;
}

function fitsWithinBoard(rect, board) {
  return (
    rect.x >= board.padding &&
    rect.y >= board.padding &&
    rect.x + rect.width <= board.width - board.padding + 0.0001 &&
    rect.y + rect.height <= board.height - board.padding + 0.0001
  );
}

function rectanglesOverlap(candidate, placed) {
  return placed.some((existing) => {
    return !(
      candidate.x + candidate.width <= existing.x ||
      candidate.x >= existing.x + existing.width ||
      candidate.y + candidate.height <= existing.y ||
      candidate.y >= existing.y + existing.height
    );
  });
}

function summariseRect(rect) {
  return {
    id: rect.id,
    width: rect.width,
    height: rect.height,
    area: rect.width * rect.height
  };
}

function createRectangle(dimensions = {}) {
  const maxWidth = Math.max(MIN_RECT_SIZE, state.config.canvasWidth - state.config.padding * 2);
  const maxHeight = Math.max(MIN_RECT_SIZE, state.config.canvasHeight - state.config.padding * 2);
  const width = snapDimension(
    clamp(dimensions.width || randomInt(state.config.minWidth, state.config.maxWidth), MIN_RECT_SIZE, maxWidth)
  );
  const height = snapDimension(
    clamp(dimensions.height || randomInt(state.config.minHeight, state.config.maxHeight), MIN_RECT_SIZE, maxHeight)
  );
  const label = `Rect ${String(state.nextLabel).padStart(2, '0')}`;
  const order = state.nextLabel;
  state.nextLabel += 1;
  state.colorIndex += 1;
  return {
    id: label,
    order,
    width,
    height,
    area: width * height,
    color: pickColor(state.colorIndex)
  };
}

function snapDimension(value) {
  if (!state.config.snapToGrid) return value;
  return snapToGrid(value, state.config.gridSize);
}

function snapToGrid(value, step) {
  const safeStep = Math.max(2, step);
  return Math.max(safeStep, Math.round(value / safeStep) * safeStep);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function startAnimation(frames) {
  if (!frames.length) {
    draw();
    return;
  }
  state.animation = {
    frames,
    visibleCount: 0,
    rafId: null,
    lastTimestamp: 0
  };
  draw();
  state.animation.rafId = requestAnimationFrame(stepAnimation);
}

function stepAnimation(timestamp) {
  if (!state.animation) return;
  if (!state.animation.lastTimestamp) {
    state.animation.lastTimestamp = timestamp;
  }
  if (timestamp - state.animation.lastTimestamp >= state.config.animationSpeed) {
    state.animation.visibleCount = Math.min(state.animation.frames.length, state.animation.visibleCount + 1);
    state.animation.lastTimestamp = timestamp;
    draw();
    if (state.animation.visibleCount >= state.animation.frames.length) {
      cancelAnimation();
      return;
    }
  }
  state.animation.rafId = requestAnimationFrame(stepAnimation);
}

function cancelAnimation() {
  if (state.animation?.rafId) {
    cancelAnimationFrame(state.animation.rafId);
  }
  state.animation = null;
}

function getVisiblePlacements() {
  if (state.animation) {
    return state.animation.frames.slice(0, state.animation.visibleCount);
  }
  return state.placements;
}

function draw() {
  const ctx = state.ui.ctx;
  const canvas = state.ui.canvas;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground(ctx, canvas);
  for (const placement of getVisiblePlacements()) {
    drawRectangle(ctx, placement);
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
  const gridSize = state.config.snapToGrid ? state.config.gridSize : 40;
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

function drawRectangle(ctx, placement) {
  ctx.save();
  ctx.fillStyle = placement.color;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(placement.x, placement.y, placement.width, placement.height);

  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.7)';
  ctx.strokeRect(placement.x, placement.y, placement.width, placement.height);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.font = '12px "JetBrains Mono", Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    placement.id,
    placement.x + placement.width / 2,
    placement.y + placement.height / 2
  );
  ctx.restore();
}

function updateSummary() {
  const { summaryFields } = state.ui;
  summaryFields.placed.textContent = `${state.placements.length} / ${state.rectangles.length}`;
  summaryFields.failed.textContent = String(state.failed.length);
  summaryFields.utilisation.textContent = `${state.stats.utilisation.toFixed(1)}%`;
  summaryFields.attempts.textContent = state.stats.attempts.toLocaleString();
  summaryFields.runtime.textContent = `${state.stats.runtime} ms`;
}

function updateInventory() {
  const list = state.ui.inventoryList;
  list.innerHTML = '';
  state.rectangles.forEach((rect) => {
    const item = document.createElement('li');
    item.style.setProperty('--swatch', rect.color);
    item.innerHTML = `
      <span class="rect-label">${rect.id}</span>
      <span>${rect.width}×${rect.height}px</span>
    `;
    list.appendChild(item);
  });
}

function updateFailureList() {
  const list = state.ui.failureList;
  list.innerHTML = '';
  if (!state.failed.length) {
    const success = document.createElement('p');
    success.className = 'all-fit';
    success.textContent = 'All rectangles fitted inside the sheet.';
    list.appendChild(success);
    return;
  }
  const headline = document.createElement('p');
  headline.className = 'fail-headline';
  headline.textContent = 'Unplaced rectangles';
  list.appendChild(headline);
  state.failed.forEach((entry) => {
    const li = document.createElement('li');
    li.textContent = `${entry.id} — ${entry.width}×${entry.height}px`;
    list.appendChild(li);
  });
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

function createSelectControl(label, options, selected) {
  const group = document.createElement('label');
  group.className = 'select-control';
  const select = document.createElement('select');
  options.forEach((option) => {
    const opt = document.createElement('option');
    opt.value = option.value;
    opt.textContent = option.label;
    if (option.value === selected) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
  group.innerHTML = `
    <span class="control-label">${label}</span>
  `;
  group.appendChild(select);
  return { group, select };
}

function createNumberControl(label, { min, max, value }) {
  const group = document.createElement('label');
  group.className = 'number-control';
  group.innerHTML = `
    <span class="control-label">${label}</span>
    <input type="number" min="${min}" max="${max}" value="${value}" />
  `;
  const input = group.querySelector('input');
  return { group, input };
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

function createAddRectanglePanel() {
  const form = document.createElement('form');
  form.className = 'add-rect-panel';
  form.innerHTML = `
    <div>
      <span class="control-label">Add custom rectangle</span>
      <p class="control-hint">Set width, height, and how many to create.</p>
    </div>
    <div class="add-rect-grid">
      <label>Width (px)<input type="number" name="rectWidth" min="${MIN_RECT_SIZE}" max="600" value="120" required /></label>
      <label>Height (px)<input type="number" name="rectHeight" min="${MIN_RECT_SIZE}" max="600" value="80" required /></label>
      <label>Count<input type="number" name="rectCount" min="1" max="5" value="1" required /></label>
    </div>
    <button type="submit" class="lab-button" style="--btn-color:#22c55e;">Add rectangle</button>
  `;
  return {
    form,
    width: form.querySelector('input[name="rectWidth"]'),
    height: form.querySelector('input[name="rectHeight"]'),
    count: form.querySelector('input[name="rectCount"]')
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

function pickColor(index) {
  const goldenRatio = 0.61803398875;
  const hue = (index * goldenRatio * 360) % 360;
  return `hsl(${hue.toFixed(1)}, 64%, 62%)`;
}
