import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.join(__dirname, '..', 'scripts', 'renderProposalDocx.py');

export function renderProposalDocx({ markdown, outputPath, title, templatePath = null, diagrams = [] }) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfpulse-proposal-'));
  try {
    const payload = {
      markdown,
      outputPath,
      title,
      templatePath,
      diagrams: diagrams.map((diagram, index) => {
        const imagePath = path.join(tempDir, `diagram-${index + 1}${path.extname(diagram.path) || '.png'}`);
        fs.copyFileSync(diagram.path, imagePath);
        return {
          title: diagram.title,
          path: imagePath,
        };
      }),
    };

    const result = spawnSync('python3', [SCRIPT_PATH], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });

    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || 'Failed to render proposal DOCX.');
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'proposal';
}

export function splitProposalMarkdown(markdown) {
  const text = String(markdown || '').trim();
  const markerRegex = /<!--\s*proposal-file:\s*([^>]+?)\s*-->/gi;
  const markers = [];
  let match;
  while ((match = markerRegex.exec(text))) {
    const raw = match[1];
    const meta = Object.fromEntries(
      raw.split(';').map(item => item.trim()).filter(Boolean).map(item => {
        const [key, ...rest] = item.split('=');
        return [key.trim().toLowerCase(), rest.join('=').trim().replace(/^["']|["']$/g, '')];
      })
    );
    markers.push({
      index: match.index,
      end: markerRegex.lastIndex,
      filename: meta.filename || null,
      title: meta.title || null,
      diagrams: String(meta.diagrams || '').toLowerCase() === 'true',
    });
  }

  if (markers.length === 0) {
    return [{
      filename: 'proposal.docx',
      title: 'Proposal',
      markdown: text,
      diagrams: true,
    }];
  }

  const parts = [];
  for (let i = 0; i < markers.length; i++) {
    const current = markers[i];
    const start = current.end;
    const end = i + 1 < markers.length ? markers[i + 1].index : text.length;
    const content = text.slice(start, end).trim();
    if (!content) continue;
    const title = current.title || `Proposal ${i + 1}`;
    parts.push({
      filename: current.filename || `${slugify(title)}.docx`,
      title,
      markdown: content,
      diagrams: current.diagrams,
    });
  }

  if (parts.length === 0) {
    return [{
      filename: 'proposal.docx',
      title: 'Proposal',
      markdown: text,
      diagrams: true,
    }];
  }

  return parts;
}
