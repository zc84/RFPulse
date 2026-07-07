import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
const SYSTEM_DIR = path.join(UPLOAD_DIR, 'system');
const TEMPLATE_FILENAME = 'proposal-template.docx';
const SETTINGS_KEY = 'proposal_template';

function ensureSystemDir() {
  if (!fs.existsSync(SYSTEM_DIR)) {
    fs.mkdirSync(SYSTEM_DIR, { recursive: true });
  }
}

function getTemplatePath() {
  ensureSystemDir();
  return path.join(SYSTEM_DIR, TEMPLATE_FILENAME);
}

async function setTemplateMetadata(metadata) {
  await query(
    `INSERT INTO global_settings (key, value)
     VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
    [SETTINGS_KEY, JSON.stringify(metadata)]
  );
}

export async function getProposalTemplateSettings() {
  ensureSystemDir();
  const result = await query('SELECT value FROM global_settings WHERE key = $1', [SETTINGS_KEY]);
  const metadata = result.rows[0]?.value ? JSON.parse(result.rows[0].value) : null;
  const templatePath = getTemplatePath();
  const hasTemplate = fs.existsSync(templatePath);
  if (!hasTemplate && metadata) {
    return {
      has_template: false,
      filename: null,
      original_name: metadata.originalName || null,
      uploaded_at: metadata.uploadedAt || null,
    };
  }
  return {
    has_template: hasTemplate,
    filename: hasTemplate ? TEMPLATE_FILENAME : null,
    original_name: metadata?.originalName || null,
    uploaded_at: metadata?.uploadedAt || null,
  };
}

export async function saveProposalTemplate(filePath, originalName) {
  ensureSystemDir();
  const targetPath = getTemplatePath();
  if (path.resolve(filePath) !== path.resolve(targetPath)) {
    fs.copyFileSync(filePath, targetPath);
  }
  const metadata = {
    originalName: originalName || TEMPLATE_FILENAME,
    uploadedAt: new Date().toISOString(),
    filename: TEMPLATE_FILENAME,
  };
  await setTemplateMetadata(metadata);
  return {
    ...metadata,
    hasTemplate: true,
    path: targetPath,
  };
}

export async function deleteProposalTemplate() {
  const templatePath = getTemplatePath();
  if (fs.existsSync(templatePath)) {
    fs.unlinkSync(templatePath);
  }
  await query('DELETE FROM global_settings WHERE key = $1', [SETTINGS_KEY]);
  return { hasTemplate: false };
}

export function resolveProposalTemplatePath() {
  const templatePath = getTemplatePath();
  return fs.existsSync(templatePath) ? templatePath : null;
}
