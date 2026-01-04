import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const ACCENT = '#2dd4bf';
const LOCALE = undefined;

const { body } = createAppShell({
  title: 'Text Case Studio',
  description:
    'Paste short text from your clipboard, then apply quick formatting like title case, lower case, sentence case, and whitespace cleanup.',
  accent: ACCENT
});

const layout = document.createElement('div');
layout.className = 'tcs-layout';
body.appendChild(layout);

const status = document.createElement('div');
status.className = 'tcs-status';
status.setAttribute('role', 'status');
status.setAttribute('aria-live', 'polite');

const editorCard = document.createElement('section');
editorCard.className = 'tcs-card';

const editorHeader = document.createElement('header');
editorHeader.className = 'tcs-card-header';
editorHeader.innerHTML = `
  <div>
    <h2>Editor</h2>
    <p>Type or paste normally, or use the button to read your clipboard (permission required).</p>
  </div>
`;

const actionBar = document.createElement('div');
actionBar.className = 'tcs-action-bar';

const pasteBtn = createButton('Paste from clipboard', 'primary');
const copyBtn = createButton('Copy to clipboard');
const undoBtn = createButton('Undo');
const clearBtn = createButton('Clear');

actionBar.append(pasteBtn, copyBtn, undoBtn, clearBtn);

const textareaLabel = document.createElement('label');
textareaLabel.className = 'tcs-field-label';
textareaLabel.textContent = 'Text';
textareaLabel.setAttribute('for', 'tcs-textarea');

const textarea = document.createElement('textarea');
textarea.id = 'tcs-textarea';
textarea.className = 'tcs-textarea';
textarea.placeholder = 'Paste text here…';
textarea.autocapitalize = 'off';
textarea.autocomplete = 'off';
textarea.spellcheck = false;
textarea.rows = 10;

const metaBar = document.createElement('footer');
metaBar.className = 'tcs-meta';
metaBar.innerHTML = `
  <span class="tcs-stat"><strong data-role="chars">0</strong> chars</span>
  <span class="tcs-stat"><strong data-role="words">0</strong> words</span>
  <span class="tcs-stat"><strong data-role="lines">0</strong> lines</span>
`;

const charsEl = metaBar.querySelector('[data-role="chars"]');
const wordsEl = metaBar.querySelector('[data-role="words"]');
const linesEl = metaBar.querySelector('[data-role="lines"]');

editorCard.append(editorHeader, actionBar, textareaLabel, textarea, metaBar);

const toolsCard = document.createElement('section');
toolsCard.className = 'tcs-card';

const toolsHeader = document.createElement('header');
toolsHeader.className = 'tcs-card-header';
toolsHeader.innerHTML = `
  <div>
    <h2>Formatting tools</h2>
    <p>Each button edits the text above. Use Undo if you change your mind.</p>
  </div>
`;

const toolGrid = document.createElement('div');
toolGrid.className = 'tcs-tool-grid';

const tools = [
  { label: 'lower case', transform: (t) => t.toLocaleLowerCase(LOCALE) },
  { label: 'UPPER CASE', transform: (t) => t.toLocaleUpperCase(LOCALE) },
  { label: 'Title Case', transform: (t) => toTitleCase(t, LOCALE) },
  { label: 'Sentence case', transform: (t) => toSentenceCase(t, LOCALE) },
  { label: 'Capitalize first letter', transform: (t) => capitalizeFirstLetter(t, LOCALE) },
  { label: 'Trim ends', transform: (t) => t.trim() },
  { label: 'Collapse spaces', transform: (t) => collapseSpaces(t) },
  { label: 'Remove blank lines', transform: (t) => removeExtraBlankLines(t) },
  { label: 'Swap case', transform: (t) => swapCase(t, LOCALE) }
];

tools.forEach((tool) => {
  const btn = createButton(tool.label);
  btn.addEventListener('click', () => applyTransform(tool.label, tool.transform));
  toolGrid.appendChild(btn);
});

toolsCard.append(toolsHeader, toolGrid);

layout.append(editorCard, toolsCard, status);

const state = {
  history: [],
  toastTimer: null
};

textarea.addEventListener('input', () => {
  updateStats();
  updateUndoEnabled();
});

pasteBtn.addEventListener('click', async () => {
  const clipboardText = await readClipboardText();
  if (clipboardText == null) return;
  applyValue('Paste from clipboard', clipboardText);
  textarea.focus();
});

copyBtn.addEventListener('click', async () => {
  const ok = await writeClipboardText(textarea.value);
  if (ok) {
    showStatus('Copied to clipboard.');
  }
});

undoBtn.addEventListener('click', () => {
  if (state.history.length === 0) return;
  const previous = state.history.pop();
  textarea.value = previous;
  updateStats();
  updateUndoEnabled();
  showStatus('Undid last change.');
});

clearBtn.addEventListener('click', () => {
  if (!textarea.value) return;
  applyValue('Clear', '');
  textarea.focus();
});

