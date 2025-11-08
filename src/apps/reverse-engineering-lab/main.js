import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const APP_TITLE = 'Protocol Decoder Lab';
const ACCENT = '#9d4edd';

const SAMPLE_PAYLOADS = [
  {
    id: 'base64-json',
    label: 'Base64 → JSON profile',
    data: 'eyJpZCI6ICJjaGF0LWFpLWFnZW50IiwiZmxhZyI6ICJhbmFseXNpc19wcm90b2NvbCIsImRhdGEiOiB7Im5hbWUiOiAiRmxpZ2h0IFJlY29yZCIsInRpbWVzdGFtcCI6ICIyMDI1LTEwLTI1VDE2OjM3OjAwWiIsImZlYXR1cmVzIjogWyJjbGllbnQiLCJwcml2YXRlIiwiY2hlY2tzdW1zIl19fQ=='
  },
  {
    id: 'hex-http',
    label: 'Hex → HTTP request',
    data:
      '474554202f6170692f76312f70696e6720485454502f312e310a557365722d4167656e743a2050726f746f636f6c2d496e73706563746f720a4163636570743a206170706c69636174696f6e2f6a736f6e0a486f73743a206578616d706c652d636f72652e6170700a0a5b2274657374696e67222c20747275655d0a'
  },
  {
    id: 'jwt',
    label: 'JWT access token',
    data:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiAidXNlci0xMjMiLCJpc3MiOiAiZGVidWdnaW5nLWxhYiIsImV4cCI6IDE3MDA2MjQwMDAsInNjb3BlcyI6IFsiZGVjb2RlIiwgImV4cGxhaW4iXX0.pmbsiTppVbNQWcV9zVQlC8eh6-DZTn5Ar72Xd1LckM8'
  },
  {
    id: 'binary-text',
    label: 'Binary → ASCII hint',
    data: '01001000 01101001 01101110 01110100 01110011 00100000 01100001 01110010 01100101 00100000 01001000 01100101 01110010 01100101'
  }
];

const { body } = createAppShell({
  title: APP_TITLE,
  description:
    'Paste unknown byte strings, encoded payloads, or cryptic protocol dumps. The lab runs multiple heuristics to spot encodings, decode layers, and identify common formats.',
  accent: ACCENT,
  status: 'Beta'
});

const ui = buildUi();
body.appendChild(ui.root);

function buildUi() {
  const root = document.createElement('div');
  root.className = 'decoder-layout';

  const inputPanel = document.createElement('section');
  inputPanel.className = 'panel input-panel';

  const inputHeader = document.createElement('header');
  inputHeader.className = 'panel-header';
  const inputTitle = document.createElement('h2');
  inputTitle.textContent = 'Paste data to inspect';
  const inputHelp = document.createElement('p');
  inputHelp.textContent = 'Large blobs are welcome. Use ⌘⏎ / Ctrl+Enter to analyze quickly.';
  inputHeader.append(inputTitle, inputHelp);

  const inputLabel = document.createElement('label');
  inputLabel.className = 'input-label';
  inputLabel.innerHTML = '<span>Raw payload</span>';

  const textarea = document.createElement('textarea');
  textarea.rows = 16;
  textarea.spellcheck = false;
  textarea.placeholder =
    'Paste binary, Base64, hex, JWTs, PEM blocks, HTTP transcripts, URL encoded forms, or anything suspicious...';
  inputLabel.appendChild(textarea);

  const controls = document.createElement('div');
  controls.className = 'controls';

  const analyzeButton = document.createElement('button');
  analyzeButton.type = 'button';
  analyzeButton.className = 'primary';
  analyzeButton.textContent = 'Run analysis';

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.textContent = 'Clear';

  const samplePicker = document.createElement('select');
  samplePicker.className = 'sample-picker';
  samplePicker.setAttribute('aria-label', 'Load a sample payload');
  samplePicker.innerHTML = [
    '<option value="">Load sample…</option>',
    ...SAMPLE_PAYLOADS.map((sample) => `<option value="${sample.id}">${sample.label}</option>`)
  ].join('');

  controls.append(analyzeButton, clearButton, samplePicker);

  const statusLine = document.createElement('div');
  statusLine.className = 'status-line';
  statusLine.setAttribute('role', 'status');
  statusLine.setAttribute('aria-live', 'polite');
  statusLine.textContent = 'Awaiting input.';

  inputPanel.append(inputHeader, inputLabel, controls, statusLine);

  const resultsPanel = document.createElement('section');
  resultsPanel.className = 'panel results-panel';

  const resultsHeader = document.createElement('header');
  resultsHeader.className = 'panel-header';
  const resultsTitle = document.createElement('h2');
  resultsTitle.textContent = 'Findings';
  const resultsMeta = document.createElement('p');
  resultsMeta.className = 'results-meta';
  resultsMeta.textContent = 'Nothing analyzed yet.';
  resultsHeader.append(resultsTitle, resultsMeta);

  const resultsList = document.createElement('div');
  resultsList.className = 'results-list';

  resultsPanel.append(resultsHeader, resultsList);

  root.append(inputPanel, resultsPanel);

    const bindings = { resultsList, statusLine, resultsMeta, analyzeButton, clearButton, samplePicker };

    analyzeButton.addEventListener('click', () => {
      handleAnalyze(textarea, bindings);
    });
    textarea.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        handleAnalyze(textarea, bindings);
      }
    });

    clearButton.addEventListener('click', () => {
      textarea.value = '';
      resultsList.innerHTML = '';
      resultsMeta.textContent = 'Cleared.';
      statusLine.textContent = 'Input cleared.';
    });

    samplePicker.addEventListener('change', () => {
      const selected = SAMPLE_PAYLOADS.find((sample) => sample.id === samplePicker.value);
      if (!selected) return;
      textarea.value = selected.data;
      statusLine.textContent = `Loaded sample: ${selected.label}`;
      samplePicker.value = '';
      handleAnalyze(textarea, bindings);
    });

  return {
    root,
    textarea,
    analyzeButton,
    clearButton,
    resultsList,
    statusLine,
    resultsMeta,
    samplePicker
  };
}

