import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const { body } = createAppShell({
  title: 'Quick List Tools',
  description:
    'Paste a list of values, then sort, de-dupe, count frequencies, quote, and convert delimiters — all locally in your browser.',
  accent: '#7ee8fa'
});

const DEFAULT_INPUT = `apple
banana
banana
pear
apple
orange`;

const state = {
  inputDelimiter: 'auto',
  outputDelimiter: 'lines',
  trim: true,
  removeEmpty: true,
  caseSensitive: false,
  frequencyFormat: 'tsv',
  workingMode: 'list', // 'list' | 'frequency'
  workingValues: [],
  frequencyRows: []
};

const ui = buildUi();
body.appendChild(ui.layout);
renderStats();

function buildUi() {
  const layout = document.createElement('div');
  layout.className = 'qlt-layout';

  const controls = document.createElement('section');
  controls.className = 'qlt-controls';

  const controlsRow1 = document.createElement('div');
  controlsRow1.className = 'qlt-controls-row';

  const inputDelimiterField = createSelectField('Input delimiter', [
    { value: 'auto', label: 'Auto' },
    { value: 'lines', label: 'Line breaks' },
    { value: 'comma', label: 'Comma' },
    { value: 'space', label: 'Whitespace' },
    { value: 'tab', label: 'Tab' },
    { value: 'semicolon', label: 'Semicolon' },
    { value: 'pipe', label: 'Pipe |' }
  ]);
  inputDelimiterField.select.value = state.inputDelimiter;

  const outputDelimiterField = createSelectField('Output delimiter', [
    { value: 'lines', label: 'Line breaks' },
    { value: 'comma', label: 'Comma + space' },
    { value: 'space', label: 'Space' },
    { value: 'tab', label: 'Tab' }
  ]);
  outputDelimiterField.select.value = state.outputDelimiter;

  const frequencyFormatField = createSelectField('Frequency output', [
    { value: 'tsv', label: 'TSV (value ↹ count)' },
    { value: 'csv', label: 'CSV (value,count)' }
  ]);
  frequencyFormatField.select.value = state.frequencyFormat;

  controlsRow1.append(
    inputDelimiterField.container,
    outputDelimiterField.container,
    frequencyFormatField.container
  );

  const togglesRow = document.createElement('div');
  togglesRow.className = 'qlt-controls-row';

  const toggles = document.createElement('div');
  toggles.className = 'qlt-toggles';

  const trimToggle = createToggle('Trim', state.trim);
  const emptyToggle = createToggle('Drop empty', state.removeEmpty);
  const caseToggle = createToggle('Case sensitive', state.caseSensitive);

  toggles.append(trimToggle.label, emptyToggle.label, caseToggle.label);
  togglesRow.appendChild(toggles);

  const buttonsRow = document.createElement('div');
  buttonsRow.className = 'qlt-controls-row';

  const buttons = document.createElement('div');
  buttons.className = 'qlt-buttons';

  const btnNormalize = createButton('Reformat', { primary: true });
  const btnSortAsc = createButton('Sort A→Z');
  const btnSortDesc = createButton('Sort Z→A');
  const btnUnique = createButton('Unique');
  const btnFrequency = createButton('Frequency');
  const btnQuoteDouble = createButton('Quote "…"');
  const btnQuoteSingle = createButton("Quote '…'");
  const btnUnquote = createButton('Unquote');
  const btnOutputToInput = createButton('Output → Input');
  const btnCopyOutput = createButton('Copy output');
  const btnClear = createButton('Clear');

  buttons.append(
    btnNormalize,
    btnSortAsc,
    btnSortDesc,
    btnUnique,
    btnFrequency,
    btnQuoteDouble,
    btnQuoteSingle,
    btnUnquote,
    btnOutputToInput,
    btnCopyOutput,
    btnClear
  );
  buttonsRow.appendChild(buttons);

  controls.append(controlsRow1, togglesRow, buttonsRow);

  const panels = document.createElement('div');
  panels.className = 'qlt-panels';

  const inputPanel = createPanel('Input', 'Paste your list here');
  const outputPanel = createPanel('Output', 'Results appear here');
  outputPanel.textarea.readOnly = true;

  inputPanel.textarea.value = DEFAULT_INPUT;

  const status = document.createElement('div');
  status.className = 'qlt-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  setStatus('Ready. Choose a button to transform the list.');

  panels.append(inputPanel.container, outputPanel.container);

  layout.append(controls, panels, status);

  // ---- events ----
  inputDelimiterField.select.addEventListener('change', () => {
    state.inputDelimiter = inputDelimiterField.select.value;
    setStatus('Input delimiter updated.', false);
  });

  outputDelimiterField.select.addEventListener('change', () => {
    state.outputDelimiter = outputDelimiterField.select.value;
    if (state.workingMode === 'list') {
      renderListOutput(outputPanel.textarea);
      setStatus('Output delimiter updated.', false);
    }
  });

  frequencyFormatField.select.addEventListener('change', () => {
    state.frequencyFormat = frequencyFormatField.select.value;
    if (state.workingMode === 'frequency') {
      renderFrequencyOutput(outputPanel.textarea);
      setStatus('Frequency output format updated.', false);
    }
  });

  trimToggle.input.addEventListener('change', () => {
    state.trim = trimToggle.input.checked;
  });
  emptyToggle.input.addEventListener('change', () => {
    state.removeEmpty = emptyToggle.input.checked;
  });
  caseToggle.input.addEventListener('change', () => {
    state.caseSensitive = caseToggle.input.checked;
  });

  btnNormalize.addEventListener('click', () => {
    runListTransform(inputPanel.textarea.value, (values) => values, outputPanel.textarea);
    setStatus('Reformatted list.', false);
  });

  btnSortAsc.addEventListener('click', () => {
    runListTransform(
      inputPanel.textarea.value,
      (values) =>
        values.slice().sort((a, b) =>
          a.localeCompare(b, undefined, {
            numeric: true,
            sensitivity: state.caseSensitive ? 'variant' : 'base'
          })
        ),
      outputPanel.textarea
    );
    setStatus('Sorted A→Z.', false);
  });

  btnSortDesc.addEventListener('click', () => {
    runListTransform(
      inputPanel.textarea.value,
      (values) =>
        values.slice().sort((a, b) =>
          b.localeCompare(a, undefined, {
            numeric: true,
            sensitivity: state.caseSensitive ? 'variant' : 'base'
          })
        ),
      outputPanel.textarea
    );
    setStatus('Sorted Z→A.', false);
  });

  btnUnique.addEventListener('click', () => {
    runListTransform(
      inputPanel.textarea.value,
      (values) => uniquePreserveOrder(values, { caseSensitive: state.caseSensitive }),
      outputPanel.textarea
    );
    setStatus('Reduced to unique values.', false);
  });

  btnFrequency.addEventListener('click', () => {
    runFrequency(inputPanel.textarea.value, outputPanel.textarea);
    setStatus('Frequency analysis complete.', false);
  });

  btnQuoteDouble.addEventListener('click', () => {
    runListTransform(
      inputPanel.textarea.value,
      (values) => values.map((value) => quoteValue(value, '"')),
      outputPanel.textarea
    );
    setStatus('Wrapped each value in double quotes.', false);
  });

  btnQuoteSingle.addEventListener('click', () => {
    runListTransform(
      inputPanel.textarea.value,
      (values) => values.map((value) => quoteValue(value, "'")),
      outputPanel.textarea
    );
    setStatus('Wrapped each value in single quotes.', false);
  });

  btnUnquote.addEventListener('click', () => {
    runListTransform(
      inputPanel.textarea.value,
      (values) => values.map((value) => unquoteValue(value)),
      outputPanel.textarea
    );
    setStatus('Removed surrounding quotes when present.', false);
  });

  btnOutputToInput.addEventListener('click', () => {
    inputPanel.textarea.value = outputPanel.textarea.value;
    state.workingMode = 'list';
    state.workingValues = [];
    state.frequencyRows = [];
    setStatus('Copied output back into input (so you can chain another operation).', false);
  });

  btnCopyOutput.addEventListener('click', async () => {
    const text = outputPanel.textarea.value;
    if (!text.trim()) {
      setStatus('Nothing to copy yet — generate output first.', true);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Output copied to clipboard.', false);
    } catch (error) {
      console.error(error);
      setStatus('Could not copy to clipboard in this browser context.', true);
    }
  });

  btnClear.addEventListener('click', () => {
    inputPanel.textarea.value = '';
    outputPanel.textarea.value = '';
    state.workingMode = 'list';
    state.workingValues = [];
    state.frequencyRows = [];
    renderStats();
    setStatus('Cleared.', false);
  });

  // Prime initial output.
  runListTransform(inputPanel.textarea.value, (values) => values, outputPanel.textarea);

  return { layout, status, inputPanel, outputPanel };

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.dataset.state = isError ? 'error' : 'ok';
  }
}

