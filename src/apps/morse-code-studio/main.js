import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const ACCENT = '#ffd166';
const DEFAULT_UNIT = 150;
const MAX_HISTORY_TOKENS = 80;
const MAX_DECODED_LENGTH = 320;

const { body } = createAppShell({
  title: 'Morse Code Studio',
  description:
    'Tap, speak, or paste Morse code, watch it decode live, then flip any text back into dots, dashes, and tone-perfect playback.',
  accent: ACCENT
});

const decoder = createLiveDecoder({
  unit: DEFAULT_UNIT,
  onUpdate: handleDecoderUpdate
});

const app = document.createElement('div');
app.className = 'morse-studio';

const telemetry = createTelemetryCard({ decoder });

const inputGrid = document.createElement('div');
inputGrid.className = 'input-grid';

const manualCard = createManualInputCard(decoder);
const micCard = createMicrophoneCard(decoder);
const asciiCard = createAsciiCard(decoder);

inputGrid.append(manualCard.card, micCard.card, asciiCard.card);

const encoder = createEncoderSection();

app.append(telemetry.card, inputGrid, encoder.section);
body.appendChild(app);

function handleDecoderUpdate(payload) {
  telemetry.update(payload);
}

function createTelemetryCard({ decoder }) {
  const card = document.createElement('section');
  card.className = 'morse-card telemetry-card';

  card.innerHTML = `
    <header class="card-header">
      <div>
        <p class="eyebrow">Live monitor</p>
        <h2>Signal + decoded message</h2>
      </div>
      <div class="header-actions">
        <button type="button" class="ghost-button" data-role="reset">Clear</button>
      </div>
    </header>
    <div class="telemetry-grid">
      <article>
        <p class="mini-label">Transmission status</p>
        <p class="status-value" data-field="state">Idle</p>
      </article>
      <article>
        <p class="mini-label">Last input source</p>
        <p class="status-value" data-field="source">—</p>
      </article>
      <article>
        <p class="mini-label">Dit length</p>
        <div class="dit-control">
          <input type="range" min="80" max="260" value="${DEFAULT_UNIT}" step="10" />
          <span data-field="dit-readout">${DEFAULT_UNIT} ms</span>
        </div>
      </article>
    </div>
    <div class="live-readout">
      <p class="mini-label">Dots & dashes</p>
      <p class="morse-text" data-field="morse">Waiting…</p>
      <p class="mini-label">Current character</p>
      <p class="symbol-text" data-field="symbol">—</p>
    </div>
    <div class="decoded-output">
      <p class="mini-label">Decoded message</p>
      <p data-field="decoded">Start tapping to build a message.</p>
    </div>
  `;

  const resetButton = card.querySelector('[data-role="reset"]');
  resetButton.addEventListener('click', () => decoder.reset());

  const rangeInput = card.querySelector('input[type="range"]');
  const ditLabel = card.querySelector('[data-field="dit-readout"]');
  rangeInput.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    ditLabel.textContent = `${value} ms`;
    decoder.setUnit(value);
  });

  return {
    card,
    update({ liveMorse, decodedText, currentSymbol, isTransmitting, unit, lastSource }) {
      const morseField = card.querySelector('[data-field="morse"]');
      const decodedField = card.querySelector('[data-field="decoded"]');
      const stateField = card.querySelector('[data-field="state"]');
      const symbolField = card.querySelector('[data-field="symbol"]');
      const sourceField = card.querySelector('[data-field="source"]');

      morseField.textContent = liveMorse || 'Waiting…';
      decodedField.textContent = decodedText || '—';
      symbolField.textContent = currentSymbol || '—';
      stateField.textContent = isTransmitting ? 'Transmitting' : 'Listening';
      sourceField.textContent = lastSource || '—';
      if (unit !== Number(rangeInput.value)) {
        rangeInput.value = unit;
        ditLabel.textContent = `${unit} ms`;
      }
      card.dataset.state = isTransmitting ? 'active' : 'idle';
    }
  };
}

