import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const { body } = createAppShell({
  title: 'Random Name Selector',
  description:
    'Paste a list of names, then click Next. The first click shuffles once, and every subsequent click reveals the next name (no duplicates).',
  accent: '#7ee8fa'
});

const state = {
  draftText: '',
  committedFingerprint: '',
  shuffled: [],
  index: 0,
  lastShown: ''
};

const ui = buildUI();
body.append(ui.layout);
syncUI();

function buildUI() {
  const layout = document.createElement('div');
  layout.className = 'name-selector';

  const entryCard = document.createElement('section');
  entryCard.className = 'card';
  entryCard.innerHTML = `
    <header class="card-header">
      <h2>Names</h2>
      <p>One per line (commas also work). Blank lines are ignored.</p>
    </header>
  `;

  const textareaLabel = document.createElement('label');
  textareaLabel.className = 'field';
  textareaLabel.innerHTML = `
    <span class="field-label">Name list</span>
    <textarea rows="9" spellcheck="false" placeholder="Alex\nBri\nCasey\nDevon"></textarea>
    <div class="field-meta">
      <span><strong data-role="count">0</strong> names detected</span>
      <span class="muted" data-role="hint">Press Next to start</span>
    </div>
  `;

  const textarea = textareaLabel.querySelector('textarea');
  const countEl = textareaLabel.querySelector('[data-role="count"]');
  const hintEl = textareaLabel.querySelector('[data-role="hint"]');

  textarea.addEventListener('input', () => {
    state.draftText = textarea.value;
    syncUI();
  });

  entryCard.append(textareaLabel);

  const actionRow = document.createElement('div');
  actionRow.className = 'actions';

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'primary';
  nextButton.textContent = 'Next';

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'ghost';
  resetButton.textContent = 'Reset';

  nextButton.addEventListener('click', () => {
    advance();
    syncUI();
  });

  resetButton.addEventListener('click', () => {
    resetRun();
    syncUI();
  });

  actionRow.append(nextButton, resetButton);

  const revealCard = document.createElement('section');
  revealCard.className = 'card reveal';
  revealCard.innerHTML = `
    <header class="card-header">
      <h2>Reveal</h2>
      <p>The list is shuffled exactly once per run.</p>
    </header>
  `;

  const namePlate = document.createElement('div');
  namePlate.className = 'name-plate';
  namePlate.setAttribute('role', 'status');
  namePlate.setAttribute('aria-live', 'polite');
  namePlate.textContent = '—';

  const progress = document.createElement('div');
  progress.className = 'progress';
  progress.innerHTML = `
    <div class="progress-row">
      <span class="progress-label" data-role="progress-label">0 / 0</span>
      <span class="progress-remaining muted" data-role="progress-remaining">0 remaining</span>
    </div>
    <div class="bar">
      <div class="bar-fill" data-role="bar-fill"></div>
    </div>
  `;

  const progressLabel = progress.querySelector('[data-role="progress-label"]');
  const progressRemaining = progress.querySelector('[data-role="progress-remaining"]');
  const barFill = progress.querySelector('[data-role="bar-fill"]');

  revealCard.append(namePlate, actionRow, progress);

  layout.append(entryCard, revealCard);

  return {
    layout,
    textarea,
    countEl,
    hintEl,
    nextButton,
    resetButton,
    namePlate,
    progressLabel,
    progressRemaining,
    barFill
  };
}

function syncUI() {
  const parsed = parseNames(state.draftText);
  ui.countEl.textContent = String(parsed.length);

  const fingerprint = fingerprintNames(parsed);
  const runIsValidForInput = state.committedFingerprint === fingerprint && state.shuffled.length > 0;
  const isRunning = runIsValidForInput && state.index > 0;
  const hasNext = runIsValidForInput && state.index < state.shuffled.length;

  if (!parsed.length) {
    ui.hintEl.textContent = 'Add at least one name';
  } else if (!runIsValidForInput) {
    ui.hintEl.textContent = 'Press Next to start (this will shuffle once)';
  } else if (hasNext) {
    ui.hintEl.textContent = `Ready • ${state.shuffled.length - state.index} left in this run`;
  } else {
    ui.hintEl.textContent = 'Done • press Reset to reshuffle';
  }

  ui.nextButton.disabled = parsed.length === 0 || (!hasNext && isRunning);
  ui.resetButton.disabled = !parsed.length && !runIsValidForInput && !state.lastShown;

  ui.namePlate.textContent = state.lastShown || '—';

  const total = runIsValidForInput ? state.shuffled.length : parsed.length;
  const shown = runIsValidForInput ? Math.min(state.index, total) : 0;
  const remaining = Math.max(0, total - shown);

  ui.progressLabel.textContent = `${shown} / ${total}`;
  ui.progressRemaining.textContent = `${remaining} remaining`;

  const ratio = total > 0 ? shown / total : 0;
  ui.barFill.style.width = `${Math.round(ratio * 100)}%`;
}

function advance() {
  const parsed = parseNames(state.draftText);
  if (parsed.length === 0) {
    state.lastShown = '';
    resetRun();
    return;
  }

  const fingerprint = fingerprintNames(parsed);
  const needNewRun = state.committedFingerprint !== fingerprint || state.shuffled.length === 0;

  if (needNewRun) {
    state.committedFingerprint = fingerprint;
    state.shuffled = shuffleCopy(parsed);
    state.index = 0;
    state.lastShown = '';
  }

  if (state.index >= state.shuffled.length) {
    return;
  }

  state.lastShown = state.shuffled[state.index];
  state.index += 1;
}

function resetRun() {
  state.committedFingerprint = '';
  state.shuffled = [];
  state.index = 0;
  state.lastShown = '';
}

function parseNames(text) {
  if (!text) return [];
  return text
    .split(/[\n,]+/g)
    .map((value) => value.trim())
    .filter(Boolean);
}

function fingerprintNames(names) {
  return names.join('\u001f');
}

function shuffleCopy(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

