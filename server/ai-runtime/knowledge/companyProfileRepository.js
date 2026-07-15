import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { query } from '../../db.js';

const COMPANY_PROFILE_PATH = path.join(process.cwd(), 'server', 'seed-data', 'andersen-profile.md');

function sha256(value) {
  return createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function splitCompanyProfileIntoSections(markdown) {
  const input = String(markdown || '');
  const blocks = input.split(/\n##\s+/g);
  const sections = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (!block.trim()) continue;

    if (index === 0) {
      const titleMatch = block.match(/^#\s+([^\n]+)/m);
      const title = titleMatch ? titleMatch[1].trim() : 'Company Overview';
      sections.push({
        sectionId: 'company-overview',
        title,
        summary: 'General company profile overview.',
        tags: ['company', 'profile', 'overview'],
        content: block.trim(),
      });
      continue;
    }

    const newlineIndex = block.indexOf('\n');
    const title = (newlineIndex === -1 ? block : block.slice(0, newlineIndex)).trim();
    const body = newlineIndex === -1 ? '' : block.slice(newlineIndex + 1).trim();
    const sectionId = `company-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `section-${index}`}`;
    sections.push({
      sectionId,
      title,
      summary: `${title} section from Andersen company profile.`,
      tags: ['company', 'profile', ...title.toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean)],
      content: body || title,
    });
  }

  return sections;
}

export async function loadCompanyProfileSeedDocument() {
  const markdown = await fs.readFile(COMPANY_PROFILE_PATH, 'utf8');
  const sections = splitCompanyProfileIntoSections(markdown);

  return {
    sourceVersion: 'andersen-profile-v1',
    sections,
  };
}

export async function syncCompanyKnowledgeSections(queryFn = query) {
  const seed = await loadCompanyProfileSeedDocument();
  let upserted = 0;

  for (const section of seed.sections) {
    await queryFn(
      `INSERT INTO knowledge_sections (
         source_type, section_id, title, summary, tags, rfp_questions,
         related_sections, engagement_models, content, content_hash,
         source_version, metadata, active, updated_at
       ) VALUES (
         'company', $1, $2, $3, $4::jsonb, '[]'::jsonb,
         '[]'::jsonb, '["all"]'::jsonb, $5, $6,
         $7, '{}'::jsonb, TRUE, CURRENT_TIMESTAMP
       )
       ON CONFLICT (source_type, section_id)
       DO UPDATE SET
         title = EXCLUDED.title,
         summary = EXCLUDED.summary,
         tags = EXCLUDED.tags,
         content = EXCLUDED.content,
         content_hash = EXCLUDED.content_hash,
         source_version = EXCLUDED.source_version,
         active = TRUE,
         updated_at = CURRENT_TIMESTAMP`,
      [
        section.sectionId,
        section.title,
        section.summary,
        JSON.stringify(section.tags || []),
        section.content,
        sha256(section.content),
        seed.sourceVersion,
      ]
    );
    upserted += 1;
  }

  return {
    sourceType: 'company',
    sourceVersion: seed.sourceVersion,
    upserted,
  };
}
