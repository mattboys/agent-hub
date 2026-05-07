import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const ACCENT = '#e8a838';

const LANES = [
  { id: 'kick', label: 'Kick' },
  { id: 'snare', label: 'Snare' },
  { id: 'hat', label: 'Hi-hat' },
  { id: 'cowbell', label: 'Cowbell' },
  { id: 'fmHit', label: 'FM hit' },
  { id: 'zap', label: 'Laser zap' }
];

/** Playback gain per lane id (post-buffer). */
const LANE_GAIN = {
  kick: 0.52,
  snare: 0.52,
  hat: 0.32,
  cowbell: 0.4,
  fmHit: 0.38,
  zap: 0.34
};

const MIN_BEATS = 2;
const MAX_BEATS = 24;
const SCHEDULE_AHEAD_SEC = 0.22;
const DEFAULT_BAR_SEC = 2;
const TRACK_HUES = [38, 198, 286, 142, 12, 310];

const { body } = createAppShell({
  title: 'Polyrhythm Drum Sequencer',
  description:
    'Stack drum loops that share one bar in real time but slice it into different beat counts—so a 5-step row and a 7-step row only meet again on the downbeat.',
  accent: ACCENT
});

const root = document.createElement('div');
root.className = 'poly-seq';
body.appendChild(root);

/** @type {AudioContext | null} */
let audioCtx = null;
/** @type {GainNode | null} */
let masterGain = null;
/** @type {Record<string, AudioBuffer> | null} */
let buffers = null;

const state = {
  playing: false,
  /** Wall-clock bar length shared by every track (seconds). */
  barSec: DEFAULT_BAR_SEC,
  masterVolume: 0.72,
  /** @type {{ id: string, beats: number, pattern: boolean[][] }[]} */
  tracks: [
    {
      id: idTrack(),
      beats: 5,
      pattern: makeEmptyPattern(5, LANES.length)
    },
    {
      id: idTrack(),
      beats: 7,
      pattern: makeEmptyPattern(7, LANES.length)
    }
  ],
  /** AudioContext time of start of current transport (after play). */
  startTime: 0,
  /** Per-track scheduler state (only valid while playing). */
  sched: /** @type {{ nextTime: number, step: number }[] | null} */ (null),
  raf: 0
};

seedDemoPattern(state.tracks[0], 'five');
seedDemoPattern(state.tracks[1], 'seven');

const toolbar = document.createElement('div');
toolbar.className = 'toolbar';

const barGroup = document.createElement('div');
barGroup.className = 'toolbar-group';
barGroup.innerHTML = '<label for="bar-sec">Bar length (seconds)</label>';
const barSecInput = document.createElement('input');
barSecInput.id = 'bar-sec';
barSecInput.className = 'bar-field';
barSecInput.type = 'number';
barSecInput.min = '0.35';
barSecInput.max = '12';
barSecInput.step = '0.05';
barSecInput.value = String(DEFAULT_BAR_SEC);
barGroup.appendChild(barSecInput);

const volGroup = document.createElement('div');
volGroup.className = 'toolbar-group';
volGroup.innerHTML = '<label for="master-vol">Master level</label>';
const volRow = document.createElement('div');
volRow.className = 'volume-row';
const volRange = document.createElement('input');
volRange.id = 'master-vol';
volRange.type = 'range';
volRange.min = '0';
volRange.max = '1';
volRange.step = '0.02';
volRange.value = String(state.masterVolume);
const volReadout = document.createElement('span');
volReadout.className = 'hint';
volReadout.style.margin = '0';
volReadout.textContent = `${Math.round(state.masterVolume * 100)}%`;
volRow.append(volRange, volReadout);
volGroup.appendChild(volRow);

const actions = document.createElement('div');
actions.className = 'toolbar-actions';
const playBtn = document.createElement('button');
playBtn.type = 'button';
playBtn.className = 'primary-button';
playBtn.textContent = 'Play';
const stopBtn = document.createElement('button');
stopBtn.type = 'button';
stopBtn.className = 'ghost-button';
stopBtn.textContent = 'Stop';
stopBtn.disabled = true;
const addTrackBtn = document.createElement('button');
addTrackBtn.type = 'button';
addTrackBtn.className = 'ghost-button';
addTrackBtn.textContent = 'Add track';
actions.append(playBtn, stopBtn, addTrackBtn);