function createManualInputCard(decoder) {
  const card = document.createElement('section');
  card.className = 'morse-card control-card';
  card.innerHTML = `
    <header class="card-header">
      <div>
        <p class="eyebrow">Key input</p>
        <h2>Hold to transmit</h2>
      </div>
    </header>
    <p class="card-description">
      Use the button (or hold the space bar) to tap dots and dashes. Release to finish each pulse.
    </p>
  `;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'transmit-button';
  button.textContent = 'Hold to send';

  const hint = document.createElement('p');
  hint.className = 'micro-hint';
  hint.textContent = 'Keyboard shortcut: press and hold Space or Enter.';

  card.append(button, hint);

  let activeCount = 0;
  const pressedKeys = new Set();

  function engage(source = 'key') {
    if (activeCount === 0) {
      decoder.signalStart(source);
      card.dataset.active = 'true';
    }
    activeCount += 1;
  }

  function release(source = 'key') {
    if (activeCount === 0) {
      return;
    }
    activeCount = Math.max(0, activeCount - 1);
    if (activeCount === 0) {
      decoder.signalEnd(source);
      card.dataset.active = 'false';
    }
  }

  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    engage('button');
  });

  button.addEventListener('pointerup', (event) => {
    event.preventDefault();
    if (button.hasPointerCapture && button.hasPointerCapture(event.pointerId)) {
      button.releasePointerCapture(event.pointerId);
    }
    release('button');
  });

  ['pointercancel', 'pointerleave'].forEach((type) => {
    button.addEventListener(type, (event) => {
      if (event.pointerId != null && button.hasPointerCapture && button.hasPointerCapture(event.pointerId)) {
        button.releasePointerCapture(event.pointerId);
      }
      release('button');
    });
  });

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      pressedKeys.add(event.code);
      engage('keyboard');
    }
  });

  window.addEventListener('keyup', (event) => {
    if (pressedKeys.has(event.code)) {
      pressedKeys.delete(event.code);
      release('keyboard');
    }
  });

  return { card };
}

function createMicrophoneCard(decoder) {
  const card = document.createElement('section');
  card.className = 'morse-card control-card mic-card';
  card.innerHTML = `
    <header class="card-header">
      <div>
        <p class="eyebrow">Microphone</p>
        <h2>Listen for real taps</h2>
      </div>
    </header>
    <p class="card-description">
      Let your mic hear real beeps or taps. Set a threshold so background noise stays ignored.
    </p>
    <div class="mic-actions">
      <button type="button" class="ghost-button" data-role="mic-start">Start listening</button>
      <button type="button" class="ghost-button" data-role="mic-stop" disabled>Stop</button>
    </div>
    <div class="mic-meter" aria-live="polite">
      <span class="mini-label">Input level</span>
      <div class="level-bar" data-role="level-bar">
        <span></span>
      </div>
      <span class="level-value" data-role="level-value">0%</span>
    </div>
    <label class="threshold-field">
      <span>Activation threshold</span>
      <input type="range" min="5" max="60" value="18" step="1" />
      <span class="threshold-readout" data-role="threshold-readout">18%</span>
    </label>
    <p class="micro-hint" data-role="mic-status">Idle — click start to request permission.</p>
  `;

  const startBtn = card.querySelector('[data-role="mic-start"]');
  const stopBtn = card.querySelector('[data-role="mic-stop"]');
  const levelBar = card.querySelector('[data-role="level-bar"] span');
  const levelValue = card.querySelector('[data-role="level-value"]');
  const status = card.querySelector('[data-role="mic-status"]');
  const thresholdSlider = card.querySelector('input[type="range"]');
  const thresholdReadout = card.querySelector('[data-role="threshold-readout"]');

  let controller = null;

  function ensureController() {
    if (controller) return controller;
    controller = createMicController({
      decoder,
      getThreshold: () => Number(thresholdSlider.value) / 100,
      onLevel: (value) => {
        const percent = Math.min(100, Math.round(value * 100));
        levelValue.textContent = `${percent}%`;
        levelBar.style.setProperty('--level', `${percent}%`);
      },
      onStateChange: (state) => {
        card.dataset.hearing = state ? 'tone' : 'silence';
      }
    });
    return controller;
  }

  startBtn.addEventListener('click', async () => {
    const instance = ensureController();
    startBtn.disabled = true;
    status.textContent = 'Requesting microphone…';
    try {
      await instance.start();
      status.textContent = 'Listening. Tap or whistle short vs long pulses.';
      stopBtn.disabled = false;
    } catch (error) {
      console.error(error);
      status.textContent = 'Microphone error. Check permissions and try again.';
      startBtn.disabled = false;
      controller?.stop();
      controller = null;
    }
  });

  stopBtn.addEventListener('click', () => {
    if (!controller) return;
    controller.stop();
    controller = null;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    status.textContent = 'Stopped listening.';
    card.dataset.hearing = 'silence';
    levelValue.textContent = '0%';
    levelBar.style.setProperty('--level', '0%');
  });

  thresholdSlider.addEventListener('input', (event) => {
    const percent = Number(event.target.value);
    thresholdReadout.textContent = `${percent}%`;
  });

  return { card };
}

