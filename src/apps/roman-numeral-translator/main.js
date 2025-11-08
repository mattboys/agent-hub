import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const ACCENT = '#f08c4a';
const MAX_VALUE = 3999;
const ROMAN_LETTERS = /^[IVXLCDM]+$/;
const ROMAN_PATTERN = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

const SYMBOLS = [
  { symbol: 'M', value: 1000 },
  { symbol: 'CM', value: 900 },
  { symbol: 'D', value: 500 },
  { symbol: 'CD', value: 400 },
  { symbol: 'C', value: 100 },
  { symbol: 'XC', value: 90 },
  { symbol: 'L', value: 50 },
  { symbol: 'XL', value: 40 },
  { symbol: 'X', value: 10 },
  { symbol: 'IX', value: 9 },
  { symbol: 'V', value: 5 },
  { symbol: 'IV', value: 4 },
  { symbol: 'I', value: 1 }
];

const VALUE_BY_SYMBOL = new Map(SYMBOLS.map((entry) => [entry.symbol, entry.value]));

const BASE_DIGITS = [
  { roman: 'I', value: 1 },
  { roman: 'V', value: 5 },
  { roman: 'X', value: 10 },
  { roman: 'L', value: 50 },
  { roman: 'C', value: 100 },
  { roman: 'D', value: 500 },
  { roman: 'M', value: 1000 }
];

const SUBTRACTIVE_DIGITS = [
  { roman: 'IV', value: 4 },
  { roman: 'IX', value: 9 },
  { roman: 'XL', value: 40 },
  { roman: 'XC', value: 90 },
  { roman: 'CD', value: 400 },
  { roman: 'CM', value: 900 }
];

const state = {
  history: []
};

const { body } = createAppShell({
  title: 'Roman Numeral Translator',
  description:
    'Swap between Roman numerals and modern numbers instantly with clear validation, breakdowns, and a running history.',
  accent: ACCENT
});

const translator = document.createElement('div');
translator.className = 'roman-translator';

const conversionGrid = document.createElement('div');
conversionGrid.className = 'translation-grid';

const romanUI = createRomanCard();
const arabicUI = createArabicCard();

conversionGrid.append(romanUI.card, arabicUI.card);

const insightGrid = document.createElement('div');
insightGrid.className = 'insight-grid';

const historyUI = createHistoryCard();
const referenceCard = createReferenceCard();

insightGrid.append(historyUI.card, referenceCard);

translator.append(conversionGrid, insightGrid);
body.appendChild(translator);

romanUI.input.addEventListener('input', () => handleRomanInput(romanUI.input.value));
romanUI.form.addEventListener('submit', (event) => {
  event.preventDefault();
  handleRomanInput(romanUI.input.value);
  romanUI.input.focus();
});

arabicUI.input.addEventListener('input', () => handleArabicInput(arabicUI.input.value));
arabicUI.form.addEventListener('submit', (event) => {
  event.preventDefault();
  handleArabicInput(arabicUI.input.value);
  arabicUI.input.focus();
});

renderHistory();

function handleRomanInput(rawValue) {
  const uppercase = rawValue.toUpperCase();
  if (romanUI.input.value !== uppercase) {
    romanUI.input.value = uppercase;
  }

  const normalized = uppercase.replace(/\s+/g, '');

  if (!normalized) {
    clearRomanResult();
    return;
  }

  if (!ROMAN_LETTERS.test(normalized)) {
    showRomanError('Use the Roman numeral letters I, V, X, L, C, D, and M only.');
    return;
  }

  if (!ROMAN_PATTERN.test(normalized)) {
    showRomanError('That sequence breaks Roman numeral rules. Check subtractive pairs like IV, IX, XL, XC, CD, and CM.');
    return;
  }

  const decoded = fromRoman(normalized);
  romanUI.error.hidden = true;
  reflectValidity(romanUI.input, true);
  setResult(romanUI.result, String(decoded.value));
  setBreakdown(romanUI.breakdown, decoded.segments);
  pushHistory({ mode: 'romanToArabic', from: normalized, to: String(decoded.value) });
}

