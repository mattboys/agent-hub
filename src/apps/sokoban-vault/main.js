import { createAppShell } from '../shared/appShell.js';
import './styles.css';
import { levelLibrary, levelSets, totalLevelCount } from './levelLibrary.js';

const ACCENT = '#f8961e';
const STORAGE_KEY = 'sokobanVaultProgress-v1';
const NUMBER_FORMAT = new Intl.NumberFormat();

const MOVE_KEYS = {
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  w: { dx: 0, dy: -1 },
  s: { dx: 0, dy: 1 },
  a: { dx: -1, dy: 0 },
  d: { dx: 1, dy: 0 },
  k: { dx: 0, dy: -1 },
  j: { dx: 0, dy: 1 },
  h: { dx: -1, dy: 0 },
  l: { dx: 1, dy: 0 }
};

const progress = loadProgress();
const firstIncompleteIndex = findFirstIncompleteIndex(progress);
const initialIndex = firstIncompleteIndex === -1 ? 0 : firstIncompleteIndex;

const { body } = createAppShell({
  title: 'Sokoban Vault',
  description:
    'Push crates through hundreds of curated Sokoban levels from Microban, Sasquatch, and XSokoban. Track completions and jump to any puzzle instantly.',
  accent: ACCENT,
  status: `${totalLevelCount} levels`
});

const ui = buildInterface(levelLibrary, levelSets);
body.appendChild(ui.layout);

const state = {
  levelIndex: initialIndex,
  width: 0,
  height: 0,
  tiles: [],
  targets: new Set(),
  boxes: new Set(),
  player: { x: 0, y: 0 },
  moves: 0,
  pushes: 0,
  history: []
};

loadLevel(initialIndex);
attachEvents();
updateLevelSelectorState();
setStatus('Use arrows, WASD, or HJKL to move crates.');

function attachEvents() {
  ui.controls.reset.addEventListener('click', () => {
    loadLevel(state.levelIndex);
    setStatus('Level reset.', 'info');
  });

  ui.controls.undo.addEventListener('click', () => {
    undoMove();
  });

  ui.controls.prev.addEventListener('click', () => {
    navigateLevel(-1);
  });

  ui.controls.next.addEventListener('click', () => {
    navigateLevel(1);
  });

  ui.controls.nextUnsolved.addEventListener('click', () => {
    jumpToNextIncomplete();
  });

  registerPadButton(ui.controls.pad?.up, 0, -1);
  registerPadButton(ui.controls.pad?.down, 0, 1);
  registerPadButton(ui.controls.pad?.left, -1, 0);
  registerPadButton(ui.controls.pad?.right, 1, 0);

  ui.overlayButton.addEventListener('click', () => {
    jumpToNextIncomplete();
  });

  ui.filters.search.addEventListener('input', () => {
    applyLevelFilter();
  });

  ui.filters.setSelect.addEventListener('change', () => {
    applyLevelFilter();
  });

  window.addEventListener('keydown', handleKeyDown);
  enableSwipeControls();
}

function handleKeyDown(event) {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const vector = MOVE_KEYS[key];
  if (!vector) {
    return;
  }
  if (isTypingTarget(event.target)) {
    return;
  }
  event.preventDefault();
  attemptMove(vector.dx, vector.dy);
}

function loadLevel(index) {
  const boundedIndex = ((index % levelLibrary.length) + levelLibrary.length) % levelLibrary.length;
  state.levelIndex = boundedIndex;
  const level = levelLibrary[boundedIndex];
  const parsed = parseLevel(level);

  state.width = parsed.width;
  state.height = parsed.height;
  state.tiles = parsed.tiles;
  state.targets = parsed.targets;
  state.boxes = parsed.boxes;
  state.player = parsed.player;
  state.moves = 0;
  state.pushes = 0;
  state.history = [];

  ui.boardWrapper.dataset.state = 'playing';

  renderBoard();
  updateHud();
  updateStats();
  updateLevelSelectorState();
  ui.board.focus({ preventScroll: true });
}