function handleAnalyze(textarea, uiBindings) {
  const { resultsList, statusLine, resultsMeta, analyzeButton, clearButton, samplePicker } = uiBindings;
  const raw = textarea.value;
  if (!raw || !raw.trim()) {
    statusLine.textContent = 'Paste some data to get started.';
    return;
  }

  setBusy(true);
  statusLine.textContent = 'Running heuristics…';

    window.setTimeout(() => {
      try {
        const analysis = runAnalysis(raw);
        renderResults(analysis, { resultsList, resultsMeta, statusLine });
      } catch (error) {
        console.error(error);
        statusLine.textContent = 'Analyzer crashed. See console for details.';
        resultsMeta.textContent = 'Analysis failed.';
      } finally {
        setBusy(false);
      }
    }, 16);

  function setBusy(flag) {
    [analyzeButton, clearButton, samplePicker].forEach((control) => {
      control.disabled = flag;
      control.classList.toggle('is-busy', flag);
    });
  }
}

function runAnalysis(raw) {
  const trimmed = raw.trim();
  const context = { raw, trimmed };
  const results = [];

  results.push(buildInputOverview(context));

  const directObservations = detectDirectPatterns(context);
  results.push(...directObservations);

  const strategyResults = [
    tryJwtDecode(context),
    tryUrlDecoding(context),
    tryBase64Decode(context, false),
    tryBase64Decode(context, true),
    tryHexDecode(context),
    tryBinaryDecode(context),
    tryBase32Decode(context),
    tryPemInsights(context),
    tryRot13(context),
    tryCaesar(context)
  ]
    .flat()
    .filter(Boolean);

  results.push(...strategyResults);

  const deduped = dedupeResults(results);
  deduped.sort(sortResults);

  const headlineCount = deduped.filter((result) => result.severity === 'success' || result.rank <= 1).length;
  const summary =
    headlineCount > 0
      ? `Detected ${headlineCount} promising clue${headlineCount === 1 ? '' : 's'}.`
      : 'No strong matches found, but summaries are provided.';

  return { summary, results: deduped, headlineCount };
}

function renderResults(analysis, elements) {
  const { resultsList, resultsMeta, statusLine } = elements;
  resultsList.innerHTML = '';

  if (!analysis.results.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No insights produced. Try trimming whitespace or selecting a different decoder.';
    resultsList.appendChild(empty);
  } else {
    analysis.results.forEach((result) => resultsList.appendChild(createResultCard(result)));
  }

  resultsMeta.textContent = `${analysis.results.length} result${analysis.results.length === 1 ? '' : 's'} · ${analysis.summary}`;
  statusLine.textContent = analysis.summary;
}

