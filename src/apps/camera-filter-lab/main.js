import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const ACCENT = '#ff5f6d';

const FILTERS = [
  {
    id: 'reference',
    name: 'Reference Glass',
    role: 'Baseline',
    note: 'Neutral, zero processing',
    description: 'Zero processing so you can judge lighting, white balance, and sensor noise accurately.',
    cssFilter: 'none',
    tags: ['Calibrate exposure', 'True colors', 'Sensor check'],
    previewBackground: 'linear-gradient(135deg, #6f6f6f 0%, #1f1f1f 100%)'
  },
  {
    id: 'studio',
    name: 'Studio Boost',
    role: 'Technical',
    note: 'Clean contrast + saturation',
    description: 'Adds micro-contrast and controlled saturation to make faces and products pop without clipping highlights.',
    cssFilter: 'contrast(1.08) saturate(1.18) brightness(1.04)',
    tags: ['Faces', 'Products', 'Any light'],
    previewBackground: 'linear-gradient(135deg, #ffb347 0%, #ffcc33 100%)'
  },
  {
    id: 'shadow',
    name: 'Shadow Lift',
    role: 'Technical',
    note: 'Recover detail from dark corners',
    description: 'Raises midtones while protecting highlights for warehouses, studios, or backlit offices.',
    cssFilter: 'brightness(1.18) contrast(0.92) saturate(1.05)',
    tags: ['Backlit', 'Indoor', 'Detail'],
    previewBackground: 'linear-gradient(135deg, #3c1053 0%, #ad5389 100%)'
  },
  {
    id: 'golden',
    name: 'Golden Hour',
    role: 'Creative',
    note: 'Warm cinematic glow',
    description: 'Warms the scene with soft contrast to mimic sunset fill without overpowering skin tones.',
    cssFilter: 'contrast(1.05) saturate(1.35) brightness(1.08) hue-rotate(-18deg)',
    overlay: {
      background: 'linear-gradient(145deg, rgba(255, 196, 140, 0.45), rgba(255, 120, 87, 0.3))',
      opacity: 0.55,
      blendMode: 'screen'
    },
    tags: ['Portrait', 'Mood', 'Warmth'],
    previewBackground: 'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)'
  },
  {
    id: 'coollab',
    name: 'Cool Lab Balance',
    role: 'Technical',
    note: 'Neutralize tungsten spill',
    description: 'Shifts the white balance cooler and tightens contrast for labs with heavy tungsten spill.',
    cssFilter: 'contrast(1.05) saturate(1.05) hue-rotate(165deg)',
    overlay: {
      background: 'linear-gradient(130deg, rgba(55, 178, 255, 0.35), rgba(21, 61, 131, 0.45))',
      opacity: 0.45,
      blendMode: 'screen'
    },
    tags: ['White balance', 'Spec sheets', 'Cool tone'],
    previewBackground: 'linear-gradient(135deg, #5efce8 0%, #736efe 100%)'
  },
  {
    id: 'softmatte',
    name: 'Soft Matte Vignette',
    role: 'Creative',
    note: 'Gentle contrast roll-off',
    description: 'Pulls highlights down, adds a subtle vignette, and sprinkles fine grain for a filmic, editorial feel.',
    cssFilter: 'contrast(0.9) saturate(0.85) brightness(1.08)',
    overlay: {
      background: 'radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0) 45%, rgba(0, 0, 0, 0.65) 100%)',
      opacity: 0.9,
      blendMode: 'multiply'
    },
    texture: 'grain',
    tags: ['Editorial', 'Product B-roll'],
    previewBackground: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)'
  },
  {
    id: 'hdr',
    name: 'HDR Crunch',
    role: 'Technical',
    note: 'Sharper edges + clarity',
    description: 'Boosts micro-contrast for inspecting solder joints, textures, and small product engravings.',
    cssFilter: 'contrast(1.35) saturate(1.1) brightness(0.95)',
    tags: ['Inspection', 'Texture', 'Details'],
    previewBackground: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'
  },
  {
    id: 'noir',
    name: 'Noir Report',
    role: 'Creative',
    note: 'Punchy black & white',
    description: 'High-ratio monochrome render for dramatic lighting tests and high-impact documentation.',
    cssFilter: 'grayscale(1) contrast(1.65) brightness(1.08)',
    overlay: {
      background: 'radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.75))',
      opacity: 0.8,
      blendMode: 'multiply'
    },
    tags: ['Monochrome', 'Drama', 'Documents'],
    previewBackground: 'linear-gradient(135deg, #bdc3c7 0%, #2c3e50 100%)'
  },
  {
    id: 'edge',
    name: 'Edge Trace',
    role: 'Diagnostic',
    note: 'Find outlines instantly',
    description: 'Inverts the feed and cranks contrast to isolate hard edges — perfect for checking alignment or PCB traces.',
    cssFilter: 'contrast(2.8) saturate(0) brightness(1.4) invert(1)',
    overlay: {
      background: 'linear-gradient(120deg, rgba(255, 255, 255, 0.35), rgba(0, 0, 0, 0.45))',
      opacity: 0.5,
      blendMode: 'screen'
    },
    tags: ['Edges', 'Alignment', 'PCB'],
    previewBackground: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)'
  },
  {
    id: 'blueprint',
    name: 'Blueprint Draft',
    role: 'Diagnostic',
    note: 'Cyan grid overlay',
    description: 'Maps tones into blueprint blues so you can check geometry, spacing, and handwriting like graph paper.',
    cssFilter: 'invert(1) hue-rotate(220deg) saturate(6) contrast(1.9) brightness(1.1)',
    overlay: {
      background: 'linear-gradient(120deg, rgba(7, 21, 60, 0.9), rgba(0, 173, 239, 0.6))',
      opacity: 0.65,
      blendMode: 'screen'
    },
    texture: 'grid',
    tags: ['Blueprint', 'Sketchnotes', 'Debug'],
    previewBackground: 'linear-gradient(135deg, #09203f 0%, #537895 100%)'
  },
  {
    id: 'thermal',
    name: 'Thermal Radar',
    role: 'Fun',
    note: 'False-color heat vision',
    description: 'Psychedelic palette that mimics thermal cameras — great for dramatic b-roll or science demos.',
    cssFilter: 'contrast(1.25) saturate(3) hue-rotate(150deg)',
    overlay: {
      background: 'linear-gradient(120deg, rgba(255, 0, 122, 0.55), rgba(255, 255, 0, 0.45), rgba(0, 180, 255, 0.45))',
      opacity: 0.75,
      blendMode: 'screen'
    },
    texture: 'grain',
    tags: ['Demos', 'Sci-fi', 'Heat map'],
    previewBackground: 'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)'
  },
  {
    id: 'night',
    name: 'Night Ops',
    role: 'Technical',
    note: 'Amplify greens in low light',
    description: 'Green-boosted low-light profile inspired by night vision goggles for dark labs or field diagnostics.',
    cssFilter: 'brightness(0.45) contrast(1.65) saturate(2.2) hue-rotate(85deg)',
    overlay: {
      background: 'radial-gradient(circle at 50% 50%, rgba(86, 255, 120, 0.65), rgba(3, 8, 2, 0.95))',
      opacity: 0.85,
      blendMode: 'screen'
    },
    tags: ['Low light', 'Field kit', 'Green amps'],
    previewBackground: 'linear-gradient(135deg, #00b09b 0%, #96c93d 100%)'
  },
  {
    id: 'infrared',
    name: 'Infrared Survey',
    role: 'Diagnostic',
    note: 'False-color plant/heat check',
    description: 'Shifts reds and magentas into glowing tones that mimic IR vegetation and heat maps.',
    cssFilter: 'contrast(1.12) saturate(2.4) hue-rotate(260deg) invert(0.15)',
    overlay: {
      background: 'linear-gradient(135deg, rgba(255, 89, 94, 0.45), rgba(61, 9, 129, 0.55))',
      opacity: 0.6,
      blendMode: 'screen'
    },
    tags: ['Field notes', 'Botany', 'Heat cues'],
    previewBackground: 'linear-gradient(135deg, #f43b47 0%, #453a94 100%)'
  },
  {
    id: 'cyber',
    name: 'Cyberpunk Bloom',
    role: 'Fun',
    note: 'Neon magenta vs cyan',
    description: 'Loud saturation, chroma shift, and animated glitch texture for neon city vibes.',
    cssFilter: 'contrast(1.45) saturate(2.4) brightness(1.1) hue-rotate(305deg)',
    overlay: {
      background: 'linear-gradient(130deg, rgba(255, 60, 172, 0.5), rgba(74, 0, 224, 0.6))',
      opacity: 0.65,
      blendMode: 'screen',
      animation: 'filtercamGlare 6s ease-in-out infinite'
    },
    texture: 'glitch',
    tags: ['Neon', 'Clubbing', 'Stylized'],
    previewBackground: 'linear-gradient(135deg, #fc00ff 0%, #00dbde 100%)'
  },
  {
    id: 'vhs',
    name: 'VHS Drift',
    role: 'Fun',
    note: 'Analog scanlines + tint',
    description: 'Retro VHS bleed with teal/magenta highlights and animated scanlines.',
    cssFilter: 'contrast(1.2) saturate(1.4) hue-rotate(-8deg) brightness(1.05)',
    overlay: {
      background: 'linear-gradient(120deg, rgba(255, 0, 153, 0.3), rgba(0, 255, 255, 0.25))',
      opacity: 0.5,
      blendMode: 'screen'
    },
    texture: 'vhs',
    tags: ['Retro', 'Title cards', 'Fun'],
    previewBackground: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)'
  },
  {
    id: 'pixel',
    name: 'Pixel Mosaic',
    role: 'Fun',
    note: 'Blocky arcade aesthetic',
    description: 'Drops resolution for a crunchy pixel-art vibe that disguises sensitive details.',
    cssFilter: 'contrast(1.2) saturate(1.15)',
    videoStyles: {
      imageRendering: 'pixelated',
      transform: 'scale(1.02)'
    },
    tags: ['Privacy', 'Retro', 'Stylized'],
    previewBackground: 'linear-gradient(135deg, #ffefba 0%, #ffffff 100%)'
  },
  {
    id: 'comic',
    name: 'Comic Halftone',
    role: 'Fun',
    note: 'Graphic novel dots',
    description: 'High contrast plus animated halftone texture for comic-book overlays and storyboards.',
    cssFilter: 'contrast(1.8) saturate(1.25) brightness(1.05)',
    texture: 'halftone',
    tags: ['Storyboards', 'Posters', 'Playful'],
    previewBackground: 'linear-gradient(135deg, #ffd194 0%, #d1913c 100%)'
  },
  {
    id: 'neon',
    name: 'Ultraviolet Neon',
    role: 'Creative',
    note: 'Purple + teal split tone',
    description: 'Split-tones shadows into teal and highlights into ultraviolet for music videos and stage looks.',
    cssFilter: 'contrast(1.6) saturate(2.8) brightness(1.1) hue-rotate(275deg)',
    overlay: {
      background: 'linear-gradient(140deg, rgba(0, 255, 224, 0.35), rgba(178, 5, 255, 0.55))',
      opacity: 0.55,
      blendMode: 'screen'
    },
    tags: ['Music', 'Stages', 'Split tone'],
    previewBackground: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)'
  },
  {
    id: 'mist',
    name: 'Mist & Diffusion',
    role: 'Creative',
    note: 'Bloomed highlights',
    description: 'Softens the entire frame with a whisper of blur and pastel overlay for dreamy interviews.',
    cssFilter: 'contrast(0.86) saturate(0.82) brightness(1.15) blur(1px)',
    overlay: {
      background: 'linear-gradient(125deg, rgba(255, 255, 255, 0.35), rgba(251, 206, 177, 0.35))',
      opacity: 0.6,
      blendMode: 'screen'
    },
    tags: ['Interviews', 'Soft focus', 'Beauty'],
    previewBackground: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)'
  },
  {
    id: 'aqua',
    name: 'Aqua Blueprint',
    role: 'Creative',
    note: 'Aqua + lime split tone',
    description: 'Stacks aqua highlights and lime shadows for energetic maker demos and gadget close-ups.',
    cssFilter: 'contrast(1.1) saturate(1.9) hue-rotate(120deg)',
    overlay: {
      background: 'linear-gradient(140deg, rgba(0, 255, 209, 0.4), rgba(126, 255, 71, 0.35))',
      opacity: 0.5,
      blendMode: 'screen'
    },
    tags: ['Maker demos', 'Products', 'Fresh'],
    previewBackground: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)'
  }
];