function parseLevel(level) {
  const tiles = [];
  const boxes = new Set();
  const targets = new Set();
  let player = null;

  for (let y = 0; y < level.rows.length; y += 1) {
    const row = level.rows[y];
    const tileRow = [];
    for (let x = 0; x < row.length; x += 1) {
      const char = row[x];
      const tile = {
        wall: false,
        target: false
      };

      if (char === '#') {
        tile.wall = true;
      } else if (char === '.') {
        tile.target = true;
      } else if (char === '$') {
        boxes.add(keyFor(x, y));
      } else if (char === '*') {
        boxes.add(keyFor(x, y));
        tile.target = true;
      } else if (char === '@') {
        player = { x, y };
      } else if (char === '+') {
        player = { x, y };
        tile.target = true;
      }

      if (tile.target) {
        targets.add(keyFor(x, y));
      }
      tileRow.push(tile);
    }
    tiles.push(tileRow);
  }

  if (!player) {
    throw new Error(`Level ${level.title} is missing a player start.`);
  }

  return {
    width: level.width,
    height: level.height,
    tiles,
    boxes,
    targets,
    player
  };
}

function attemptMove(dx, dy) {
  if (!dx && !dy) {
    return;
  }
  const nextX = state.player.x + dx;
  const nextY = state.player.y + dy;
  if (!isInside(nextX, nextY)) {
    return;
  }

  const nextTile = state.tiles[nextY]?.[nextX];
  if (!nextTile || nextTile.wall) {
    bump();
    return;
  }

  const nextKey = keyFor(nextX, nextY);
  if (state.boxes.has(nextKey)) {
    const pushX = nextX + dx;
    const pushY = nextY + dy;
    if (!isInside(pushX, pushY)) {
      bump();
      return;
    }
    const pushTile = state.tiles[pushY]?.[pushX];
    const pushKey = keyFor(pushX, pushY);
    if (!pushTile || pushTile.wall || state.boxes.has(pushKey)) {
      bump();
      return;
    }
    pushHistory();
    state.boxes.delete(nextKey);
    state.boxes.add(pushKey);
    state.player = { x: nextX, y: nextY };
    state.moves += 1;
    state.pushes += 1;
  } else {
    pushHistory();
    state.player = { x: nextX, y: nextY };
    state.moves += 1;
  }

  renderBoard();
  updateStats();
  checkSolved();
}

function pushHistory() {
  state.history.push({
    player: { ...state.player },
    boxes: Array.from(state.boxes),
    moves: state.moves,
    pushes: state.pushes
  });
  if (state.history.length > 2000) {
    state.history.shift();
  }
}

function undoMove() {
  const snapshot = state.history.pop();
  if (!snapshot) {
    setStatus('Nothing to undo.', 'muted');
    return;
  }
  state.player = { ...snapshot.player };
  state.boxes = new Set(snapshot.boxes);
  state.moves = snapshot.moves;
  state.pushes = snapshot.pushes;
  ui.boardWrapper.dataset.state = 'playing';
  renderBoard();
  updateStats();
  setStatus('Move undone.', 'info');
}

function renderBoard() {
  ui.board.style.setProperty('--cols', state.width);
  ui.board.textContent = '';
  const fragment = document.createDocumentFragment();

  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      const tile = state.tiles[y][x];
      const key = keyFor(x, y);
      const cell = document.createElement('div');
      cell.className = 'tile';
      cell.dataset.tile = tile.wall ? 'wall' : tile.target ? 'target' : 'floor';

      if (state.boxes.has(key)) {
        cell.dataset.box = state.targets.has(key) ? 'settled' : 'crate';
      }
      if (state.player.x === x && state.player.y === y) {
        cell.dataset.player = state.targets.has(key) ? 'goal' : 'active';
      }

      fragment.appendChild(cell);
    }
  }

  ui.board.appendChild(fragment);
}

function updateHud() {
  const level = levelLibrary[state.levelIndex];
  ui.stats.levelName.textContent = level.title;
  ui.stats.setName.textContent = `${level.setTitle} • ${level.author}`;
  ui.stats.difficulty.textContent = level.difficulty;
  ui.stats.targets.textContent = `${level.targetCount} goals`;
}

function updateStats() {
  ui.stats.moves.textContent = NUMBER_FORMAT.format(state.moves);
  ui.stats.pushes.textContent = NUMBER_FORMAT.format(state.pushes);
  ui.stats.home.textContent = `${boxesOnTargets()} / ${state.targets.size}`;
}

function boxesOnTargets() {
  let settled = 0;
  state.boxes.forEach((key) => {
    if (state.targets.has(key)) {
      settled += 1;
    }
  });
  return settled;
}

