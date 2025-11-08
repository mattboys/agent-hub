import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const ACCENT = '#3a86ff';
const RENDER_DELAY = 120;

const { body } = createAppShell({
  title: 'Quick Diff',
  description:
    'Paste two snippets and instantly see a character-by-character diff with precise highlights for insertions and deletions.',
  accent: ACCENT
});

const app = document.createElement('div');
app.className = 'quick-diff';

const inputGrid = document.createElement('div');
inputGrid.className = 'diff-input-grid';

const originalPanel = createInputPanel({
  heading: 'Original text',
  description: 'Drop the baseline snippet here. Deletions show up in red.',
  id: 'quick-diff-original',
  placeholder: 'Paste the earlier version…'
});

const revisedPanel = createInputPanel({
  heading: 'Modified text',
  description: 'Paste the changed snippet. Insertions glow in green.',
  id: 'quick-diff-revised',
  placeholder: 'Paste the newer version…'
});

inputGrid.append(originalPanel.card, revisedPanel.card);

const actionBar = document.createElement('div');
actionBar.className = 'diff-action-bar';

const swapButton = createActionButton('Swap sides');
const clearButton = createActionButton('Clear both');

actionBar.append(swapButton, clearButton);

const summaryUI = createSummaryBlock();
const resultsUI = createResultsBlock();

app.append(inputGrid, actionBar, summaryUI.wrapper, resultsUI.wrapper);
body.appendChild(app);

const state = {
  timer: null,
  diff: [],
  revision: 0
};

originalPanel.textarea.addEventListener('input', handleInput);
revisedPanel.textarea.addEventListener('input', handleInput);
swapButton.addEventListener('click', handleSwap);
clearButton.addEventListener('click', handleClear);

updateCounters(originalPanel, revisedPanel);
renderDiff();

function handleInput() {
  updateCounters(originalPanel, revisedPanel);
  scheduleDiff();
}

function handleSwap() {
  const originalValue = originalPanel.textarea.value;
  originalPanel.textarea.value = revisedPanel.textarea.value;
  revisedPanel.textarea.value = originalValue;
  updateCounters(originalPanel, revisedPanel);
  renderDiff(true);
}

function handleClear() {
  originalPanel.textarea.value = '';
  revisedPanel.textarea.value = '';
  updateCounters(originalPanel, revisedPanel);
  renderDiff(true);
}

function scheduleDiff() {
  if (state.timer) {
    clearTimeout(state.timer);
  }
  state.timer = setTimeout(() => {
    renderDiff();
    state.timer = null;
  }, RENDER_DELAY);
}

function renderDiff(force = false) {
  const originalValue = originalPanel.textarea.value;
  const revisedValue = revisedPanel.textarea.value;

  const key = `${originalValue.length}:${revisedValue.length}:${originalValue === revisedValue ? 'same' : 'diff'}`;
  if (!force && state.lastKey === key && !state.timer) {
    return;
  }
  state.lastKey = key;

  if (!originalValue && !revisedValue) {
    summaryUI.setEmpty();
    resultsUI.setEmpty();
    return;
  }

  const diff = diffStrings(originalValue, revisedValue);
  state.diff = diff;
  state.revision += 1;

  const metrics = summariseDiff(diff);
  summaryUI.render(metrics);
  resultsUI.render(diff);
}

function updateCounters(...panels) {
  panels.forEach((panel) => {
    const text = panel.textarea.value;
    panel.charCount.textContent = formatNumber(countCodePoints(text));
    panel.lineCount.textContent = formatNumber(countLines(text));
  });
}

function createInputPanel({ heading, description, id, placeholder }) {
  const card = document.createElement('article');
  card.className = 'diff-input-card';

  const header = document.createElement('div');
  header.className = 'diff-card-header';

  const title = document.createElement('h2');
  title.textContent = heading;

  const body = document.createElement('p');
  body.textContent = description;

  header.append(title, body);

  const fieldLabel = document.createElement('label');
  fieldLabel.className = 'diff-field-label';
  fieldLabel.setAttribute('for', id);
  fieldLabel.textContent = heading;

  const textarea = document.createElement('textarea');
  textarea.id = id;
  textarea.className = 'diff-input';
  textarea.placeholder = placeholder;
  textarea.autocapitalize = 'off';
  textarea.autocomplete = 'off';
  textarea.spellcheck = false;
  textarea.wrap = 'off';
  textarea.rows = 8;

  const footer = document.createElement('footer');
  footer.className = 'diff-input-meta';

  const charLabel = document.createElement('span');
  charLabel.className = 'diff-stat';
  charLabel.innerHTML = '<strong data-role="char-count">0</strong> chars';

  const lineLabel = document.createElement('span');
  lineLabel.className = 'diff-stat';
  lineLabel.innerHTML = '<strong data-role="line-count">0</strong> lines';

  footer.append(charLabel, lineLabel);

  card.append(header, fieldLabel, textarea, footer);

  return {
    card,
    textarea,
    charCount: charLabel.querySelector('[data-role="char-count"]'),
    lineCount: lineLabel.querySelector('[data-role="line-count"]')
  };
}