const { body } = createAppShell({
  title: 'FilterCam Playground',
  description:
    'Stream your webcam directly in the browser and jump between cinematic, diagnostic, and just-for-fun filter presets. Allow the camera and tap any card to restyle the live feed.',
  accent: ACCENT
});

const root = document.createElement('div');
root.className = 'filtercam';

const streamPanel = document.createElement('section');
streamPanel.className = 'filtercam-panel filtercam-panel--stream';

const streamHeader = document.createElement('header');
streamHeader.className = 'filtercam-panel-header';
streamHeader.innerHTML = `
  <div>
    <h2>Live camera</h2>
    <p>Grant access, then pin a preset. Each filter stacks CSS processing, overlays, and textures for distinct looks.</p>
  </div>
`;

const streamViewport = document.createElement('div');
streamViewport.className = 'filtercam-viewport';
streamViewport.setAttribute('role', 'presentation');

const video = document.createElement('video');
video.className = 'filtercam-video';
video.autoplay = true;
video.muted = true;
video.playsInline = true;
video.setAttribute('aria-label', 'Live camera preview');

const overlay = document.createElement('div');
overlay.className = 'filtercam-overlay';

const texture = document.createElement('div');
texture.className = 'filtercam-texture';

streamViewport.append(video, overlay, texture);

