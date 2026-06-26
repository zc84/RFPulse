import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

const SUPPORTED_TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.json', '.csv', '.html', '.htm', '.xml', '.yaml', '.yml']);

// --- PDF extraction with coordinate-based table reconstruction ---

const Y_TOLERANCE = 3;   // px — items within this vertical range are the same row
const COL_GAP = 20;      // px — horizontal gap larger than this starts a new column

function groupIntoRows(items) {
  const sorted = [...items].sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);
  const rows = [];
  for (const item of sorted) {
    const y = item.transform[5];
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - y) <= Y_TOLERANCE) {
      last.items.push(item);
    } else {
      rows.push({ y, items: [item] });
    }
  }
  return rows;
}

function rowsToMarkdown(rows) {
  const tableRows = rows.map(row => {
    const sorted = row.items.sort((a, b) => a.transform[4] - b.transform[4]);
    const cells = [];
    let prevX = null;
    let cellBuf = '';
    for (const item of sorted) {
      const x = item.transform[4];
      if (prevX !== null && x - prevX > COL_GAP) {
        cells.push(cellBuf.trim());
        cellBuf = '';
      }
      cellBuf += (cellBuf ? ' ' : '') + item.str;
      prevX = x + (item.width || 0);
    }
    if (cellBuf.trim()) cells.push(cellBuf.trim());
    return cells;
  });

  if (tableRows.length === 0) return '';

  const maxCols = Math.max(...tableRows.map(r => r.length));
  const pad = row => {
    while (row.length < maxCols) row.push('');
    return row;
  };

  const lines = tableRows.map(r => '| ' + pad(r).join(' | ') + ' |');
  const separator = '| ' + Array(maxCols).fill('---').join(' | ') + ' |';
  lines.splice(1, 0, separator);
  return lines.join('\n');
}

function isLikelyTable(rows) {
  if (rows.length < 2) return false;
  const colCounts = rows.map(r => {
    const sorted = r.items.sort((a, b) => a.transform[4] - b.transform[4]);
    let cols = 1;
    let prevX = null;
    for (const item of sorted) {
      const x = item.transform[4];
      if (prevX !== null && x - prevX > COL_GAP) cols++;
      prevX = x + (item.width || 0);
    }
    return cols;
  });
  const multiColRows = colCounts.filter(c => c > 1).length;
  return multiColRows >= 2;
}

async function extractTextFromPdf(filePath) {
  const buffer = await fs.promises.readFile(filePath);
  const loadingTask = getDocument({ data: new Uint8Array(buffer), disableFontFace: true, verbosity: 0 });
  const pdfDoc = await loadingTask.promise;
  const pageTexts = [];

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items.filter(item => item.str && item.str.trim());

    const rows = groupIntoRows(items);

    if (isLikelyTable(rows)) {
      pageTexts.push(rowsToMarkdown(rows));
    } else {
      pageTexts.push(rows.map(r => r.items.map(it => it.str).join(' ')).join('\n'));
    }
  }

  return pageTexts.join('\n\n');
}

// --- DOCX extraction with HTML table → Markdown conversion ---

function htmlTableToMarkdown(html) {
  const tableRegex = /<table[\s\S]*?<\/table>/gi;
  return html.replace(tableRegex, (tableHtml) => {
    const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const tagRegex = /<[^>]+>/g;

    const rows = [];
    let rowMatch;
    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const cells = [];
      let cellMatch;
      const cellSrc = rowMatch[0];
      while ((cellMatch = cellRegex.exec(cellSrc)) !== null) {
        cells.push(cellMatch[1].replace(tagRegex, '').trim());
      }
      if (cells.length) rows.push(cells);
    }

    if (rows.length === 0) return '';
    const maxCols = Math.max(...rows.map(r => r.length));
    const pad = row => { while (row.length < maxCols) row.push(''); return row; };
    const lines = rows.map(r => '| ' + pad(r).join(' | ') + ' |');
    const sep = '| ' + Array(maxCols).fill('---').join(' | ') + ' |';
    lines.splice(1, 0, sep);
    return '\n' + lines.join('\n') + '\n';
  });
}

function htmlToPlainText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractTextFromDocx(filePath) {
  const result = await mammoth.convertToHtml({ path: filePath });
  const withTables = htmlTableToMarkdown(result.value || '');
  return htmlToPlainText(withTables);
}

async function extractTextFromTextFile(filePath) {
  return await fs.promises.readFile(filePath, 'utf-8');
}

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_TEXT_EXTENSIONS.has(ext);
}

export async function extractDocumentText(filePath) {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'File not found', text: '' };
  }

  try {
    const ext = path.extname(filePath).toLowerCase();
    let text = '';

    if (ext === '.pdf') {
      text = await extractTextFromPdf(filePath);
    } else if (ext === '.docx') {
      text = await extractTextFromDocx(filePath);
    } else if (isTextFile(filePath)) {
      text = await extractTextFromTextFile(filePath);
    } else {
      return { success: false, error: `Unsupported file type: ${ext}`, text: '' };
    }

    return { success: true, text: text.trim() };
  } catch (err) {
    return { success: false, error: err.message || 'Extraction failed', text: '' };
  }
}

export async function buildDealContextBundle(dealId, documents) {
  const numericDealId = parseInt(dealId.replace('D-', ''), 10);
  if (isNaN(numericDealId)) {
    throw new Error('Invalid deal id');
  }

  const dealDir = path.join(UPLOAD_DIR, String(numericDealId));
  const extractedDocs = [];

  for (const doc of documents) {
    if (!doc.filename) continue;
    const filePath = path.join(dealDir, doc.filename);
    const result = await extractDocumentText(filePath);
    extractedDocs.push({
      id: doc.id,
      name: doc.name,
      size: doc.size,
      ...result,
    });
  }

  return extractedDocs;
}

export function summarizeContextBundle(extractedDocs) {
  const parts = [];
  for (const doc of extractedDocs) {
    parts.push(`--- ${doc.name} ---`);
    if (doc.success) {
      parts.push(doc.text);
    } else {
      parts.push(`[Could not extract: ${doc.error}]`);
    }
    parts.push('');
  }
  return parts.join('\n').trim();
}
