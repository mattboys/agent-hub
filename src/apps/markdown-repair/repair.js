/**
 * Markdown repair and reformatting utilities.
 * Preserves code blocks, tables, and list structure while fixing common issues.
 */

const BLOCK_FENCE = /^(`{3,}|~{3,})/;
const TABLE_ROW = /^\|.+\|$/;
const LIST_ITEM = /^(\s*)([-*+]|\d+\.)\s/;
const HEADER = /^#{1,6}\s/;
const BLOCKQUOTE = /^\s*>/;
const HR = /^(\s*[-*_]\s*){3,}$/;

/**
 * Repair markdown document with all fixes.
 * @param {string} text - Raw markdown
 * @param {Object} options - Repair options
 * @returns {string} Repaired markdown
 */
export function repairMarkdown(text, options = {}) {
  if (!text || typeof text !== 'string') return text;

  const opts = {
    trimSpaces: true,
    removeExtraLinebreaks: true,
    fixMidSentenceBreaks: true,
    fixSoftHyphens: true,
    fixBrokenBullets: true,
    formatTables: true,
    ...options
  };

  let result = text;

  // Preserve fenced code blocks and process the rest
  const parts = splitByFencedBlocks(result);
  result = parts
    .map((part, i) => {
      if (part.isCode) return part.raw;
      return repairMarkdownSection(part.text, opts);
    })
    .join('\n')
    .replace(/\n\n+/g, '\n\n');

  return result;
}

function splitByFencedBlocks(text) {
  const parts = [];
  const lines = text.split(/\r\n|\r|\n/);
  let i = 0;
  let current = [];

  while (i < lines.length) {
    const line = lines[i];
    const fenceMatch = line.match(/^([ \t]*)(`{3,}|~{3,})([^\n]*)$/);

    if (fenceMatch && current.length === 0) {
      const fence = fenceMatch[2];
      const block = [line];
      i++;
      while (i < lines.length) {
        const closeMatch = lines[i].match(new RegExp(`^([ \\t]*)(${fence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\s*$`));
        block.push(lines[i]);
        if (closeMatch) {
          i++;
          break;
        }
        i++;
      }
      parts.push({ isCode: true, raw: block.join('\n') });
    } else if (fenceMatch && current.length > 0) {
      parts.push({ isCode: false, text: current.join('\n') });
      current = [];
      // Reprocess this line as fence start (don't increment i)
    } else {
      current.push(line);
      i++;
    }
  }

  if (current.length > 0) {
    parts.push({ isCode: false, text: current.join('\n') });
  }

  return parts;
}

function repairMarkdownSection(text, opts) {
  let lines = text.split(/\r\n|\r|\n/);

  if (opts.trimSpaces) {
    lines = lines.map((line) => line.replace(/[ \t]+$/, ''));
  }

  if (opts.fixSoftHyphens) {
    lines = fixSoftHyphens(lines);
  }

  if (opts.fixMidSentenceBreaks) {
    lines = fixMidSentenceBreaks(lines);
  }

  if (opts.fixBrokenBullets) {
    lines = fixBrokenBullets(lines);
  }

  if (opts.formatTables) {
    lines = formatTables(lines);
  }

  let result = lines.join('\n');

  if (opts.removeExtraLinebreaks) {
    result = result.replace(/\n{3,}/g, '\n\n');
  }

  return result;
}

/** Remove soft hyphens at end of line and join with next word */
function fixSoftHyphens(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    const trimmed = line.replace(/\s+$/, '');
    const endsWithHyphen = /-\s*$/.test(trimmed) && trimmed.length > 1;
    const nextStartsWord = next && /^[a-zA-Z0-9]/.test(next.trim());

    if (endsWithHyphen && nextStartsWord && !isBlockStart(next)) {
      out.push(trimmed.replace(/\s*-\s*$/, '') + next.trim());
      i++;
    } else {
      out.push(line);
    }
  }
  return out;
}

/** Join lines that break mid-sentence (in paragraph context) */
function fixMidSentenceBreaks(lines) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const next = lines[i + 1];

    const isBlank = /^\s*$/.test(line);
    const isBlockStartLine = isBlockStart(line);
    const nextIsBlockStart = next && isBlockStart(next);
    const nextIsBlank = next && /^\s*$/.test(next);

    const endsSentence = /[.!?:]\s*$/.test(line) || /["')\]]\s*$/.test(line);
    const endsWithCommaOrColon = /[,\u2013\u2014:;]\s*$/.test(line);
    const startsWithLower = next && /^[a-z\u00e0-\u024f]/.test(next.trim());
    const lineEndsWithoutPeriod = line.trim().length > 0 && !endsSentence && !endsWithCommaOrColon;
    const lineEndsWithLetter = /[a-z\u00e0-\u024f]\s*$/i.test(line);

    const shouldJoin =
      !isBlank &&
      !isBlockStartLine &&
      !nextIsBlockStart &&
      !nextIsBlank &&
      next &&
      lineEndsWithLetter &&
      (endsWithCommaOrColon || lineEndsWithoutPeriod) &&
      (startsWithLower || /^\d/.test(next.trim()));

    if (shouldJoin) {
      const joined = line.trimEnd() + ' ' + next.trim();
      out.push(joined);
      i += 2;
    } else {
      out.push(line);
      i++;
    }
  }
  return out;
}

