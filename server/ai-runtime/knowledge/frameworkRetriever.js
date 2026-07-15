import { query } from '../../db.js';
import { searchFrameworkKnowledgeSections, syncFrameworkKnowledgeSections } from './frameworkRepository.js';
import { resolveRetrievalIntents } from './knowledgeIntent.js';

let frameworkSyncPromise = null;

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

function scoreFrameworkRow(row, tokens) {
  const title = normalizeText(row.title);
  const summary = normalizeText(row.summary);
  const content = normalizeText(row.content).slice(0, 6000);
  const tags = Array.isArray(row.tags) ? row.tags.map(item => normalizeText(item)) : [];
  const questions = Array.isArray(row.rfp_questions) ? row.rfp_questions.map(item => normalizeText(item)) : [];

  let score = 0;
  const reasons = [];
  for (const token of tokens) {
    if (!token) continue;
    if (title.includes(token)) {
      score += 5;
      reasons.push(`title:${token}`);
    }
    if (tags.some(tag => tag.includes(token))) {
      score += 4;
      reasons.push(`tag:${token}`);
    }
    if (questions.some(question => question.includes(token))) {
      score += 3;
      reasons.push(`rfp_question:${token}`);
    }
    if (summary.includes(token)) {
      score += 2;
      reasons.push(`summary:${token}`);
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

async function ensureFrameworkKnowledgeLoaded(queryFn = query) {
  if (!frameworkSyncPromise) {
    frameworkSyncPromise = syncFrameworkKnowledgeSections(queryFn).catch(error => {
      frameworkSyncPromise = null;
      throw error;
    });
  }
  return frameworkSyncPromise;
}

async function loadAllFrameworkRows(queryFn = query) {
  const result = await queryFn(
    `SELECT source_type, section_id, title, summary, tags, rfp_questions,
            related_sections, engagement_models, content, source_version, metadata
     FROM knowledge_sections
     WHERE source_type = 'framework'
       AND active = TRUE
     ORDER BY section_id ASC`
  );
  return result.rows;
}

export async function retrieveFrameworkSections({
  queryText = '',
  intents = [],
  limit = 5,
  includeRelated = true,
  relatedLimit = 2,
} = {}, queryFn = query) {
  await ensureFrameworkKnowledgeLoaded(queryFn);
  const rows = await loadAllFrameworkRows(queryFn);

  const intentResolution = resolveRetrievalIntents(queryText, intents, { maxIntents: 4 });
  const resolvedIntents = intentResolution.intents;
  const joinedIntentText = Array.isArray(resolvedIntents) ? resolvedIntents.join(' ') : '';
  const tokens = tokenize(`${queryText} ${joinedIntentText}`);
  const requestedLimit = Math.max(1, Math.min(Number(limit || 5), 10));
  const maxRelated = Math.max(0, Math.min(Number(relatedLimit || 2), 5));

  const ranked = rows
    .map(row => {
      const scored = scoreFrameworkRow(row, tokens);
      return {
        ...row,
        score: scored.score,
        reasons: scored.reasons,
      };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.section_id).localeCompare(String(b.section_id)));

  const selected = ranked.slice(0, requestedLimit);
  const selectedById = new Map(selected.map(item => [item.section_id, item]));

  if (includeRelated && maxRelated > 0) {
    for (const base of [...selected]) {
      const relatedIds = Array.isArray(base.related_sections) ? base.related_sections : [];
      for (const relatedId of relatedIds.slice(0, maxRelated)) {
        if (selectedById.has(relatedId)) continue;
        const related = rows.find(row => row.section_id === relatedId);
        if (!related) continue;
        const relatedScored = scoreFrameworkRow(related, tokens);
        selectedById.set(relatedId, {
          ...related,
          score: Math.max(relatedScored.score, 1),
          reasons: [...new Set([...(relatedScored.reasons || []), `related:${base.section_id}`])],
        });
      }
    }
  }

  const expanded = [...selectedById.values()]
    .sort((a, b) => b.score - a.score || String(a.section_id).localeCompare(String(b.section_id)))
    .slice(0, requestedLimit + maxRelated);

  const sourceVersion = expanded[0]?.source_version || rows[0]?.source_version || null;

  const rationale = expanded.map(item => ({
    sectionId: item.section_id,
    rationale: item.reasons?.length > 0
      ? `Selected for: ${item.reasons.join(', ')}`
      : 'Selected as best available framework context for the query.',
  }));

  return {
    query: String(queryText || ''),
    intents: resolvedIntents,
    intentResolution: {
      inferred: intentResolution.inferred,
      providedIntentCount: Array.isArray(intents) ? intents.filter(Boolean).length : 0,
      resolvedIntentCount: resolvedIntents.length,
    },
    sourceVersion,
    retrievalMode: 'metadata-candidate-search+heuristic-rerank',
    candidates: ranked.slice(0, Math.max(requestedLimit * 2, requestedLimit)).map(item => ({
      sectionId: item.section_id,
      title: item.title,
      score: item.score,
      reasons: item.reasons,
    })),
    rationale,
    sections: expanded.map(item => ({
      sectionId: item.section_id,
      title: item.title,
      summary: item.summary,
      score: item.score,
      reasons: item.reasons,
      sourceVersion: item.source_version || null,
      content: item.content,
      relatedSections: Array.isArray(item.related_sections) ? item.related_sections : [],
      tags: Array.isArray(item.tags) ? item.tags : [],
      rfpQuestions: Array.isArray(item.rfp_questions) ? item.rfp_questions : [],
    })),
  };
}

export async function listFrameworkSections({ limit = 5 } = {}, queryFn = query) {
  await ensureFrameworkKnowledgeLoaded(queryFn);
  const rows = await searchFrameworkKnowledgeSections({ limit }, queryFn);
  return rows.map(row => ({
    sectionId: row.section_id,
    title: row.title,
    summary: row.summary,
    sourceVersion: row.source_version || null,
    tags: Array.isArray(row.tags) ? row.tags : [],
  }));
}
