import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const SUPPORTED_TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.json', '.csv', '.html', '.htm', '.xml', '.yaml', '.yml']);

async function extractTextFromPdf(filePath) {
  const buffer = await fs.promises.readFile(filePath);
  const parser = new PDFParse({ data: buffer });
  try {
    const data = await parser.getText();
    return data.text || '';
  } finally {
    await parser.destroy();
  }
}

async function extractTextFromDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || '';
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
