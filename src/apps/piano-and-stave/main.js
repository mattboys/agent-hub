import { createAppShell } from '../shared/appShell';
import './styles.css';

const ACCENT = '#6f6bff';
const WHITE_TEMPLATE = [
  { name: 'C4', frequency: 261.63, keyLabel: 'A' },
  { name: 'D4', frequency: 293.66, keyLabel: 'S' },
  { name: 'E4', frequency: 329.63, keyLabel: 'D' },
  { name: 'F4', frequency: 349.23, keyLabel: 'F' },
  { name: 'G4', frequency: 392.0, keyLabel: 'G' },
  { name: 'A4', frequency: 440.0, keyLabel: 'H' },
  { name: 'B4', frequency: 493.88, keyLabel: 'J' },
  { name: 'C5', frequency: 523.25, keyLabel: 'K' }
];

const BLACK_TEMPLATE = [
  { name: 'C#4', frequency: 277.18, keyLabel: 'W', anchorIndex: 0 },
  { name: 'D#4', frequency: 311.13, keyLabel: 'E', anchorIndex: 1 },
  { name: 'F#4', frequency: 369.99, keyLabel: 'T', anchorIndex: 3 },
  { name: 'G#4', frequency: 415.3, keyLabel: 'Y', anchorIndex: 4 },
  { name: 'A#4', frequency: 466.16, keyLabel: 'U', anchorIndex: 5 }
];

const NOTE_STEPS = {
  C4: -2,
  'C#4': -1.5,
  D4: -1,
  'D#4': -0.5,
  E4: 0,
  F4: 0.5,
  'F#4': 1,
  G4: 1.5,
  'G#4': 2,
  A4: 2.5,
  'A#4': 3,
  B4: 3.5,
  C5: 4
};

const WHITE_KEYS = WHITE_TEMPLATE.map((note, index) => ({
  ...note,
  type: 'white',
  whiteIndex: index
}));

const BLACK_KEYS = BLACK_TEMPLATE.map((note) => ({
  ...note,
  type: 'black'
}));

const KEY_LOOKUP = new Map();
const heldKeys = new Map();
const blackKeyElements = [];
const noteQueue = [];
const MAX_NOTES = 16;
const NOTE_SPACING = 40;
const STAFF_STEP = 10;
const STAFF_BASE = 36;

let audioCtx;

const { body } = createAppShell({
  title: 'Piano Stave Studio',
  description:
    'Play a clicky piano, hear each tone via Web Audio, and drop matching symbols on a treble staff as you go.',
  accent: ACCENT
});

const app = document.createElement('div');
app.className = 'piano-stave-app';

const staffPanel = document.createElement('section');
staffPanel.className = 'panel staff-panel';

const staffHeading = document.createElement('div');
staffHeading.className = 'panel-heading';
staffHeading.innerHTML = `
  <div>
    <p class="eyebrow">Live notation</p>
    <h2>Treble staff capture</h2>
    <p>Each press drops a fresh note head so you can sketch melodic ideas visually.</p>
  </div>
`;

const clearButton = document.createElement('button');
clearButton.type = 'button';
clearButton.className = 'ghost-button';
clearButton.textContent = 'Clear staff';
staffHeading.appendChild(clearButton);
staffPanel.appendChild(staffHeading);

const staff = document.createElement('div');
staff.className = 'staff';

const notesLayer = document.createElement('div');
notesLayer.className = 'notes-layer';
staff.appendChild(notesLayer);
staffPanel.appendChild(staff);

const statusLine = document.createElement('p');
statusLine.className = 'status-line';
statusLine.textContent = 'No notes yet - start tapping keys.';
staffPanel.appendChild(statusLine);

const keyboardPanel = document.createElement('section');
keyboardPanel.className = 'panel keyboard-panel';
const keyboardHeading = document.createElement('div');
keyboardHeading.className = 'panel-heading';
keyboardHeading.innerHTML = `
  <div>
    <p class="eyebrow">Playable instrument</p>
    <h2>Clicky browser piano</h2>
    <p>Use the home row (A-K) for white keys or W/E/T/Y/U for sharps.</p>
  </div>
`;
keyboardPanel.appendChild(keyboardHeading);

const keyboard = document.createElement('div');
keyboard.className = 'keyboard';
const keyBed = document.createElement('div');
keyBed.className = 'key-bed';
const whiteKeysRow = document.createElement('div');
whiteKeysRow.className = 'white-keys';
const blackKeysLayer = document.createElement('div');
blackKeysLayer.className = 'black-keys';

keyBed.appendChild(whiteKeysRow);
keyBed.appendChild(blackKeysLayer);
keyboard.appendChild(keyBed);
keyboardPanel.appendChild(keyboard);

const legend = document.createElement('div');
legend.className = 'keyboard-legend';
legend.innerHTML = `
  <p><span>White keys</span><strong>A S D F G H J K</strong></p>
  <p><span>Black keys</span><strong>W E - T Y U</strong></p>
`;
keyboardPanel.appendChild(legend);

