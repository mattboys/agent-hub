import { createAppShell } from '../shared/appShell.js';
import { repairMarkdown } from './repair.js';
import './styles.css';

const ACCENT = '#6ee7b7';

const { body } = createAppShell({
  title: 'Markdown Repair',
  description:
    'Repair and reformat markdown documents: fix line breaks in sentences, soft hyphens, broken bullets, tables, trailing spaces, and extra line breaks.',
  accent: ACCENT
});

const layout = document.createElement('div');
layout.className = 'mdr-layout';

const editorCard = document.createElement('section');
editorCard.className = 'mdr-card';

const editorHeader = document.createElement('header');
editorHeader.className = 'mdr-card-header';
editorHeader.innerHTML = `
  <div>
    <h2>Markdown input</h2>
    <p>Paste or type markdown. Code blocks are preserved; paragraphs, lists, and tables are repaired.</p>
  </div>
`;

const actionBar = document.createElement('div');
actionBar.className = 'mdr-action-bar';

const pasteBtn = createButton('Paste from clipboard', 'primary');
const repairBtn = createButton('Repair all', 'primary');
const copyBtn = createButton('Copy result');
const clearBtn = createButton('Clear');

actionBar.append(pasteBtn, repairBtn, copyBtn, clearBtn);

const textareaLabel = document.createElement('label');
textareaLabel.className = 'mdr-field-label';
textareaLabel.textContent = 'Markdown';
textareaLabel.setAttribute('for', 'mdr-textarea');

const textarea = document.createElement('textarea');
textarea.id = 'mdr-textarea';
textarea.className = 'mdr-textarea';
textarea.placeholder = 'Paste markdown here…\n\nExample:\nThis is a sen-\ntence that was broken.\n\n- Bullet one\n- Bullet two';
textarea.autocapitalize = 'off';
textarea.autocomplete = 'off';
textarea.spellcheck = false;
textarea.rows = 14;

const metaBar = document.createElement('footer');
metaBar.className = 'mdr-meta';
metaBar.innerHTML = `
  <span class="mdr-stat"><strong data-role="chars">0</strong> chars</span>
  <span class="mdr-stat"><strong data-role="lines">0</strong> lines</span>
`;

const charsEl = metaBar.querySelector('[data-role="chars"]');
const linesEl = metaBar.querySelector('[data-role="lines"]');

editorCard.append(editorHeader, actionBar, textareaLabel, textarea, metaBar);

const optionsCard = document.createElement('section');
optionsCard.className = 'mdr-card';

const optionsHeader = document.createElement('header');
optionsHeader.className = 'mdr-card-header';
optionsHeader.innerHTML = `
  <div>
    <h2>Repair options</h2>
    <p>Toggle individual repairs. All are on by default.</p>
  </div>
`;

const optionsGrid = document.createElement('div');
optionsGrid.className = 'mdr-options-grid';

const options = [
  { id: 'trimSpaces', label: 'Trim leading/trailing spaces', default: true },
  { id: 'removeExtraLinebreaks', label: 'Remove extra line breaks (3+ → 2)', default: true },
  { id: 'fixSoftHyphens', label: 'Fix soft hyphens at line end', default: true },
  { id: 'fixMidSentenceBreaks', label: 'Join mid-sentence line breaks', default: true },
  { id: 'fixBrokenBullets', label: 'Fix broken bullet lists', default: true },
  { id: 'formatTables', label: 'Format tables (align columns)', default: true }
];

const optionCheckboxes = {};
options.forEach((opt) => {
  const label = document.createElement('label');
  label.className = 'mdr-option';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = opt.default;
  cb.id = `mdr-opt-${opt.id}`;
  cb.dataset.opt = opt.id;
  optionCheckboxes[opt.id] = cb;
  label.appendChild(cb);
  label.appendChild(document.createTextNode(' ' + opt.label));
  optionsGrid.appendChild(label);
});

optionsCard.append(optionsHeader, optionsGrid);

const status = document.createElement('div');
status.className = 'mdr-status';
status.setAttribute('role', 'status');
status.setAttribute('aria-live', 'polite');

layout.append(editorCard, optionsCard, status);
body.appendChild(layout);

const state = { toastTimer: null };

textarea.addEventListener('input', updateStats);

pasteBtn.addEventListener('click', async () => {
  const clipboardText = await readClipboardText();
  if (clipboardText != null) {
    textarea.value = clipboardText;
    updateStats();
    showStatus('Pasted from clipboard.');
  }
  textarea.focus();
});

repairBtn.addEventListener('click', () => {
  const current = textarea.value;
  if (!current) {
    showStatus('Nothing to repair—paste some markdown first.', true);
    return;
  }
  const opts = {};
  options.forEach((opt) => {
    opts[opt.id] = optionCheckboxes[opt.id].checked;
  });
  const repaired = repairMarkdown(current, opts);
  textarea.value = repaired;
  updateStats();
  showStatus('Repairs applied.');
  textarea.focus();
});

copyBtn.addEventListener('click', async () => {
  const ok = await writeClipboardText(textarea.value);
  if (ok) showStatus('Copied to clipboard.');
});

clearBtn.addEventListener('click', () => {
  if (!textarea.value) return;
  textarea.value = '';
  updateStats();
  showStatus('Cleared.');
  textarea.focus();
});

updateStats();

if (!navigator.clipboard) {
  showStatus('Clipboard APIs are not available. You can still paste manually (Ctrl/⌘+V).', true);
}

function updateStats() {
  const text = textarea.value ?? '';
  charsEl.textContent = new Intl.NumberFormat().format(Array.from(text).length);
  linesEl.textContent = new Intl.NumberFormat().format(text.split(/\r\n|\r|\n/).length);
}

function showStatus(message, isError = false) {
  status.textContent = message;
  status.dataset.state = isError ? 'error' : 'ok';
  status.classList.add('visible');
  if (state.toastTimer) clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => status.classList.remove('visible'), 2600);
}

function createButton(label, variant) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = variant === 'primary' ? 'mdr-btn primary' : 'mdr-btn';
  btn.textContent = label;
  return btn;
}

async function readClipboardText() {
  if (!navigator.clipboard?.readText) {
    showStatus('Clipboard read is not supported. Paste manually instead.', true);
    return null;
  }
  try {
    return await navigator.clipboard.readText();
  } catch (err) {
    console.error(err);
    showStatus('Could not read clipboard.', true);
    return null;
  }
}

async function writeClipboardText(text) {
  if (!navigator.clipboard?.writeText) {
    showStatus('Clipboard write is not supported.', true);
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error(err);
    showStatus('Could not write to clipboard.', true);
    return false;
  }
}
