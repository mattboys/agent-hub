import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const ACCENT = '#48cae4';
const AUTO_CLEAN_DELAY = 220;

const { body } = createAppShell({
  title: 'Clean URL Trimmer',
  description:
    'Drop in a messy sharing link and instantly strip out ad trackers, campaign tags, and redirect cruft to get the trustworthy version you actually wanted.',
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
    <h2>Messy link</h2>
    <p>Paste a full URL. We will keep the meaningful parts and remove known trackers automatically.</p>
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

const clearButton = createActionButton('Clear');

actions.append(cleanButton, copyButton, clearButton);

inputCard.append(inputHeader, inputField, inputFooter, actions);

const outputCard = document.createElement('article');
outputCard.className = 'url-card';
outputCard.dataset.state = 'idle';

const outputHeader = document.createElement('header');
outputHeader.className = 'url-card-header';
outputHeader.innerHTML = `
  <div>
    <h2>Clean result</h2>
    <p>Tracking parameters and redirect fluff are stripped from the link below.</p>
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
    <span data-role="removed-count">0 trackers</span>
  </div>
  <div class="meta-row" data-role="protocol-note" hidden></div>
`;

outputCard.append(outputHeader, outputField, outputMeta);

const removalSummary = document.createElement('section');
removalSummary.className = 'removal-summary';
removalSummary.dataset.state = 'empty';
removalSummary.innerHTML = `
  <h3>Tracker breakdown</h3>
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

clearButton.addEventListener('click', () => {
  inputField.value = '';
  outputField.value = '';
  copyButton.disabled = true;
  protocolNote.hidden = true;
  removalList.innerHTML = '';
  removalSummary.dataset.state = 'empty';
  removedCountEl.textContent = '0 trackers';
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
    removalSummary.dataset.state = 'empty';
    removalList.innerHTML = '';
    removedCountEl.textContent = '0 trackers';
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
    removalSummary.dataset.state = 'empty';
    removalList.innerHTML = '';
    removedCountEl.textContent = '0 trackers';
    protocolNote.hidden = true;
    protocolNote.textContent = '';
    return;
  }

  outputCard.dataset.state = result.removed.length ? 'changed' : 'clean';
  statusChip.dataset.state = result.removed.length ? 'changed' : 'clean';
  statusChip.textContent = result.removed.length ? 'Trackers removed' : 'Already clean';

  outputField.value = result.cleanedUrl;
  copyButton.disabled = !result.cleanedUrl;

  if (result.protocolNote) {
    protocolNote.hidden = false;
    protocolNote.textContent = result.protocolNote;
  } else {
    protocolNote.hidden = true;
    protocolNote.textContent = '';
  }

  const totalRemoved = result.removed.length;
  removedCountEl.textContent = totalRemoved === 1 ? '1 tracker' : `${totalRemoved} trackers`;

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
    entry.innerHTML = `
      <span class="removal-key">${item.key}</span>
      <span class="removal-location">${item.location}</span>
      ${item.value ? `<code class="removal-value">${escapeHtml(item.value)}</code>` : ''}
    `;
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
  removeQueryTrackers(parsed, removed);
  const { hash, removed: fragmentRemoved } = cleanHash(parsed.hash);
  parsed.hash = hash;
  removed.push(...fragmentRemoved);

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
    removed,
    protocolNote: protocolNote || null
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

function removeQueryTrackers(url, removed) {
  const params = url.searchParams;
  const initialEntries = Array.from(params.entries());
  initialEntries.forEach(([key, value]) => {
    if (isTrackerParam(key, value)) {
      params.delete(key);
      removed.push({
        location: 'query',
        key,
        value
      });
    }
  });
}

function cleanHash(hash) {
  if (!hash || hash.length <= 1) {
    return { hash, removed: [] };
  }

  const raw = hash.slice(1);
  if (!raw.includes('=')) {
    return { hash, removed: [] };
  }

  const segments = raw.split('&');
  const kept = [];
  const removed = [];

  segments.forEach((segment) => {
    const [rawKey, rawValue = ''] = segment.split('=');
    if (!rawKey) {
      return;
    }
    const key = decodeURIComponentSafe(rawKey);
    const value = decodeURIComponentSafe(rawValue);

    if (isTrackerParam(key, value)) {
      removed.push({
        location: 'fragment',
        key,
        value
      });
      return;
    }
    kept.push(segment);
  });

  const cleanHashValue = kept.length ? `#${kept.join('&')}` : '';
  return { hash: cleanHashValue, removed };
}

function isTrackerParam(key, value) {
  if (!key) return false;
  const lowerKey = key.toLowerCase();

  if (TRACKER_EXACT.has(lowerKey)) {
    return true;
  }

  if (TRACKER_PREFIXES.some((prefix) => lowerKey.startsWith(prefix))) {
    return true;
  }

  if (TRACKER_SUFFIXES.some((suffix) => lowerKey.endsWith(suffix))) {
    return true;
  }

  if (TRACKER_REGEX.some((pattern) => pattern.test(lowerKey))) {
    return true;
  }

  if (value && TRACKER_VALUE_REGEX.some((pattern) => pattern.test(value))) {
    return true;
  }

  return false;
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(value.replace(/\+/g, '%20'));
  } catch {
    return value;
  }
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const TRACKER_EXACT = new Set(
  [
    'fbclid',
    'gclid',
    'gbraid',
    'wbraid',
    'dclid',
    'msclkid',
    'ttclid',
    'twclid',
    'yclid',
    'igshid',
    'mc_cid',
    'mc_eid',
    'mkt_tok',
    'oly_anon_id',
    'oly_enc_id',
    'vero_conv',
    'vero_id',
    's_cid',
    'trackingid',
    'ref_src',
    'ref_url',
    'zanpid',
    'hsCtaTracking',
    'ml_subscriber',
    'ml_subscriber_hash',
    'rb_clickid'
  ].map((key) => key.toLowerCase())
);

const TRACKER_PREFIXES = [
  'utm_',
  '_utm',
  'mtm_',
  'pk_',
  'mc_',
  'mkt_',
  'oly_',
  'hsa_',
  'ga_',
  'fb_',
  '_hs',
  '__hs',
  'vero_',
  'aff_',
  'sscid',
  'rb_'
];

const TRACKER_SUFFIXES = ['_cid', '_source', '_medium', '_campaign', '_term', '_content', '_id', '_name'];

const TRACKER_REGEX = [
  /^utm[\w-]*$/,
  /^pk_campaign/,
  /^pk_kwd/,
  /^ga_session/,
  /^ga_measurement/,
  /^ga_client/,
  /^yclid$/,
  /^icnclid$/,
  /^campid$/,
  /^zanpid$/,
  /^s?cid$/,
  /^aff(id|iliate)?$/,
  /^affiliate(id)?$/,
  /^hsa_/,
  /^hs(?:enc|mi|first)/,
  /^vero_/,
  /^rb_/
];

const TRACKER_VALUE_REGEX = [/^t\.me\//i];