toolbar.append(barGroup, volGroup, actions);

const hint = document.createElement('p');
hint.className = 'hint';
hint.textContent =
  'Every track loops through the same bar duration. Change beats-per-bar to split that bar into different slices—paint acoustic-style drums plus cowbell and two electronic hits, all meeting again on each downbeat.';

const syncReadout = document.createElement('div');
syncReadout.className = 'sync-readout';

const trackListEl = document.createElement('div');
trackListEl.className = 'track-list';

const libraries = document.createElement('details');
libraries.className = 'libraries';
libraries.innerHTML = `
  <summary>Free sound libraries (replace or layer samples)</summary>
  <ul>
    <li>
      <a href="https://freesound.org/browse/tags/?f=tag:%22CC0%22+tag:%22one+shot%22" rel="noopener noreferrer">Freesound · CC0 one-shots</a>
      — filter for CC0 kicks, snares, and hats you can bundle or hot-swap.
    </li>
    <li>
      <a href="https://freesound.org/people/deadrobotmusic/packs/32907/" rel="noopener noreferrer">Dead Robot Music · Drum One Shots (kicks)</a>
      — CC0 pack on Freesound; companion snare and hat packs from the same author use the same license.
    </li>
    <li>
      <a href="https://99sounds.org/drum-samples/" rel="noopener noreferrer">99Sounds · Drum Samples</a>
      — royalty-free acoustic and electronic hits (check each pack’s license note before redistribution).
    </li>
    <li>
      <a href="https://freepd.com/" rel="noopener noreferrer">FreePD</a>
      — public-domain music beds; handy if you later pair stems with this sequencer.
    </li>
  </ul>
  <p class="hint" style="margin-top: 10px">
    This page plays compact synthesized drums generated in your browser so nothing leaves the network. Use the links above if you want to drop in WAV one-shots of your own.
  </p>
`;

root.append(toolbar, hint, syncReadout, trackListEl, libraries);

function applyBarSecFromInput() {
  const v = clamp(Number(barSecInput.value), 0.35, 12);
  state.barSec = v;
  barSecInput.value = String(roundTo(v, 3));
  updateSyncReadout();
  renderTracks();
  if (state.playing) restartTransport();
}

barSecInput.addEventListener('change', applyBarSecFromInput);

volRange.addEventListener('input', () => {
  state.masterVolume = Number(volRange.value);
  volReadout.textContent = `${Math.round(state.masterVolume * 100)}%`;
  if (masterGain) masterGain.gain.value = state.masterVolume;
});

playBtn.addEventListener('click', async () => {
  await ensureAudio();
  if (state.playing) return;
  state.playing = true;
  playBtn.disabled = true;
  stopBtn.disabled = false;
  startTransport();
  loopUi();
});

stopBtn.addEventListener('click', () => {
  if (!state.playing) return;
  state.playing = false;
  playBtn.disabled = false;
  stopBtn.disabled = true;
  stopTransport();
  cancelAnimationFrame(state.raf);
  renderTracks();
});

addTrackBtn.addEventListener('click', () => {
  const beats = 4;
  state.tracks.push({
    id: idTrack(),
    beats,
    pattern: makeEmptyPattern(beats, LANES.length)
  });
  renderTracks();
  updateSyncReadout();
  if (state.playing) restartTransport();
});

function idTrack() {
  return `t-${Math.random().toString(36).slice(2, 9)}`;
}

function makeEmptyPattern(beats, lanes) {
  return Array.from({ length: lanes }, () => Array.from({ length: beats }, () => false));
}

function seedDemoPattern(track, preset) {
  const { pattern, beats } = track;
  const ix = Object.fromEntries(LANES.map((l, i) => [l.id, i]));
  if (preset === 'five' && beats === 5) {
    pattern[ix.kick][0] = pattern[ix.kick][2] = pattern[ix.kick][4] = true;
    pattern[ix.hat][0] = pattern[ix.hat][1] = pattern[ix.hat][2] = pattern[ix.hat][3] = pattern[ix.hat][4] = true;
    pattern[ix.snare][3] = true;
    pattern[ix.cowbell][1] = pattern[ix.cowbell][4] = true;
    pattern[ix.fmHit][2] = true;
  }
  if (preset === 'seven' && beats === 7) {
    pattern[ix.kick][0] = pattern[ix.kick][4] = true;
    pattern[ix.hat][0] = pattern[ix.hat][2] = pattern[ix.hat][4] = pattern[ix.hat][6] = true;
    pattern[ix.snare][2] = pattern[ix.snare][5] = true;
    pattern[ix.zap][1] = pattern[ix.zap][3] = pattern[ix.zap][5] = true;
    pattern[ix.fmHit][4] = true;
  }
}

