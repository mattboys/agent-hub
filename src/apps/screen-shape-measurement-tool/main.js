import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const ACCENT = '#5cf7c1';
const LINE_LENGTH_PX = 260;
const DISPLAY_FORMAT = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2
});

const UNIT_OPTIONS = [
  { id: 'mm', label: 'mm', mmPerUnit: 1, step: 0.1 },
  { id: 'cm', label: 'cm', mmPerUnit: 10, step: 0.01 },
  { id: 'in', label: 'in', mmPerUnit: 25.4, step: 0.01 }
];

const TOOL_DEFINITIONS = [
  {
    id: 'circle',
    title: 'Circle',
    description: 'Diameter',
    controls: [
      { key: 'diameter', label: 'Diameter', minMm: 5, maxMm: 220, stepMm: 1, valueMm: 60 }
    ],
    render: (tool, scalePxPerMm) => {
      const diameterPx = toPixels(tool.controls[0].valueMm, scalePxPerMm);
      setShapeSize(tool.shape, diameterPx, diameterPx);
    }
  },
  {
    id: 'corner-radius',
    title: 'Corner Radius',
    description: 'Radius',
    controls: [
      { key: 'radius', label: 'Radius', minMm: 1, maxMm: 80, stepMm: 0.5, valueMm: 12 }
    ],
    render: (tool, scalePxPerMm) => {
      const radiusPx = toPixels(tool.controls[0].valueMm, scalePxPerMm);
      const minSizePx = toPixels(30, scalePxPerMm);
      const sizePx = Math.max(minSizePx, radiusPx * 3);
      setShapeSize(tool.shape, sizePx, sizePx);
      tool.shape.style.borderRadius = `${radiusPx}px`;
    }
  },
  {
    id: 'square',
    title: 'Square',
    description: 'Side length',
    controls: [
      { key: 'side', label: 'Side', minMm: 5, maxMm: 220, stepMm: 1, valueMm: 70 }
    ],
    render: (tool, scalePxPerMm) => {
      const sidePx = toPixels(tool.controls[0].valueMm, scalePxPerMm);
      setShapeSize(tool.shape, sidePx, sidePx);
    }
  },
  {
    id: 'triangle',
    title: 'Triangle',
    description: 'Side length',
    controls: [
      { key: 'side', label: 'Side', minMm: 10, maxMm: 240, stepMm: 1, valueMm: 80 }
    ],
    render: (tool, scalePxPerMm) => {
      const sidePx = toPixels(tool.controls[0].valueMm, scalePxPerMm);
      const heightPx = sidePx * Math.sqrt(3) / 2;
      setShapeSize(tool.shape, sidePx, heightPx);
    }
  },
  {
    id: 'pentagon',
    title: 'Pentagon',
    description: 'Side length',
    controls: [
      { key: 'side', label: 'Side', minMm: 10, maxMm: 220, stepMm: 1, valueMm: 60 }
    ],
    render: (tool, scalePxPerMm) => {
      const sidePx = toPixels(tool.controls[0].valueMm, scalePxPerMm);
      const radius = sidePx / (2 * Math.sin(Math.PI / 5));
      const sizePx = radius * 2;
      setShapeSize(tool.shape, sizePx, sizePx);
    }
  },
  {
    id: 'hexagon',
    title: 'Hexagon',
    description: 'Side length',
    controls: [
      { key: 'side', label: 'Side', minMm: 10, maxMm: 240, stepMm: 1, valueMm: 65 }
    ],
    render: (tool, scalePxPerMm) => {
      const sidePx = toPixels(tool.controls[0].valueMm, scalePxPerMm);
      const radius = sidePx / (2 * Math.sin(Math.PI / 6));
      const sizePx = radius * 2;
      setShapeSize(tool.shape, sizePx, sizePx);
    }
  },
  {
    id: 'rectangle',
    title: 'Rectangle',
    description: 'Width and height',
    controls: [
      { key: 'width', label: 'Width', minMm: 10, maxMm: 260, stepMm: 1, valueMm: 120 },
      { key: 'height', label: 'Height', minMm: 10, maxMm: 200, stepMm: 1, valueMm: 80 }
    ],
    render: (tool, scalePxPerMm) => {
      const widthPx = toPixels(tool.controls[0].valueMm, scalePxPerMm);
      const heightPx = toPixels(tool.controls[1].valueMm, scalePxPerMm);
      setShapeSize(tool.shape, widthPx, heightPx);
    }
  },
  {
    id: 'line',
    title: 'Line',
    description: 'Length',
    controls: [
      { key: 'length', label: 'Length', minMm: 10, maxMm: 260, stepMm: 1, valueMm: 90 }
    ],
    render: (tool, scalePxPerMm) => {
      const lengthPx = toPixels(tool.controls[0].valueMm, scalePxPerMm);
      setShapeSize(tool.shape, lengthPx, 6);
    }
  }
];

