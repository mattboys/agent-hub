import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const { body } = createAppShell({
  title: 'Aura Gradient Mixer',
  description:
    'Craft gradients that feel like late-night neon or golden-hour haze. Tweak the stops or randomize an entirely new vibe, then copy the CSS when it feels right.',
  accent: '#ff7ee7'
});

const state = {
  angle: 132,
  colors: [
    { id: 'start', label: 'First light', value: '#ff7ee7' },
    { id: 'mid', label: 'Dream wash', value: '#8a77ff' },
    { id: 'end', label: 'Deep glow', value: '#3fa9f5' }
  ]
};

const preview = document.createElement('div');
preview.className = 'gradient-preview';

const overlay = document.createElement('div');
overlay.className = 'gradient-overlay';
preview.appendChild(overlay);

const controls = document.createElement('div');
controls.className = 'gradient-controls';

const angleControl = document.createElement('label');
angleControl.className = 'control angle-control';
angleControl.innerHTML = `
  <span class="control-label">Angle</span>
  <div class="range-row">
    <input type="range" min="0" max="360" value="${state.angle}" aria-label="Gradient angle" />
    <span class="angle-value">${state.angle}°</span>
  </div>
`;

const angleInput = angleControl.querySelector('input');
const angleValue = angleControl.querySelector('.angle-value');

angleInput.addEventListener('input', (event) => {
  const newAngle = Number(event.target.value);
  state.angle = newAngle;
  angleValue.textContent = `${newAngle}°`;
  renderGradient();
});

const stopsList = document.createElement('div');
stopsList.className = 'stops-list';

state.colors.forEach((stop, index) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'control stop-control';
  wrapper.innerHTML = `
    <span class="control-label">${stop.label}</span>
    <div class="stop-inputs">
      <input type="color" value="${stop.value}" aria-label="${stop.label} color" />
      <input type="text" value="${stop.value}" aria-label="${stop.label} hex" maxlength="7" />
    </div>
  `;

  const colorInput = wrapper.querySelector('input[type="color"]');
  const textInput = wrapper.querySelector('input[type="text"]');

  const syncValue = (value) => {
    state.colors[index].value = normalizeHex(value);
    const normalized = state.colors[index].value;
    colorInput.value = normalized;
    textInput.value = normalized;
    renderGradient();
  };

  colorInput.addEventListener('input', (event) => {
    syncValue(event.target.value);
  });

  textInput.addEventListener('change', (event) => {
    const parsed = normalizeHex(event.target.value);
    syncValue(parsed);
  });

  stopsList.appendChild(wrapper);
});

const actions = document.createElement('div');
actions.className = 'gradient-actions';

const randomizeButton = document.createElement('button');
randomizeButton.type = 'button';
randomizeButton.className = 'action-btn';
randomizeButton.textContent = 'Randomize vibe';
randomizeButton.addEventListener('click', () => {
  const { colors, angle } = randomGradient();
  state.angle = angle;
  angleInput.value = String(angle);
  angleValue.textContent = `${angle}°`;
  state.colors.forEach((stop, index) => {
    stop.value = colors[index];
    const wrapper = stopsList.children[index];
    const colorInput = wrapper.querySelector('input[type="color"]');
    const textInput = wrapper.querySelector('input[type="text"]');
    colorInput.value = stop.value;
    textInput.value = stop.value;
  });
  renderGradient();
  toast('✨ Fresh gradient incoming');
});

const copyButton = document.createElement('button');
copyButton.type = 'button';
copyButton.className = 'action-btn primary';
copyButton.textContent = 'Copy CSS snippet';
copyButton.addEventListener('click', async () => {
  const css = `background: ${getGradientString()};`;
  try {
    await navigator.clipboard.writeText(css);
    toast('Copied gradient CSS to clipboard');
  } catch (error) {
    console.error(error);
    toast('Clipboard blocked. Copy manually from the code block.', true);
  }
});

actions.append(randomizeButton, copyButton);

const codeBlock = document.createElement('pre');
codeBlock.className = 'code-block';

const status = document.createElement('div');
status.className = 'toast';
status.setAttribute('role', 'status');
status.setAttribute('aria-live', 'polite');

controls.append(angleControl, stopsList, actions);

body.append(preview, controls, codeBlock, status);

function getGradientString() {
  const stops = state.colors.map((stop, index) => {
    const position = index === 0 ? '0%' : index === state.colors.length - 1 ? '100%' : `${Math.round((index / (state.colors.length - 1)) * 100)}%`;
    return `${stop.value} ${position}`;
  });
  return `linear-gradient(${state.angle}deg, ${stops.join(', ')})`;
}

function renderGradient() {
  const gradient = getGradientString();
  preview.style.background = gradient;
  overlay.style.background = gradient;
  codeBlock.textContent = `background: ${gradient};`;
}

let toastTimeout;
function toast(message, isError = false) {
  status.textContent = message;
  status.dataset.state = isError ? 'error' : 'ok';
  status.classList.add('visible');
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  toastTimeout = setTimeout(() => {
    status.classList.remove('visible');
  }, 2600);
}

function randomGradient() {
  const baseHue = Math.floor(Math.random() * 360);
  const spread = 40 + Math.random() * 40;
  const colors = [-spread, 0, spread * 0.7].map((offset, index) => {
    const hue = (baseHue + offset + 360) % 360;
    const saturation = 65 + Math.random() * 20;
    const lightness = 45 + index * 5 + Math.random() * 6;
    return hslToHex(hue, saturation, lightness);
  });
  const angle = Math.floor(Math.random() * 360);
  return { colors, angle };
}

function hslToHex(h, s, l) {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = chroma;
    g = x;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = chroma;
  } else if (h >= 120 && h < 180) {
    g = chroma;
    b = x;
  } else if (h >= 180 && h < 240) {
    g = x;
    b = chroma;
  } else if (h >= 240 && h < 300) {
    r = x;
    b = chroma;
  } else {
    r = chroma;
    b = x;
  }

  const toHex = (value) => {
    return Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, '0');
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function normalizeHex(value) {
  if (!value) {
    return '#000000';
  }
  const prefixed = value.startsWith('#') ? value : `#${value}`;
  if (/^#([0-9a-f]{3}){1,2}$/i.test(prefixed)) {
    if (prefixed.length === 4) {
      const r = prefixed[1];
      const g = prefixed[2];
      const b = prefixed[3];
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return prefixed.toLowerCase();
  }
  return '#4b4bfa';
}

renderGradient();