function createAsciiCard(decoder) {
  const card = document.createElement('section');
  card.className = 'morse-card control-card ascii-card';
  card.innerHTML = `
    <header class="card-header">
      <div>
        <p class="eyebrow">ASCII input</p>
        <h2>Paste dots & dashes</h2>
      </div>
    </header>
    <p class="card-description">
      Type or paste text like <code>.... . .-.. .-.. ---</code>. Use <code>/</code> between words.
    </p>
  `;

  const textarea = document.createElement('textarea');
  textarea.rows = 4;
  textarea.placeholder = '..-. --- --- / -... .- .-.'; // example

  const previewLabel = document.createElement('p');
  previewLabel.className = 'mini-label';
  previewLabel.textContent = 'Preview decode';

  const previewValue = document.createElement('p');
  previewValue.className = 'preview-text';
  previewValue.textContent = '—';

  const normalizedHint = document.createElement('p');
  normalizedHint.className = 'micro-hint';
  normalizedHint.textContent = 'Normalized pulses: —';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ghost-button';
  button.textContent = 'Send to live decoder';

  card.append(textarea, previewLabel, previewValue, normalizedHint, button);

  function updatePreview() {
    const tokens = parseMorseTokens(textarea.value);
    const normalized = tokens.join(' ');
    normalizedHint.textContent = tokens.length ? `Normalized pulses: ${normalized}` : 'Normalized pulses: —';
    const decoded = decodeMorseTokens(tokens);
    previewValue.textContent = decoded || '—';
  }

  textarea.addEventListener('input', updatePreview);
  updatePreview();

  button.addEventListener('click', () => {
    const injected = decoder.injectSequence(textarea.value, 'ascii');
    if (injected) {
      textarea.value = '';
      updatePreview();
      button.textContent = 'Sent!';
      setTimeout(() => {
        button.textContent = 'Send to live decoder';
      }, 1200);
    } else {
      button.textContent = 'Nothing to send';
      setTimeout(() => {
        button.textContent = 'Send to live decoder';
      }, 1200);
    }
  });

  return { card };
}

