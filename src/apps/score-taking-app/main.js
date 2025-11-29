import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const ACCENT = '#ff7b54';
const DEFAULT_HINT = 'Tip: press Enter to drop the name into the grid.';

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
  <h2>Columns</h2>
  <p>Name every player, team, or category you want to track. Each name becomes a column in the grid.</p>
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
  <div>
    <h2>Score grid</h2>
    <p>Create a fresh row whenever someone scores or a new round finishes.</p>
  </div>
`;

const addRowButton = document.createElement('button');
addRowButton.type = 'button';
addRowButton.className = 'primary-button';
addRowButton.textContent = 'Add row';
addRowButton.disabled = true;

tableHeader.appendChild(addRowButton);
tableCard.appendChild(tableHeader);

const scoreEmpty = document.createElement('p');
scoreEmpty.className = 'score-empty';
scoreEmpty.textContent = 'Add at least one name to spin up the grid.';
tableCard.appendChild(scoreEmpty);

const tableWrapper = document.createElement('div');
tableWrapper.className = 'score-table-wrapper';
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
  totalCells: []
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
}

function renderPlayerList() {
  refs.playerList.innerHTML = '';
  if (!state.players.length) {
    refs.playerList.classList.add('player-list-empty');
    const empty = document.createElement('p');
    empty.className = 'player-empty';
    empty.textContent = 'No columns yet. Add players or teams to begin.';
    refs.playerList.appendChild(empty);
    return;
  }
  refs.playerList.classList.remove('player-list-empty');
  state.players.forEach((player, index) => {
    const chip = document.createElement('span');
    chip.className = 'player-chip';
    chip.textContent = `${index + 1}. ${player.name}`;
    refs.playerList.appendChild(chip);
  });
}

function renderScoreTable() {
  if (!state.players.length) {
    refs.tableWrapper.innerHTML = '';
    refs.scoreEmpty.hidden = false;
    refs.scoreEmpty.textContent = 'Add at least one name to spin up the grid.';
    refs.tableCard.dataset.state = 'empty';
    refs.addRowButton.disabled = true;
    refs.totalCells = [];
    return;
  }

  refs.addRowButton.disabled = false;
  refs.tableCard.dataset.state = 'ready';
  refs.scoreEmpty.hidden = state.rows.length > 0;
  if (!state.rows.length) {
    refs.scoreEmpty.textContent = 'No rows yet. Tap “Add row” whenever someone scores.';
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
  updateTotals();
}

function updateTotals() {
  if (!refs.totalCells.length) {
    return;
  }
  const totals = state.players.map((_, colIndex) => {
    return state.rows.reduce((acc, row) => acc + parseScore(row.scores[colIndex]), 0);
  });

  refs.totalCells.forEach((cell, index) => {
    const total = totals[index];
    cell.textContent = formatSignedNumber(total);
    cell.dataset.polarity = total > 0 ? 'positive' : total < 0 ? 'negative' : 'neutral';
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