function buildInputOverview({ raw, trimmed }) {
  const lines = raw ? raw.split(/\r?\n/) : [];
  const asciiRatio = computePrintableRatio(raw);
  const whitespaceRatio = raw.length ? raw.replace(/[^\s]/g, '').length / raw.length : 0;
  const digitsRatio = raw.length ? raw.replace(/\D/g, '').length / raw.length : 0;
  const unique = new Set(raw).size;

  const summary = `${formatNumber(raw.length)} characters · ${formatNumber(lines.length)} line${
    lines.length === 1 ? '' : 's'
  } · ${Math.round(asciiRatio * 100)}% printable ASCII`;

  const details = [
    { label: 'Characters', value: formatNumber(raw.length) },
    { label: 'Lines', value: formatNumber(lines.length) },
    { label: 'Printable ASCII', value: formatPercent(asciiRatio) },
    { label: 'Whitespace', value: formatPercent(whitespaceRatio) },
    { label: 'Digits', value: formatPercent(digitsRatio) },
    { label: 'Unique symbols', value: formatNumber(unique) }
  ];

  const firstLine = trimmed.split(/\r?\n/)[0] ?? '';
  const insights = [];
  if (/^-----BEGIN [A-Z ]+-----/.test(trimmed)) {
    insights.push('Starts with a PEM block header.');
  }
  if (/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(firstLine)) {
    insights.push('Looks like a JSON Web Token (JWT).');
  }
  if (/^[0-9a-fA-F\s:]+$/.test(trimmed) && trimmed.replace(/[\s:]/g, '').length > 8) {
    insights.push('Hexadecimal characters dominate the input.');
  }

  return makeResult({
    id: 'input-overview',
    label: 'Input overview',
    summary,
    details,
    insights,
    preview: createPreview(firstLine, 120),
    previewLabel: 'First line',
    rank: 0,
    severity: 'neutral'
  });
}

function detectDirectPatterns({ trimmed }) {
  const results = [];

  if (!trimmed) {
    return results;
  }

  if (/^{.*}$/s.test(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed);
      results.push(
        makeResult({
          id: 'json-direct',
          label: 'JSON structure detected',
          summary: 'Top-level input parses cleanly as JSON.',
          insights: ['Parsed as UTF-8 JSON without conversion.'],
          preview: JSON.stringify(parsed, null, 2).slice(0, 600),
          previewIsCode: true,
          confidence: 0.9,
          rank: 1,
          severity: 'success'
        })
      );
    } catch (error) {
      // Ignore parse errors.
    }
  }

  if (/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s/i.test(trimmed)) {
    const lines = trimmed.split(/\r?\n/);
    const hostLine = lines.find((line) => /^Host:/i.test(line));
    results.push(
      makeResult({
        id: 'http-direct',
        label: 'HTTP request detected',
        summary: 'Input resembles a raw HTTP request.',
        insights: hostLine ? [`Host header: ${hostLine.replace(/^Host:\s*/i, '')}`] : [],
        preview: createPreview(trimmed, 500),
        previewIsCode: true,
        confidence: 0.85,
        rank: 1,
        severity: 'success'
      })
    );
  }

  return results;
}