const { body } = createAppShell({
  title: 'Screen Shape Measurement Tool',
  description: 'Estimate screen scale, calibrate with a measured line, and preview shapes in real-world sizes.',
  accent: ACCENT
});

const state = {
  unit: UNIT_OPTIONS[0],
  estimatedScalePxPerMm: getEstimatedScalePxPerMm(),
  scalePxPerMm: 0,
  calibrationLinePx: LINE_LENGTH_PX,
  calibrationLengthMm: 0
};

state.scalePxPerMm = state.estimatedScalePxPerMm;
state.calibrationLengthMm = state.calibrationLinePx / state.scalePxPerMm;

const app = document.createElement('div');
app.className = 'measurement-app';

const scaleSection = createScaleSection(state);
const toolsSection = createToolsSection(state);

app.append(scaleSection.section, toolsSection.section);
body.appendChild(app);

updateScaleReadout();
updateCalibrationInput();
updateAllTools();

function createScaleSection() {
  const section = document.createElement('section');
  section.className = 'scale-section';

  const header = document.createElement('div');
  header.className = 'section-header';
  header.innerHTML = `
    <div>
      <h2>Screen scale and calibration</h2>
      <p>Start with an estimate, then measure the line below to lock in an exact scale.</p>
    </div>
  `;

  const grid = document.createElement('div');
  grid.className = 'scale-grid';

  const scaleCard = document.createElement('article');
  scaleCard.className = 'measurement-card';

  const scaleHeader = document.createElement('div');
  scaleHeader.className = 'card-header';
  scaleHeader.innerHTML = `
    <h3>Scale estimate</h3>
    <p>These values are guessed from your browser until you calibrate.</p>
  `;

  const unitRow = document.createElement('div');
  unitRow.className = 'unit-row';

  const unitLabel = document.createElement('label');
  unitLabel.textContent = 'Units';
  unitLabel.setAttribute('for', 'unit-select');

  const unitSelect = document.createElement('select');
  unitSelect.id = 'unit-select';
  unitSelect.className = 'unit-select';
  UNIT_OPTIONS.forEach((unit) => {
    const option = document.createElement('option');
    option.value = unit.id;
    option.textContent = unit.label;
    unitSelect.appendChild(option);
  });

  unitRow.append(unitLabel, unitSelect);

  const stats = document.createElement('div');
  stats.className = 'scale-stats';

  const estimatedRow = createScaleRow('Estimated scale', '--');
  const currentRow = createScaleRow('Current scale', '--');
  const perPixelRow = createScaleRow('One pixel equals', '--');
  const dprRow = createScaleRow('Device pixel ratio', formatDisplay(window.devicePixelRatio || 1));

  stats.append(estimatedRow.row, currentRow.row, perPixelRow.row, dprRow.row);

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'ghost-button';
  resetButton.textContent = 'Reset to estimate';

  scaleCard.append(scaleHeader, unitRow, stats, resetButton);

  const calibrationCard = document.createElement('article');
  calibrationCard.className = 'measurement-card';

  const calibrationHeader = document.createElement('div');
  calibrationHeader.className = 'card-header';
  calibrationHeader.innerHTML = `
    <h3>Calibration line</h3>
    <p>Measure the line with a ruler and enter the real length.</p>
  `;

  const lineWrap = document.createElement('div');
  lineWrap.className = 'calibration-line-wrap';

  const line = document.createElement('div');
  line.className = 'calibration-line';
  line.style.width = `${state.calibrationLinePx}px`;

  const lineLabel = document.createElement('span');
  lineLabel.className = 'line-label';
  lineLabel.textContent = `${state.calibrationLinePx}px line`;

  lineWrap.append(line, lineLabel);

  const calibrationInputRow = document.createElement('div');
  calibrationInputRow.className = 'calibration-input-row';

  const calibrationLabel = document.createElement('label');
  calibrationLabel.setAttribute('for', 'calibration-input');
  calibrationLabel.textContent = 'Measured length';

  const calibrationField = document.createElement('div');
  calibrationField.className = 'calibration-field';

  const calibrationInput = document.createElement('input');
  calibrationInput.type = 'number';
  calibrationInput.id = 'calibration-input';
  calibrationInput.inputMode = 'decimal';
  calibrationInput.autocomplete = 'off';

  const calibrationUnit = document.createElement('span');
  calibrationUnit.className = 'unit-suffix';

  calibrationField.append(calibrationInput, calibrationUnit);
  calibrationInputRow.append(calibrationLabel, calibrationField);

  const calibrationHint = document.createElement('p');
  calibrationHint.className = 'calibration-hint';

  const estimatedHint = document.createElement('p');
  estimatedHint.className = 'calibration-hint';

  calibrationCard.append(
    calibrationHeader,
    lineWrap,
    calibrationInputRow,
    calibrationHint,
    estimatedHint
  );

  grid.append(scaleCard, calibrationCard);
  section.append(header, grid);

  unitSelect.addEventListener('change', () => {
    const next = UNIT_OPTIONS.find((unit) => unit.id === unitSelect.value);
    if (!next) {
      return;
    }
    state.unit = next;
    updateUnitSensitiveUI();
  });

  resetButton.addEventListener('click', () => {
    state.scalePxPerMm = state.estimatedScalePxPerMm;
    state.calibrationLengthMm = state.calibrationLinePx / state.scalePxPerMm;
    calibrationHint.textContent = 'Reset to the estimated scale.';
    calibrationInput.removeAttribute('aria-invalid');
    updateScaleReadout();
    updateCalibrationInput();
    updateAllTools();
  });

  calibrationInput.addEventListener('input', () => {
    const value = calibrationInput.valueAsNumber;
    if (!Number.isFinite(value) || value <= 0) {
      calibrationInput.setAttribute('aria-invalid', 'true');
      calibrationHint.textContent = 'Enter a positive number to calibrate.';
      return;
    }
    calibrationInput.removeAttribute('aria-invalid');
    state.calibrationLengthMm = value * state.unit.mmPerUnit;
    state.scalePxPerMm = state.calibrationLinePx / state.calibrationLengthMm;
    calibrationHint.textContent = 'Calibration applied to all tools.';
    updateScaleReadout();
    updateAllTools();
    estimatedHint.textContent = buildEstimatedHint();
  });

  section.ui = {
    unitSelect,
    calibrationInput,
    calibrationUnit,
    calibrationHint,
    estimatedHint,
    estimatedValue: estimatedRow.value,
    currentValue: currentRow.value,
    perPixelValue: perPixelRow.value
  };

  return { section };
}