updateStats();
updateUndoEnabled();

if (!navigator.clipboard) {
  showStatus('Clipboard APIs are not available here. You can still paste manually (Ctrl/⌘+V).', true);
}

function applyTransform(label, transform) {
  const current = textarea.value;
  if (!current) {
    showStatus('Nothing to format yet—paste some text first.', true);
    return;
  }
  let next;
  try {
    next = transform(current);
  } catch (error) {
    console.error(error);
    showStatus(`Could not run "${label}". See console for details.`, true);
    return;
  }
  applyValue(label, next);
}

function applyValue(label, nextValue) {
  const current = textarea.value;
  if (nextValue === current) {
    showStatus(`"${label}" made no changes.`);
    return;
  }
  pushHistory(current);
  textarea.value = nextValue;
  updateStats();
  updateUndoEnabled();
  showStatus(`Applied: ${label}.`);
}

function pushHistory(value) {
  const capped = 40;
  state.history.push(value);
  if (state.history.length > capped) {
    state.history.splice(0, state.history.length - capped);
  }
}

function updateUndoEnabled() {
  undoBtn.disabled = state.history.length === 0;
}

function updateStats() {
  const text = textarea.value ?? '';
  charsEl.textContent = formatNumber(Array.from(text).length);
  wordsEl.textContent = formatNumber(countWords(text));
  linesEl.textContent = formatNumber(countLines(text));
}

function showStatus(message, isError = false) {
  status.textContent = message;
  status.dataset.state = isError ? 'error' : 'ok';
  status.classList.add('visible');
  if (state.toastTimer) {
    clearTimeout(state.toastTimer);
  }
  state.toastTimer = setTimeout(() => {
    status.classList.remove('visible');
  }, 2600);
}

function createButton(label, variant) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = variant === 'primary' ? 'tcs-btn primary' : 'tcs-btn';
  btn.textContent = label;
  return btn;
}

async function readClipboardText() {
  if (!navigator.clipboard?.readText) {
    showStatus('Clipboard read is not supported here. Paste manually instead.', true);
    return null;
  }
  try {
    return await navigator.clipboard.readText();
  } catch (error) {
    console.error(error);
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      showStatus('Clipboard permission denied. Click the page and try again.', true);
      return null;
    }
    showStatus('Could not read clipboard text.', true);
    return null;
  }
}

async function writeClipboardText(text) {
  if (!navigator.clipboard?.writeText) {
    showStatus('Clipboard write is not supported here.', true);
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error(error);
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      showStatus('Clipboard permission denied. Click the page and try again.', true);
      return false;
    }
    showStatus('Could not write to clipboard.', true);
    return false;
  }
}

function toTitleCase(text, locale) {
  if (!text) return text;

  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter !== 'undefined') {
    const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
    let out = '';
    for (const segment of segmenter.segment(text)) {
      if (segment.isWordLike) {
        out += titleWord(segment.segment, locale);
      } else {
        out += segment.segment;
      }
    }
    return out;
  }

  return text.replace(/\p{L}[\p{L}\p{M}'’\-]*/gu, (word) => titleWord(word, locale));
}

function titleWord(word, locale) {
  const lower = word.toLocaleLowerCase(locale);
  const chars = Array.from(lower);
  if (chars.length === 0) return lower;
  chars[0] = chars[0].toLocaleUpperCase(locale);
  return chars.join('');
}

function toSentenceCase(text, locale) {
  if (!text) return text;
  const lower = text.toLocaleLowerCase(locale);
  let out = '';
  let capitalizeNext = true;

  for (const ch of lower) {
    if (capitalizeNext && /\p{L}/u.test(ch)) {
      out += ch.toLocaleUpperCase(locale);
      capitalizeNext = false;
      continue;
    }
    out += ch;
    if (ch === '.' || ch === '!' || ch === '?' || ch === '\n') {
      capitalizeNext = true;
    }
  }

  return out;
}

function capitalizeFirstLetter(text, locale) {
  if (!text) return text;
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i += 1) {
    if (/\p{L}/u.test(chars[i])) {
      chars[i] = chars[i].toLocaleUpperCase(locale);
      return chars.join('');
    }
  }
  return text;
}

function collapseSpaces(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n');
}

function removeExtraBlankLines(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

function swapCase(text, locale) {
  if (!text) return text;
  let out = '';
  for (const ch of text) {
    const upper = ch.toLocaleUpperCase(locale);
    const lower = ch.toLocaleLowerCase(locale);
    if (ch === upper && ch !== lower) {
      out += lower;
    } else if (ch === lower && ch !== upper) {
      out += upper;
    } else {
      out += ch;
    }
  }
  return out;
}

function countWords(text) {
  if (!text) return 0;
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

function countLines(text) {
  if (!text) return 0;
  return text.split(/\r\n|\r|\n/).length;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}
