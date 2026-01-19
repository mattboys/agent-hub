import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const ACCENT = '#4cc9f0';
const NUMBER_FORMAT = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 6
});

const { body } = createAppShell({
  title: 'Slope-Intercept Calculator',
  description:
    'Enter two points to solve the slope (m) and y-intercept (c) in y = mx + c.',
  accent: ACCENT
});

const app = document.createElement('div');
app.className = 'linear-calculator';

const inputCard = createInputCard();
const resultCard = createResultCard();

app.append(inputCard.card, resultCard.card);
body.appendChild(app);

const inputs = inputCard.inputs;

Object.values(inputs).forEach((input) => {
  input.addEventListener('input', handleUpdate);
});

inputCard.form.addEventListener('submit', (event) => {
  event.preventDefault();
  handleUpdate();
});

inputCard.swapButton.addEventListener('click', () => {
  swapPointValues(inputs);
  handleUpdate();
});

inputCard.clearButton.addEventListener('click', () => {
  clearPointValues(inputs);
  handleUpdate();
  inputs.x1.focus();
});

handleUpdate();

function handleUpdate() {
  const values = readPointValues(inputs);

  if (values.missing) {
    setIdle(resultCard);
    return;
  }

  if (values.invalid) {
    setError(resultCard, 'Enter valid numbers for all x and y values.');
    return;
  }

  const { x1, y1, x2, y2 } = values;
  const dx = x2 - x1;

  if (dx === 0) {
    setError(resultCard, 'x1 and x2 must be different to calculate a slope.');
    return;
  }

  const m = (y2 - y1) / dx;
  const c = y1 - m * x1;

  setReady(resultCard, { m, c, x1, y1, x2, y2 });
}

function readPointValues(inputs) {
  const parsed = {};
  let missing = false;
  let invalid = false;

  Object.entries(inputs).forEach(([key, input]) => {
    const raw = input.value.trim();

    if (!raw) {
      input.removeAttribute('aria-invalid');
      missing = true;
      return;
    }

    const value = Number(raw);

    if (!Number.isFinite(value)) {
      input.setAttribute('aria-invalid', 'true');
      invalid = true;
      return;
    }

    input.removeAttribute('aria-invalid');
    parsed[key] = value;
  });

  return { ...parsed, missing, invalid };
}

function setIdle(resultCard) {
  resultCard.card.dataset.state = 'idle';
  resultCard.status.textContent = 'Enter both points to calculate m and c.';
  setResultOutputs(resultCard, '--', '--', 'y = mx + c');
  resultCard.pointSummary.textContent = 'Provide two unique points to solve the line.';
}

function setError(resultCard, message) {
  resultCard.card.dataset.state = 'error';
  resultCard.status.textContent = message;
  setResultOutputs(resultCard, '--', '--', 'y = mx + c');
  resultCard.pointSummary.textContent = 'Check the inputs and try again.';
}

function setReady(resultCard, { m, c, x1, y1, x2, y2 }) {
  resultCard.card.dataset.state = 'ready';
  resultCard.status.textContent = 'Slope and intercept are ready.';

  const slopeText = formatNumber(m);
  const interceptText = formatNumber(c);
  const equationText = buildEquationText(m, c);

  setResultOutputs(resultCard, slopeText, interceptText, equationText);

  resultCard.pointSummary.textContent = `Using points (${formatNumber(x1)}, ${formatNumber(y1)}) and (${formatNumber(x2)}, ${formatNumber(y2)}).`;
}

function setResultOutputs(resultCard, slopeText, interceptText, equationText) {
  resultCard.slope.value.textContent = slopeText;
  resultCard.intercept.value.textContent = interceptText;
  resultCard.equation.textContent = equationText;
}

function buildEquationText(m, c) {
  if (!Number.isFinite(m) || !Number.isFinite(c)) {
    return 'y = mx + c';
  }

  const slopeText = formatNumber(m);
  const interceptAbs = formatNumber(Math.abs(c));
  const sign = c < 0 ? '-' : '+';

  return `y = ${slopeText}x ${sign} ${interceptAbs}`;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return '--';
  }

  const normalized = Object.is(value, -0) ? 0 : value;
  return NUMBER_FORMAT.format(normalized);
}

function swapPointValues(inputs) {
  const x1 = inputs.x1.value;
  const y1 = inputs.y1.value;

  inputs.x1.value = inputs.x2.value;
  inputs.y1.value = inputs.y2.value;
  inputs.x2.value = x1;
  inputs.y2.value = y1;
}

function clearPointValues(inputs) {
  Object.values(inputs).forEach((input) => {
    input.value = '';
    input.removeAttribute('aria-invalid');
  });
}