function createToolsSection() {
  const section = document.createElement('section');
  section.className = 'tools-section';

  const header = document.createElement('div');
  header.className = 'section-header';
  header.innerHTML = `
    <div>
      <h2>Shape tools</h2>
      <p>Enter a value or drag a slider to preview the shape at real-world size.</p>
    </div>
  `;

  const grid = document.createElement('div');
  grid.className = 'tool-grid';

  const toolStates = TOOL_DEFINITIONS.map((definition) => createToolCard(definition));
  toolStates.forEach((tool) => grid.appendChild(tool.card));

  section.append(header, grid);
  section.toolStates = toolStates;
  return { section };
}

function createToolCard(definition) {
  const card = document.createElement('article');
  card.className = 'measurement-card tool-card';

  const header = document.createElement('div');
  header.className = 'card-header';
  header.innerHTML = `
    <h3>${definition.title}</h3>
    <p>${definition.description}</p>
  `;

  const controls = document.createElement('div');
  controls.className = 'tool-controls';

  const controlStates = definition.controls.map((control) => createControl(control, definition.id));
  controlStates.forEach((control) => controls.appendChild(control.wrapper));

  const preview = document.createElement('div');
  preview.className = 'tool-preview';

  const shape = document.createElement('div');
  shape.className = `shape shape-${definition.id}`;
  preview.appendChild(shape);

  const meta = document.createElement('p');
  meta.className = 'tool-meta';

  card.append(header, controls, preview, meta);

  const toolState = {
    definition,
    controls: controlStates,
    shape,
    meta,
    card
  };

  controlStates.forEach((control) => {
    control.tool = toolState;
    control.input.addEventListener('input', () => {
      handleControlInput(control, control.input.valueAsNumber);
    });
    control.range.addEventListener('input', () => {
      handleControlInput(control, control.range.valueAsNumber);
    });
  });

  return toolState;
}

