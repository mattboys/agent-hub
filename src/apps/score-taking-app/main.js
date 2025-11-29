import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const ACCENT = '#ff7b54';
const DEFAULT_HINT = 'Keep names short so columns stay readable on phones.';

const { body } = createAppShell({
  title: 'Scorecard Studio',
  description:
    'Add the columns you need, jot down per-round scores (positive or negative), and keep the running totals pinned to the top row.',
  accent: ACCENT
});

const app = document.createElement('div');
app.className = 'scorekeeper';

const playerCard = document.createElement('article');
playerCard.className = 'score-card';

const playerHeader = document.createElement('header');
playerHeader.className = 'card-header';
playerHeader.innerHTML = `
  <p class="section-eyebrow">Setup</p>
  <h2>Players & columns</h2>
  <p>Short names keep the grid tight on small screens.</p>
`;
playerCard.appendChild(playerHeader);

const playerForm = document.createElement('form');
playerForm.className = 'player-form';
playerForm.autocomplete = 'off';

const playerInput = document.createElement('input');
playerInput.type = 'text';
playerInput.className = 'player-input';
playerInput.placeholder = 'Add a name (e.g. Ana)…';
playerInput.maxLength = 28;
playerInput.autocomplete = 'off';
playerInput.spellcheck = false;

const addPlayerButton = document.createElement('button');
addPlayerButton.type = 'submit';
addPlayerButton.className = 'primary-button';
addPlayerButton.textContent = 'Add column';

playerForm.append(playerInput, addPlayerButton);

const playerHint = document.createElement('p');
playerHint.className = 'form-hint';
playerHint.textContent = DEFAULT_HINT;

const playerList = document.createElement('div');
playerList.className = 'player-list player-list-empty';

playerCard.append(playerForm, playerHint, playerList);

const tableCard = document.createElement('section');
tableCard.className = 'score-card score-table-card';
tableCard.dataset.state = 'empty';

const tableHeader = document.createElement('div');
tableHeader.className = 'score-table-header';
tableHeader.innerHTML = `
  <p class="section-eyebrow">Rounds</p>
  <h2>Score grid</h2>
  <p>Tap add row every time a round lands. Totals update instantly.</p>
`;

const addRowButton = document.createElement('button');
addRowButton.type = 'button';
addRowButton.className = 'primary-button';
addRowButton.textContent = 'Add row';
addRowButton.disabled = true;

const tableUtilities = document.createElement('div');
tableUtilities.className = 'score-table-utilities';

const totalsStrip = document.createElement('div');
totalsStrip.className = 'totals-strip';
totalsStrip.dataset.state = 'empty';
totalsStrip.textContent = 'Totals appear as soon as you add columns.';

tableUtilities.append(totalsStrip, addRowButton);

tableCard.append(tableHeader, tableUtilities);

const scoreEmpty = document.createElement('p');
scoreEmpty.className = 'score-empty';
scoreEmpty.textContent = 'Add a name to create your grid.';
tableCard.appendChild(scoreEmpty);

const tableWrapper = document.createElement('div');
tableWrapper.className = 'score-table-wrapper';
tableWrapper.dataset.scrollState = 'none';
tableWrapper.addEventListener('scroll', handleTableScroll);
if (typeof window !== 'undefined') {
  window.addEventListener('resize', handleTableScroll);
}
tableCard.appendChild(tableWrapper);

app.append(playerCard, tableCard);
body.appendChild(app);

const state = {
  players: [],
  rows: []
};

let playerCounter = 1;
let rowCounter = 1;

const numberFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

const refs = {
  tableWrapper,
  tableCard,
  addRowButton,
  scoreEmpty,
  playerList,
  playerHint,
  totalsStrip,
  totalCells: [],
  totalBadges: new Map(),
  playerChipTotals: new Map()
};

setPlayerHint();

playerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = playerInput.value.trim();
  if (!name) {
    setPlayerHint('Enter a name before adding.');
    playerInput.focus();
    return;
  }
  if (state.players.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
    setPlayerHint('That name is already in the grid.');
    playerInput.select();
    return;
  }
  addPlayer(name);
  playerInput.value = '';
  setPlayerHint();
  playerInput.focus();
});

playerInput.addEventListener('input', () => {
  if (playerHint.dataset.state === 'error') {
    setPlayerHint();
  }
});

addRowButton.addEventListener('click', () => {
  if (!state.players.length) {
    return;
  }
  addRow();
});

