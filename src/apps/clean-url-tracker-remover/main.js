import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const ACCENT = '#48cae4';
const AUTO_CLEAN_DELAY = 220;

const { body } = createAppShell({
  title: 'Clean URL Trimmer',
  description:
    'Drop in a URL and instantly strip out all query parameters (everything after the ?) to get a clean link.',
  accent: ACCENT
});

const app = document.createElement('div');
app.className = 'url-cleaner';

const inputCard = document.createElement('article');
inputCard.className = 'url-card';

const inputHeader = document.createElement('header');
inputHeader.className = 'url-card-header';
inputHeader.innerHTML = `
  <div>
    <h2>Original URL</h2>
    <p>Paste a URL and we'll remove all query parameters automatically.</p>
  </div>
`;

const inputField = document.createElement('textarea');
inputField.className = 'url-input';
inputField.rows = 4;
inputField.placeholder = 'https://example.com/page?utm_source=newsletter&gclid=123&utm_medium=email';
inputField.autocapitalize = 'off';
inputField.autocomplete = 'off';
inputField.spellcheck = false;

const inputFooter = document.createElement('footer');
inputFooter.className = 'url-card-footer';
inputFooter.innerHTML = `
  <span>Auto-cleans while you type. Hit “Clean it” to force a refresh.</span>
`;

const actions = document.createElement('div');
actions.className = 'url-actions';

const cleanButton = createActionButton('Clean it');
cleanButton.classList.add('primary');

const copyButton = createActionButton('Copy clean URL');
copyButton.disabled = true;

const openButton = createActionButton('Open in new tab');
openButton.disabled = true;

const clearButton = createActionButton('Clear');

actions.append(cleanButton, copyButton, openButton, clearButton);

inputCard.append(inputHeader, inputField, inputFooter, actions);

const outputCard = document.createElement('article');
outputCard.className = 'url-card';
outputCard.dataset.state = 'idle';

const outputHeader = document.createElement('header');
outputHeader.className = 'url-card-header';
outputHeader.innerHTML = `
  <div>
    <h2>Clean result</h2>
    <p>All query parameters are stripped from the link below.</p>
  </div>
  <span class="status-chip" data-role="status-chip">Waiting…</span>
`;

const outputField = document.createElement('input');
outputField.className = 'url-output';
outputField.type = 'text';
outputField.readOnly = true;
outputField.placeholder = 'Your clean link will appear here.';

const outputMeta = document.createElement('div');
outputMeta.className = 'url-meta';
outputMeta.innerHTML = `
  <div class="meta-row">
    <strong>Removed:</strong>
    <span data-role="removed-count">0 parameters</span>
  </div>
  <div class="meta-row" data-role="protocol-note" hidden></div>
`;

outputCard.append(outputHeader, outputField, outputMeta);

const removalSummary = document.createElement('section');
removalSummary.className = 'removal-summary';
removalSummary.dataset.state = 'empty';
removalSummary.innerHTML = `
  <h3>Removed parameters</h3>
  <p class="empty-hint">Removed parameters will be listed here once we find any.</p>
  <ul class="removal-list" data-role="removal-list"></ul>
`;

app.append(inputCard, outputCard, removalSummary);
body.appendChild(app);

const state = {
  timer: null,
  lastInput: '',
  lastResult: null
};

const statusChip = outputCard.querySelector('[data-role="status-chip"]');
statusChip.dataset.state = 'idle';
const removedCountEl = outputCard.querySelector('[data-role="removed-count"]');
const removalList = removalSummary.querySelector('[data-role="removal-list"]');
const protocolNote = outputMeta.querySelector('[data-role="protocol-note"]');

inputField.addEventListener('input', () => {
  scheduleClean();
});

cleanButton.addEventListener('click', () => {
  runClean({ force: true });
});

copyButton.addEventListener('click', async () => {
  if (!state.lastResult || state.lastResult.status !== 'clean') {
    return;
  }
  try {
    await navigator.clipboard.writeText(state.lastResult.cleanedUrl);
    showCopyConfirmation(copyButton);
  } catch (error) {
    console.error('Clipboard write failed', error);
    copyButton.dataset.state = 'error';
    copyButton.textContent = 'Copy failed';
    setTimeout(() => {
      copyButton.dataset.state = '';
      copyButton.textContent = 'Copy clean URL';
    }, 2000);
  }
});