function createControl(control, idPrefix) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tool-control';

  const header = document.createElement('div');
  header.className = 'tool-control-header';

  const label = document.createElement('label');
  const inputId = `${idPrefix}-${control.key}`;
  label.setAttribute('for', inputId);
  label.textContent = control.label;

  const inputWrap = document.createElement('div');
  inputWrap.className = 'tool-input-wrap';

  const input = document.createElement('input');
  input.type = 'number';
  input.inputMode = 'decimal';
  input.id = inputId;
  input.autocomplete = 'off';

  const unitSuffix = document.createElement('span');
  unitSuffix.className = 'unit-suffix';

  inputWrap.append(input, unitSuffix);
  header.append(label, inputWrap);

  const range = document.createElement('input');
  range.type = 'range';

  wrapper.append(header, range);

  return {
    ...control,
    wrapper,
    label,
    input,
    range,
    unitSuffix,
    valueMm: control.valueMm
  };
}

function handleControlInput(control, valueInUnit) {
  if (!Number.isFinite(valueInUnit)) {
    control.input.setAttribute('aria-invalid', 'true');
    return;
  }
  control.input.removeAttribute('aria-invalid');
  const nextMm = clamp(valueInUnit * state.unit.mmPerUnit, control.minMm, control.maxMm);
  control.valueMm = nextMm;
  syncControl(control);
  updateTool(control.tool);
}

function syncControl(control) {
  const stepUnit = control.stepMm / state.unit.mmPerUnit;
  const valueUnit = control.valueMm / state.unit.mmPerUnit;
  control.input.step = stepUnit;
  control.range.step = stepUnit;
  control.input.min = control.minMm / state.unit.mmPerUnit;
  control.range.min = control.minMm / state.unit.mmPerUnit;
  control.input.max = control.maxMm / state.unit.mmPerUnit;
  control.range.max = control.maxMm / state.unit.mmPerUnit;
  control.input.value = formatInput(valueUnit, stepUnit);
  control.range.value = String(valueUnit);
  control.unitSuffix.textContent = state.unit.label;
}

function updateAllTools() {
  toolsSection.section.toolStates.forEach((tool) => updateTool(tool));
}

