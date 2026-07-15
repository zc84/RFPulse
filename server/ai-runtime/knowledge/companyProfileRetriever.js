import { query } from '../../db.js';
import { syncCompanyKnowledgeSections } from './companyProfileRepository.js';
import { resolveRetrievalIntents } from './knowledgeIntent.js';

let companySyncPromise = null;

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function tokenize(input) {
  return [...new Set(
    normalizeText(input)
      .split(/[^a-z0-9]+/g)
      .filter(token => token.length >= 3)
  )];
}

function scoreCompanyRow(row, tokens) {
  const title = normalizeText(row.title);
  const summary = normalizeText(row.summary);
  const content = normalizeText(row.content).slice(0, 4000);
  const tags = Array.isArray(row.tags) ? row.tags.map(item => normalizeText(item)) : [];

  let score = 0;
  const reasons = [];

  for (const token of tokens) {
    if (!token) continue;
    if (title.includes(token)) {
      score += 4;
      reasons.push(`title:${token}`);
    }
    if (summary.includes(token)) {
      score += 3;
      reasons.push(`summary:${token}`);
    }
    if (tags.some(tag => tag.includes(token))) {
      score += 2;
      reasons.push(`tag:${token}`);
    }
    if (content.includes(token)) {
      score += 1;
      reasons.push(`content:${token}`);
    }
  }

  return {
    score,
    reasons: [...new Set(reasons)],
  };
}

async function ensureCompanyKnowledgeLoaded(queryFn = query) {
  if (!companySyncPromise) {
    companySyncPromise = syncCompanyKnowledgeSections(queryFn).catch(error => {
      companySyncPromise = null;
      throw error;
    });
  }
  return companySyncPromise;
}

async function loadAllCompanyRows(queryFn = query) {
  const result = await queryFn(
    `SELECT source_type, section_id, title, summary, tags, content, source_version
     FROM knowledge_sections
     WHERE source_type = 'company'
       AND active = TRUE
     ORDER BY section_id ASC`
  );
  return result.rows;
}

export async function retrieveCompanyProfileSections({
  queryText = '',
  intents = [],
  limit = 5,
} = {}, queryFn = query) {
  await ensureCompanyKnowledgeLoaded(queryFn);
  const rows = await loadAllCompanyRows(queryFn);

  const intentResolution = resolveRetrievalIntents(queryText, intents, { maxIntents: 4 });
  const resolvedIntents = intentResolution.intents;
  const joinedIntentText = Array.isArray(resolvedIntents) ? resolvedIntents.join(' ') : '';
  const tokens = tokenize(`${queryText} ${joinedIntentText}`);
  const requestedLimit = Math.max(1, Math.min(Number(limit || 5), 10));

  const ranked = rows
    .map(row => {
      const scored = scoreCompanyRow(row, tokens);
      return {
        ...row,
        score: scored.score,
        reasons: scored.reasons,
      };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.section_id).localeCompare(String(b.section_id)));

  const selected = ranked.slice(0, requestedLimit);
  const sourceVersion = selected[0]?.source_version || rows[0]?.source_version || null;
  const rationale = selected.map(item => ({
    sectionId: item.section_id,
    rationale: item.reasons?.length > 0
      ? `Selected for: ${item.reasons.join(', ')}`
      : 'Selected as best available company profile context for the query.',
  }));

  return {
    query: String(queryText || ''),
    intents: resolvedIntents,
    intentResolution: {
      inferred: intentResolution.inferred,
      providedIntentCount: Array.isArray(intents) ? intents.filter(Boolean).length : 0,
      resolvedIntentCount: resolvedIntents.length,
    },
    retrievalMode: 'metadata-candidate-search+heuristic-rerank',
    sourceVersion,
    candidates: ranked.slice(0, Math.max(requestedLimit * 2, requestedLimit)).map(item => ({
      sectionId: item.section_id,
      title: item.title,
      score: item.score,
      reasons: item.reasons,
    })),
    rationale,
    sections: selected.map(item => ({
      sectionId: item.section_id,
      title: item.title,
      summary: item.summary,
      score: item.score,
      reasons: item.reasons,
      sourceVersion: item.source_version || null,
      content: item.content,
      tags: Array.isArray(item.tags) ? item.tags : [],
    })),
  };
}