function handleArabicInput(rawValue) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    clearArabicResult();
    return;
  }

  if (!/^-?\d+$/.test(trimmed)) {
    showArabicError('Please enter a whole number without decimals or symbols.');
    return;
  }

  const numeric = Number(trimmed);

  if (!Number.isInteger(numeric)) {
    showArabicError('Please enter a whole number without decimals.');
    return;
  }

  if (numeric < 1 || numeric > MAX_VALUE) {
    showArabicError(`Standard Roman numerals cover 1 through ${MAX_VALUE}.`);
    return;
  }

  const encoded = toRoman(numeric);
  arabicUI.error.hidden = true;
  reflectValidity(arabicUI.input, true);
  setResult(arabicUI.result, encoded.roman);
  setBreakdown(arabicUI.breakdown, encoded.segments);
  pushHistory({ mode: 'arabicToRoman', from: String(numeric), to: encoded.roman });
}

function showRomanError(message) {
  romanUI.error.textContent = message;
  romanUI.error.hidden = false;
  reflectValidity(romanUI.input, false);
  setResult(romanUI.result, '—', 'error');
  setBreakdown(romanUI.breakdown, []);
}

function showArabicError(message) {
  arabicUI.error.textContent = message;
  arabicUI.error.hidden = false;
  reflectValidity(arabicUI.input, false);
  setResult(arabicUI.result, '—', 'error');
  setBreakdown(arabicUI.breakdown, []);
}

function clearRomanResult() {
  romanUI.error.hidden = true;
  reflectValidity(romanUI.input, true);
  setResult(romanUI.result, '—', 'idle');
  setBreakdown(romanUI.breakdown, []);
}

function clearArabicResult() {
  arabicUI.error.hidden = true;
  reflectValidity(arabicUI.input, true);
  setResult(arabicUI.result, '—', 'idle');
  setBreakdown(arabicUI.breakdown, []);
}

function reflectValidity(input, isValid) {
  if (isValid) {
    input.removeAttribute('aria-invalid');
  } else {
    input.setAttribute('aria-invalid', 'true');
  }
}

function setResult(resultUI, value, state = 'ready') {
  resultUI.value.textContent = value;
  resultUI.wrapper.dataset.state = state;
}

function setBreakdown(breakdownUI, segments) {
  breakdownUI.list.innerHTML = '';

  if (!segments.length) {
    breakdownUI.wrapper.dataset.state = 'empty';
    return;
  }

  breakdownUI.wrapper.dataset.state = 'ready';

  segments.forEach((segment, index) => {
    const item = document.createElement('li');
    item.className = 'breakdown-chip';
    item.innerHTML = `
      <span class="chip-symbol">${segment.symbol}</span>
      <span class="chip-value">${segment.value}</span>
    `;
    item.setAttribute('aria-label', `${segment.symbol} equals ${segment.value}`);
    item.dataset.index = String(index);
    breakdownUI.list.appendChild(item);
  });
}

function pushHistory(entry) {
  const signature = `${entry.mode}:${entry.from}->${entry.to}`;
  if (state.history[0]?.signature === signature) {
    renderHistory();
    return;
  }

  state.history.unshift({
    ...entry,
    signature,
    timestamp: Date.now()
  });

  if (state.history.length > 7) {
    state.history.length = 7;
  }

  renderHistory();
}

function renderHistory() {
  historyUI.list.innerHTML = '';

  if (!state.history.length) {
    historyUI.list.dataset.state = 'empty';
    historyUI.empty.hidden = false;
    return;
  }

  historyUI.list.dataset.state = 'ready';
  historyUI.empty.hidden = true;

  state.history.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'history-item';

    const from = document.createElement('span');
    from.className = 'history-value from';
    from.textContent = entry.from;

    const arrow = document.createElement('span');
    arrow.className = 'history-arrow';
    arrow.textContent = '→';

    const to = document.createElement('span');
    to.className = 'history-value to';
    to.textContent = entry.to;

    const meta = document.createElement('span');
    meta.className = 'history-meta';
    meta.textContent =
      entry.mode === 'romanToArabic' ? 'Roman → Number' : 'Number → Roman';

    item.append(from, arrow, to, meta);
    historyUI.list.appendChild(item);
  });
}