renderPlayerList();
renderScoreTable();

function addPlayer(name) {
  state.players.push({ id: `player-${playerCounter++}`, name });
  state.rows.forEach((row) => {
    row.scores.push('');
  });
  renderPlayerList();
  renderScoreTable();
}

function addRow() {
  const newRow = {
    id: `row-${rowCounter++}`,
    label: '',
    scores: state.players.map(() => '')
  };
  state.rows.push(newRow);
  renderScoreTable();
  requestAnimationFrame(() => {
    const lastRowLabel = refs.tableWrapper.querySelector('tbody tr:last-child .row-label-input');
    if (lastRowLabel) {
      lastRowLabel.focus();
      lastRowLabel.select();
    }
  });
}

function renderPlayerList() {
  refs.playerList.innerHTML = '';
  refs.playerChipTotals = new Map();
  if (!state.players.length) {
    refs.playerList.classList.add('player-list-empty');
    const empty = document.createElement('p');
    empty.className = 'player-empty';
    empty.textContent = 'No columns yet. Add a name above to start.';
    refs.playerList.appendChild(empty);
    return;
  }
  refs.playerList.classList.remove('player-list-empty');
  state.players.forEach((player, index) => {
    const chip = document.createElement('span');
    chip.className = 'player-chip';

    const chipIndex = document.createElement('span');
    chipIndex.className = 'player-chip-index';
    chipIndex.textContent = index + 1;

    const chipName = document.createElement('span');
    chipName.className = 'player-chip-name';
    chipName.textContent = player.name;

    const chipTotal = document.createElement('span');
    chipTotal.className = 'player-chip-total';
    chipTotal.textContent = '0';
    chipTotal.setAttribute('aria-label', `Running total for ${player.name}`);

    chip.append(chipIndex, chipName, chipTotal);
    refs.playerList.appendChild(chip);
    refs.playerChipTotals.set(player.id, chipTotal);
  });
}