function createEncoderSection() {
  const section = document.createElement('section');
  section.className = 'morse-card encoder-card';

  section.innerHTML = `
    <header class="card-header">
      <div>
        <p class="eyebrow">Encoder</p>
        <h2>Text → Morse + tone</h2>
      </div>
    </header>
    <p class="card-description">
      Type a message to see its dots and dashes. Generate matching audio beeps for playback drills.
    </p>
  `;

  const textarea = document.createElement('textarea');
  textarea.rows = 4;
  textarea.placeholder = 'sos crew ready in five minutes';

  const stats = document.createElement('div');
  stats.className = 'encoder-stats';
  stats.innerHTML = `
    <span data-role="char-count">0 chars</span>
    <label>
      <span>Dit length</span>
      <input type="range" min="80" max="240" value="${DEFAULT_UNIT}" step="10" />
      <strong data-role="tempo">${DEFAULT_UNIT} ms</strong>
    </label>
  `;

  const outputLabel = document.createElement('p');
  outputLabel.className = 'mini-label';
  outputLabel.textContent = 'Dots & dashes';

  const morseOutput = document.createElement('pre');
  morseOutput.className = 'morse-output';
  morseOutput.textContent = '—';

  const actionRow = document.createElement('div');
  actionRow.className = 'encoder-actions';

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'ghost-button';
  copyButton.textContent = 'Copy code';

  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.className = 'ghost-button';
  playButton.textContent = 'Play tone';

  actionRow.append(copyButton, playButton);

  section.append(textarea, stats, outputLabel, morseOutput, actionRow);

  const charCount = stats.querySelector('[data-role="char-count"]');
  const tempoLabel = stats.querySelector('[data-role="tempo"]');
  const tempoSlider = stats.querySelector('input[type="range"]');

  const tonePlayer = createTonePlayer();

  function updateOutput() {
    const text = textarea.value;
    const encoded = encodeToMorse(text);
    morseOutput.textContent = encoded || '—';
    charCount.textContent = `${text.length} ${text.length === 1 ? 'char' : 'chars'}`;
  }

  textarea.addEventListener('input', updateOutput);
  tempoSlider.addEventListener('input', (event) => {
    const ms = Number(event.target.value);
    tempoLabel.textContent = `${ms} ms`;
  });

  copyButton.addEventListener('click', async () => {
    const value = morseOutput.textContent;
    if (!value || value === '—') return;
    try {
      await navigator.clipboard.writeText(value);
      copyButton.textContent = 'Copied!';
      setTimeout(() => {
        copyButton.textContent = 'Copy code';
      }, 1200);
    } catch (error) {
      console.error(error);
      copyButton.textContent = 'Copy failed';
      setTimeout(() => {
        copyButton.textContent = 'Copy code';
      }, 1400);
    }
  });

  playButton.addEventListener('click', async () => {
    const value = morseOutput.textContent;
    if (!value || value === '—') {
      playButton.textContent = 'Nothing to play';
      setTimeout(() => {
        playButton.textContent = 'Play tone';
      }, 1200);
      return;
    }
    if (tonePlayer.isPlaying()) {
      tonePlayer.stop();
      playButton.textContent = 'Play tone';
      return;
    }
    playButton.textContent = 'Playing…';
    await tonePlayer.play(value, Number(tempoSlider.value));
    playButton.textContent = 'Play tone';
  });

  updateOutput();

  return { section };
}

