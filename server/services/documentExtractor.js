import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as XLSX from '@e965/xlsx';
import { normalizeDocumentName } from '../utils/filenames.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

const SUPPORTED_TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.json', '.csv', '.html', '.htm', '.xml', '.yaml', '.yml']);
const SUPPORTED_SPREADSHEET_EXTENSIONS = new Set(['.xls', '.xlsx']);
const MAX_WORKSHEETS = 20;
const MAX_ROWS_PER_WORKSHEET = 3000;
const MAX_COLUMNS_PER_WORKSHEET = 80;
const MAX_CELLS_PER_WORKSHEET = 20000;
const MAX_SPREADSHEET_CHARACTERS = 240000;
const EXTRACTION_CONCURRENCY = 3;
const extractionCache = new Map();

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

    const pageText = isLikelyTable(rows)
      ? rowsToMarkdown(rows)
      : rows.map(r => r.items.map(it => it.str).join(' ')).join('\n');
    pageTexts.push(`## Page ${i}\n\n${pageText}`);
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

function escapeMarkdownCell(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
}

function formatSpreadsheetCell(cell) {
  if (!cell) return '';

  let displayed = '';
  try {
    displayed = XLSX.utils.format_cell(cell);
  } catch {
    displayed = cell.v === undefined || cell.v === null ? '' : String(cell.v);
  }

  if (cell.f) {
    const formula = `=${cell.f}`;
    return displayed && displayed !== formula ? `${formula} → ${displayed}` : formula;
  }
  return displayed;
}

function worksheetToMarkdown(worksheet) {
  if (!worksheet?.['!ref']) return { markdown: '[Empty worksheet]', truncated: false };

  const sourceRange = XLSX.utils.decode_range(worksheet['!ref']);
  const sourceColumnCount = sourceRange.e.c - sourceRange.s.c + 1;
  const columnCount = Math.min(sourceColumnCount, MAX_COLUMNS_PER_WORKSHEET);
  const rowLimitFromCells = Math.max(1, Math.floor(MAX_CELLS_PER_WORKSHEET / columnCount));
  const sourceRowCount = sourceRange.e.r - sourceRange.s.r + 1;
  const rowCount = Math.min(sourceRowCount, MAX_ROWS_PER_WORKSHEET, rowLimitFromCells);
  const endColumn = sourceRange.s.c + columnCount - 1;
  const endRow = sourceRange.s.r + rowCount - 1;

  const header = ['Source row'];
  for (let column = sourceRange.s.c; column <= endColumn; column++) {
    header.push(XLSX.utils.encode_col(column));
  }

  const rows = [];
  for (let row = sourceRange.s.r; row <= endRow; row++) {
    const values = [];
    let hasContent = false;
    for (let column = sourceRange.s.c; column <= endColumn; column++) {
      const value = formatSpreadsheetCell(worksheet[XLSX.utils.encode_cell({ r: row, c: column })]);
      if (value) hasContent = true;
      values.push(escapeMarkdownCell(value));
    }
    if (hasContent) rows.push([String(row + 1), ...values]);
  }

  if (rows.length === 0) return { markdown: '[Empty worksheet]', truncated: false };

  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.join(' | ')} |`),
  ];
  const truncated = sourceColumnCount > columnCount || sourceRowCount > rowCount;
  return { markdown: lines.join('\n'), truncated };
}

export async function extractTextFromSpreadsheet(filePath) {
  const buffer = await fs.promises.readFile(filePath);
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    cellFormula: true,
    cellNF: true,
    cellText: true,
  });

  const sheetNames = workbook.SheetNames.slice(0, MAX_WORKSHEETS);
  const sections = [];
  let extractedCharacters = 0;
  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const sheetMetadata = workbook.Workbook?.Sheets?.find(sheet => sheet.name === sheetName);
    const visibility = sheetMetadata?.Hidden ? ' (hidden)' : '';
    const { markdown, truncated } = worksheetToMarkdown(worksheet);
    const section = [
      `## Worksheet: ${sheetName}${visibility}`,
      markdown,
      truncated ? '[Worksheet truncated to safe extraction limits.]' : ''
    ].filter(Boolean).join('\n\n');
    const remainingCharacters = MAX_SPREADSHEET_CHARACTERS - extractedCharacters;
    if (section.length > remainingCharacters) {
      if (remainingCharacters > 0) {
        sections.push(
          section.slice(0, remainingCharacters),
          '[Workbook text truncated to the AI context safety limit.]'
        );
      }
      break;
    }
    sections.push(section);
    extractedCharacters += section.length;
  }
  if (workbook.SheetNames.length > sheetNames.length) {
    sections.push(`[Workbook truncated: ${workbook.SheetNames.length - sheetNames.length} worksheet(s) omitted.]`);
  }
  return sections.filter(Boolean).join('\n\n');
}

export function decodeTextBuffer(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer.subarray(2));
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buffer.subarray(2));
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    // Windows-1251 remains common in Russian TXT/CSV exports.
    return new TextDecoder('windows-1251').decode(buffer);
  }
}

async function extractTextFromTextFile(filePath) {
  const buffer = await fs.promises.readFile(filePath);
  return decodeTextBuffer(buffer);
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
    } else if (SUPPORTED_SPREADSHEET_EXTENSIONS.has(ext)) {
      text = await extractTextFromSpreadsheet(filePath);
    } else if (isTextFile(filePath)) {
      text = await extractTextFromTextFile(filePath);
    } else {
      return { success: false, error: `Unsupported file type: ${ext}`, text: '' };
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
      return {
        success: false,
        error: 'No extractable text found. Scanned PDFs require OCR before upload.',
        text: '',
      };
    }
    return { success: true, text: trimmedText };
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
  const work = documents.filter(doc => doc.filename);

  return mapWithConcurrency(work, EXTRACTION_CONCURRENCY, async doc => {
    const filePath = path.join(dealDir, doc.filename);
    const result = await extractDocumentTextCached(filePath);
    return {
      id: doc.id,
      name: normalizeDocumentName(doc.name),
      size: doc.size,
      ...result,
    };
  });
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

async function extractDocumentTextCached(filePath) {
  try {
    const stat = await fs.promises.stat(filePath);
    const cacheKey = `${filePath}:${stat.mtimeMs}:${stat.size}`;
    if (!extractionCache.has(cacheKey)) {
      extractionCache.set(cacheKey, extractDocumentText(filePath));
    }
    return extractionCache.get(cacheKey);
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Extraction failed',
      text: '',
    };
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
