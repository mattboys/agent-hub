import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const accent = '#b7410e';

const { body } = createAppShell({
  title: 'Browser Systems Diagnostic',
  description:
    'Spin up a deliberate, cinematic sweep of browser capabilities, permissions, and experimental APIs. Hit start and watch each probe resolve in sequence.',
  accent,
  status: 'beta'
});

const startButton = document.createElement('button');
startButton.type = 'button';
startButton.className = 'start-button';
startButton.textContent = 'Start Diagnostic Sweep';

const subtext = document.createElement('p');
subtext.className = 'intro-note';
subtext.textContent =
  'The sweep requests select permissions (clipboard, location, camera, microphone) and inspects dozens of APIs. Keep this tab focused so prompts are easy to spot.';

const progressNote = document.createElement('p');
progressNote.className = 'progress-note';
progressNote.textContent = 'Waiting to start.';

const testsList = document.createElement('ul');
testsList.className = 'checks-list';

body.append(startButton, subtext, progressNote, testsList);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function resolveWithTimeout(promise, timeoutMs, timeoutMessage) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage || `Timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function getPermissionStatus(name) {
  if (!('permissions' in navigator) || typeof navigator.permissions.query !== 'function') {
    return { state: 'unsupported', detail: 'Permissions API unavailable' };
  }
  try {
    const status = await navigator.permissions.query({ name });
    return { state: status.state };
  } catch (error) {
    return { state: 'unsupported', detail: error?.message || 'Query not supported' };
  }
}

function normalizeMediaError(error) {
  if (!error) {
    return 'Unknown media error';
  }
  if (typeof error === 'string') {
    return error;
  }
  if ('message' in error && error.message) {
    return error.message;
  }
  if ('name' in error && error.name) {
    return error.name;
  }
  return 'Media permission failed';
}

function detectBrowserName() {
  const ua = navigator.userAgent;
  const vendor = navigator.vendor || '';
  if (/edg\//i.test(ua)) {
    return 'Microsoft Edge';
  }
  if (/chrome|crios/i.test(ua) && /google inc\./i.test(vendor)) {
    return 'Google Chrome';
  }
  if (/firefox|fxios/i.test(ua)) {
    return 'Mozilla Firefox';
  }
  if (/safari/i.test(ua) && !/chrome|crios|edg/i.test(ua)) {
    return 'Apple Safari';
  }
  if (/opr\//i.test(ua)) {
    return 'Opera';
  }
  if (/brave/i.test(ua)) {
    return 'Brave';
  }
  return 'Unknown Browser';
}

function detectPlatformKind() {
  const ua = navigator.userAgent || '';
  const uaData = navigator.userAgentData;
  if (uaData && Array.isArray(uaData.brands)) {
    if (uaData.mobile) {
      return 'Mobile (userAgentData)';
    }
    return 'Desktop (userAgentData)';
  }
  if (/ipad|tablet/i.test(ua)) {
    return 'Tablet';
  }
  if (/android|iphone|ipod|blackberry|windows phone|opera mini|mobile/i.test(ua)) {
    return 'Mobile';
  }
  return 'Desktop';
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return 'unknown';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[exponent]}`;
}