const statusBar = document.createElement('div');
statusBar.className = 'filtercam-status-bar';

const cameraStatus = document.createElement('p');
cameraStatus.className = 'filtercam-status';
cameraStatus.dataset.tone = 'pending';
cameraStatus.textContent = 'Requesting camera access…';

const retryButton = document.createElement('button');
retryButton.type = 'button';
retryButton.className = 'ghost-button filtercam-retry';
retryButton.textContent = 'Retry camera';
retryButton.hidden = true;
retryButton.addEventListener('click', () => bootCamera());

statusBar.append(cameraStatus, retryButton);

const currentCard = document.createElement('article');
currentCard.className = 'filtercam-current';

const currentHeader = document.createElement('div');
currentHeader.className = 'filtercam-current-heading';

const currentBadge = document.createElement('span');
currentBadge.className = 'filtercam-current-badge';
currentBadge.textContent = FILTERS[0]?.role ?? '';

const currentName = document.createElement('h3');
currentName.className = 'filtercam-current-name';
currentName.textContent = FILTERS[0]?.name ?? '';

currentHeader.append(currentBadge, currentName);

const currentNote = document.createElement('p');
currentNote.className = 'filtercam-current-note';
currentNote.textContent = FILTERS[0]?.description ?? '';

const tagList = document.createElement('div');
tagList.className = 'filtercam-tags';