function tryBase64Decode(context, urlSafe) {
  const { trimmed } = context;
  if (!trimmed) return null;

  const sanitized = trimmed.replace(/\s+/g, '');
  const base64Pattern = urlSafe ? /^[A-Za-z0-9_\-=]+$/ : /^[A-Za-z0-9+/=]+$/;
  if (!base64Pattern.test(sanitized) || sanitized.length < 8) {
    return null;
  }

  if (urlSafe && !/[-_]/.test(sanitized)) {
    return null;
  }

  if (!urlSafe && /[-_]/.test(sanitized)) {
    return null;
  }

  const normalized = urlSafe ? sanitized.replace(/-/g, '+').replace(/_/g, '/') : sanitized;
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');

  try {
    const bytes = base64ToBytes(padded);
    const interpretation = interpretBytes(bytes);
    const summaryParts = [`Decoded ${formatNumber(bytes.length)} bytes.`];
    if (interpretation.signature) {
      summaryParts.push(interpretation.signature.description);
    }
    if (interpretation.compression) {
      summaryParts.push(interpretation.compression);
    }
    if (interpretation.json) {
      summaryParts.push('Contains valid JSON.');
    } else if (interpretation.asciiConfidence > 0.75) {
      summaryParts.push('Looks like readable UTF-8 text.');
    }

    return makeResult({
      id: urlSafe ? 'base64url' : 'base64',
      label: urlSafe ? 'Base64 (URL-safe) decode' : 'Base64 decode',
      summary: summaryParts.join(' '),
      confidence: Math.max(0.4, interpretation.asciiConfidence),
      insights: interpretation.insights,
      preview: interpretation.json
        ? JSON.stringify(interpretation.json, null, 2).slice(0, 600)
        : interpretation.preview,
      previewIsCode: Boolean(interpretation.json),
      previewLabel: interpretation.json ? 'Decoded JSON' : 'Decoded preview',
      details: [
        { label: 'Bytes', value: formatNumber(bytes.length) },
        { label: 'ASCII confidence', value: formatPercent(interpretation.asciiConfidence) }
      ],
      textOutput: interpretation.text,
      bytes,
      rank: interpretation.signature ? 1 : 2,
      severity: interpretation.json || interpretation.signature ? 'success' : 'info'
    });
  } catch (error) {
    return makeResult({
      id: urlSafe ? 'base64url-error' : 'base64-error',
      label: urlSafe ? 'Base64 (URL-safe) decode' : 'Base64 decode',
      summary: 'Decoding failed—input may not actually be Base64.',
      details: [{ label: 'Reason', value: error.message }],
      rank: 4,
      severity: 'warn'
    });
  }
}

function tryHexDecode({ trimmed }) {
  if (!trimmed) return null;
  if (!/^[0-9a-fA-F\s:]+$/.test(trimmed)) return null;

  const sanitized = trimmed.replace(/[\s:]/g, '');
  if (sanitized.length % 2 !== 0 || sanitized.length < 8) return null;

  try {
    const bytes = hexToBytes(sanitized);
    const interpretation = interpretBytes(bytes);
    const summaryParts = [`Converted ${formatNumber(bytes.length)} byte hex stream.`];
    if (interpretation.signature) {
      summaryParts.push(interpretation.signature.description);
    }
    if (interpretation.compression) {
      summaryParts.push(interpretation.compression);
    }
    if (interpretation.json) {
      summaryParts.push('Contains JSON payload.');
    } else if (interpretation.asciiConfidence > 0.65) {
      summaryParts.push('Likely ASCII/UTF-8 text.');
    }

    return makeResult({
      id: 'hex-decode',
      label: 'Hex decode',
      summary: summaryParts.join(' '),
      confidence: Math.max(0.4, interpretation.asciiConfidence),
      insights: interpretation.insights,
      preview: interpretation.json
        ? JSON.stringify(interpretation.json, null, 2).slice(0, 600)
        : interpretation.preview,
      previewIsCode: Boolean(interpretation.json),
      previewLabel: interpretation.json ? 'Decoded JSON' : 'Decoded preview',
      details: [
        { label: 'Bytes', value: formatNumber(bytes.length) },
        { label: 'ASCII confidence', value: formatPercent(interpretation.asciiConfidence) }
      ],
      textOutput: interpretation.text,
      bytes,
      rank: interpretation.signature ? 1 : 2,
      severity: interpretation.signature ? 'success' : 'info'
    });
  } catch (error) {
    return makeResult({
      id: 'hex-error',
      label: 'Hex decode',
      summary: 'Could not parse hex stream.',
      details: [{ label: 'Reason', value: error.message }],
      rank: 4,
      severity: 'warn'
    });
  }
}

function tryBinaryDecode({ trimmed }) {
  if (!trimmed) return null;
  if (!/^[01\s]+$/.test(trimmed)) return null;

  const sanitized = trimmed.replace(/\s+/g, '');
  if (sanitized.length % 8 !== 0 || sanitized.length < 16) return null;

  const bytes = binaryToBytes(sanitized);
  const interpretation = interpretBytes(bytes);

  return makeResult({
    id: 'binary-decode',
    label: 'Binary buffer decode',
    summary: `Interpreted ${bytes.length} bytes from binary string. ${interpretation.asciiConfidence > 0.6 ? 'Likely readable text.' : ''}`,
    confidence: Math.max(0.35, interpretation.asciiConfidence),
    insights: interpretation.insights,
    preview: interpretation.preview,
    previewLabel: 'Decoded preview',
    textOutput: interpretation.text,
    bytes,
    rank: 2,
    severity: interpretation.asciiConfidence > 0.7 ? 'success' : 'info'
  });
}