function fromRoman(value) {
  let index = 0;
  let total = 0;
  const segments = [];

  while (index < value.length) {
    const two = value.slice(index, index + 2);

    if (VALUE_BY_SYMBOL.has(two)) {
      const segmentValue = VALUE_BY_SYMBOL.get(two);
      segments.push({ symbol: two, value: segmentValue });
      total += segmentValue;
      index += 2;
      continue;
    }

    const one = value[index];
    const singleValue = VALUE_BY_SYMBOL.get(one);
    segments.push({ symbol: one, value: singleValue });
    total += singleValue;
    index += 1;
  }

  return { value: total, segments };
}

function toRoman(number) {
  let remaining = number;
  const segments = [];

  for (const entry of SYMBOLS) {
    while (remaining >= entry.value) {
      segments.push({ symbol: entry.symbol, value: entry.value });
      remaining -= entry.value;
    }
  }

  const roman = segments.map((segment) => segment.symbol).join('');
  return { roman, segments };
}

function createRomanCard() {
  const card = document.createElement('article');
  card.className = 'translator-card';

  const header = document.createElement('div');
  header.className = 'card-header';
  header.innerHTML = `
    <span class="card-eyebrow">Roman → Number</span>
    <h2>Decode a Roman numeral</h2>
    <p>Get an instant arabic value with component breakdown and validation tips.</p>
  `;

  const form = document.createElement('form');
  form.className = 'translator-form';

  const field = document.createElement('label');
  field.className = 'field-group';

  const labelText = document.createElement('span');
  labelText.className = 'field-label';
  labelText.textContent = 'Roman numeral';

  const input = document.createElement('input');
  input.type = 'text';
  input.name = 'roman';
  input.placeholder = 'Try XIV or MMXXIV';
  input.autocomplete = 'off';
  input.autocapitalize = 'characters';
  input.spellcheck = false;
  input.className = 'field-input';
  input.setAttribute('aria-describedby', 'roman-hint');

  const hint = document.createElement('p');
  hint.className = 'field-hint';
  hint.id = 'roman-hint';
  hint.textContent = 'Valid letters: I, V, X, L, C, D, M. Standard range covers up to 3,999.';

  const button = document.createElement('button');
  button.type = 'submit';
  button.className = 'primary-btn';
  button.textContent = 'Translate to number';

  field.append(labelText, input, hint);
  form.append(field, button);

  const error = document.createElement('p');
  error.className = 'field-error';
  error.hidden = true;
  error.setAttribute('aria-live', 'polite');

  const result = createResultBlock({
    label: 'Arabic value',
    placeholder: '—'
  });

  card.append(header, form, error, result.wrapper);

  return {
    card,
    form,
    input,
    error,
    result,
    breakdown: result.breakdown
  };
}

function createArabicCard() {
  const card = document.createElement('article');
  card.className = 'translator-card';

  const header = document.createElement('div');
  header.className = 'card-header';
  header.innerHTML = `
    <span class="card-eyebrow">Number → Roman</span>
    <h2>Encode a number</h2>
    <p>Convert modern numerals into classic Roman symbols with canonical formatting.</p>
  `;

  const form = document.createElement('form');
  form.className = 'translator-form';

  const field = document.createElement('label');
  field.className = 'field-group';

  const labelText = document.createElement('span');
  labelText.className = 'field-label';
  labelText.textContent = 'Number';

  const input = document.createElement('input');
  input.type = 'number';
  input.name = 'arabic';
  input.min = '1';
  input.max = String(MAX_VALUE);
  input.inputMode = 'numeric';
  input.placeholder = 'Enter a value between 1 and 3999';
  input.className = 'field-input';
  input.setAttribute('aria-describedby', 'arabic-hint');

  const hint = document.createElement('p');
  hint.className = 'field-hint';
  hint.id = 'arabic-hint';
  hint.textContent = 'Enter whole numbers only. Traditional Roman numerals max out at 3,999.';

  const button = document.createElement('button');
  button.type = 'submit';
  button.className = 'primary-btn';
  button.textContent = 'Translate to Roman';

  field.append(labelText, input, hint);
  form.append(field, button);

  const error = document.createElement('p');
  error.className = 'field-error';
  error.hidden = true;
  error.setAttribute('aria-live', 'polite');

  const result = createResultBlock({
    label: 'Roman numeral',
    placeholder: '—'
  });

  card.append(header, form, error, result.wrapper);

  return {
    card,
    form,
    input,
    error,
    result,
    breakdown: result.breakdown
  };
}