currentCard.append(currentHeader, currentNote, tagList);

streamPanel.append(streamHeader, streamViewport, statusBar, currentCard);

const filterPanel = document.createElement('section');
filterPanel.className = 'filtercam-panel filtercam-panel--filters';

const filtersHeader = document.createElement('header');
filtersHeader.className = 'filtercam-panel-header';
filtersHeader.innerHTML = `
  <div>
    <h2>Filter library</h2>
    <p>${FILTERS.length} curated looks spanning color grading, diagnostics, and straight-up fun.</p>
  </div>
`;

const filtersGrid = document.createElement('div');
filtersGrid.className = 'filtercam-filter-grid';

filterPanel.append(filtersHeader, filtersGrid);

root.append(streamPanel, filterPanel);
body.appendChild(root);

const filterLookup = new Map(FILTERS.map((filter) => [filter.id, filter]));
const filterButtons = new Map();
let activeFilterId = FILTERS[0]?.id ?? null;
let activeStream = null;

renderFilterButtons();
if (activeFilterId) {
  selectFilter(activeFilterId);
}

bootCamera();

window.addEventListener('pagehide', cleanupStream);
window.addEventListener('beforeunload', cleanupStream);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    video.pause();
    return;
  }
  if (activeStream) {
    video.play().catch(() => {});
  }
});