function checkSolved() {
  if (state.targets.size === 0) {
    return;
  }
  const solved = [...state.targets].every((key) => state.boxes.has(key));
  if (!solved) {
    ui.boardWrapper.dataset.state = 'playing';
    return;
  }
  ui.boardWrapper.dataset.state = 'solved';
  const level = levelLibrary[state.levelIndex];
  setStatus(`Solved ${level.title} in ${state.moves} moves.`, 'success');
  recordCompletion(level, state.moves, state.pushes);
}

function recordCompletion(level, moves, pushes) {
  const previous = progress.completed[level.id];
  if (previous) {
    const improved =
      moves < previous.moves || (moves === previous.moves && pushes < previous.pushes);
    if (!improved) {
      return;
    }
  }
  progress.completed[level.id] = {
    moves,
    pushes,
    solvedAt: Date.now()
  };
  persistProgress();
  updateLevelSelectorState();
}

function persistProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    console.error('Unable to persist progress', error);
  }
}

function loadProgress() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && typeof stored === 'object' && stored.completed) {
      return {
        completed: stored.completed
      };
    }
  } catch (error) {
    console.warn('Failed to parse stored progress', error);
  }
  return { completed: {} };
}

function findFirstIncompleteIndex(stored) {
  return levelLibrary.findIndex((level) => !stored.completed?.[level.id]);
}

function updateLevelSelectorState() {
  const perSetCounts = {};
  let solvedTotal = 0;

  ui.levelItems.forEach((entry, idx) => {
    const solved = Boolean(progress.completed[entry.level.id]);
    if (solved) {
      solvedTotal += 1;
      entry.button.dataset.state = 'solved';
      const record = progress.completed[entry.level.id];
      entry.button.title = `Solved in ${record.moves} moves / ${record.pushes} pushes`;
    } else {
      entry.button.dataset.state = 'ready';
      entry.button.removeAttribute('title');
    }
    if (idx === state.levelIndex) {
      entry.button.dataset.current = 'true';
    } else {
      entry.button.removeAttribute('data-current');
    }
    perSetCounts[entry.level.setId] = (perSetCounts[entry.level.setId] || 0) + (solved ? 1 : 0);
  });

  ui.progressBadge.textContent = `${solvedTotal} / ${totalLevelCount} cleared`;

  levelSets.forEach((setMeta) => {
    const solved = perSetCounts[setMeta.id] || 0;
    ui.setSummary[setMeta.id].textContent = `${solved}/${setMeta.count}`;
  });
}

function applyLevelFilter() {
  const term = ui.filters.search.value.trim().toLowerCase();
  const set = ui.filters.setSelect.value;
  ui.levelItems.forEach((entry) => {
    const matchesTerm =
      !term ||
      `${entry.level.title} ${entry.level.setTitle} ${entry.level.difficulty}`
        .toLowerCase()
        .includes(term);
    const matchesSet = !set || entry.level.setId === set;
    entry.button.hidden = !(matchesTerm && matchesSet);
  });
}

function navigateLevel(step) {
  const nextIndex = (state.levelIndex + step + levelLibrary.length) % levelLibrary.length;
  loadLevel(nextIndex);
  setStatus(`Loaded ${levelLibrary[nextIndex].title}.`, 'info');
}

function jumpToNextIncomplete() {
  const start = (state.levelIndex + 1) % levelLibrary.length;
  let index = start;
  do {
    if (!progress.completed[levelLibrary[index].id]) {
      loadLevel(index);
      setStatus(`Jumped to ${levelLibrary[index].title}.`, 'info');
      ui.levelGrid.scrollTo({
        top: ui.levelItems[index].button.offsetTop - 32,
        behavior: 'smooth'
      });
      return;
    }
    index = (index + 1) % levelLibrary.length;
  } while (index !== start);

  setStatus('Every level is complete. Feel free to replay favorites!', 'success');
}

function bump() {
  ui.boardWrapper.dataset.bump = 'true';
  window.requestAnimationFrame(() => {
    ui.boardWrapper.dataset.bump = 'false';
  });
}

function updateStatus(message, tone) {
  setStatus(message, tone);
}

function setStatus(message, tone = 'muted') {
  ui.status.textContent = message;
  ui.status.dataset.tone = tone;
}

function registerPadButton(button, dx, dy) {
  if (!button) return;
  button.addEventListener('click', () => attemptMove(dx, dy));
}

function isInside(x, y) {
  return y >= 0 && y < state.height && x >= 0 && x < state.width;
}