function createInputCard() {
  const card = document.createElement('article');
  card.className = 'calc-card';

  const header = document.createElement('div');
  header.className = 'calc-card-header';
  header.innerHTML = `
    <span class="calc-eyebrow">Inputs</span>
    <h2>Enter two points</h2>
    <p>Provide real-number coordinates for two distinct x values.</p>
  `;

  const form = document.createElement('form');
  form.className = 'calc-form';

  const pointGrid = document.createElement('div');
  pointGrid.className = 'point-grid';

  const pointA = createPointFieldset('Point A', 'x1', 'y1');
  const pointB = createPointFieldset('Point B', 'x2', 'y2');

  pointGrid.append(pointA.fieldset, pointB.fieldset);

  const helper = document.createElement('p');
  helper.className = 'calc-helper';
  helper.textContent = 'Decimals and negative values are supported.';

  const actionBar = document.createElement('div');
  actionBar.className = 'action-bar';

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'action-button primary';
  submitButton.textContent = 'Calculate';

  const swapButton = document.createElement('button');
  swapButton.type = 'button';
  swapButton.className = 'action-button';
  swapButton.textContent = 'Swap points';

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'action-button ghost';
  clearButton.textContent = 'Clear';

  actionBar.append(submitButton, swapButton, clearButton);
  form.append(pointGrid, helper, actionBar);
  card.append(header, form);

  return {
    card,
    form,
    inputs: {
      x1: pointA.xInput,
      y1: pointA.yInput,
      x2: pointB.xInput,
      y2: pointB.yInput
    },
    swapButton,
    clearButton
  };
}

function createPointFieldset(title, xName, yName) {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'point-fieldset';

  const legend = document.createElement('legend');
  legend.textContent = title;

  const fieldRow = document.createElement('div');
  fieldRow.className = 'field-row';

  const xField = createFieldGroup('X value', xName, '0');
  const yField = createFieldGroup('Y value', yName, '0');

  fieldRow.append(xField.group, yField.group);
  fieldset.append(legend, fieldRow);

  return { fieldset, xInput: xField.input, yInput: yField.input };
}

function createFieldGroup(labelText, name, placeholder) {
  const group = document.createElement('label');
  group.className = 'field-group';

  const label = document.createElement('span');
  label.className = 'field-label';
  label.textContent = labelText;

  const input = document.createElement('input');
  input.type = 'number';
  input.name = name;
  input.id = `calc-${name}`;
  input.className = 'field-input';
  input.placeholder = placeholder;
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.step = 'any';

  group.append(label, input);
  return { group, input };
}

function createResultCard() {
  const card = document.createElement('article');
  card.className = 'calc-card result-card';
  card.dataset.state = 'idle';

  const header = document.createElement('div');
  header.className = 'calc-card-header';
  header.innerHTML = `
    <span class="calc-eyebrow">Results</span>
    <h2>Slope-intercept form</h2>
    <p>See the slope and y-intercept for the line through the two points.</p>
  `;

  const status = document.createElement('p');
  status.className = 'result-status';
  status.setAttribute('role', 'status');
  status.textContent = 'Enter both points to calculate m and c.';

  const grid = document.createElement('div');
  grid.className = 'result-grid';

  const slope = createResultItem('Slope (m)', '--');
  const intercept = createResultItem('Intercept (c)', '--');

  grid.append(slope.card, intercept.card);

  const equationBlock = document.createElement('div');
  equationBlock.className = 'equation-block';

  const equationLabel = document.createElement('span');
  equationLabel.className = 'equation-label';
  equationLabel.textContent = 'Equation';

  const equationValue = document.createElement('output');
  equationValue.className = 'equation-value';
  equationValue.textContent = 'y = mx + c';
  equationValue.setAttribute('aria-live', 'polite');

  const equationHint = document.createElement('p');
  equationHint.className = 'equation-hint';
  equationHint.textContent = 'Use this form to graph or check the line.';

  equationBlock.append(equationLabel, equationValue, equationHint);

  const pointSummary = document.createElement('p');
  pointSummary.className = 'point-summary';
  pointSummary.textContent = 'Provide two unique points to solve the line.';

  card.append(header, status, grid, equationBlock, pointSummary);

  return {
    card,
    status,
    slope,
    intercept,
    equation: equationValue,
    pointSummary
  };
}

function createResultItem(labelText, valueText) {
  const card = document.createElement('div');
  card.className = 'result-item';

  const label = document.createElement('span');
  label.className = 'result-label';
  label.textContent = labelText;

  const value = document.createElement('output');
  value.className = 'result-value';
  value.textContent = valueText;
  value.setAttribute('aria-live', 'polite');

  card.append(label, value);
  return { card, value };
}