function lcm(a, b) {
  return (a / gcd(a, b)) * b;
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function lcmMany(nums) {
  return nums.reduce((acc, n) => lcm(acc, n), 1);
}

function updateSyncReadout() {
  const beats = state.tracks.map((t) => t.beats);
  const L = lcmMany(beats);
  const barSec = state.barSec;
  const micro = barSec / L;
  syncReadout.innerHTML = `
    <strong>Shared bar:</strong> ${barSec.toFixed(2)}s (~${(60 / barSec).toFixed(2)} bar cycles per minute).
    <br />
    <strong>Poly grid:</strong> least common multiple of beat counts is <strong>${L}</strong> micro-steps per bar
    (each ${(micro * 1000).toFixed(1)}ms)—tracks only share a downbeat at the start of every bar.
  `;
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function roundTo(n, d) {
  const p = 10 ** d;
  return Math.round(n * p) / p;
}

async function ensureAudio() {
  if (audioCtx) {
    if (!buffers || LANES.some((l) => !buffers[l.id])) {
      buffers = buildDrumBuffers(audioCtx);
    }
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  audioCtx = new Ctx();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = state.masterVolume;
  masterGain.connect(audioCtx.destination);
  buffers = buildDrumBuffers(audioCtx);
}

function buildDrumBuffers(ctx) {
  const sr = ctx.sampleRate;
  return {
    kick: renderKick(ctx, sr),
    snare: renderSnare(ctx, sr),
    hat: renderHat(ctx, sr),
    cowbell: renderCowbell(ctx, sr),
    fmHit: renderFmHit(ctx, sr),
    zap: renderZap(ctx, sr)
  };
}

function renderKick(ctx, sampleRate) {
  const dur = 0.38;
  const frames = Math.floor(dur * sampleRate);
  const buf = ctx.createBuffer(1, frames, sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    const pitch = 58 + 95 * Math.exp(-t * 26);
    const env = Math.exp(-t * 11);
    const tone = Math.sin(2 * Math.PI * pitch * t);
    ch[i] = tone * env * 0.98;
  }
  return buf;
}

function renderSnare(ctx, sampleRate) {
  const dur = 0.22;
  const frames = Math.floor(dur * sampleRate);
  const buf = ctx.createBuffer(1, frames, sampleRate);
  const ch = buf.getChannelData(0);
  let seed = 0x9e3779b9;
  const rnd = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 2 ** 32 - 0.5;
  };
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    const noise = rnd();
    const body = Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 35);
    const snap = Math.sin(2 * Math.PI * 420 * t) * Math.exp(-t * 70);
    const env = Math.exp(-t * 18);
    ch[i] = (noise * 0.55 + body * 0.35 + snap * 0.25) * env * 1.15;
  }
  return buf;
}

function renderHat(ctx, sampleRate) {
  const dur = 0.08;
  const frames = Math.floor(dur * sampleRate);
  const buf = ctx.createBuffer(1, frames, sampleRate);
  const ch = buf.getChannelData(0);
  let seed = 0x6eed8c89;
  const rnd = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 2 ** 32 - 0.5;
  };
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    const hp = rnd() - rnd();
    const env = Math.exp(-t * 90);
    ch[i] = hp * env * 0.45;
  }
  return buf;
}

/** Metallic cowbell: two inharmonic partials, quick decay. */
function renderCowbell(ctx, sampleRate) {
  const dur = 0.14;
  const frames = Math.floor(dur * sampleRate);
  const buf = ctx.createBuffer(1, frames, sampleRate);
  const ch = buf.getChannelData(0);
  const f1 = 562;
  const f2 = 845;
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 28);
    const a = Math.sin(2 * Math.PI * f1 * t);
    const b = Math.sin(2 * Math.PI * f2 * t);
    const click = Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t * 120) * 0.12;
    ch[i] = (a * 0.55 + b * 0.45 + click) * env * 0.9;
  }
  return buf;
}