function safeToFixed(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

const tests = [
  {
    id: 'ip-address',
    label: 'Get IP address',
    run: async () => {
      if (!navigator.onLine) {
        throw new Error('Offline – cannot query public IP');
      }
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      let timeoutId;
      if (controller) {
        timeoutId = setTimeout(() => controller.abort(), 5200);
      }
      try {
        const response = await fetch('https://api.ipify.org?format=json', {
          signal: controller?.signal
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const result = await response.json();
        return { message: `Public IP ${result.ip}` };
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw new Error('IP service timed out');
        }
        throw new Error(error?.message || 'IP fetch failed');
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    }
  },
  {
    id: 'browser-type',
    label: 'Identify browser type',
    run: () => {
      const name = detectBrowserName();
      return { message: `Detected ${name}` };
    }
  },
  {
    id: 'screen-size',
    label: 'Report screen size',
    run: () => {
      const { width, height } = window.screen;
      const dpr = window.devicePixelRatio || 1;
      return { message: `${width} × ${height} @ ${dpr.toFixed(2)}x DPR` };
    }
  },
  {
    id: 'form-factor',
    label: 'Determine desktop or mobile',
    run: () => {
      const platform = detectPlatformKind();
      return { message: platform };
    }
  },
  {
    id: 'clipboard-permission',
    label: 'Request clipboard read permission',
    run: async () => {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API unavailable');
      }
      const status = await getPermissionStatus('clipboard-read');
      if (status.state === 'granted') {
        return { message: 'Clipboard read access already granted' };
      }
      if (status.state === 'denied') {
        throw new Error('Clipboard permission denied');
      }
      if (status.state === 'unsupported') {
        throw new Error(status.detail || 'Clipboard permission query unsupported');
      }
      throw new Error('Clipboard permission not granted yet (requires user gesture)');
    }
  },
  {
    id: 'geolocation',
    label: 'Request location permission',
    run: async () => {
      if (!('geolocation' in navigator)) {
        throw new Error('Geolocation API unavailable');
      }
      const status = await getPermissionStatus('geolocation');
      if (status.state === 'denied') {
        throw new Error('Location permission denied');
      }
      const position = await resolveWithTimeout(
        new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 1000
          });
        }),
        9000,
        'Location request timed out'
      ).catch((error) => {
        throw new Error(error?.message || 'Location request failed');
      });
      const { latitude, longitude } = position.coords;
      return {
        message: `Approx. ${safeToFixed(latitude, 3)}°, ${safeToFixed(longitude, 3)}°`
      };
    }
  },
  {
    id: 'camera',
    label: 'Request camera permission',
    run: async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('MediaDevices.getUserMedia unavailable');
      }
      const status = await getPermissionStatus('camera');
      if (status.state === 'denied') {
        throw new Error('Camera permission denied');
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((track) => track.stop());
        return { message: 'Camera stream granted' };
      } catch (error) {
        throw new Error(normalizeMediaError(error));
      }
    }
  },
  {
    id: 'microphone',
    label: 'Request microphone permission',
    run: async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('MediaDevices.getUserMedia unavailable');
      }
      const status = await getPermissionStatus('microphone');
      if (status.state === 'denied') {
        throw new Error('Microphone permission denied');
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        return { message: 'Microphone stream granted' };
      } catch (error) {
        throw new Error(normalizeMediaError(error));
      }
    }
  },
  {
    id: 'storage-estimate',
    label: 'Estimate storage quota',
    run: async () => {
      if (!navigator.storage?.estimate) {
        throw new Error('StorageManager.estimate unavailable');
      }
      const { quota, usage } = await navigator.storage.estimate();
      return {
        message: `Usage ${formatBytes(usage || 0)} / ${formatBytes(quota || 0)}`
      };
    }
  },
  {
    id: 'webassembly',
    label: 'Check WebAssembly enablement',
    run: () => {
      if (typeof WebAssembly === 'object') {
        return { message: 'WebAssembly available' };
      }
      throw new Error('WebAssembly not supported');
    }
  },
  {
    id: 'serial',
    label: 'Check Web Serial support',
    run: () => {
      if ('serial' in navigator) {
        return { message: 'navigator.serial detected' };
      }
      throw new Error('Web Serial not available');
    }
  },
  {
    id: 'javascript',
    label: 'Verify JavaScript execution',
    run: () => ({ message: 'JavaScript running (you are here)' })
  },
  {
    id: 'hdr',
    label: 'Probe high dynamic range display',
    run: () => {
      if (window.matchMedia && window.matchMedia('(dynamic-range: high)').matches) {
        return { message: 'HDR dynamic-range: high' };
      }
      if (window.matchMedia && window.matchMedia('(color-gamut: p3)').matches) {
        return { message: 'Wide color gamut (DCI-P3)' };
      }
      throw new Error('HDR not reported');
    }
  },
  {
    id: 'service-worker',
    label: 'Check Service Worker support',
    run: () => {
      if ('serviceWorker' in navigator) {
        return { message: 'Service workers supported' };
      }
      throw new Error('Service workers unavailable');
    }
  },
  {
    id: 'push-api',
    label: 'Check Push API support',
    run: () => {
      if ('PushManager' in window) {
        return { message: 'PushManager available' };
      }
      throw new Error('Push API unavailable');
    }
  },
  {
    id: 'bluetooth',
    label: 'Check Web Bluetooth support',
    run: () => {
      if ('bluetooth' in navigator) {
        return { message: 'navigator.bluetooth ready' };
      }
      throw new Error('Web Bluetooth unavailable');
    }
  },
  {
    id: 'midi',
    label: 'Check Web MIDI support',
    run: async () => {
      if (!navigator.requestMIDIAccess) {
        throw new Error('Web MIDI API unavailable');
      }
      const access = await navigator.requestMIDIAccess({ sysex: false }).catch((error) => {
        throw new Error(error?.message || 'Web MIDI request failed');
      });
      const inputs = access.inputs?.size ?? 0;
      const outputs = access.outputs?.size ?? 0;
      return { message: `MIDI ${inputs} inputs / ${outputs} outputs` };
    }
  },
  {
    id: 'gamepad',
    label: 'Check Gamepad API support',
    run: () => {
      if ('getGamepads' in navigator) {
        const pads = navigator.getGamepads?.();
        const connected = Array.isArray(pads) ? pads.filter(Boolean).length : 0;
        return { message: `Gamepads connected: ${connected}` };
      }
      throw new Error('Gamepad API unavailable');
    }
  },
  {
    id: 'device-memory',
    label: 'Read device memory estimate',
    run: () => {
      if ('deviceMemory' in navigator) {
        return { message: `${navigator.deviceMemory} GB reported` };
      }
      throw new Error('Device memory API unavailable');
    }
  },
  {
    id: 'network-info',
    label: 'Inspect network information',
    run: () => {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!connection) {
        throw new Error('Network Information API unavailable');
      }
      const parts = [];
      if (connection.effectiveType) {
        parts.push(`effective ${connection.effectiveType}`);
      }
      if (typeof connection.downlink === 'number') {
        parts.push(`${connection.downlink} Mbps downlink`);
      }
      if (connection.saveData) {
        parts.push('data saver on');
      }
      return { message: parts.length ? parts.join(', ') : 'Network info available' };
    }
  },
  {
    id: 'battery',
    label: 'Check Battery Status API',
    run: async () => {
      if (!navigator.getBattery) {
        throw new Error('Battery API unavailable');
      }
      const battery = await navigator.getBattery();
      const level = Math.round((battery.level || 0) * 100);
      const charging = battery.charging ? 'charging' : 'not charging';
      return { message: `${level}% and ${charging}` };
    }
  },
  {
    id: 'touch',
    label: 'Detect touch capability',
    run: () => {
      const touchPoints = navigator.maxTouchPoints || 0;
      if ('ontouchstart' in window || touchPoints > 0) {
        return { message: `${touchPoints} touch points` };
      }
      throw new Error('Touch support not detected');
    }
  },
  {
    id: 'pointer-lock',
    label: 'Check Pointer Lock API',
    run: () => {
      if ('pointerLockElement' in document || 'mozPointerLockElement' in document) {
        return { message: 'Pointer Lock API detected' };
      }
      throw new Error('Pointer Lock unsupported');
    }
  },
  {
    id: 'fullscreen',
    label: 'Check Fullscreen API',
    run: () => {
      if (document.fullscreenEnabled || document.webkitFullscreenEnabled || document.msFullscreenEnabled) {
        return { message: 'Fullscreen enabled' };
      }
      throw new Error('Fullscreen API unavailable');
    }
  },
  {
    id: 'webgl',
    label: 'Check WebGL availability',
    run: () => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        return { message: 'WebGL context acquired' };
      }
      throw new Error('WebGL context failed');
    }
  },
  {
    id: 'offscreencanvas',
    label: 'Check OffscreenCanvas support',
    run: () => {
      if (typeof OffscreenCanvas === 'function') {
        return { message: 'OffscreenCanvas available' };
      }
      throw new Error('OffscreenCanvas not supported');
    }
  },
  {
    id: 'cookies',
    label: 'Check cookie availability',
    run: () => {
      if (navigator.cookieEnabled) {
        return { message: 'Cookies enabled' };
      }
      throw new Error('Cookies disabled');
    }
  },
  {
    id: 'do-not-track',
    label: 'Read Do Not Track preference',
    run: () => {
      const dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
      if (dnt === '1' || dnt === 'yes') {
        return { message: 'Do Not Track enabled' };
      }
      if (dnt === '0' || dnt === 'no') {
        return { message: 'Do Not Track disabled' };
      }
      throw new Error('Do Not Track preference unavailable');
    }
  },
  {
    id: 'prefers-color-scheme',
    label: 'Check color-scheme preference',
    run: () => {
      if (!window.matchMedia) {
        throw new Error('matchMedia unavailable');
      }
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return { message: 'Prefers dark mode' };
      }
      if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        return { message: 'Prefers light mode' };
      }
      throw new Error('No explicit color-scheme preference');
    }
  },
  {
    id: 'web-share',
    label: 'Check Web Share API',
    run: () => {
      if (navigator.share) {
        return { message: 'navigator.share available' };
      }
      throw new Error('Web Share API unavailable');
    }
  },
  {
    id: 'speech-synthesis',
    label: 'Check speech synthesis',
    run: () => {
      if ('speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices?.() || [];
        return { message: `${voices.length} voices detected` };
      }
      throw new Error('Speech synthesis unavailable');
    }
  },
  {
    id: 'speech-recognition',
    label: 'Check speech recognition support',
    run: () => {
      if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        return { message: 'Speech recognition constructor available' };
      }
      throw new Error('Speech recognition not supported');
    }
  },
  {
    id: 'idle-detection',
    label: 'Check Idle Detection API',
    run: async () => {
      if (!('IdleDetector' in window)) {
        throw new Error('Idle Detector unavailable');
      }
      const status = await getPermissionStatus('idle-detection');
      if (status.state === 'denied') {
        throw new Error('Idle detection permission denied');
      }
      return { message: 'IdleDetector interface ready' };
    }
  },
  {
    id: 'file-system-access',
    label: 'Check File System Access API',
    run: () => {
      if ('showOpenFilePicker' in window || 'chooseFileSystemEntries' in window) {
        return { message: 'File System Access detected' };
      }
      throw new Error('File System Access API unavailable');
    }
  },
  {
    id: 'nfc',
    label: 'Check Web NFC support',
    run: () => {
      if ('nfc' in navigator) {
        return { message: 'navigator.nfc available' };
      }
      throw new Error('Web NFC unsupported');
    }
  },
  {
    id: 'wake-lock',
    label: 'Check Screen Wake Lock',
    run: async () => {
      if (!('wakeLock' in navigator)) {
        throw new Error('Wake Lock API unavailable');
      }
      const status = await getPermissionStatus('screen-wake-lock');
      if (status.state === 'denied') {
        throw new Error('Wake Lock permission denied');
      }
      return { message: 'Navigator wakeLock present' };
    }
  },
  {
    id: 'webgpu',
    label: 'Check WebGPU support',
    run: () => {
      if ('gpu' in navigator) {
        return { message: 'navigator.gpu detected' };
      }
      throw new Error('WebGPU not available');
    }
  },
  {
    id: 'avif',
    label: 'Check AVIF image support',
    run: () => {
      const canvas = document.createElement('canvas');
      try {
        const dataUrl = canvas.toDataURL('image/avif');
        if (dataUrl.startsWith('data:image/avif')) {
          return { message: 'AVIF encoding supported' };
        }
      } catch (error) {
        throw new Error(error?.message || 'AVIF encoding not supported');
      }
      throw new Error('AVIF encoding not supported');
    }
  },
  {
    id: 'hevc',
    label: 'Check HEVC video support',
    run: () => {
      const video = document.createElement('video');
      if (!video.canPlayType) {
        throw new Error('HTMLVideoElement.canPlayType unavailable');
      }
      const support = video.canPlayType('video/mp4; codecs="hvc1.1.L123.B0"');
      if (support === 'probably' || support === 'maybe') {
        return { message: `HEVC ${support}` };
      }
      throw new Error('HEVC playback not advertised');
    }
  },
  {
    id: 'local-storage',
    label: 'Check localStorage functionality',
    run: () => {
      try {
        const key = `diagnostic-test-${Date.now()}`;
        localStorage.setItem(key, 'ok');
        localStorage.removeItem(key);
        return { message: 'localStorage read/write succeeded' };
      } catch (error) {
        throw new Error(error?.message || 'localStorage unavailable');
      }
    }
  },
  {
    id: 'session-storage',
    label: 'Check sessionStorage functionality',
    run: () => {
      try {
        const key = `diagnostic-test-${Date.now()}`;
        sessionStorage.setItem(key, 'ok');
        sessionStorage.removeItem(key);
        return { message: 'sessionStorage read/write succeeded' };
      } catch (error) {
        throw new Error(error?.message || 'sessionStorage unavailable');
      }
    }
  },
  {
    id: 'notifications',
    label: 'Check notification permission',
    run: () => {
      if (!('Notification' in window)) {
        throw new Error('Notifications API unavailable');
      }
      const status = Notification.permission;
      if (status === 'granted') {
        return { message: 'Notifications granted' };
      }
      throw new Error(`Notification permission: ${status}`);
    }
  },
  {
    id: 'vibration',
    label: 'Check Vibration API',
    run: () => {
      if ('vibrate' in navigator) {
        const outcome = navigator.vibrate?.(0);
        return { message: `navigator.vibrate available (${outcome === false ? 'inactive' : 'ready'})` };
      }
      throw new Error('Vibration API unavailable');
    }
  },
  {
    id: 'reduced-motion',
    label: 'Check reduced motion preference',
    run: () => {
      if (!window.matchMedia) {
        throw new Error('matchMedia unavailable');
      }
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mq.matches) {
        return { message: 'Prefers reduced motion' };
      }
      return { message: 'No reduced motion preference' };
    }
  },
  {
    id: 'hardware-concurrency',
    label: 'Check logical CPU cores',
    run: () => {
      if ('hardwareConcurrency' in navigator) {
        return { message: `${navigator.hardwareConcurrency} cores reported` };
      }
      throw new Error('Hardware concurrency unavailable');
    }
  },
  {
    id: 'storage-persist',
    label: 'Check persistent storage capability',
    run: async () => {
      if (!navigator.storage || typeof navigator.storage.persisted !== 'function') {
        throw new Error('Persistent storage query unavailable');
      }
      const persisted = await navigator.storage.persisted();
      return { message: persisted ? 'Already persisted' : 'Not persisted (can request)' };
    }
  },
  {
    id: 'eye-dropper',
    label: 'Check EyeDropper API',
    run: () => {
      if ('EyeDropper' in window) {
        return { message: 'EyeDropper constructor available' };
      }
      throw new Error('EyeDropper API unavailable');
    }
  },
  {
    id: 'scheduler-post-task',
    label: 'Check scheduler.postTask',
    run: () => {
      if (window.scheduler?.postTask) {
        return { message: 'scheduler.postTask ready' };
      }
      throw new Error('scheduler.postTask unavailable');
    }
  },
  {
    id: 'ambient-light',
    label: 'Check Ambient Light Sensor',
    run: () => {
      if ('AmbientLightSensor' in window) {
        return { message: 'AmbientLightSensor constructor present' };
      }
      throw new Error('Ambient Light Sensor unavailable');
    }
  },
  {
    id: 'magnetometer',
    label: 'Check Magnetometer support',
    run: () => {
      if ('Magnetometer' in window || 'AbsoluteOrientationSensor' in window) {
        return { message: 'Orientation sensors available' };
      }
      throw new Error('Magnetometer unavailable');
    }
  },
  {
    id: 'screen-orientation',
    label: 'Check Screen Orientation API',
    run: () => {
      if ('orientation' in screen && screen.orientation?.type) {
        return { message: `Orientation ${screen.orientation.type}` };
      }
      throw new Error('Screen Orientation API unavailable');
    }
  },
  {
    id: 'clipboard-write',
    label: 'Check clipboard write capability',
    run: async () => {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API unavailable');
      }
      const status = await getPermissionStatus('clipboard-write');
      if (status.state === 'denied') {
        throw new Error('Clipboard write denied');
      }
      if (status.state === 'granted') {
        return { message: 'Clipboard write granted' };
      }
      throw new Error('Clipboard write permission not granted');
    }
  },
  {
    id: 'share-target',
    label: 'Check Web Share Target capability',
    run: () => {
      if ('launchQueue' in window || navigator.canShare) {
        return { message: 'Share target primitives detected' };
      }
      throw new Error('Share target APIs unavailable');
    }
  },
  {
    id: 'media-session',
    label: 'Check Media Session API',
    run: () => {
      if ('mediaSession' in navigator) {
        return { message: 'navigator.mediaSession detected' };
      }
      throw new Error('Media Session API unavailable');
    }
  },
  {
    id: 'periodic-sync',
    label: 'Check Periodic Background Sync',
    run: async () => {
      if (!('serviceWorker' in navigator) || !('permissions' in navigator)) {
        throw new Error('Prerequisites unavailable');
      }
      const status = await getPermissionStatus('periodic-background-sync');
      if (status.state === 'granted') {
        return { message: 'Periodic background sync granted' };
      }
      throw new Error(`Periodic background sync: ${status.state}`);
    }
  },
  {
    id: 'handwriting-recognition',
    label: 'Check handwriting recognition availability',
    run: () => {
      if ('queryLocalFonts' in navigator) {
        return { message: 'Local font access detected (used by handwriting recognition)' };
      }
      throw new Error('Handwriting recognition prerequisites unavailable');
    }
  },
  {
    id: 'virtual-keyboard',
    label: 'Check Virtual Keyboard API',
    run: () => {
      if ('virtualKeyboard' in navigator) {
        return { message: 'navigator.virtualKeyboard detected' };
      }
      throw new Error('Virtual Keyboard API unavailable');
    }
  }
];

