import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const APP_TITLE = 'PDF Forensic Analysis';
const ACCENT = '#e07a5f';

const { body } = createAppShell({
  title: APP_TITLE,
  description:
    'Upload a PDF to inspect low-level forensic details: version, features, embedded images, compression, fonts, and more. All analysis runs locally in your browser—nothing is sent to any server.',
  accent: ACCENT,
  status: 'Beta'
});

const ui = buildUi();
body.appendChild(ui.root);

function buildUi() {
  const root = document.createElement('div');
  root.className = 'forensic-layout';

  const inputPanel = document.createElement('section');
  inputPanel.className = 'panel input-panel';

  const inputHeader = document.createElement('header');
  inputHeader.className = 'panel-header';
  const inputTitle = document.createElement('h2');
  inputTitle.textContent = 'Upload PDF';
  const inputHelp = document.createElement('p');
  inputHelp.textContent = 'Drop a PDF file or click to browse. Analysis runs entirely in your browser.';
  inputHeader.append(inputTitle, inputHelp);

  const dropZone = document.createElement('div');
  dropZone.className = 'drop-zone';
  dropZone.innerHTML = `
    <div class="icon">📄</div>
    <p class="prompt">Drop PDF here or click to select</p>
    <p class="hint">Supports PDF 1.0–1.7</p>
    <input type="file" accept=".pdf,application/pdf" />
  `;

  const statusLine = document.createElement('div');
  statusLine.className = 'status-line';
  statusLine.setAttribute('role', 'status');
  statusLine.setAttribute('aria-live', 'polite');
  statusLine.textContent = 'Awaiting PDF upload.';

  inputPanel.append(inputHeader, dropZone, statusLine);

  const resultsPanel = document.createElement('section');
  resultsPanel.className = 'panel results-panel';

  const resultsHeader = document.createElement('header');
  resultsHeader.className = 'panel-header';
  const resultsTitle = document.createElement('h2');
  resultsTitle.textContent = 'Forensic Report';
  const resultsMeta = document.createElement('p');
  resultsMeta.className = 'results-meta';
  resultsMeta.textContent = 'Analysis results will appear here.';
  resultsHeader.append(resultsTitle, resultsMeta);

  const resultsList = document.createElement('div');
  resultsList.className = 'results-list';

  resultsPanel.append(resultsHeader, resultsList);

  root.append(inputPanel, resultsPanel);

  const fileInput = dropZone.querySelector('input[type="file"]');

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file?.type === 'application/pdf' || file?.name?.toLowerCase().endsWith('.pdf')) {
      handleFile(file, { resultsList, resultsMeta, statusLine });
    } else {
      statusLine.textContent = 'Please drop a PDF file.';
    }
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) {
      handleFile(file, { resultsList, resultsMeta, statusLine });
      fileInput.value = '';
    }
  });

  return {
    root,
    resultsList,
    statusLine,
    resultsMeta
  };
}

async function handleFile(file, elements) {
  const { resultsList, resultsMeta, statusLine } = elements;
  statusLine.textContent = `Analyzing ${file.name}…`;

  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const analysis = analyzePdf(bytes);
    renderResults(analysis, elements);
    statusLine.textContent = `Analysis complete. ${file.name} (${formatBytes(file.size)})`;
  } catch (error) {
    console.error(error);
    statusLine.textContent = `Analysis failed: ${error.message}`;
    resultsMeta.textContent = 'Error.';
    resultsList.innerHTML = '';
    const errCard = document.createElement('article');
    errCard.className = 'result-card';
    errCard.dataset.severity = 'warn';
    errCard.innerHTML = `
      <header class="result-header"><h3>Error</h3></header>
      <p class="result-summary">${escapeHtml(error.message)}</p>
    `;
    resultsList.appendChild(errCard);
  }
}

