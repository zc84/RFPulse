import { createHash } from 'node:crypto';
import { query } from '../db.js';

const REQUIREMENT_KEYWORDS = [
  'must',
  'shall',
  'required',
  'should',
  'optional',
  'submit',
  'deadline',
  'compliance',
  'security',
  'pricing',
  'commercial',
  'appendix',
  'attachment',
  'certificate',
  'evidence',
  'proof',
];

function hashContent(content) {
  return createHash('sha256').update(String(content || ''), 'utf8').digest('hex');
}

function inferLanguage(text) {
  const value = String(text || '');
  const cyrillic = (value.match(/[\u0400-\u04FF]/g) || []).length;
  const latin = (value.match(/[A-Za-z]/g) || []).length;
  if (cyrillic > latin * 1.3) return 'ru';
  return 'en';
}

function splitDocumentIntoChunks(text) {
  const value = String(text || '').trim();
  if (!value) return [];

  const markerRegex = /(?=^##\s+(?:Page\s+\d+|Worksheet:\s+.+)$)/gm;
  const sections = value.split(markerRegex).map(part => part.trim()).filter(Boolean);
  if (sections.length <= 1) {
    return [{ locator: 'full-document', content: value }];
  }

  return sections.map((section, index) => {
    const firstLine = section.split(/\r?\n/, 1)[0]?.trim() || `section-${index + 1}`;
    return {
      locator: firstLine.replace(/^##\s+/, ''),
      content: section,
    };
  });
}

function splitRequirementCandidates(text) {
  return String(text || '')
    .split(/\r?\n|(?<=[.!?;:])\s+(?=[A-ZА-Я])/g)
    .map(line => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean)
    .filter(line => line.length >= 20);
}

function normalizeRequirementText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyObligationLevel(text) {
  const value = String(text || '').toLowerCase();
  if (/\b(must|shall|required|mandatory|обязан|обязательно)\b/.test(value)) return 'mandatory';
  if (/\b(should|recommended|желательно|рекомендуется)\b/.test(value)) return 'should';
  if (/\b(optional|may|может|опционально)\b/.test(value)) return 'optional';
  return 'informational';
}

function classifyResponseType(text) {
  const value = String(text || '').toLowerCase();
  if (/\b(form|template|annex|appendix|application form|questionnaire|таблица|форма)\b/.test(value)) return 'form';
  if (/\b(attachment|certificate|license|licence|cv|portfolio|appendix|annex|вложени|сертификат)\b/.test(value)) return 'attachment';
  if (/\b(price|pricing|commercial|budget|cost|financial|usd|eur|стоим|бюджет)\b/.test(value)) return 'commercial';
  if (/\b(evidence|proof|reference|case study|подтвержд|доказательств)\b/.test(value)) return 'evidence';
  return 'narrative';
}

function classifyCategory(text) {
  const value = String(text || '').toLowerCase();
  if (/\b(security|iso|compliance|gdpr|confidentiality|audit|legal|law|privacy|регулятор|соответств)\b/.test(value)) return 'compliance';
  if (/\b(price|pricing|commercial|budget|cost|payment|invoice|финанс|стоим)\b/.test(value)) return 'commercial';
  if (/\b(architecture|integration|api|technology|platform|infrastructure|performance|availability|техничес)\b/.test(value)) return 'technical';
  if (/\b(submission|deadline|date|format|section|template|signed|подать|срок)\b/.test(value)) return 'submission';
  if (/\b(implementation|delivery|timeline|milestone|support|sla|обслужив|внедрени)\b/.test(value)) return 'delivery';
  return 'general';
}

function classifyPriority(text, obligationLevel) {
  const value = String(text || '').toLowerCase();
  if (obligationLevel === 'mandatory' && /\b(deadline|submission|security|compliance|legal|penalt|liability)\b/.test(value)) return 'critical';
  if (obligationLevel === 'mandatory') return 'high';
  if (obligationLevel === 'should') return 'medium';
  return 'low';
}

function extractKeywordMatches(text) {
  const value = String(text || '').toLowerCase();
  return REQUIREMENT_KEYWORDS.filter(keyword => value.includes(keyword));
}

function detectMissingAppendixGap(text) {
  const value = String(text || '').toLowerCase();
  const mentionsReferencedAttachment = /\b(appendix|annex|attachment|schedule|exhibit)\b/.test(value);
  if (!mentionsReferencedAttachment) return false;
  return /\b(missing|not attached|not provided|to be provided|not included|not enclosed|absent)\b/.test(value);
}

export function buildEvidenceItemsFromExtractedDocs(extractedDocs) {
  const items = [];
  for (const doc of extractedDocs || []) {
    if (!doc?.success || !doc?.text) continue;
    const chunks = splitDocumentIntoChunks(doc.text);
    const totalChunks = chunks.length;
    chunks.forEach((chunk, index) => {
      items.push({
        sourceDocumentId: doc.id,
        sourceType: 'client_document',
        locator: chunk.locator,
        content: chunk.content,
        language: inferLanguage(chunk.content),
        confidence: 0.98,
        contentHash: hashContent(`${doc.id}:${chunk.locator}:${chunk.content}`),
        metadata: {
          documentName: doc.name || null,
          chunkIndex: index + 1,
          chunkCount: totalChunks,
          fromTableLikeContent: chunk.content.includes('| ---') || chunk.content.includes('Worksheet:'),
        },
      });
    });
  }
  return items;
}

export function extractRequirementsFromEvidence(evidenceItems) {
  const byNormalized = new Map();

  for (const evidence of evidenceItems || []) {
    const candidates = splitRequirementCandidates(evidence.content);
    for (const candidate of candidates) {
      const keywordMatches = extractKeywordMatches(candidate);
      if (keywordMatches.length === 0) continue;

      const normalized = normalizeRequirementText(candidate);
      if (!normalized) continue;
      const isMissingAppendixGap = detectMissingAppendixGap(candidate);

      if (!byNormalized.has(normalized)) {
        const obligationLevel = classifyObligationLevel(candidate);
        const responseType = classifyResponseType(candidate);
        byNormalized.set(normalized, {
          sourceDocumentId: evidence.sourceDocumentId,
          sourceLocator: evidence.locator,
          text: candidate,
          normalizedText: normalized,
          category: classifyCategory(candidate),
          obligationLevel,
          responseType,
          priority: isMissingAppendixGap ? 'critical' : classifyPriority(candidate, obligationLevel),
          status: isMissingAppendixGap ? 'gap' : 'open',
          conflictGroup: null,
          metadata: {
            sourceEvidenceHash: evidence.contentHash,
            keywordMatches,
            gapType: isMissingAppendixGap ? 'missing-appendix-reference' : null,
            sourceRefs: [{
              sourceDocumentId: evidence.sourceDocumentId,
              sourceLocator: evidence.locator,
              sourceEvidenceHash: evidence.contentHash,
            }],
          },
        });
        continue;
      }

      const existing = byNormalized.get(normalized);
      const refs = Array.isArray(existing.metadata?.sourceRefs) ? existing.metadata.sourceRefs : [];
      const duplicateRefKey = `${evidence.sourceDocumentId || 'none'}::${evidence.locator || 'none'}::${evidence.contentHash || 'none'}`;
      const alreadyTracked = refs.some(ref => (
        `${ref.sourceDocumentId || 'none'}::${ref.sourceLocator || 'none'}::${ref.sourceEvidenceHash || 'none'}`
      ) === duplicateRefKey);

      if (!alreadyTracked) {
        refs.push({
          sourceDocumentId: evidence.sourceDocumentId,
          sourceLocator: evidence.locator,
          sourceEvidenceHash: evidence.contentHash,
        });
      }

      const existingKeywords = new Set(existing.metadata?.keywordMatches || []);
      for (const keyword of keywordMatches) existingKeywords.add(keyword);

      existing.metadata = {
        ...(existing.metadata || {}),
        keywordMatches: [...existingKeywords],
        sourceRefs: refs,
      };
    }
  }

  return [...byNormalized.values()];
}

export function buildRequirementInventorySummary(requirements) {
  const rows = Array.isArray(requirements) ? requirements : [];
  const summary = {
    total: rows.length,
    byObligationLevel: {},
    byStatus: {},
    byPriority: {},
    byResponseType: {},
    byCategory: {},
    missingAppendixGapCount: 0,
    coveredDocuments: 0,
  };

  const documentIds = new Set();
  for (const row of rows) {
    const obligation = row.obligation_level || row.obligationLevel || 'unknown';
    const status = row.status || 'unknown';
    const priority = row.priority || 'unknown';
    const responseType = row.response_type || row.responseType || 'unknown';
    const category = row.category || 'unknown';
    const metadata = row.metadata && typeof row.metadata === 'string'
      ? (() => {
          try { return JSON.parse(row.metadata); } catch { return {}; }
        })()
      : (row.metadata || {});

    summary.byObligationLevel[obligation] = (summary.byObligationLevel[obligation] || 0) + 1;
    summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
    summary.byPriority[priority] = (summary.byPriority[priority] || 0) + 1;
    summary.byResponseType[responseType] = (summary.byResponseType[responseType] || 0) + 1;
    summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;
    if (metadata?.gapType === 'missing-appendix-reference') {
      summary.missingAppendixGapCount += 1;
    }

    const sourceDocumentId = row.source_document_id ?? row.sourceDocumentId;
    if (sourceDocumentId !== null && sourceDocumentId !== undefined) {
      documentIds.add(sourceDocumentId);
    }
  }

  summary.coveredDocuments = documentIds.size;
  return summary;
}

export async function persistRunEvidenceAndRequirements({ sessionId, dealId, extractedDocs, queryFn = query }) {
  try {
    await queryFn('DELETE FROM ai_requirements WHERE session_id = $1', [sessionId]);
    await queryFn('DELETE FROM ai_evidence_items WHERE session_id = $1', [sessionId]);

    const evidenceItems = buildEvidenceItemsFromExtractedDocs(extractedDocs);
    for (const item of evidenceItems) {
      await queryFn(
        `INSERT INTO ai_evidence_items
           (session_id, deal_id, source_document_id, source_type, locator, content, language, confidence, content_hash, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (session_id, source_document_id, content_hash) DO NOTHING`,
        [
          sessionId,
          dealId,
          item.sourceDocumentId,
          item.sourceType,
          item.locator,
          item.content,
          item.language,
          item.confidence,
          item.contentHash,
          JSON.stringify(item.metadata || {}),
        ]
      );
    }

    const requirements = extractRequirementsFromEvidence(evidenceItems);
    for (const req of requirements) {
      await queryFn(
        `INSERT INTO ai_requirements
          (session_id, deal_id, source_document_id, source_locator, text, normalized_text, category, obligation_level, response_type, priority, status, conflict_group, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          sessionId,
          dealId,
          req.sourceDocumentId,
          req.sourceLocator,
          req.text,
          req.normalizedText,
          req.category,
          req.obligationLevel,
          req.responseType,
          req.priority,
          req.status,
          req.conflictGroup,
          JSON.stringify(req.metadata || {}),
        ]
      );
    }

    return {
      skipped: false,
      evidenceCount: evidenceItems.length,
      requirementCount: requirements.length,
    };
  } catch (err) {
    if (err?.code === '42P01') {
      return { skipped: true, reason: 'phase1_tables_missing', evidenceCount: 0, requirementCount: 0 };
    }
    throw err;
  }
}

export async function listRequirementInventory({ dealId, sessionId = null, queryFn = query }) {
  try {
    const params = [dealId];
    let where = 'WHERE r.deal_id = $1';
    if (sessionId) {
      params.push(sessionId);
      where += ` AND r.session_id = $${params.length}`;
    }

    const result = await queryFn(
      `SELECT r.*, d.name AS source_document_name
       FROM ai_requirements r
       LEFT JOIN documents d ON d.id = r.source_document_id
       ${where}
       ORDER BY
         CASE r.priority
           WHEN 'critical' THEN 0
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           ELSE 3
         END,
         r.id ASC`,
      params
    );
    return result.rows;
  } catch (err) {
    if (err?.code === '42P01') return [];
    throw err;
  }
}