/** Short FM “plastic” percussion (carrier + decaying mod index). */
function renderFmHit(ctx, sampleRate) {
  const dur = 0.12;
  const frames = Math.floor(dur * sampleRate);
  const buf = ctx.createBuffer(1, frames, sampleRate);
  const ch = buf.getChannelData(0);
  const fc = 220;
  const ratio = 3.4;
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 22);
    const modI = 6 * Math.exp(-t * 45);
    const mod = Math.sin(2 * Math.PI * fc * ratio * t) * modI;
    const car = Math.sin(2 * Math.PI * fc * t + mod);
    ch[i] = car * env * 0.75;
  }
  return buf;
}

/** Descending chirp + noise burst—electronic laser zap. */
function renderZap(ctx, sampleRate) {
  const dur = 0.09;
  const frames = Math.floor(dur * sampleRate);
  const buf = ctx.createBuffer(1, frames, sampleRate);
  const ch = buf.getChannelData(0);
  let seed = 0xdeadbeef;
  const rnd = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 2 ** 32 - 0.5;
  };
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    const p = t / dur;
    const f0 = 3200;
    const f1 = 380;
    const freq = f0 * (f1 / f0) ** p;
    const env = Math.exp(-t * 42);
    const tone = Math.sin(2 * Math.PI * freq * t);
    const noise = rnd() * 0.35;
    ch[i] = (tone * 0.65 + noise) * env * 0.85;
  }
  return buf;
}

function playLane(laneIndex, when) {
  if (!audioCtx || !masterGain || !buffers) return;
  const id = LANES[laneIndex].id;
  const buf = buffers[id];
  if (!buf) return;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const laneGain = audioCtx.createGain();
  laneGain.gain.value = LANE_GAIN[id] ?? 0.45;
  src.connect(laneGain);
  laneGain.connect(masterGain);
  src.start(when);
}

function startTransport() {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + 0.06;
  state.startTime = t0;
  state.sched = state.tracks.map(() => ({ nextTime: t0, step: 0 }));
  scheduleSlice();
}

function stopTransport() {
  state.sched = null;
}

function restartTransport() {
  if (!state.playing || !audioCtx) return;
  startTransport();
}

function scheduleSlice() {
  if (!state.playing || !audioCtx || !state.sched) return;
  const until = audioCtx.currentTime + SCHEDULE_AHEAD_SEC;
  const { sched, tracks, barSec } = state;

  while (true) {
    let bestTi = -1;
    let bestT = Infinity;
    for (let ti = 0; ti < tracks.length; ti++) {
      const s = sched[ti];
      if (s.nextTime < bestT) {
        bestT = s.nextTime;
        bestTi = ti;
      }
    }
    if (bestTi < 0 || bestT >= until) break;

    const tr = tracks[bestTi];
    const s = sched[bestTi];
    const step = s.step;
    const pattern = tr.pattern;

    for (let lane = 0; lane < LANES.length; lane++) {
      if (pattern[lane][step]) {
        playLane(lane, s.nextTime);
      }
    }

    s.step = (step + 1) % tr.beats;
    s.nextTime += barSec / tr.beats;
  }
}

function loopUi() {
  if (!state.playing) return;
  scheduleSlice();
  renderTracksPlayheads();
  state.raf = requestAnimationFrame(loopUi);
}

function currentBarPhase() {
  if (!audioCtx || !state.playing) return 0;
  const elapsed = Math.max(0, audioCtx.currentTime - state.startTime);
  const cyc = elapsed % state.barSec;
  return cyc / state.barSec;
}

function stepFromPhase(beats) {
  const phase = currentBarPhase();
  const raw = phase * beats;
  const idx = Math.floor(raw + 1e-9) % beats;
  return idx;
}

function renderTracksPlayheads() {
  const cells = trackListEl.querySelectorAll('[data-step-cell]');
  cells.forEach((el) => {
    const ti = Number(el.getAttribute('data-track'));
    const step = Number(el.getAttribute('data-step'));
    const tr = state.tracks[ti];
    if (!tr) return;
    const active = stepFromPhase(tr.beats) === step;
    el.classList.toggle('playhead', active && state.playing);
  });
}