function analyzePdf(bytes) {
  const text = new TextDecoder('latin1').decode(bytes);
  const results = [];

  const version = parseVersion(text);
  results.push({
    id: 'version',
    label: 'PDF Version',
    severity: 'success',
    summary: `Header declares PDF ${version}.`,
    details: [{ label: 'Version', value: version }]
  });

  const stats = parseStats(text, bytes);
  results.push({
    id: 'stats',
    label: 'Document Statistics',
    severity: 'neutral',
    summary: `${stats.objectCount} objects, ${stats.streamCount} streams, ${formatBytes(bytes.length)} file size.`,
    details: [
      { label: 'File size', value: formatBytes(bytes.length) },
      { label: 'Indirect objects', value: String(stats.objectCount) },
      { label: 'Streams', value: String(stats.streamCount) },
      { label: 'Pages', value: String(stats.pageCount) }
    ]
  });

  const features = parseFeatures(text);
  if (features.length) {
    results.push({
      id: 'features',
      label: 'Features Used',
      severity: 'neutral',
      summary: features.join(', '),
      insights: features
    });
  }

  const compression = parseCompression(text);
  results.push({
    id: 'compression',
    label: 'Compression Analysis',
    severity: compression.filters.length ? 'success' : 'neutral',
    summary: compression.summary,
    details: compression.filters.map((f) => ({ label: f.name, value: f.count })),
    insights: compression.insights
  });

  const images = parseImages(text);
  if (images.length) {
    results.push({
      id: 'images',
      label: 'Embedded Images',
      severity: 'success',
      summary: `${images.length} image(s) found.`,
      details: [{ label: 'Count', value: String(images.length) }],
      images
    });
  } else {
    results.push({
      id: 'images',
      label: 'Embedded Images',
      severity: 'neutral',
      summary: 'No embedded images detected.'
    });
  }

  const fonts = parseFonts(text);
  if (fonts.length) {
    results.push({
      id: 'fonts',
      label: 'Fonts Used',
      severity: 'success',
      summary: `${fonts.length} font(s) referenced.`,
      fonts
    });
  } else {
    results.push({
      id: 'fonts',
      label: 'Fonts Used',
      severity: 'neutral',
      summary: 'No font references detected (may use only standard fonts).'
    });
  }

  const metadata = parseMetadata(text);
  if (Object.keys(metadata).length) {
    results.push({
      id: 'metadata',
      label: 'Document Metadata',
      severity: 'neutral',
      summary: 'Info dictionary entries.',
      details: Object.entries(metadata).map(([k, v]) => ({ label: k, value: v }))
    });
  }

  return { results };
}

function parseVersion(text) {
  const match = text.match(/%PDF-(\d+\.\d+)/);
  return match ? match[1] : 'unknown';
}

function parseStats(text, bytes) {
  const objectMatches = text.matchAll(/\b(\d+)\s+\d+\s+obj\b/g);
  const objectIds = new Set();
  for (const m of objectMatches) {
    objectIds.add(m[1]);
  }

  const streamCount = (text.match(/stream\s/gi) || []).length;
  const pageMatch = text.match(/\/Type\s*\/Page\b/gi);
  const pageCount = pageMatch ? pageMatch.length : 0;

  return {
    objectCount: objectIds.size,
    streamCount,
    pageCount,
    fileSize: bytes.length
  };
}

function parseFeatures(text) {
  const features = [];
  if (/\/AcroForm/.test(text)) features.push('AcroForm (form fields)');
  if (/\/JavaScript/.test(text)) features.push('JavaScript');
  if (/\/EmbeddedFiles/.test(text)) features.push('Embedded files');
  if (/\/XObject/.test(text)) features.push('XObjects');
  if (/\/Annots/.test(text)) features.push('Annotations');
  if (/\/Encrypt/.test(text)) features.push('Encryption');
  if (/\/Metadata\s+\d+\s+\d+\s+R/.test(text)) features.push('XMP metadata');
  if (/\/OutputIntents/.test(text)) features.push('Output intents');
  if (/\/OpenAction/.test(text)) features.push('Open action');
  if (/\/AA\b/.test(text)) features.push('Additional actions');
  return features;
}

function parseCompression(text) {
  const filterRegex = /\/(FlateDecode|DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode|LZWDecode|ASCIIHexDecode|ASCII85Decode|RunLengthDecode)\b/g;
  const counts = {};
  let m;
  while ((m = filterRegex.exec(text)) !== null) {
    counts[m[1]] = (counts[m[1]] || 0) + 1;
  }

  const filters = Object.entries(counts).map(([name, count]) => ({ name, count }));
  const total = filters.reduce((s, f) => s + f.count, 0);
  const summary = total
    ? `${total} compressed stream(s) using ${filters.map((f) => f.name).join(', ')}.`
    : 'No compression filters detected (content may be uncompressed).';

  const insights = [];
  if (counts.FlateDecode) insights.push('FlateDecode: zlib/deflate compression (common).');
  if (counts.DCTDecode) insights.push('DCTDecode: JPEG compression for images.');
  if (counts.JPXDecode) insights.push('JPXDecode: JPEG2000 compression.');
  if (counts.CCITTFaxDecode) insights.push('CCITTFaxDecode: fax-style compression (often for scans).');

  return { filters, summary, insights };
}