function runListTransform(rawText, transform, outputTextarea) {
  const inputValues = parseValues(rawText, state.inputDelimiter);
  const normalized = normalizeValues(inputValues);
  const result = transform(normalized);

  state.workingMode = 'list';
  state.workingValues = result;
  state.frequencyRows = [];
  renderListOutput(outputTextarea);
  renderStats({ sourceCount: normalized.length });
}

function runFrequency(rawText, outputTextarea) {
  const inputValues = parseValues(rawText, state.inputDelimiter);
  const normalized = normalizeValues(inputValues);
  const rows = frequencyRows(normalized, { caseSensitive: state.caseSensitive });

  state.workingMode = 'frequency';
  state.frequencyRows = rows;
  state.workingValues = [];
  renderFrequencyOutput(outputTextarea);
  renderStats({ sourceCount: normalized.length, uniqueCount: rows.length });
}

function renderListOutput(outputTextarea) {
  const delimiter = joinDelimiter(state.outputDelimiter);
  outputTextarea.value = state.workingValues.join(delimiter);
}

function renderFrequencyOutput(outputTextarea) {
  const lines = [];
  if (state.frequencyFormat === 'csv') {
    lines.push('value,count');
    state.frequencyRows.forEach((row) => {
      lines.push(`${csvEscape(row.value)},${row.count}`);
    });
  } else {
    lines.push('value\tcount');
    state.frequencyRows.forEach((row) => {
      lines.push(`${row.value}\t${row.count}`);
    });
  }
  outputTextarea.value = lines.join('\n');
}