function createActionButton(label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ghost-button';
  button.textContent = label;
  return button;
}

function createSummaryBlock() {
  const wrapper = document.createElement('section');
  wrapper.className = 'diff-summary';
  wrapper.dataset.state = 'empty';

  const empty = document.createElement('p');
  empty.className = 'diff-empty';
  empty.textContent = 'Paste two snippets to see a live diff.';

  const grid = document.createElement('div');
  grid.className = 'diff-summary-grid';

  const matches = createSummaryStat('Matches', '0', 'Characters that stayed the same');
  const insertions = createSummaryStat('Insertions', '0', 'Green highlights in the modified text');
  const deletions = createSummaryStat('Deletions', '0', 'Red highlights from the original text');
  const delta = createSummaryStat('Length delta', '0', 'Difference in total characters (modified minus original)');

  grid.append(matches.card, insertions.card, deletions.card, delta.card);
  wrapper.append(empty, grid);

  return {
    wrapper,
    setEmpty() {
      wrapper.dataset.state = 'empty';
    },
    render(stats) {
      wrapper.dataset.state = 'ready';
      matches.value.textContent = formatNumber(stats.matches);
      insertions.value.textContent = formatNumber(stats.insertions);
      deletions.value.textContent = formatNumber(stats.deletions);
      const deltaValue = stats.insertions - stats.deletions;
      const sign = deltaValue > 0 ? '+' : '';
      delta.value.textContent = `${sign}${formatNumber(deltaValue)}`;
    }
  };
}

function createSummaryStat(title, value, hint) {
  const card = document.createElement('article');
  card.className = 'summary-card';

  const heading = document.createElement('h3');
  heading.textContent = title;

  const valueEl = document.createElement('span');
  valueEl.className = 'summary-value';
  valueEl.textContent = value;

  const hintEl = document.createElement('p');
  hintEl.textContent = hint;

  card.append(heading, valueEl, hintEl);
  return { card, value: valueEl };
}

function createResultsBlock() {
  const wrapper = document.createElement('section');
  wrapper.className = 'diff-results';
  wrapper.dataset.state = 'empty';

  const empty = document.createElement('p');
  empty.className = 'diff-empty';
  empty.textContent = 'Diff output will appear here.';

  const combined = document.createElement('article');
  combined.className = 'diff-card';

  const combinedHeader = document.createElement('div');
  combinedHeader.className = 'diff-card-header';
  combinedHeader.innerHTML = `
    <h2>Inline diff</h2>
    <p>Balanced output with insertions in green and deletions in red.</p>
  `;

  const combinedBody = document.createElement('div');
  combinedBody.className = 'diff-inline';
  combinedBody.setAttribute('role', 'presentation');

  combined.append(combinedHeader, combinedBody);

  const split = document.createElement('article');
  split.className = 'diff-card split-view';

  const splitHeader = document.createElement('div');
  splitHeader.className = 'diff-card-header';
  splitHeader.innerHTML = `
    <h2>Side-by-side view</h2>
    <p>Original on the left, modified on the right. Copy text directly from either side.</p>
  `;

  const paneGrid = document.createElement('div');
  paneGrid.className = 'diff-pane-grid';

  const originalPane = createDiffPane('Original');
  const revisedPane = createDiffPane('Modified');

  paneGrid.append(originalPane.card, revisedPane.card);
  split.append(splitHeader, paneGrid);

  wrapper.append(empty, combined, split);

  return {
    wrapper,
    setEmpty() {
      wrapper.dataset.state = 'empty';
      combinedBody.innerHTML = '';
      originalPane.content.innerHTML = '';
      revisedPane.content.innerHTML = '';
    },
    render(diff) {
      wrapper.dataset.state = 'ready';
      combinedBody.innerHTML = '';
      originalPane.content.innerHTML = '';
      revisedPane.content.innerHTML = '';

      diff.forEach((segment) => {
        renderSegment(combinedBody, segment, 'inline');
        renderSegment(originalPane.content, segment, 'original');
        renderSegment(revisedPane.content, segment, 'revised');
      });
    }
  };
}