openButton.addEventListener('click', () => {
  if (!state.lastResult || state.lastResult.status !== 'clean') {
    return;
  }
  const urlToOpen = state.lastResult.fullCleanedUrl || state.lastResult.cleanedUrl;
  window.open(urlToOpen, '_blank');
});

clearButton.addEventListener('click', () => {
  inputField.value = '';
  outputField.value = '';
  copyButton.disabled = true;
  openButton.disabled = true;
  protocolNote.hidden = true;
  removalList.innerHTML = '';
  removalSummary.dataset.state = 'empty';
  removedCountEl.textContent = '0 parameters';
  statusChip.textContent = 'Waiting…';
  statusChip.dataset.state = 'idle';
  outputCard.dataset.state = 'idle';
  state.lastInput = '';
  state.lastResult = null;
});

function scheduleClean() {
  if (state.timer) {
    clearTimeout(state.timer);
  }
  state.timer = setTimeout(() => {
    runClean({ force: false });
    state.timer = null;
  }, AUTO_CLEAN_DELAY);
}

function runClean({ force }) {
  const raw = inputField.value;
  if (!force && raw === state.lastInput) {
    return;
  }
  state.lastInput = raw;
  const result = cleanUrl(raw);
  state.lastResult = result;
  renderResult(result);
}

function renderResult(result) {
  if (result.status === 'empty') {
    outputCard.dataset.state = 'idle';
    statusChip.dataset.state = 'idle';
    statusChip.textContent = 'Waiting…';
    outputField.value = '';
    copyButton.disabled = true;
    openButton.disabled = true;
    removalSummary.dataset.state = 'empty';
    removalList.innerHTML = '';
    removedCountEl.textContent = '0 parameters';
    protocolNote.hidden = true;
    protocolNote.textContent = '';
    return;
  }

  if (result.status === 'invalid') {
    outputCard.dataset.state = 'error';
    statusChip.dataset.state = 'error';
    statusChip.textContent = 'Not a valid URL';
    outputField.value = '';
    copyButton.disabled = true;
    openButton.disabled = true;
    removalSummary.dataset.state = 'empty';
    removalList.innerHTML = '';
    removedCountEl.textContent = '0 parameters';
    protocolNote.hidden = true;
    protocolNote.textContent = '';
    return;
  }

  outputCard.dataset.state = result.removed.length ? 'changed' : 'clean';
  statusChip.dataset.state = result.removed.length ? 'changed' : 'clean';
  statusChip.textContent = result.removed.length ? 'Parameters removed' : 'Already clean';

  outputField.value = result.cleanedUrl;
  copyButton.disabled = !result.cleanedUrl;
  openButton.disabled = !result.cleanedUrl;

  if (result.protocolNote) {
    protocolNote.hidden = false;
    protocolNote.textContent = result.protocolNote;
  } else {
    protocolNote.hidden = true;
    protocolNote.textContent = '';
  }

  const totalRemoved = result.removed.length;
  removedCountEl.textContent = totalRemoved === 1 ? '1 parameter' : `${totalRemoved} parameters`;

  if (!totalRemoved) {
    removalSummary.dataset.state = 'empty';
    removalList.innerHTML = '';
  } else {
    removalSummary.dataset.state = 'ready';
    renderRemovalList(removalList, result.removed);
  }
}

function renderRemovalList(target, removedItems) {
  target.innerHTML = '';
  removedItems.forEach((item) => {
    const entry = document.createElement('li');
    entry.className = 'removal-item';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'removal-content';
    contentDiv.innerHTML = `
      <span class="removal-key">${escapeHtml(item.key)}</span>
      ${item.value ? `<code class="removal-value">${escapeHtml(item.value)}</code>` : ''}
    `;
    
    const restoreButton = document.createElement('button');
    restoreButton.type = 'button';
    restoreButton.className = 'restore-button';
    restoreButton.textContent = 'Restore';
    restoreButton.addEventListener('click', () => {
      restoreParameter(item);
    });
    
    entry.appendChild(contentDiv);
    entry.appendChild(restoreButton);
    target.appendChild(entry);
  });
}