function keyFor(x, y) {
  return `${x}:${y}`;
}

function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    target.isContentEditable ||
    target.getAttribute?.('role') === 'textbox'
  );
}

function buildInterface(levels, sets) {
  const layout = document.createElement('div');
  layout.className = 'sokoban-layout';

  const playPanel = document.createElement('section');
  playPanel.className = 'play-panel';

  const hud = document.createElement('header');
  hud.className = 'level-hud';

  const levelName = document.createElement('h2');
  levelName.textContent = 'Loading…';

  const metaLine = document.createElement('p');
  metaLine.className = 'level-meta';

  const setName = document.createElement('span');
  setName.className = 'meta-chip';

  const difficulty = document.createElement('span');
  difficulty.className = 'meta-chip';

  const targets = document.createElement('span');
  targets.className = 'meta-chip';

  metaLine.append(setName, difficulty, targets);
  hud.append(levelName, metaLine);

  const statGrid = document.createElement('dl');
  statGrid.className = 'stat-grid';

  const movesLabel = createStatBlock('Moves');
  const pushesLabel = createStatBlock('Pushes');
  const homeLabel = createStatBlock('Boxes on goals');

  statGrid.append(movesLabel.wrapper, pushesLabel.wrapper, homeLabel.wrapper);

  const boardWrapper = document.createElement('div');
  boardWrapper.className = 'board-wrapper';

  const board = document.createElement('div');
  board.className = 'sokoban-board';
  board.setAttribute('role', 'grid');
  board.setAttribute('aria-label', 'Sokoban board');
  board.tabIndex = 0;

  const solvedBanner = document.createElement('div');
  solvedBanner.className = 'solved-banner';
  solvedBanner.innerHTML = `
    <p>Crates aligned!</p>
    <button type="button" class="primary-button">Play next unsolved ↗</button>
  `;

  boardWrapper.append(board, solvedBanner);

  const controlRow = document.createElement('div');
  controlRow.className = 'control-row';

  const undoButton = createGhostButton('Undo');
  const resetButton = createGhostButton('Restart');
  const prevButton = createGhostButton('Prev');
  const nextButton = createGhostButton('Next');
  const nextUnsolvedButton = createPrimaryButton('Next unsolved');

  controlRow.append(undoButton, resetButton, prevButton, nextButton, nextUnsolvedButton);

  const controlPad = document.createElement('div');
  controlPad.className = 'control-pad';
  controlPad.setAttribute('aria-label', 'Directional controls');

  const padButtons = {
    up: createDirectionButton('↑', 'Move up'),
    down: createDirectionButton('↓', 'Move down'),
    left: createDirectionButton('←', 'Move left'),
    right: createDirectionButton('→', 'Move right')
  };

  padButtons.up.style.gridArea = 'up';
  padButtons.down.style.gridArea = 'down';
  padButtons.left.style.gridArea = 'left';
  padButtons.right.style.gridArea = 'right';

  const padCenter = document.createElement('div');
  padCenter.className = 'pad-center';
  padCenter.style.gridArea = 'center';
  padCenter.textContent = 'Swipe or tap';

  controlPad.append(
    createPadSpacer(),
    padButtons.up,
    createPadSpacer(),
    padButtons.left,
    padCenter,
    padButtons.right,
    createPadSpacer(),
    padButtons.down,
    createPadSpacer()
  );

  const status = document.createElement('p');
  status.className = 'status-bar';
  status.dataset.tone = 'muted';

  const helperCard = document.createElement('section');
  helperCard.className = 'helper-card';
  helperCard.innerHTML = `
    <h3>How to play</h3>
    <ul>
      <li>Use arrows, WASD, or HJKL to step around the warehouse.</li>
      <li>On mobile, tap the arrow pad or swipe across the board to move.</li>
      <li>You can only push one crate at a time, never pull.</li>
      <li>Undo is unlimited; stash clever states to explore alternate ideas.</li>
    </ul>
    <p class="credits">
      Level packs sourced from David W. Skinner's Microban + Sasquatch collections and the XSokoban community archive (via the open-source sokoban-go repository).
    </p>
  `;

  playPanel.append(hud, statGrid, boardWrapper, controlRow, controlPad, status, helperCard);

  const selectorPanel = document.createElement('section');
  selectorPanel.className = 'selector-panel';

  const selectorHeader = document.createElement('div');
  selectorHeader.className = 'selector-header';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search title, set, or difficulty';
  searchInput.autocomplete = 'off';

  const setSelect = document.createElement('select');
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'All sets';
  setSelect.appendChild(defaultOption);

  sets.forEach((set) => {
    const option = document.createElement('option');
    option.value = set.id;
    option.textContent = `${set.title} (${set.count})`;
    setSelect.appendChild(option);
  });

  const progressBadge = document.createElement('span');
  progressBadge.className = 'progress-badge';
  progressBadge.textContent = `0 / ${totalLevelCount} cleared`;

  selectorHeader.append(searchInput, setSelect, progressBadge);

  const levelGrid = document.createElement('div');
  levelGrid.className = 'level-grid';

  const levelItems = [];

  levels.forEach((level, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'level-chip';
    button.dataset.set = level.setId;
    button.dataset.difficulty = level.difficulty;
    button.innerHTML = `
      <span class="chip-title">${level.title}</span>
      <span class="chip-meta">${level.setTitle} • ${level.targetCount} goals</span>
    `;
    button.addEventListener('click', () => {
      loadLevel(index);
      setStatus(`Loaded ${level.title}.`, 'info');
      board.focus({ preventScroll: false });
    });
    levelGrid.appendChild(button);
    levelItems.push({ button, level });
  });

  const setSummaryList = document.createElement('ul');
  setSummaryList.className = 'set-summary';
  const setSummary = {};

  sets.forEach((set) => {
    const item = document.createElement('li');
    item.innerHTML = `
      <div>
        <strong>${set.title}</strong>
        <p>${set.count} puzzles • ${set.difficulty}</p>
      </div>
      <span class="set-progress" data-set="${set.id}">0/${set.count}</span>
    `;
    setSummary[set.id] = item.querySelector('.set-progress');
    setSummaryList.appendChild(item);
  });

  selectorPanel.append(selectorHeader, levelGrid, setSummaryList);

  layout.append(playPanel, selectorPanel);

  return {
    layout,
    board,
    boardWrapper,
    overlayButton: solvedBanner.querySelector('button'),
    status,
    stats: {
      levelName,
      setName,
      difficulty,
      targets,
      moves: movesLabel.value,
      pushes: pushesLabel.value,
      home: homeLabel.value
    },
    controls: {
      undo: undoButton,
      reset: resetButton,
      prev: prevButton,
      next: nextButton,
      nextUnsolved: nextUnsolvedButton,
      pad: padButtons
    },
    filters: {
      search: searchInput,
      setSelect
    },
    progressBadge,
    levelItems,
    levelGrid,
    setSummary
  };
}