function createDiffPane(title) {
  const card = document.createElement('section');
  card.className = 'diff-pane';

  const heading = document.createElement('header');
  heading.className = 'pane-header';
  heading.textContent = title;

  const content = document.createElement('div');
  content.className = 'pane-content';
  content.setAttribute('role', 'presentation');

  card.append(heading, content);
  return { card, content };
}

function renderSegment(target, segment, mode) {
  if (!segment.value) {
    return;
  }

  const span = document.createElement('span');
  let typeClass = segment.type;
  span.textContent = segment.value;

  if (mode === 'inline') {
    span.className = `diff-span diff-${typeClass}`;
    target.appendChild(span);
    return;
  }

  if (mode === 'original') {
    if (segment.type === 'insert') {
      span.className = 'diff-span diff-insert ghost';
      span.dataset.diffGhost = 'insertion';
    } else {
      span.className = `diff-span diff-${typeClass}`;
    }
  } else if (mode === 'revised') {
    if (segment.type === 'delete') {
      span.className = 'diff-span diff-delete ghost';
      span.dataset.diffGhost = 'deletion';
    } else {
      span.className = `diff-span diff-${typeClass}`;
    }
  }

  target.appendChild(span);
}

function summariseDiff(diff) {
  return diff.reduce(
    (acc, segment) => {
      const length = countCodePoints(segment.value || '');
      if (segment.type === 'equal') {
        acc.matches += length;
      } else if (segment.type === 'insert') {
        acc.insertions += length;
      } else if (segment.type === 'delete') {
        acc.deletions += length;
      }
      return acc;
    },
    {
      matches: 0,
      insertions: 0,
      deletions: 0
    }
  );
}

function diffStrings(a, b) {
  if (a === b) {
    return a ? [{ type: 'equal', value: a }] : [];
  }
  if (!a) {
    return [{ type: 'insert', value: b }];
  }
  if (!b) {
    return [{ type: 'delete', value: a }];
  }
  const aChars = Array.from(a);
  const bChars = Array.from(b);
  const raw = myersDiff(aChars, bChars);
  return mergeAdjacent(raw);
}

function myersDiff(a, b) {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const offset = max;
  const size = 2 * max + 3;
  const v = new Array(size).fill(-1);
  v[offset + 1] = 0;
  const trace = [];

  for (let d = 0; d <= max; d++) {
    for (let k = -d; k <= d; k += 2) {
      const kIndex = offset + k;
      let x;
      if (k === -d || (k !== d && v[kIndex - 1] < v[kIndex + 1])) {
        x = v[kIndex + 1];
      } else {
        x = v[kIndex - 1] + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      v[kIndex] = x;
      if (x >= n && y >= m) {
        trace.push(v.slice());
        return backtrack(trace, a, b, offset);
      }
    }
    trace.push(v.slice());
  }
  return [];
}

function backtrack(trace, a, b, offset) {
  let x = a.length;
  let y = b.length;
  const result = [];

  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d];
    const k = x - y;

    if (d === 0) {
      while (x > 0 && y > 0 && a[x - 1] === b[y - 1]) {
        x -= 1;
        y -= 1;
        result.push({ type: 'equal', value: a[x] });
      }
      break;
    }

    let prevK;
    if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }

    const prevX = v[offset + prevK];
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      x -= 1;
      y -= 1;
      result.push({ type: 'equal', value: a[x] });
    }

    if (prevX === x) {
      y -= 1;
      result.push({ type: 'insert', value: b[prevY] });
    } else {
      x -= 1;
      result.push({ type: 'delete', value: a[prevX] });
    }
  }

  return result.reverse();
}

function mergeAdjacent(ops) {
  const merged = [];
  for (const op of ops) {
    if (!op.value) continue;
    const last = merged[merged.length - 1];
    if (last && last.type === op.type) {
      last.value += op.value;
    } else {
      merged.push({ ...op });
    }
  }
  return merged;
}

function countCodePoints(text) {
  return Array.from(text).length;
}

function countLines(text) {
  if (!text) return 0;
  return text.split(/\r\n|\r|\n/).length;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}