function renderStats({ sourceCount, uniqueCount } = {}) {
  const statsEls = document.querySelectorAll('[data-qlt-stats]');
  if (!statsEls.length) return;

  const inputStats = buildStatsText(sourceCount);
  const outputStats = buildOutputStatsText(uniqueCount);

  const [left, right] = statsEls;
  if (left) left.textContent = inputStats;
  if (right) right.textContent = outputStats;

  function buildStatsText(countOverride) {
    const inferred = countOverride ?? normalizeValues(parseValues(DEFAULT_INPUT, 'lines')).length;
    return `${inferred.toLocaleString()} items`;
  }

  function buildOutputStatsText(uniqueOverride) {
    if (state.workingMode === 'frequency') {
      const u = uniqueOverride ?? state.frequencyRows.length;
      return `${u.toLocaleString()} unique values`;
    }
    const total = state.workingValues.length;
    const u = uniqueOverride ?? uniquePreserveOrder(state.workingValues, { caseSensitive: state.caseSensitive }).length;
    return `${total.toLocaleString()} items • ${u.toLocaleString()} unique`;
  }
}

function parseValues(text, delimiterMode) {
  const mode = delimiterMode === 'auto' ? detectDelimiterMode(text) : delimiterMode;

  if (!text) return [];

  switch (mode) {
    case 'lines':
      return text.split(/\r?\n/);
    case 'comma':
      return text.split(',');
    case 'space':
      return text.split(/\s+/);
    case 'tab':
      return text.split(/\t+/);
    case 'semicolon':
      return text.split(';');
    case 'pipe':
      return text.split('|');
    default:
      return text.split(/\r?\n/);
  }
}