function renderScoreTable() {
  if (!state.players.length) {
    refs.tableWrapper.innerHTML = '';
    refs.scoreEmpty.hidden = false;
    refs.scoreEmpty.textContent = 'Add a name to create your grid.';
    refs.tableCard.dataset.state = 'empty';
    refs.addRowButton.disabled = true;
    refs.totalCells = [];
    refs.totalBadges = new Map();
    renderTotalsStrip();
    requestAnimationFrame(updateScrollShadows);
    return;
  }

  refs.addRowButton.disabled = false;
  refs.tableCard.dataset.state = 'ready';
  refs.scoreEmpty.hidden = state.rows.length > 0;
  if (!state.rows.length) {
    refs.scoreEmpty.textContent = 'No rows yet. Tap “Add row” after each round.';
  }

  const table = document.createElement('table');
  table.className = 'score-table';

  const thead = document.createElement('thead');
  const nameRow = document.createElement('tr');

  const corner = document.createElement('th');
  corner.scope = 'col';
  corner.textContent = 'Row';
  nameRow.appendChild(corner);

  state.players.forEach((player) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = player.name;
    nameRow.appendChild(th);
  });

  thead.appendChild(nameRow);

  const totalsRow = document.createElement('tr');
  totalsRow.className = 'totals-row';
  const totalsLabel = document.createElement('th');
  totalsLabel.scope = 'row';
  totalsLabel.textContent = 'Totals';
  totalsRow.appendChild(totalsLabel);

  const totalCells = [];

  state.players.forEach((player, index) => {
    const td = document.createElement('td');
    td.textContent = '0';
    td.dataset.playerId = player.id;
    td.dataset.playerName = player.name;
    totalsRow.appendChild(td);
    totalCells.push(td);
  });

  thead.appendChild(totalsRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  state.rows.forEach((row, rowIndex) => {
    alignRowWithPlayers(row);
    const tr = document.createElement('tr');
    tr.dataset.rowId = row.id;

    const labelCell = document.createElement('th');
    labelCell.scope = 'row';
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.placeholder = `Row ${rowIndex + 1}`;
    labelInput.value = row.label;
    labelInput.className = 'row-label-input';
    labelInput.addEventListener('input', (event) => {
      state.rows[rowIndex].label = event.target.value;
    });
    labelCell.appendChild(labelInput);
    tr.appendChild(labelCell);

    state.players.forEach((player, colIndex) => {
      const cell = document.createElement('td');
      cell.dataset.playerName = player.name;
      const input = document.createElement('input');
      input.type = 'number';
      input.inputMode = 'decimal';
      input.step = 'any';
      input.placeholder = '0';
      input.value = row.scores[colIndex];
      input.className = 'score-input';
      input.addEventListener('input', (event) => {
        state.rows[rowIndex].scores[colIndex] = event.target.value;
        updateTotals();
      });
      cell.appendChild(input);
      tr.appendChild(cell);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);

  refs.tableWrapper.innerHTML = '';
  refs.tableWrapper.appendChild(table);
  refs.totalCells = totalCells;
  renderTotalsStrip();
  updateTotals();
  requestAnimationFrame(updateScrollShadows);
}

let scrollUpdateId = null;

function handleTableScroll() {
  if (scrollUpdateId) {
    cancelAnimationFrame(scrollUpdateId);
  }
  scrollUpdateId = requestAnimationFrame(updateScrollShadows);
}

function updateScrollShadows() {
  scrollUpdateId = null;
  const wrapper = refs.tableWrapper;
  if (!wrapper) {
    return;
  }
  const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;
  if (maxScroll <= 2) {
    wrapper.dataset.scrollState = 'none';
    return;
  }
  const left = wrapper.scrollLeft;
  const atStart = left <= 2;
  const atEnd = left >= maxScroll - 2;
  if (atStart && !atEnd) {
    wrapper.dataset.scrollState = 'right';
    return;
  }
  if (atEnd && !atStart) {
    wrapper.dataset.scrollState = 'left';
    return;
  }
  if (!atStart && !atEnd) {
    wrapper.dataset.scrollState = 'middle';
    return;
  }
  wrapper.dataset.scrollState = 'none';
}

function renderTotalsStrip() {
  const { totalsStrip } = refs;
  if (!totalsStrip) {
    return;
  }
  refs.totalBadges = new Map();
  totalsStrip.innerHTML = '';

  if (!state.players.length) {
    totalsStrip.dataset.state = 'empty';
    const hint = document.createElement('span');
    hint.className = 'totals-empty';
    hint.textContent = 'Totals appear once columns exist.';
    totalsStrip.appendChild(hint);
    return;
  }

  totalsStrip.dataset.state = 'ready';
  state.players.forEach((player) => {
    const badge = document.createElement('span');
    badge.className = 'total-badge';
    const name = document.createElement('span');
    name.className = 'total-badge-name';
    name.textContent = player.name;
    const value = document.createElement('strong');
    value.className = 'total-badge-value';
    value.textContent = '0';
    badge.append(name, value);
    totalsStrip.appendChild(badge);
    refs.totalBadges.set(player.id, value);
  });
}

function updateTotals() {
  if (!refs.totalCells.length) {
    renderTotalsStrip();
    return;
  }

  const totals = state.players.map((_, colIndex) => {
    return state.rows.reduce((acc, row) => acc + parseScore(row.scores[colIndex]), 0);
  });

  const formattedTotals = totals.map((value) => formatSignedNumber(value));

  refs.totalCells.forEach((cell, index) => {
    const total = totals[index];
    cell.textContent = formattedTotals[index];
    cell.dataset.polarity = total > 0 ? 'positive' : total < 0 ? 'negative' : 'neutral';
  });

  state.players.forEach((player, index) => {
    const badge = refs.totalBadges.get(player.id);
    if (badge) {
      badge.textContent = formattedTotals[index];
    }
    const chipTotal = refs.playerChipTotals.get(player.id);
    if (chipTotal) {
      chipTotal.textContent = formattedTotals[index];
    }
  });
}

function alignRowWithPlayers(row) {
  while (row.scores.length < state.players.length) {
    row.scores.push('');
  }
  while (row.scores.length > state.players.length) {
    row.scores.pop();
  }
}

function parseScore(value) {
  if (value === '' || value === undefined || value === null) {
    return 0;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatSignedNumber(value) {
  if (!state.rows.length || !Number.isFinite(value) || value === 0) {
    return '0';
  }
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${numberFormatter.format(value)}`;
}

function setPlayerHint(message = '') {
  if (message) {
    refs.playerHint.textContent = message;
    refs.playerHint.dataset.state = 'error';
    return;
  }
  refs.playerHint.textContent = DEFAULT_HINT;
  refs.playerHint.dataset.state = 'default';
}