function tryBase32Decode({ trimmed }) {
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z2-7=]+$/.test(normalized) || normalized.length < 8) return null;

  try {
    const bytes = base32ToBytes(normalized);
    const interpretation = interpretBytes(bytes);
    return makeResult({
      id: 'base32-decode',
      label: 'Base32 decode',
      summary: `Decoded ${formatNumber(bytes.length)} bytes from Base32 alphabet.`,
      confidence: Math.max(0.35, interpretation.asciiConfidence),
      insights: interpretation.insights,
      preview: interpretation.preview,
      previewLabel: 'Decoded preview',
      textOutput: interpretation.text,
      bytes,
      rank: 3,
      severity: interpretation.asciiConfidence > 0.65 ? 'info' : 'warn'
    });
  } catch (error) {
    return makeResult({
      id: 'base32-error',
      label: 'Base32 decode',
      summary: 'Failed to decode using Base32 alphabet.',
      details: [{ label: 'Reason', value: error.message }],
      rank: 4,
      severity: 'warn'
    });
  }
}

function tryUrlDecoding({ trimmed }) {
  if (!trimmed) return null;
  if (!/%[0-9A-Fa-f]{2}/.test(trimmed) && !trimmed.includes('+')) return null;
  try {
    const decoded = decodeURIComponent(trimmed.replace(/\+/g, ' '));
    const asciiConfidence = computePrintableRatio(decoded);
    const preview = createPreview(decoded, 500);
    return makeResult({
      id: 'url-decode',
      label: 'URL decoding',
      summary: 'Decoded percent-encoding and plus signs. Consider re-running analysis on the result.',
      confidence: asciiConfidence,
      preview,
      previewLabel: 'Decoded text',
      textOutput: decoded,
      rank: 2,
      severity: 'info'
    });
  } catch (error) {
    return makeResult({
      id: 'url-decode-error',
      label: 'URL decoding',
      summary: 'Detected URL encoding markers but decoding failed.',
      details: [{ label: 'Reason', value: error.message }],
      rank: 4,
      severity: 'warn'
    });
  }
}

function tryJwtDecode({ trimmed }) {
  if (!trimmed) return null;
  const parts = trimmed.split('.');
  if (parts.length !== 3) return null;
  if (!parts.every((part) => part.length > 0)) return null;

  try {
    const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[0])));
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[1])));
    const signatureBytes = base64UrlToBytes(parts[2]);

    const summary = `Header alg=${header.alg ?? 'unknown'} · Payload exp=${payload.exp ?? 'n/a'}`;
    const insights = [
      header.typ ? `Type: ${header.typ}` : null,
      payload.iss ? `Issuer: ${payload.iss}` : null,
      payload.sub ? `Subject: ${payload.sub}` : null,
      payload.aud ? `Audience: ${payload.aud}` : null
    ].filter(Boolean);

    return [
      makeResult({
        id: 'jwt-header',
        label: 'JWT header',
        summary: 'Base64URL-decoded header segment.',
        insights: [`Algorithm: ${header.alg ?? 'unknown'}`, header.kid ? `Key ID: ${header.kid}` : null].filter(Boolean),
        preview: JSON.stringify(header, null, 2),
        previewIsCode: true,
        previewLabel: 'Header JSON',
        rank: 1,
        severity: 'success'
      }),
      makeResult({
        id: 'jwt-payload',
        label: 'JWT payload',
        summary,
        insights,
        preview: JSON.stringify(payload, null, 2),
        previewIsCode: true,
        previewLabel: 'Payload JSON',
        rank: 1,
        severity: 'success'
      }),
      makeResult({
        id: 'jwt-signature',
        label: 'JWT signature bytes',
        summary: `Signature length: ${signatureBytes.length} bytes.`,
        preview: bytesToHexPreview(signatureBytes, 64),
        previewLabel: 'Signature hex',
        rank: 2,
        severity: 'info'
      })
    ];
  } catch (error) {
    return makeResult({
      id: 'jwt-error',
      label: 'JWT decode',
      summary: 'Input resembles a JWT but segments failed to decode.',
      details: [{ label: 'Reason', value: error.message }],
      rank: 3,
      severity: 'warn'
    });
  }
}

