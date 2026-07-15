import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { query } from '../../db.js';
import { parseFrameworkSemanticDocument } from './knowledgeParser.js';

const FRAMEWORK_DIR = path.join(process.cwd(), 'server', 'seed-data', 'framework');
const FRAMEWORK_INDEX_PATH = path.join(FRAMEWORK_DIR, 'framework_index.json');
const FRAMEWORK_SEMANTIC_PATH = path.join(FRAMEWORK_DIR, 'framework_semantic.md');

function toJsonb(value, fallback) {
  const resolved = value === undefined || value === null ? fallback : value;
  return JSON.stringify(resolved);
}

function sha256(value) {
  return createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

export async function loadFrameworkSeedDocuments() {
  const [indexRaw, semanticRaw] = await Promise.all([
    fs.readFile(FRAMEWORK_INDEX_PATH, 'utf8'),
    fs.readFile(FRAMEWORK_SEMANTIC_PATH, 'utf8'),
  ]);

  const indexDocument = JSON.parse(indexRaw);
  const semanticSectionsById = parseFrameworkSemanticDocument(semanticRaw);

  return {
    version: String(indexDocument.version || 'unknown'),
    document: String(indexDocument.document || 'Framework'),
    retrievalHint: String(indexDocument.retrieval_hint || ''),
    sections: Array.isArray(indexDocument.sections) ? indexDocument.sections : [],
    semanticSectionsById,
  };
}

export async function syncFrameworkKnowledgeSections(queryFn = query) {
  const seed = await loadFrameworkSeedDocuments();
  let upserted = 0;

  for (const section of seed.sections) {
    const sectionId = String(section.id || '').trim();
    if (!sectionId) continue;

    const semantic = seed.semanticSectionsById.get(sectionId);
    const title = String(section.title || semantic?.title || sectionId);
    const summary = section.summary ? String(section.summary) : null;
    const content = semantic?.content || summary || title;
    const metadata = {
      document: seed.document,
      order: section.order ?? null,
      tables: Array.isArray(section.tables) ? section.tables : [],
      visuals: Array.isArray(section.visuals) ? section.visuals : [],
      cases: Array.isArray(section.cases) ? section.cases : [],
      excerptStandalone: Boolean(section.excerpt_standalone),
      retrievalHint: seed.retrievalHint,
      wordCount: Number(section.word_count || 0),
    };

    await queryFn(
      `INSERT INTO knowledge_sections (
         source_type, section_id, title, summary, tags, rfp_questions,
         related_sections, engagement_models, content, content_hash,
         source_version, metadata, active, updated_at
       ) VALUES (
         'framework', $1, $2, $3, $4::jsonb, $5::jsonb,
         $6::jsonb, $7::jsonb, $8, $9,
         $10, $11::jsonb, TRUE, CURRENT_TIMESTAMP
       )
       ON CONFLICT (source_type, section_id)
       DO UPDATE SET
         title = EXCLUDED.title,
         summary = EXCLUDED.summary,
         tags = EXCLUDED.tags,
         rfp_questions = EXCLUDED.rfp_questions,
         related_sections = EXCLUDED.related_sections,
         engagement_models = EXCLUDED.engagement_models,
         content = EXCLUDED.content,
         content_hash = EXCLUDED.content_hash,
         source_version = EXCLUDED.source_version,
         metadata = EXCLUDED.metadata,
         active = TRUE,
         updated_at = CURRENT_TIMESTAMP`,
      [
        sectionId,
        title,
        summary,
        toJsonb(section.tags, []),
        toJsonb(section.rfp_questions, []),
        toJsonb(section.related_sections, []),
        toJsonb(section.engagement_models, []),
        content,
        sha256(content),
        seed.version,
        toJsonb(metadata, {}),
      ]
    );

    upserted += 1;
  }

  return {
    sourceType: 'framework',
    sourceVersion: seed.version,
    upserted,
  };
}

export async function searchFrameworkKnowledgeSections({ limit = 5 } = {}, queryFn = query) {
  const maxLimit = Math.max(1, Math.min(Number(limit || 5), 20));
  const result = await queryFn(
    `SELECT source_type, section_id, title, summary, tags, rfp_questions,
            related_sections, engagement_models, content, source_version, metadata
     FROM knowledge_sections
     WHERE source_type = 'framework'
       AND active = TRUE
     ORDER BY section_id ASC
     LIMIT $1`,
    [maxLimit]
  );
  return result.rows;
}