function parseImages(text) {
  const images = [];
  const objRegex = /\b\d+\s+\d+\s+obj\s+([\s\S]*?)\bendobj\b/g;
  let objMatch;
  while ((objMatch = objRegex.exec(text)) !== null) {
    const objContent = objMatch[1];
    if (!/\/Subtype\s*\/Image\b/.test(objContent)) continue;

    const width = objContent.match(/\/Width\s+(\d+)/)?.[1];
    const height = objContent.match(/\/Height\s+(\d+)/)?.[1];
    const bpc = objContent.match(/\/BitsPerComponent\s+(\d+)/)?.[1];
    const filterMatch = objContent.match(/\/Filter\s*(?:\/(\w+)|\[([^\]]+)\])/);
    let filter = 'None';
    if (filterMatch) {
      if (filterMatch[1]) filter = filterMatch[1];
      else if (filterMatch[2]) filter = filterMatch[2].replace(/\//g, '').trim();
    }

    let colorSpace = 'Unknown';
    const csMatch = objContent.match(/\/ColorSpace\s*\/(\w+)/);
    if (csMatch) {
      colorSpace = csMatch[1];
      if (colorSpace === 'DeviceRGB') colorSpace = 'RGB';
      else if (colorSpace === 'DeviceGray') colorSpace = 'Grayscale';
      else if (colorSpace === 'DeviceCMYK') colorSpace = 'CMYK';
      else if (colorSpace === 'Indexed') colorSpace = 'Indexed (palette)';
    }

    const lengthMatch = objContent.match(/\/Length\s+(\d+)/);
    let size = 0;
    if (lengthMatch) {
      size = parseInt(lengthMatch[1], 10);
    } else {
      const streamMatch = objContent.match(/stream\s*[\r\n]+([\s\S]*?)endstream/);
      if (streamMatch) {
        size = streamMatch[1].replace(/\r\n/g, '\n').trim().length;
      }
    }

    images.push({
      width: width || '?',
      height: height || '?',
      colorSpace,
      bitsPerComponent: bpc || '?',
      filter,
      size: size ? formatBytes(size) : '?'
    });
  }
  return images;
}

function parseFonts(text) {
  const fonts = new Set();
  const fontRegex = /\/(F\d+|Font\d+)\s+(\d+)\s+\d+\s+R/g;
  let m;
  while ((m = fontRegex.exec(text)) !== null) {
    fonts.add(m[1]);
  }

  const baseFontRegex = /\/BaseFont\s*\/([^\s\/\[\]<>()]+)/g;
  while ((m = baseFontRegex.exec(text)) !== null) {
    let name = m[1];
    if (name.startsWith('+')) name = name.slice(1);
    if (name && !/^[A-Z]{7}$/.test(name)) {
      fonts.add(name);
    }
  }

  const subtypeFontRegex = /\/Subtype\s*\/Type1\b[^>]*?\/BaseFont\s*\/([^\s\/\[\]<>()]+)/g;
  while ((m = subtypeFontRegex.exec(text)) !== null) {
    fonts.add(m[1]);
  }

  return Array.from(fonts).filter((f) => f.length > 1 && f.length < 80).slice(0, 50);
}

function parseMetadata(text) {
  const metadata = {};
  const infoKeys = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate'];
  for (const key of infoKeys) {
    const regex = new RegExp(`/${key}\\s*\\(([^)]*)\\)`, 's');
    const match = text.match(regex);
    if (match) {
      let val = match[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\([()])/g, '$1')
        .replace(/\\\\/g, '\\');
      if (val.length > 100) val = val.slice(0, 100) + '…';
      metadata[key] = val;
    }
  }
  return metadata;
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function renderResults(analysis, elements) {
  const { resultsList, resultsMeta } = elements;
  resultsList.innerHTML = '';

  analysis.results.forEach((result) => resultsList.appendChild(createResultCard(result)));

  resultsMeta.textContent = `${analysis.results.length} section(s) analyzed.`;
}

function createResultCard(result) {
  const card = document.createElement('article');
  card.className = 'result-card';
  card.dataset.severity = result.severity ?? 'neutral';

  const header = document.createElement('header');
  header.className = 'result-header';
  const title = document.createElement('h3');
  title.textContent = result.label;
  header.appendChild(title);

  const summary = document.createElement('p');
  summary.className = 'result-summary';
  summary.textContent = result.summary;

  card.append(header, summary);

  if (result.insights?.length) {
    const list = document.createElement('ul');
    list.className = 'insight-list';
    result.insights.forEach((note) => {
      const item = document.createElement('li');
      item.textContent = note;
      list.appendChild(item);
    });
    card.appendChild(list);
  }

  if (result.details?.length) {
    const dl = document.createElement('dl');
    dl.className = 'result-details';
    result.details.forEach((d) => {
      const dt = document.createElement('dt');
      dt.textContent = d.label;
      const dd = document.createElement('dd');
      dd.textContent = d.value;
      dl.append(dt, dd);
    });
    card.appendChild(dl);
  }

  if (result.images?.length) {
    const grid = document.createElement('div');
    grid.className = 'image-grid';
    result.images.forEach((img, i) => {
      const div = document.createElement('div');
      div.className = 'image-card';
      div.innerHTML = `
        <strong>Image ${i + 1}</strong>
        <span>${img.width}×${img.height} px</span>
        <span>${img.colorSpace} · ${img.bitsPerComponent} bpc</span>
        <span>Filter: ${img.filter}</span>
        <span>Stream: ${img.size}</span>
      `;
      grid.appendChild(div);
    });
    card.appendChild(grid);
  }

  if (result.fonts?.length) {
    const fontList = document.createElement('div');
    fontList.className = 'font-list';
    result.fonts.forEach((f) => {
      const chip = document.createElement('span');
      chip.className = 'font-chip';
      chip.textContent = f;
      fontList.appendChild(chip);
    });
    card.appendChild(fontList);
  }

  return card;
}