function tryPemInsights({ trimmed }) {
  if (!trimmed.startsWith('-----BEGIN')) return null;

  const headerLine = trimmed.split(/\r?\n/, 1)[0];
  const type = headerLine.replace(/-----BEGIN\s+/, '').replace(/-----$/, '');
  const body = trimmed
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => !line.startsWith('-----END'))
    .join('');

  const base64Result = tryBase64Decode({ trimmed: body }, false);

  return [
    makeResult({
      id: 'pem-insight',
      label: 'PEM container detected',
      summary: `PEM type: ${type || 'Unknown'}`,
      insights: ['Consider using the decoded result to inspect the DER payload.'],
      rank: 1,
      severity: 'success'
    }),
    base64Result
  ].filter(Boolean);
}

function tryRot13({ trimmed }) {
  if (!/[A-Za-z]/.test(trimmed)) return null;
  const decoded = applyRot(trimmed, 13);
  const asciiConfidence = computePrintableRatio(decoded);
  const score = englishScore(decoded);
  if (score < 0.1) {
    return null;
  }
  return makeResult({
    id: 'rot13',
    label: 'ROT13',
    summary: 'Applying ROT13 yields text with English-like structure.',
    preview: createPreview(decoded, 500),
    previewLabel: 'ROT13 output',
    textOutput: decoded,
    confidence: Math.min(1, (asciiConfidence + score) / 2),
    rank: 3,
    severity: 'info'
  });
}