function createActionButton(label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'url-button';
  button.textContent = label;
  return button;
}

function showCopyConfirmation(button) {
  const previous = button.textContent;
  button.dataset.state = 'success';
  button.textContent = 'Copied!';
  setTimeout(() => {
    button.dataset.state = '';
    button.textContent = previous;
  }, 1600);
}

function cleanUrl(rawInput) {
  if (!rawInput || !rawInput.trim()) {
    return { status: 'empty' };
  }

  const trimmed = rawInput.trim();
  const prepared = prepareUrl(trimmed);
  let parsed;

  try {
    parsed = new URL(prepared.href);
  } catch (error) {
    return { status: 'invalid', message: error.message };
  }

  const removed = [];
  removeAllQueryParams(parsed, removed);

  const canonicalHref = parsed.toString();
  const cleanedHref = normaliseForDisplay(canonicalHref, prepared);

  const protocolNote =
    prepared.addedPrefix === 'https://' && !hasScheme(trimmed)
      ? 'Added https:// so the browser treats this as a full URL.'
      : trimmed.startsWith('//')
        ? 'Protocol-relative URL detected; using https:// for cleaning.'
        : '';

  return {
    status: 'clean',
    cleanedUrl: cleanedHref,
    fullCleanedUrl: canonicalHref,
    removed,
    protocolNote: protocolNote || null,
    displayAddedPrefix: prepared.addedPrefix
  };
}

function prepareUrl(value) {
  const hasSchemeValue = hasScheme(value);
  if (hasSchemeValue) {
    return { href: value, addedPrefix: '' };
  }
  if (value.startsWith('//')) {
    return { href: `https:${value}`, addedPrefix: 'https:' };
  }
  return { href: `https://${value}`, addedPrefix: 'https://' };
}

function hasScheme(value) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

function normaliseForDisplay(href, prepared) {
  if (!prepared.addedPrefix) {
    return href;
  }

  if (prepared.addedPrefix === 'https://') {
    return href.replace(/^https?:\/\//i, '');
  }

  if (prepared.addedPrefix === 'https:') {
    const withoutScheme = href.replace(/^https?:\/\//i, '');
    return `//${withoutScheme}`;
  }

  return href;
}

function removeAllQueryParams(url, removed) {
  const params = url.searchParams;
  const initialEntries = Array.from(params.entries());
  initialEntries.forEach(([key, value]) => {
    params.delete(key);
    removed.push({
      key,
      value
    });
  });
}


function restoreParameter(item) {
  if (!state.lastResult || state.lastResult.status !== 'clean') {
    return;
  }

  const { lastResult } = state;
  const baseHref =
    lastResult.fullCleanedUrl ||
    prepareUrl(lastResult.cleanedUrl || '').href;

  let url;
  try {
    url = new URL(baseHref);
  } catch (error) {
    console.error('Unable to restore parameter due to invalid base URL.', error);
    return;
  }

  url.searchParams.set(item.key, item.value);

  const updatedFullHref = url.toString();
  const displayAddedPrefix = lastResult.displayAddedPrefix ?? '';
  const updatedDisplayHref = normaliseForDisplay(updatedFullHref, { addedPrefix: displayAddedPrefix });

  const updatedRemoved = removeRestoredParameter(lastResult.removed, item);

  const updatedResult = {
    ...lastResult,
    cleanedUrl: updatedDisplayHref,
    fullCleanedUrl: updatedFullHref,
    removed: updatedRemoved
  };

  state.lastResult = updatedResult;
  renderResult(updatedResult);
}

function removeRestoredParameter(removedItems = [], restoredItem) {
  if (!removedItems.length) {
    return [];
  }

  const index = removedItems.findIndex(
    (entry) => entry.key === restoredItem.key && entry.value === restoredItem.value
  );

  if (index === -1) {
    return [...removedItems];
  }

  return removedItems.filter((_, idx) => idx !== index);
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
