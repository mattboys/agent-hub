import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const { body } = createAppShell({
  title: 'Clipboard Alchemist',
  description:
    'Grant access once, then remix whatever text you have copied. Every action reads the clipboard, transforms it, and writes back the result instantly.',
  accent: '#5ae4a7'
});

if (!navigator.clipboard) {
  const warning = document.createElement('p');
  warning.textContent = 'Clipboard APIs are not available in this browser. Try the latest version of Chrome, Edge, or Safari.';
  warning.className = 'warning-banner';
  body.appendChild(warning);
} else {
  buildUi();
}

function buildUi() {
  const layout = document.createElement('div');
  layout.className = 'clipboard-layout';

  const actionsPanel = document.createElement('div');
  actionsPanel.className = 'actions-panel';

  const previewPanel = document.createElement('div');
  previewPanel.className = 'preview-panel';

  const status = document.createElement('div');
  status.className = 'status-toast';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const actionList = document.createElement('div');
  actionList.className = 'action-list';

  const findReplaceCard = document.createElement('div');
  findReplaceCard.className = 'action-card';
  findReplaceCard.innerHTML = `
    <header>
      <h3>Find &amp; replace</h3>
      <p>Swap all instances of a string with something new.</p>
    </header>
    <div class="find-replace-inputs">
      <label>
        <span>Find</span>
        <input type="text" placeholder="Text to find" />
      </label>
      <label>
        <span>Replace with</span>
        <input type="text" placeholder="Replacement" />
      </label>
      <button type="button" class="action-btn primary">Run replace</button>
    </div>
  `;

  const [findInput, replaceInput] = findReplaceCard.querySelectorAll('input');
  const replaceButton = findReplaceCard.querySelector('button');

  replaceButton.addEventListener('click', () => {
    const findValue = findInput.value;
    if (!findValue) {
      showStatus('Type something to find first.', true);
      return;
    }
    runAction({
      label: 'Find & replace',
      transform: (text) => text.split(findValue).join(replaceInput.value)
    });
  });

  const actionDefinitions = [
    {
      id: 'json-prettify',
      label: 'Beautify JSON',
      description: 'Parse and pretty-print clipboard JSON with 2-space indentation.',
      transform: (text) => {
        const parsed = JSON.parse(text);
        return JSON.stringify(parsed, null, 2);
      }
    },
    {
      id: 'json-minify',
      label: 'Minify JSON',
      description: 'Strip whitespace from JSON without changing its meaning.',
      transform: (text) => {
        const parsed = JSON.parse(text);
        return JSON.stringify(parsed);
      }
    },
    {
      id: 'url-encode',
      label: 'URL encode',
      description: 'Turns your text into a URL-safe string using encodeURIComponent.',
      transform: (text) => encodeURIComponent(text)
    },
    {
      id: 'url-decode',
      label: 'URL decode',
      description: 'Reverses URL encoding and restores readable characters.',
      transform: (text) => decodeURIComponent(text)
    }
  ];

  actionDefinitions.forEach((action) => {
    const card = document.createElement('article');
    card.className = 'action-card';
    card.innerHTML = `
      <header>
        <h3>${action.label}</h3>
        <p>${action.description}</p>
      </header>
    `;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-btn';
    button.textContent = 'Run on clipboard';
    button.addEventListener('click', () => runAction(action));

    card.appendChild(button);
    actionList.appendChild(card);
  });

  actionList.appendChild(findReplaceCard);

  const refreshButton = document.createElement('button');
  refreshButton.type = 'button';
  refreshButton.className = 'refresh-btn';
  refreshButton.textContent = 'Peek at clipboard';
  refreshButton.addEventListener('click', async () => {
    await previewClipboard();
  });

  const previewHeader = document.createElement('header');
  previewHeader.className = 'preview-header';
  previewHeader.innerHTML = `
    <div>
      <h3>Clipboard preview</h3>
      <p>We never send data anywhere—everything you see is rendered locally.</p>
    </div>
  `;
  previewHeader.appendChild(refreshButton);

  const sourceField = buildPreviewField('Before', 'Source clipboard text');
  const resultField = buildPreviewField('After', 'Result written back');

  previewPanel.append(previewHeader, sourceField.container, resultField.container);

  actionsPanel.append(actionList);

  layout.append(actionsPanel, previewPanel, status);
  body.appendChild(layout);

  let working = false;
  let toastTimer;

  async function runAction(action) {
    if (working) return;
    working = true;
    setBusy(true);
    try {
      const input = await navigator.clipboard.readText();
      sourceField.textarea.value = input;
      const output = action.transform(input);
      await navigator.clipboard.writeText(output);
      resultField.textarea.value = output;
      showStatus(`✅ ${action.label} completed and copied back.`);
    } catch (error) {
      console.error(error);
      showStatus(parseError(action.label, error), true);
    } finally {
      working = false;
      setBusy(false);
    }
  }

  async function previewClipboard() {
    if (working) return;
    setBusy(true);
    try {
      const input = await navigator.clipboard.readText();
      sourceField.textarea.value = input;
      showStatus('📋 Clipboard captured for preview.');
    } catch (error) {
      console.error(error);
      showStatus('Could not read from the clipboard. Ensure the page has permission.', true);
    } finally {
      setBusy(false);
    }
  }

  function buildPreviewField(label, ariaLabel) {
    const container = document.createElement('section');
    container.className = 'preview-field';
    container.innerHTML = `<div class="preview-label">${label}</div>`;
    const textarea = document.createElement('textarea');
    textarea.readOnly = true;
    textarea.rows = 6;
    textarea.spellcheck = false;
    textarea.setAttribute('aria-label', ariaLabel);
    container.appendChild(textarea);
    return { container, textarea };
  }

  function setBusy(isBusy) {
    const buttons = layout.querySelectorAll('button');
    buttons.forEach((btn) => {
      btn.disabled = isBusy;
      btn.classList.toggle('is-busy', isBusy);
    });
  }

  function showStatus(message, isError = false) {
    status.textContent = message;
    status.dataset.state = isError ? 'error' : 'ok';
    status.classList.add('visible');
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(() => {
      status.classList.remove('visible');
    }, 2600);
  }

  function parseError(actionLabel, error) {
    if (error instanceof SyntaxError) {
      return `⚠️ ${actionLabel} failed: clipboard data was not valid JSON.`;
    }
    if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        return 'Permission denied. Click the page, grant clipboard access, then try again.';
      }
      if (error.name === 'DataError') {
        return `⚠️ ${actionLabel} failed: decoding error. Is the text URL encoded?`;
      }
    }
    return `Something went sideways while running ${actionLabel}. Check the console for details.`;
  }

  // Prime the preview to prompt for clipboard permissions.
  previewClipboard();
}