function updateTool(tool) {
  tool.definition.render(tool, state.scalePxPerMm);
  tool.controls.forEach((control) => syncControl(control));
  tool.meta.textContent = tool.controls
    .map((control) => `${control.label}: ${formatDisplay(control.valueMm / state.unit.mmPerUnit)} ${state.unit.label}`)
    .join(' | ');
}

function updateScaleReadout() {
  const ui = scaleSection.section.ui;
  const estimatedPxPerUnit = state.estimatedScalePxPerMm * state.unit.mmPerUnit;
  const currentPxPerUnit = state.scalePxPerMm * state.unit.mmPerUnit;
  const unitPerPx = 1 / currentPxPerUnit;
  ui.estimatedValue.textContent = `${formatDisplay(estimatedPxPerUnit)} px per ${state.unit.label}`;
  ui.currentValue.textContent = `${formatDisplay(currentPxPerUnit)} px per ${state.unit.label}`;
  ui.perPixelValue.textContent = `${formatDisplay(unitPerPx)} ${state.unit.label} per px`;
  ui.calibrationUnit.textContent = state.unit.label;
  ui.unitSelect.value = state.unit.id;
  ui.estimatedHint.textContent = buildEstimatedHint();
}

function updateCalibrationInput() {
  const ui = scaleSection.section.ui;
  const valueUnit = state.calibrationLengthMm / state.unit.mmPerUnit;
  ui.calibrationInput.value = formatInput(valueUnit, state.unit.step);
  ui.calibrationInput.step = state.unit.step;
  ui.calibrationInput.min = state.unit.step;
  ui.calibrationInput.max = ((state.calibrationLinePx / state.estimatedScalePxPerMm) * 3) / state.unit.mmPerUnit;
  ui.calibrationUnit.textContent = state.unit.label;
  ui.calibrationHint.textContent = 'Enter the measured length to calibrate.';
  ui.estimatedHint.textContent = buildEstimatedHint();
}

function updateUnitSensitiveUI() {
  updateScaleReadout();
  updateCalibrationInput();
  updateAllTools();
}

function buildEstimatedHint() {
  const estimatedLengthMm = state.calibrationLinePx / state.estimatedScalePxPerMm;
  const estimatedValue = estimatedLengthMm / state.unit.mmPerUnit;
  return `Estimated length at this scale: ${formatDisplay(estimatedValue)} ${state.unit.label}.`;
}

function createScaleRow(label, valueText) {
  const row = document.createElement('div');
  row.className = 'scale-row';

  const labelSpan = document.createElement('span');
  labelSpan.textContent = label;

  const valueSpan = document.createElement('strong');
  valueSpan.textContent = valueText;

  row.append(labelSpan, valueSpan);
  return { row, value: valueSpan };
}

function setShapeSize(shape, width, height) {
  shape.style.width = `${Math.max(width, 1)}px`;
  shape.style.height = `${Math.max(height, 1)}px`;
}

function toPixels(mm, scalePxPerMm) {
  return mm * scalePxPerMm;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatInput(value, step) {
  if (!Number.isFinite(value)) {
    return '';
  }
  const decimals = getStepDecimals(step);
  const fixed = value.toFixed(decimals);
  return trimTrailingZeros(fixed);
}

function formatDisplay(value) {
  if (!Number.isFinite(value)) {
    return '--';
  }
  return DISPLAY_FORMAT.format(value);
}

function trimTrailingZeros(value) {
  return value.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
}

function getStepDecimals(step) {
  const stepString = String(step);
  const decimal = stepString.split('.')[1];
  return decimal ? decimal.length : 0;
}

function getEstimatedScalePxPerMm() {
  const probe = document.createElement('div');
  probe.style.width = '1in';
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  document.body.appendChild(probe);
  const pxPerInch = probe.getBoundingClientRect().width || 96;
  probe.remove();
  return pxPerInch / 25.4;
}