function renderFilterButtons() {
  FILTERS.forEach((filter) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filtercam-chip';
    button.dataset.filter = filter.id;
    button.setAttribute('aria-pressed', 'false');

    const preview = document.createElement('span');
    preview.className = 'filtercam-chip-preview';
    preview.style.setProperty('--chip-bg', filter.previewBackground ?? 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)');
    preview.style.filter = filter.previewFilter ?? filter.cssFilter ?? 'none';

    const body = document.createElement('span');
    body.className = 'filtercam-chip-body';

    const title = document.createElement('strong');
    title.textContent = filter.name;

    const note = document.createElement('em');
    note.textContent = filter.note;

    const role = document.createElement('span');
    role.className = 'filtercam-chip-role';
    role.textContent = filter.role;

    body.append(title, note, role);
    button.append(preview, body);
    button.addEventListener('click', () => selectFilter(filter.id));

    filterButtons.set(filter.id, button);
    filtersGrid.appendChild(button);
  });
}

function selectFilter(filterId) {
  const filter = filterLookup.get(filterId);
  if (!filter) {
    return;
  }

  activeFilterId = filterId;
  updateFilterButtons(filterId);
  applyFilterToVideo(filter);
  updateCurrentFilterCard(filter);
}

function updateFilterButtons(filterId) {
  filterButtons.forEach((button, id) => {
    const isActive = id === filterId;
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.classList.toggle('is-active', isActive);
  });
}

function applyFilterToVideo(filter) {
  video.style.filter = filter.cssFilter ?? 'none';
  video.style.mixBlendMode = filter.mixBlendMode ?? 'normal';
  video.style.imageRendering = filter.videoStyles?.imageRendering ?? '';
  video.style.transform = filter.videoStyles?.transform ?? '';

  applyOverlay(filter.overlay);
  applyTexture(filter.texture);
}

function applyOverlay(config) {
  if (!config) {
    overlay.style.opacity = '0';
    overlay.style.background = 'transparent';
    overlay.style.mixBlendMode = 'screen';
    overlay.style.animation = 'none';
    return;
  }
  overlay.style.opacity = `${config.opacity ?? 0.45}`;
  overlay.style.background = config.background ?? '';
  overlay.style.mixBlendMode = config.blendMode ?? 'screen';
  overlay.style.animation = config.animation ?? 'none';
}

const TEXTURE_CLASS_MAP = {
  scanlines: 'filtercam-texture--scanlines',
  glitch: 'filtercam-texture--glitch',
  grain: 'filtercam-texture--grain',
  halftone: 'filtercam-texture--halftone',
  vhs: 'filtercam-texture--vhs',
  grid: 'filtercam-texture--grid'
};

function applyTexture(effect) {
  texture.className = 'filtercam-texture';
  if (!effect) {
    return;
  }
  const className = TEXTURE_CLASS_MAP[effect];
  if (className) {
    texture.classList.add(className);
  }
}

function updateCurrentFilterCard(filter) {
  currentBadge.textContent = filter.role;
  currentName.textContent = filter.name;
  currentNote.textContent = filter.description;

  tagList.innerHTML = '';
  (filter.tags ?? []).forEach((tag) => {
    const chip = document.createElement('span');
    chip.className = 'filtercam-tag';
    chip.textContent = tag;
    tagList.appendChild(chip);
  });
}

async function bootCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('This browser does not support camera capture.', 'error');
    retryButton.hidden = true;
    return;
  }

  setStatus('Requesting camera access…', 'pending');
  cleanupStream();

  try {
    const constraints = {
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        facingMode: { ideal: 'user' }
      },
      audio: false
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    activeStream = stream;
    video.srcObject = stream;
    await video.play().catch(() => {});
    setStatus('Camera live. Pick a filter to restyle the feed.', 'success');
  } catch (error) {
    console.error('Camera error', error);
    cleanupStream();
    setStatus('Could not access the camera. Check permissions and click retry.', 'error');
  }
}

function cleanupStream() {
  if (!activeStream) {
    return;
  }
  activeStream.getTracks().forEach((track) => track.stop());
  activeStream = null;
  video.srcObject = null;
}

function setStatus(message, tone = 'info') {
  cameraStatus.textContent = message;
  cameraStatus.dataset.tone = tone;
  retryButton.hidden = tone !== 'error';
}