function createMicController({ decoder, getThreshold, onLevel, onStateChange }) {
  let audioContext;
  let analyser;
  let mediaStream;
  let dataArray;
  let rafId;
  let isRunning = false;
  let isActive = false;
  let startTime = 0;
  let aboveCount = 0;
  let belowCount = 0;

  async function start() {
    if (isRunning) return;
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(mediaStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    dataArray = new Uint8Array(analyser.fftSize);
    source.connect(analyser);
    isRunning = true;
    aboveCount = 0;
    belowCount = 0;
    tick();
  }

  function stop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (isActive) {
      isActive = false;
      decoder.signalEnd('mic');
      onStateChange(false);
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    analyser = null;
    dataArray = null;
    mediaStream = null;
    aboveCount = 0;
    belowCount = 0;
    isRunning = false;
  }

  function tick() {
    if (!isRunning) return;
    analyser.getByteTimeDomainData(dataArray);
    const level = computeVolume(dataArray);
    onLevel(level);

    const threshold = getThreshold();
    if (level >= threshold) {
      aboveCount += 1;
      belowCount = 0;
      if (!isActive && aboveCount >= 2) {
        isActive = true;
        startTime = performance.now();
        decoder.signalStart('mic');
        onStateChange(true);
      }
    } else {
      belowCount += 1;
      aboveCount = 0;
      if (isActive && belowCount >= 3) {
        isActive = false;
        const duration = performance.now() - startTime;
        decoder.signalEnd('mic', duration);
        onStateChange(false);
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  return { start, stop };
}

function createLiveDecoder({ unit, onUpdate }) {
  const reverse = buildReverseMap();

  const state = {
    unit,
    history: [],
    decoded: '',
    currentSymbol: '',
    signalActive: false,
    signalStart: null,
    letterTimeout: null,
    wordTimeout: null,
    lastSource: '—'
  };

  function signalStart(source = 'manual') {
    if (state.signalActive) return;
    state.signalActive = true;
    state.signalStart = performance.now();
    state.lastSource = source;
    clearPendingTimers();
    emit();
  }

  function signalEnd(source = 'manual', durationOverride) {
    if (!state.signalActive && durationOverride == null) {
      return;
    }
    const now = performance.now();
    const duration = durationOverride ?? (state.signalStart ? now - state.signalStart : state.unit);
    state.signalActive = false;
    state.signalStart = null;
    const symbol = classifyDuration(duration, state.unit);
    if (symbol) {
      state.currentSymbol += symbol;
    }
    scheduleGaps();
    emit();
  }

  function classifyDuration(duration, unitMs) {
    if (!duration || Number.isNaN(duration)) return null;
    const dotThreshold = unitMs * 1.6;
    return duration <= dotThreshold ? '.' : '-';
  }

  function finalizeLetter(symbolOverride) {
    const symbol = symbolOverride ?? state.currentSymbol;
    const normalized = normalizeSymbol(symbol);
    if (!normalized) {
      state.currentSymbol = '';
      return;
    }
    const char = reverse[normalized] ?? '?';
    appendHistory(normalized);
    pushDecodedChar(char);
    if (!symbolOverride) {
      state.currentSymbol = '';
    }
  }

  function finalizeWord() {
    finalizeLetter();
    appendHistory('/');
    pushDecodedChar(' ');
  }

  function appendHistory(token) {
    if (!token) return;
    state.history.push(token);
    if (state.history.length > MAX_HISTORY_TOKENS) {
      state.history = state.history.slice(-MAX_HISTORY_TOKENS);
    }
  }

  function pushDecodedChar(char) {
    if (char === ' ') {
      if (!state.decoded.endsWith(' ')) {
        state.decoded += ' ';
      }
    } else {
      state.decoded += char;
    }
    if (state.decoded.length > MAX_DECODED_LENGTH) {
      state.decoded = state.decoded.slice(-MAX_DECODED_LENGTH);
    }
  }

  function scheduleGaps() {
    clearPendingTimers();
    state.letterTimeout = setTimeout(() => {
      finalizeLetter();
      emit();
    }, state.unit * 3);
    state.wordTimeout = setTimeout(() => {
      finalizeWord();
      emit();
    }, state.unit * 7);
  }

  function clearPendingTimers() {
    if (state.letterTimeout) {
      clearTimeout(state.letterTimeout);
      state.letterTimeout = null;
    }
    if (state.wordTimeout) {
      clearTimeout(state.wordTimeout);
      state.wordTimeout = null;
    }
  }

  function getLiveMorse() {
    const base = state.history.join(' ');
    if (state.currentSymbol) {
      return `${base ? `${base} ` : ''}${state.currentSymbol}`.trim();
    }
    return base.trim();
  }

  function setUnit(nextUnit) {
    state.unit = nextUnit;
    if (!state.signalActive && state.currentSymbol) {
      scheduleGaps();
    }
    emit();
  }

  function reset() {
    clearPendingTimers();
    state.history = [];
    state.decoded = '';
    state.currentSymbol = '';
    state.signalActive = false;
    emit();
  }

  function emit() {
    onUpdate({
      liveMorse: getLiveMorse(),
      decodedText: state.decoded.trimStart(),
      currentSymbol: state.currentSymbol,
      isTransmitting: state.signalActive,
      unit: state.unit,
      lastSource: state.lastSource
    });
  }

  function injectSequence(input, source = 'ascii') {
    const tokens = parseMorseTokens(input);
    if (!tokens.length) {
      return false;
    }
    tokens.forEach((token) => {
      if (token === '/') {
        finalizeWord();
      } else {
        finalizeLetter(token);
      }
    });
    state.lastSource = source;
    emit();
    return true;
  }

  emit();

  return {
    signalStart,
    signalEnd,
    setUnit,
    reset,
    injectSequence
  };
}

function computeVolume(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const value = (buffer[i] - 128) / 128;
    sum += value * value;
  }
  return Math.sqrt(sum / buffer.length);
}

function parseMorseTokens(input) {
  if (!input) return [];
  return input
    .trim()
    .split(/\s+/)
    .map((chunk) => {
      if (chunk === '/' || chunk === '|') {
        return '/';
      }
      return normalizeSymbol(chunk);
    })
    .filter((token) => token === '/' || token.length);
}

function decodeMorseTokens(tokens) {
  if (!tokens.length) return '';
  const reverse = buildReverseMap();
  return tokens
    .map((token) => {
      if (token === '/') {
        return ' ';
      }
      return reverse[token] ?? '?';
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSymbol(chunk) {
  if (!chunk) return '';
  return chunk
    .replace(/[·•]/g, '.')
    .replace(/[\u2010-\u2015\u2212_]/g, '-')
    .replace(/[^.\-]/g, '');
}

function encodeToMorse(text) {
  if (!text) return '';
  const normalized = text.toUpperCase();
  const parts = [];
  for (const char of normalized) {
    if (char === ' ') {
      parts.push('/');
      continue;
    }
    const code = MORSE_TABLE[char];
    if (code) {
      parts.push(code);
    }
  }
  return parts.join(' ');
}

function buildReverseMap() {
  const reverse = {};
  Object.entries(MORSE_TABLE).forEach(([char, code]) => {
    reverse[code] = char;
  });
  return reverse;
}

function createTonePlayer() {
  let audioContext;
  let gain;
  let oscillator;
  let playing = false;
  let controller = null;

  async function play(sequence, unitMs) {
    if (!sequence.trim()) return;
    if (playing) {
      stop();
      return;
    }
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    oscillator = audioContext.createOscillator();
    gain = audioContext.createGain();
    gain.gain.value = 0;
    oscillator.type = 'sine';
    oscillator.frequency.value = 620;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();

    playing = true;
    controller = { stop: false, timeout: null, waitResolver: null };

    const pulses = buildPulsePlan(sequence);
    try {
      for (const pulse of pulses) {
        if (controller.stop) break;
        if (pulse.type === 'tone') {
          toneOn();
        } else {
          toneOff();
        }
        await wait(pulse.units * unitMs);
        if (controller.stop) break;
      }
    } finally {
      toneOff();
      if (oscillator) {
        oscillator.stop();
        oscillator.disconnect();
        oscillator = null;
      }
      if (gain) {
        gain.disconnect();
        gain = null;
      }
      playing = false;
      controller = null;
    }
  }

  function toneOn() {
    if (!gain || !audioContext) return;
    gain.gain.cancelScheduledValues(audioContext.currentTime);
    gain.gain.setTargetAtTime(0.35, audioContext.currentTime, 0.01);
  }

  function toneOff() {
    if (!gain || !audioContext) return;
    gain.gain.cancelScheduledValues(audioContext.currentTime);
    gain.gain.setTargetAtTime(0, audioContext.currentTime, 0.01);
  }

  function wait(duration) {
    if (!duration || duration <= 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      if (!controller) {
        resolve();
        return;
      }
      controller.waitResolver = resolve;
      controller.timeout = setTimeout(() => {
        if (controller) {
          controller.timeout = null;
          controller.waitResolver = null;
        }
        resolve();
      }, duration);
    });
  }

  function stop() {
    if (!playing || !controller) return;
    controller.stop = true;
    if (controller.timeout) {
      clearTimeout(controller.timeout);
      controller.timeout = null;
    }
    if (controller.waitResolver) {
      controller.waitResolver();
      controller.waitResolver = null;
    }
    toneOff();
  }

  function isPlaying() {
    return playing;
  }

  return { play, stop, isPlaying };
}

function buildPulsePlan(sequence) {
  const tokens = sequence
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const plan = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === '/') {
      plan.push({ type: 'gap', units: 7 });
      continue;
    }
    const chars = token.split('');
    chars.forEach((symbol, index) => {
      plan.push({ type: 'tone', units: symbol === '-' ? 3 : 1 });
      if (index < chars.length - 1) {
        plan.push({ type: 'gap', units: 1 });
      }
    });
    const next = tokens[i + 1];
    if (next && next !== '/') {
      plan.push({ type: 'gap', units: 3 });
    }
  }
  return plan;
}

const MORSE_TABLE = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  '0': '-----',
  '1': '.----',
  '2': '..---',
  '3': '...--',
  '4': '....-',
  '5': '.....',
  '6': '-....',
  '7': '--...',
  '8': '---..',
  '9': '----.',
  '.': '.-.-.-',
  ',': '--..--',
  '?': '..--..',
  '!': '-.-.--',
  "'": '.----.',
  '"': '.-..-.',
  '&': '.-...',
  ':': '---...',
  ';': '-.-.-.',
  '/': '-..-.',
  '+': '.-.-.',
  '-': '-....-',
  '=': '-...-',
  '_': '..--.-',
  '$': '...-..-',
  '@': '.--.-.'
};