const items = new Map();

tests.forEach((test, index) => {
  const item = document.createElement('li');
  item.className = 'check-item';
  item.dataset.status = 'pending';
  item.dataset.index = String(index + 1);

  const icon = document.createElement('span');
  icon.className = 'check-icon';

  const text = document.createElement('span');
  text.className = 'check-text';
  text.textContent = test.label;

  item.append(icon, text);
  testsList.appendChild(item);

  items.set(test.id, { element: item, icon, text, label: test.label });
});

let isRunning = false;

async function runTestsSequentially() {
  if (isRunning) {
    return;
  }
  isRunning = true;
  startButton.disabled = true;
  startButton.textContent = 'Running…';
  progressNote.textContent = 'Starting diagnostic sweep…';

  for (let i = 0; i < tests.length; i += 1) {
    const test = tests[i];
    const item = items.get(test.id);
    if (!item) {
      continue;
    }

    updateItemStatus(item, 'running', `${test.label} – checking…`);
    progressNote.textContent = `Running ${i + 1} of ${tests.length}: ${test.label}`;
    await wait(350);

    try {
      const result = await test.run();
      const message = result?.message || 'Success';
      updateItemStatus(item, 'passed', `${test.label} – ${message}`);
    } catch (error) {
      const message = error?.message || 'Failed';
      updateItemStatus(item, 'failed', `${test.label} – ${message}`);
    }

    await wait(220);
  }

  progressNote.textContent = 'Diagnostic sweep complete. You can rerun anytime.';
  startButton.disabled = false;
  startButton.textContent = 'Run Again';
  isRunning = false;
}

function updateItemStatus(item, status, message) {
  item.element.dataset.status = status;
  item.text.textContent = message;
}

startButton.addEventListener('click', () => {
  tests.forEach((test) => {
    const item = items.get(test.id);
    if (!item) {
      return;
    }
    updateItemStatus(item, 'pending', item.label);
  });
  runTestsSequentially();
});