function normalizeTrackPattern(track) {
  const wantLanes = LANES.length;
  while (track.pattern.length < wantLanes) {
    track.pattern.push(Array.from({ length: track.beats }, () => false));
  }
  if (track.pattern.length > wantLanes) {
    track.pattern = track.pattern.slice(0, wantLanes);
  }
  track.pattern = track.pattern.map((row) => {
    const next = row.slice(0, track.beats);
    while (next.length < track.beats) next.push(false);
    return next;
  });
}

function renderTracks() {
  trackListEl.innerHTML = '';
  state.tracks.forEach((track, ti) => {
    normalizeTrackPattern(track);
    const hue = TRACK_HUES[ti % TRACK_HUES.length];
    const accent = `hsl(${hue} 78% 58%)`;

    const card = document.createElement('section');
    card.className = 'track-card';
    card.style.setProperty('--track-accent', accent);

    const head = document.createElement('div');
    head.className = 'track-head';

    const title = document.createElement('div');
    title.className = 'track-title';
    const swatch = document.createElement('span');
    swatch.className = 'track-swatch';
    swatch.style.background = accent;
    const titleText = document.createElement('span');
    titleText.textContent = `Track ${ti + 1}`;
    title.append(swatch, titleText);

    const controls = document.createElement('div');
    controls.className = 'track-controls';

    const beatsLabel = document.createElement('label');
    beatsLabel.textContent = 'Beats / bar';
    const beatsInput = document.createElement('input');
    beatsInput.type = 'number';
    beatsInput.className = 'bar-field beats-input';
    beatsInput.min = String(MIN_BEATS);
    beatsInput.max = String(MAX_BEATS);
    beatsInput.value = String(track.beats);
    beatsLabel.appendChild(beatsInput);

    const stepMs = document.createElement('span');
    stepMs.className = 'hint';
    stepMs.style.margin = '0';
    const refreshStepReadout = () => {
      const ms = (state.barSec / track.beats) * 1000;
      stepMs.textContent = `≈ ${ms.toFixed(1)} ms per step`;
    };
    refreshStepReadout();

    beatsInput.addEventListener('change', () => {
      let v = Math.round(Number(beatsInput.value));
      v = clamp(v, MIN_BEATS, MAX_BEATS);
      track.beats = v;
      beatsInput.value = String(v);
      track.pattern = resizePattern(track.pattern, v);
      refreshStepReadout();
      updateSyncReadout();
      renderTracks();
      if (state.playing) restartTransport();
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'ghost-button remove-track';
    removeBtn.textContent = 'Remove';
    removeBtn.disabled = state.tracks.length <= 1;
    removeBtn.addEventListener('click', () => {
      if (state.tracks.length <= 1) return;
      state.tracks = state.tracks.filter((t) => t.id !== track.id);
      renderTracks();
      updateSyncReadout();
      if (state.playing) restartTransport();
    });

    controls.append(beatsLabel, stepMs, removeBtn);
    head.append(title, controls);

    const lanesWrap = document.createElement('div');
    lanesWrap.className = 'lane-labels';

    LANES.forEach((lane, laneIndex) => {
      const name = document.createElement('div');
      name.className = 'lane-name';
      name.textContent = lane.label;

      const steps = document.createElement('div');
      steps.className = 'lane-steps';
      const row = document.createElement('div');
      row.className = 'step-row';

      for (let step = 0; step < track.beats; step++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'step-cell';
        if (track.pattern[laneIndex][step]) cell.classList.add('on');
        cell.dataset.stepCell = '1';
        cell.dataset.track = String(ti);
        cell.dataset.lane = String(laneIndex);
        cell.dataset.step = String(step);
        cell.setAttribute('aria-label', `${lane.label} step ${step + 1}`);
        cell.addEventListener('click', () => {
          track.pattern[laneIndex][step] = !track.pattern[laneIndex][step];
          cell.classList.toggle('on', track.pattern[laneIndex][step]);
        });
        row.appendChild(cell);
      }
      steps.appendChild(row);
      lanesWrap.append(name, steps);
    });

    card.append(head, lanesWrap);
    trackListEl.appendChild(card);
  });

  if (state.playing) renderTracksPlayheads();
}

function resizePattern(pattern, newBeats) {
  return pattern.map((row) => {
    const next = row.slice(0, newBeats);
    while (next.length < newBeats) next.push(false);
    return next;
  });
}

updateSyncReadout();
renderTracks();