function createHistoryCard() {
  const card = document.createElement('article');
  card.className = 'translator-card history-card';

  const header = document.createElement('div');
  header.className = 'card-header';
  header.innerHTML = `
    <span class="card-eyebrow">Session history</span>
    <h2>Recent translations</h2>
    <p>Your last few swaps stay here for easy reference.</p>
  `;

  const list = document.createElement('ul');
  list.className = 'history-list';
  list.dataset.state = 'empty';
  list.setAttribute('aria-live', 'polite');

  const empty = document.createElement('p');
  empty.className = 'empty-state';
  empty.textContent = 'Run a translation to build a quick history.';

  card.append(header, empty, list);

  return {
    card,
    list,
    empty
  };
}

function createReferenceCard() {
  const card = document.createElement('article');
  card.className = 'translator-card reference-card';

  const header = document.createElement('div');
  header.className = 'card-header';
  header.innerHTML = `
    <span class="card-eyebrow">Quick reference</span>
    <h2>Core numerals at a glance</h2>
    <p>Memorise the building blocks to sanity-check tricky combinations.</p>
  `;

  const grid = document.createElement('div');
  grid.className = 'reference-grid';

  grid.append(createReferenceColumn('Base numerals', BASE_DIGITS));
  grid.append(createReferenceColumn('Subtractive pairs', SUBTRACTIVE_DIGITS));

  const note = document.createElement('p');
  note.className = 'reference-note';
  note.textContent = 'Need larger numbers? Romans repeated numerals with overlines, but this tool sticks to the standard 1–3,999 range used in modern typography.';

  card.append(header, grid, note);
  return card;
}

function createReferenceColumn(title, items) {
  const column = document.createElement('div');
  column.className = 'reference-column';

  const heading = document.createElement('h3');
  heading.textContent = title;

  const list = document.createElement('ul');
  list.className = 'reference-list';

  items.forEach((item) => {
    const row = document.createElement('li');
    row.innerHTML = `
      <span class="ref-roman">${item.roman}</span>
      <span class="ref-value">${item.value}</span>
    `;
    list.appendChild(row);
  });

  column.append(heading, list);
  return column;
}

function createResultBlock({ label, placeholder }) {
  const wrapper = document.createElement('section');
  wrapper.className = 'result-block';
  wrapper.dataset.state = 'idle';

  const labelEl = document.createElement('span');
  labelEl.className = 'result-label';
  labelEl.textContent = label;

  const value = document.createElement('output');
  value.className = 'result-value';
  value.textContent = placeholder;
  value.setAttribute('aria-live', 'polite');

  const breakdownWrapper = document.createElement('div');
  breakdownWrapper.className = 'breakdown-wrapper';
  breakdownWrapper.dataset.state = 'empty';

  const breakdownLabel = document.createElement('span');
  breakdownLabel.className = 'breakdown-label';
  breakdownLabel.textContent = 'Components';

  const breakdownList = document.createElement('ul');
  breakdownList.className = 'breakdown-list';

  breakdownWrapper.append(breakdownLabel, breakdownList);
  wrapper.append(labelEl, value, breakdownWrapper);

  return {
    wrapper,
    value,
    breakdown: {
      wrapper: breakdownWrapper,
      list: breakdownList
    }
  };
}