function detectDelimiterMode(text) {
  if (/\r?\n/.test(text)) return 'lines';
  if (text.includes(',')) return 'comma';
  if (text.includes('\t')) return 'tab';
  if (text.includes('|')) return 'pipe';
  if (text.includes(';')) return 'semicolon';
  return 'space';
}

function normalizeValues(values) {
  let out = values.slice();
  if (state.trim) {
    out = out.map((v) => v.trim());
  }
  if (state.removeEmpty) {
    out = out.filter((v) => v.length > 0);
  }
  return out;
}

function uniquePreserveOrder(values, { caseSensitive }) {
  const seen = new Set();
  const out = [];
  values.forEach((value) => {
    const key = caseSensitive ? value : value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(value);
  });
  return out;
}

function frequencyRows(values, { caseSensitive }) {
  const map = new Map();
  values.forEach((value) => {
    const key = caseSensitive ? value : value.toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { value, count: 1 });
    } else {
      existing.count += 1;
    }
  });

  const rows = Array.from(map.values());
  rows.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.value.localeCompare(b.value, undefined, { numeric: true, sensitivity: 'base' });
  });
  return rows;
}

function joinDelimiter(mode) {
  switch (mode) {
    case 'comma':
      return ', ';
    case 'space':
      return ' ';
    case 'tab':
      return '\t';
    case 'lines':
    default:
      return '\n';
  }
}

function quoteValue(value, quoteChar) {
  if (quoteChar === "'") {
    const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function unquoteValue(value) {
  const trimmed = value.trim();
  if (trimmed.length < 2) return value;

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if (!((first === '"' && last === '"') || (first === "'" && last === "'"))) {
    return value;
  }

  const inner = trimmed.slice(1, -1);
  if (first === "'") {
    return inner.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  }
  return inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

function csvEscape(value) {
  const needsQuotes = /[",\n\r]/.test(value);
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function createSelectField(label, options) {
  const container = document.createElement('label');
  container.className = 'qlt-field';

  const title = document.createElement('span');
  title.textContent = label;

  const select = document.createElement('select');
  options.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    select.appendChild(option);
  });

  container.append(title, select);
  return { container, select };
}

function createToggle(label, initial) {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = initial;

  const text = document.createElement('span');
  text.textContent = label;

  const wrap = document.createElement('label');
  wrap.className = 'qlt-toggle';
  wrap.append(input, text);

  return { label: wrap, input };
}

function createButton(label, { primary = false } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `qlt-btn${primary ? ' primary' : ''}`;
  button.textContent = label;
  return button;
}

function createPanel(title, hint) {
  const container = document.createElement('section');
  container.className = 'qlt-panel';

  const header = document.createElement('div');
  header.className = 'qlt-panel-header';

  const h3 = document.createElement('h3');
  h3.className = 'qlt-panel-title';
  h3.textContent = title;

  const stats = document.createElement('div');
  stats.className = 'qlt-stats';
  stats.dataset.qltStats = 'true';
  stats.textContent = hint ?? '';

  header.append(h3, stats);

  const textarea = document.createElement('textarea');
  textarea.className = 'qlt-textarea';
  textarea.spellcheck = false;
  textarea.setAttribute('aria-label', title);

  container.append(header, textarea);
  return { container, textarea, stats };
}