function isBlockStart(line) {
  const t = line.trim();
  return (
    BLOCK_FENCE.test(t) ||
    HEADER.test(t) ||
    BLOCKQUOTE.test(t) ||
    LIST_ITEM.test(t) ||
    TABLE_ROW.test(t) ||
    HR.test(t) ||
    t === '---' ||
    t === '***' ||
    t === '___'
  );
}

/** Fix bullet lists: normalize markers, fix indentation, merge orphan lines */
function fixBrokenBullets(lines) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const next = lines[i + 1];

    const listMatch = line.match(LIST_ITEM);
    const nextListMatch = next && next.match(LIST_ITEM);
    const nextBlank = next && /^\s*$/.test(next);
    const nextIndent = next && /^\s+/.test(next) && !nextListMatch;

    if (listMatch && next && !nextBlank && !nextListMatch && nextIndent) {
      const indent = next.match(/^(\s+)/)[1];
      const bulletIndent = listMatch[1].length;
      if (indent.length > bulletIndent) {
        out.push(line);
        out.push(next.trimStart());
        i += 2;
        continue;
      }
    }

    if (listMatch && next && !nextBlank && !nextListMatch && !nextIndent && !isBlockStart(next)) {
      const content = next.trim();
      if (content.length > 0 && !content.startsWith('-') && !content.startsWith('*') && !/^\d+\./.test(content)) {
        out.push(line.trimEnd() + ' ' + content);
        i += 2;
        continue;
      }
    }

    if (listMatch) {
      const normalized = line.replace(/^(\s*)([-*+])\s+/, (_, sp, m) => sp + '- ');
      out.push(normalized);
    } else {
      out.push(line);
    }
    i++;
  }
  return out;
}

/** Format markdown tables: align columns, fix separators */
function formatTables(lines) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!TABLE_ROW.test(line.trim())) {
      out.push(line);
      i++;
      continue;
    }

    const tableLines = [];
    while (i < lines.length && TABLE_ROW.test(lines[i].trim())) {
      tableLines.push(lines[i]);
      i++;
    }

    const formatted = formatTableBlock(tableLines);
    out.push(...formatted);
  }
  return out;
}

function formatTableBlock(rows) {
  if (rows.length === 0) return rows;

  const parseRow = (row) => {
    const trimmed = row.trim();
    const cells = trimmed
      .slice(1, -1)
      .split(/\|/)
      .map((c) => c.trim());
    return cells;
  };

  const parsed = rows.map(parseRow);
  const numCols = Math.max(...parsed.map((r) => r.length));

  for (const row of parsed) {
    while (row.length < numCols) row.push('');
  }

  const isSeparator = (row) => {
    const str = row.join(' ').replace(/\s/g, '');
    return /^[-:]+$/.test(str) || row.every((c) => /^[-:\s]+$/.test(c));
  };

  let headerEnd = 0;
  for (let j = 0; j < parsed.length; j++) {
    if (isSeparator(parsed[j])) {
      headerEnd = j;
      break;
    }
    headerEnd = j + 1;
  }

  const colWidths = [];
  for (let c = 0; c < numCols; c++) {
    let max = 3;
    for (let r = 0; r < parsed.length; r++) {
      if (r === headerEnd && isSeparator(parsed[headerEnd])) continue;
      const len = parsed[r][c]?.length ?? 0;
      if (len > max) max = len;
    }
    colWidths.push(max);
  }

  const pad = (s, w, align = 'left') => {
    const len = (s ?? '').length;
    if (align === 'right') return ' '.repeat(Math.max(0, w - len)) + (s ?? '');
    if (align === 'center') {
      const padLeft = Math.floor((w - len) / 2);
      const padRight = w - len - padLeft;
      return ' '.repeat(Math.max(0, padLeft)) + (s ?? '') + ' '.repeat(Math.max(0, padRight));
    }
    return (s ?? '') + ' '.repeat(Math.max(0, w - len));
  };

  const formatCell = (cell, c, r) => {
    const w = colWidths[c];
    if (r === headerEnd && isSeparator(parsed[r])) {
      const content = cell.replace(/\s/g, '');
      const left = content.startsWith(':');
      const right = content.endsWith(':');
      if (left && right) return ':' + '-'.repeat(Math.max(0, w - 2)) + ':';
      if (right) return '-'.repeat(Math.max(0, w - 1)) + ':';
      if (left) return ':' + '-'.repeat(Math.max(0, w - 1));
      return '-'.repeat(w);
    }
    return pad(cell, w);
  };

  const result = [];
  for (let r = 0; r < parsed.length; r++) {
    const cells = parsed[r].map((cell, c) => formatCell(cell, c, r));
    result.push('| ' + cells.join(' | ') + ' |');
  }
  return result;
}