function createStatBlock(label) {
  const wrapper = document.createElement('div');
  wrapper.className = 'stat';
  const title = document.createElement('span');
  title.textContent = label;
  const value = document.createElement('strong');
  value.textContent = '0';
  wrapper.append(title, value);
  return { wrapper, value };
}

function createGhostButton(label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ghost-button';
  button.textContent = label;
  return button;
}

function createPrimaryButton(label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'primary-button';
  button.textContent = label;
  return button;
}

function createDirectionButton(symbol, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pad-button';
  button.textContent = symbol;
  button.setAttribute('aria-label', label);
  return button;
}

function createPadSpacer() {
  const span = document.createElement('span');
  span.className = 'pad-spacer';
  return span;
}

function enableSwipeControls() {
  let startX = 0;
  let startY = 0;
  let pointerId = null;
  let active = false;

  const threshold = 24;

  ui.board.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.pointerType === 'mouse') {
      return;
    }
    active = true;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    try {
      ui.board.setPointerCapture(pointerId);
    } catch (error) {
      // ignored
    }
  });

  ui.board.addEventListener('pointerup', (event) => {
    if (!active || event.pointerId !== pointerId) {
      return;
    }
    active = false;
    pointerId = null;
    try {
      ui.board.releasePointerCapture(event.pointerId);
    } catch (error) {
      // ignored
    }

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < threshold) {
      return;
    }

    if (absX > absY) {
      attemptMove(dx > 0 ? 1 : -1, 0);
    } else {
      attemptMove(0, dy > 0 ? 1 : -1);
    }
  });

  ui.board.addEventListener('pointercancel', (event) => {
    if (event.pointerId === pointerId) {
      active = false;
      pointerId = null;
    }
  });
}