function tryCaesar({ trimmed }) {
  if (!/[A-Za-z]/.test(trimmed) || trimmed.length > 2048) return null;
  const candidates = [];
  for (let shift = 1; shift < 26; shift += 1) {
    const decoded = applyRot(trimmed, shift);
    const score = englishScore(decoded);
    if (score > 0.18) {
      candidates.push({ shift, decoded, score });
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, 3);

  const insights = top.map((candidate) => `Shift ${candidate.shift}: score ${(candidate.score * 100).toFixed(1)}`);
  return makeResult({
    id: 'caesar',
    label: 'Caesar cipher candidates',
    summary: `Top candidate uses shift ${top[0].shift}.`,
    insights,
    preview: createPreview(top[0].decoded, 400),
    previewLabel: `Shift ${top[0].shift} preview`,
    textOutput: top[0].decoded,
    confidence: top[0].score,
    rank: 3,
    severity: 'info'
  });
}

function dedupeResults(results) {
  const seen = new Set();
  const deduped = [];
  results.forEach((result) => {
    if (!result) return;
    const key = result.id;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(result);
  });
  return deduped;
}

function sortResults(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  const aConfidence = 'confidence' in a && typeof a.confidence === 'number' ? a.confidence : -1;
  const bConfidence = 'confidence' in b && typeof b.confidence === 'number' ? b.confidence : -1;
  if (aConfidence !== bConfidence) return bConfidence - aConfidence;
  return a.label.localeCompare(b.label);
}

function createResultCard(result) {
  const card = document.createElement('article');
  card.className = 'result-card';
  card.dataset.severity = result.severity ?? 'info';

  const header = document.createElement('header');
  header.className = 'result-header';

  const title = document.createElement('h3');
  title.textContent = result.label;
  header.appendChild(title);

  if (typeof result.confidence === 'number') {
    const confidence = document.createElement('span');
    confidence.className = 'confidence';
    confidence.textContent = `${Math.round(result.confidence * 100)}% confidence`;
    header.appendChild(confidence);
  }

  const summary = document.createElement('p');
  summary.className = 'result-summary';
  summary.textContent = result.summary;

  card.append(header, summary);

  if (result.insights && result.insights.length) {
    const list = document.createElement('ul');
    list.className = 'insight-list';
    result.insights.forEach((note) => {
      if (!note) return;
      const item = document.createElement('li');
      item.textContent = note;
      list.appendChild(item);
    });
    if (list.children.length) {
      card.appendChild(list);
    }
  }

  if (result.details && result.details.length) {
    const definition = document.createElement('dl');
    definition.className = 'result-details';
    result.details.forEach((detail) => {
      const dt = document.createElement('dt');
      dt.textContent = detail.label;
      const dd = document.createElement('dd');
      dd.textContent = detail.value;
      definition.append(dt, dd);
    });
    card.appendChild(definition);
  }

  if (result.preview) {
    const previewWrapper = document.createElement('div');
    previewWrapper.className = 'preview';
    if (result.previewLabel) {
      const label = document.createElement('div');
      label.className = 'preview-label';
      label.textContent = result.previewLabel;
      previewWrapper.appendChild(label);
    }
    const pre = document.createElement(result.previewIsCode ? 'pre' : 'textarea');
    if (result.previewIsCode) {
      pre.textContent = result.preview;
    } else {
      pre.readOnly = true;
      pre.value = result.preview;
      pre.rows = Math.min(12, Math.max(3, Math.ceil(result.preview.length / 80)));
      pre.spellcheck = false;
    }
    previewWrapper.appendChild(pre);
    card.appendChild(previewWrapper);
  }

  if (result.textOutput || result.bytes) {
    const actions = document.createElement('div');
    actions.className = 'result-actions';

    if (result.textOutput) {
      const copyText = document.createElement('button');
      copyText.type = 'button';
      copyText.textContent = 'Copy text';
      copyText.addEventListener('click', () => {
        navigator.clipboard
          .writeText(result.textOutput)
          .then(() => showToast(copyText, 'Copied text to clipboard'))
          .catch(() => showToast(copyText, 'Clipboard copy failed'));
      });
      actions.appendChild(copyText);
    }

    if (result.bytes) {
      const copyHex = document.createElement('button');
      copyHex.type = 'button';
      copyHex.textContent = 'Copy hex';
      const hexString = Array.from(result.bytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join(' ');
      copyHex.addEventListener('click', () => {
        navigator.clipboard
          .writeText(hexString)
          .then(() => showToast(copyHex, 'Copied hex to clipboard'))
          .catch(() => showToast(copyHex, 'Clipboard copy failed'));
      });
      actions.appendChild(copyHex);
    }

    if (actions.children.length) {
      card.appendChild(actions);
    }
  }

  return card;
}

function showToast(button, message) {
  button.classList.add('flash');
  button.setAttribute('data-toast', message);
  window.setTimeout(() => {
    button.classList.remove('flash');
    button.removeAttribute('data-toast');
  }, 1500);
}

function makeResult(options) {
  return {
    id: options.id,
    label: options.label,
    summary: options.summary,
    severity: options.severity ?? 'info',
    confidence: options.confidence,
    insights: options.insights ?? [],
    preview: options.preview,
    previewLabel: options.previewLabel,
    previewIsCode: options.previewIsCode ?? false,
    details: options.details ?? [],
    textOutput: options.textOutput,
    bytes: options.bytes,
    rank: options.rank ?? 3
  };
}

function computePrintableRatio(text) {
  if (!text || !text.length) return 0;
  let printable = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (
      (code >= 32 && code <= 126) ||
      code === 9 ||
      code === 10 ||
      code === 13 ||
      (code >= 128 && code <= 255 && text[i] !== '\uFFFD')
    ) {
      printable += 1;
    }
  }
  return printable / text.length;
}

function formatPercent(value) {
  return `${Math.round((value || 0) * 100)}%`;
}

function formatNumber(value) {
  return value.toLocaleString();
}

function createPreview(text, limit = 360) {
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}…`;
}

function bytesToHexPreview(bytes, max = 128) {
  if (!bytes || !bytes.length) return '';
  const slice = bytes.slice(0, max);
  const hex = Array.from(slice)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(' ');
  return bytes.length > max ? `${hex} …` : hex;
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return base64ToBytes(padded);
}

function hexToBytes(value) {
  if (value.length % 2 !== 0) {
    throw new Error('Hex length must be even.');
  }
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < value.length; i += 2) {
    bytes[i / 2] = parseInt(value.slice(i, i + 2), 16);
  }
  return bytes;
}

function binaryToBytes(binary) {
  const bytes = new Uint8Array(binary.length / 8);
  for (let i = 0; i < binary.length; i += 8) {
    bytes[i / 8] = parseInt(binary.slice(i, i + 8), 2);
  }
  return bytes;
}

function base32ToBytes(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const output = [];
  const cleaned = input.replace(/=+$/, '');

  for (let i = 0; i < cleaned.length; i += 1) {
    const char = cleaned[i];
    const idx = alphabet.indexOf(char);
    if (idx === -1) {
      throw new Error(`Invalid Base32 character: ${char}`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((value >> bits) & 0xff);
    }
  }

  return new Uint8Array(output);
}

function interpretBytes(bytes) {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const text = decoder.decode(bytes);
  const asciiConfidence = computePrintableRatio(text);
  const insights = [];

  let json = null;
  if (asciiConfidence > 0.6 && isLikelyJson(text)) {
    try {
      json = JSON.parse(text);
    } catch (error) {
      // ignore
    }
  }

  if (asciiConfidence > 0.75) {
    insights.push('Mostly printable UTF-8 text.');
  }

  if (json) {
    insights.push(`JSON keys: ${Object.keys(json).slice(0, 5).join(', ')}`);
  }

  if (looksLikeHttp(text)) {
    insights.push('Matches HTTP message structure.');
  }

  const signature = detectFileSignature(bytes);
  if (signature) {
    insights.push(signature.description);
  }

  const compression = detectCompression(bytes);
  if (compression) {
    insights.push(compression);
  }

  const preview =
    json && typeof json === 'object'
      ? JSON.stringify(json, null, 2)
      : asciiConfidence > 0.45
        ? createPreview(text, 600)
        : bytesToHexPreview(bytes, 256);

  return {
    text,
    asciiConfidence,
    insights,
    preview,
    json,
    signature,
    compression,
    bytes
  };
}

function detectFileSignature(bytes) {
  if (bytes.length < 4) return null;
  const signatureMap = [
    { magic: [0x50, 0x4b, 0x03, 0x04], description: 'ZIP archive (PKZIP)' },
    { magic: [0x25, 0x50, 0x44, 0x46], description: 'PDF document' },
    { magic: [0x89, 0x50, 0x4e, 0x47], description: 'PNG image' },
    { magic: [0xff, 0xd8, 0xff], description: 'JPEG image' },
    { magic: [0x47, 0x49, 0x46, 0x38], description: 'GIF image' },
    { magic: [0x42, 0x4d], description: 'BMP image' },
    { magic: [0x52, 0x49, 0x46, 0x46], description: 'RIFF container (WAV/AVI/WebP)' },
    { magic: [0x1f, 0x8b], description: 'GZIP compressed data' },
    { magic: [0x78, 0x9c], description: 'Zlib compressed stream' },
    { magic: [0x42, 0x5a, 0x68], description: 'BZip2 compressed data' },
    { magic: [0x7f, 0x45, 0x4c, 0x46], description: 'ELF executable' },
    { magic: [0xca, 0xfe, 0xba, 0xbe], description: 'Java class/JAR magic' }
  ];

  return signatureMap.find((entry) => entry.magic.every((value, index) => bytes[index] === value)) ?? null;
}

function detectCompression(bytes) {
  if (bytes.length < 2) return null;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    return 'GZIP signature detected.';
  }
  if (bytes[0] === 0x78 && (bytes[1] === 0x01 || bytes[1] === 0x9c || bytes[1] === 0xda)) {
    return 'Zlib/Deflate stream header detected.';
  }
  if (bytes[0] === 0x42 && bytes[1] === 0x5a && bytes[2] === 0x68) {
    return 'BZip2 compressed payload.';
  }
  return null;
}

function isLikelyJson(text) {
  const trimmed = text.trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) return false;
  return /[\]}]$/.test(trimmed);
}

function looksLikeHttp(text) {
  const lines = text.split(/\r?\n/);
  if (!lines.length) return false;
  if (/^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s+\S+\s+HTTP\/\d\.\d/i.test(lines[0])) {
    return true;
  }
  if (/^HTTP\/\d\.\d\s+\d{3}/.test(lines[0])) {
    return true;
  }
  return false;
}

function englishScore(text) {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let letters = 0;
  let common = 0;
  for (let i = 0; i < lower.length; i += 1) {
    const code = lower.charCodeAt(i);
    if (code >= 97 && code <= 122) letters += 1;
  }
  const length = lower.length || 1;
  if (lower.includes(' the ')) common += 1;
  if (lower.includes(' and ')) common += 1;
  if (lower.includes(' to ')) common += 1;
  const letterRatio = letters / length;
  return Math.min(1, letterRatio * 0.6 + common * 0.15);
}

function applyRot(text, shift) {
  return text.replace(/[A-Za-z]/g, (char) => {
    const base = char <= 'Z' ? 65 : 97;
    const code = char.charCodeAt(0) - base;
    const rotated = (code + shift) % 26;
    return String.fromCharCode(rotated + base);
  });
}