app.appendChild(staffPanel);
app.appendChild(keyboardPanel);
body.appendChild(app);

WHITE_KEYS.forEach((note) => {
  const button = createKeyButton(note);
  note.element = button;
  button.classList.add('white-key');
  whiteKeysRow.appendChild(button);
  KEY_LOOKUP.set(note.keyLabel.toUpperCase(), note);
});

BLACK_KEYS.forEach((note) => {
  const button = createKeyButton(note);
  note.element = button;
  button.classList.add('black-key');
  blackKeysLayer.appendChild(button);
  blackKeyElements.push({ element: button, note });
  KEY_LOOKUP.set(note.keyLabel.toUpperCase(), note);
});

clearButton.addEventListener('click', () => {
  noteQueue.length = 0;
  renderNotes();
  statusLine.textContent = 'Staff cleared. Ready for new notes.';
});

positionBlackKeys();
const resizeObserver = new ResizeObserver(positionBlackKeys);
resizeObserver.observe(keyBed);
window.addEventListener('resize', positionBlackKeys);

window.addEventListener('keydown', (event) => {
  const key = event.key.toUpperCase();
  const note = KEY_LOOKUP.get(key);
  if (!note || heldKeys.has(key)) {
    return;
  }
  event.preventDefault();
  heldKeys.set(key, note);
  setKeyActive(note, true);
  triggerNote(note);
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toUpperCase();
  const note = heldKeys.get(key);
  if (!note) {
    return;
  }
  heldKeys.delete(key);
  setKeyActive(note, false);
});

window.addEventListener('blur', () => {
  heldKeys.forEach((note) => setKeyActive(note, false));
  heldKeys.clear();
});

function createKeyButton(note) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'piano-key';
  button.dataset.note = note.name;
  button.setAttribute('aria-label', `${note.name} (${note.keyLabel} key)`);
  button.innerHTML = `
    <span class="note-name">${note.name}</span>
    <span class="key-label">${note.keyLabel}</span>
  `;

  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    setKeyActive(note, true);
    triggerNote(note);
  });

  button.addEventListener('pointerup', (event) => {
    if (button.hasPointerCapture(event.pointerId)) {
      button.releasePointerCapture(event.pointerId);
    }
    setKeyActive(note, false);
  });

  button.addEventListener('pointerleave', () => {
    setKeyActive(note, false);
  });

  return button;
}

function triggerNote(note) {
  playFrequency(note.frequency);
  addNoteToStaff(note.name);
  statusLine.textContent = `Last note: ${note.name}`;
}

function setKeyActive(note, isActive) {
  if (note?.element) {
    note.element.classList.toggle('is-active', isActive);
  }
}

function positionBlackKeys() {
  const totalWidth = keyBed.clientWidth;
  if (!totalWidth) {
    return;
  }

  const whiteWidth = totalWidth / WHITE_KEYS.length;
  const blackWidth = whiteWidth * 0.65;

  blackKeyElements.forEach(({ element, note }) => {
    const left = (note.anchorIndex + 1) * whiteWidth - blackWidth / 2;
    element.style.width = `${blackWidth}px`;
    element.style.left = `${left}px`;
  });
}

function addNoteToStaff(noteName) {
  noteQueue.push({ id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, name: noteName });
  if (noteQueue.length > MAX_NOTES) {
    noteQueue.shift();
  }
  renderNotes();
}

function renderNotes() {
  notesLayer.innerHTML = '';
  noteQueue.forEach((entry, index) => {
    const noteEl = document.createElement('div');
    noteEl.className = 'notation-note';
    noteEl.style.left = `${index * NOTE_SPACING}px`;
    noteEl.style.bottom = `${getStaffPosition(entry.name)}px`;

    const head = document.createElement('span');
    head.className = 'note-head';
    noteEl.appendChild(head);

    if (entry.name.includes('#')) {
      const accidental = document.createElement('span');
      accidental.className = 'accidental';
      accidental.textContent = '♯';
      noteEl.appendChild(accidental);
    }

    if (requiresLedger(entry.name)) {
      const ledger = document.createElement('span');
      ledger.className = 'ledger-line';
      noteEl.appendChild(ledger);
    }

    notesLayer.appendChild(noteEl);
  });
}

function requiresLedger(noteName) {
  const step = NOTE_STEPS[noteName];
  return typeof step === 'number' && step <= -2;
}

function getStaffPosition(noteName) {
  const step = NOTE_STEPS[noteName];
  if (typeof step !== 'number') {
    return STAFF_BASE;
  }
  return STAFF_BASE + step * STAFF_STEP;
}

function playFrequency(frequency) {
  if (!audioCtx) {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }
    audioCtx = new AudioContextCtor();
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const now = audioCtx.currentTime;
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(frequency, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.35, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

  oscillator.connect(gain).connect(audioCtx.destination);
  oscillator.start(now);
  oscillator.stop(now + 1.2);
}
