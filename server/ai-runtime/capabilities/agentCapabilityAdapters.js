import {
  runAgent,
  runEstimator,
  buildFinalProposalMarkdown,
} from '../../services/aiOrchestrator.js';
import { retrieveFrameworkSections } from '../knowledge/frameworkRetriever.js';
import { retrieveCompanyProfileSections } from '../knowledge/companyProfileRetriever.js';

export const EVIDENCE_CLASSIFICATION = {
  CLIENT_REQUIREMENT: 'client_requirement',
  ANDERSEN_CAPABILITY_FRAMEWORK_CONTENT: 'andersen_capability_framework_content',
  RECOMMENDATION: 'recommendation',
  ASSUMPTION: 'assumption',
};

function normalizeClassification(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === EVIDENCE_CLASSIFICATION.CLIENT_REQUIREMENT) return normalized;
  if (normalized === EVIDENCE_CLASSIFICATION.ANDERSEN_CAPABILITY_FRAMEWORK_CONTENT) return normalized;
  if (normalized === EVIDENCE_CLASSIFICATION.RECOMMENDATION) return normalized;
  if (normalized === EVIDENCE_CLASSIFICATION.ASSUMPTION) return normalized;
  return null;
}

export function normalizeClassifiedEvidence(input = []) {
  if (!Array.isArray(input)) return [];
  return input
    .map(item => {
      if (!item || typeof item !== 'object') return null;
      const classification = normalizeClassification(item.classification);
      if (!classification) return null;
      return {
        sourceType: String(item.sourceType || 'runtime').toLowerCase(),
        sourceId: item.sourceId ? String(item.sourceId) : null,
        title: item.title ? String(item.title) : null,
        sourceVersion: item.sourceVersion ? String(item.sourceVersion) : null,
        classification,
        rationale: item.rationale ? String(item.rationale) : '',
      };
    })
    .filter(Boolean);
}

export const LEGACY_SPECIALIST_TO_CAPABILITY = {
  legal: 'analysis.legal',
  architect: 'analysis.solution',
  estimator: 'analysis.estimation',
};

export function mapSpecialistsToCapabilities(specialists = []) {
  const ordered = [];
  for (const specialist of specialists || []) {
    const capability = LEGACY_SPECIALIST_TO_CAPABILITY[specialist];
    if (capability && !ordered.includes(capability)) ordered.push(capability);
  }
  if (!ordered.includes('proposal.integrate')) ordered.push('proposal.integrate');
  return ordered;
}

export function createCapabilityAdapterContext({
  context,
  conversation,
  priorityInstructions = '',
  signal = null,
  dealName = null,
  outputs = {},
}) {
  return {
    context,
    conversation,
    priorityInstructions,
    signal,
    dealName,
    outputs,
  };
}

export const capabilityAdapterHandlers = {
  'knowledge.retrieve.framework': async ctx => {
    const queryText = ctx.inputRefs?.framework_retrieval_query || ctx.outputs?.framework_retrieval_query || '';
    const intents = ctx.inputRefs?.framework_retrieval_intents || ctx.outputs?.framework_retrieval_intents || [];
    const retrieval = await retrieveFrameworkSections({
      queryText,
      intents,
      limit: 5,
      includeRelated: true,
      relatedLimit: 2,
    });
    const additionalEvidence = normalizeClassifiedEvidence(ctx.inputRefs?.classified_evidence);
    return {
      framework_sections: retrieval.sections,
      knowledge_evidence: retrieval.sections.map(section => ({
        sourceType: 'framework',
        sourceId: section.sectionId,
        title: section.title,
        sourceVersion: section.sourceVersion || retrieval.sourceVersion || null,
        classification: EVIDENCE_CLASSIFICATION.ANDERSEN_CAPABILITY_FRAMEWORK_CONTENT,
        rationale: Array.isArray(section.reasons) ? section.reasons.join(', ') : '',
      })).concat(additionalEvidence),
      framework_retrieval_trace: {
        query: retrieval.query,
        intents: retrieval.intents,
        sourceVersion: retrieval.sourceVersion,
        intentResolution: retrieval.intentResolution,
        candidates: retrieval.candidates,
        rationale: retrieval.rationale || [],
        retrievalMode: retrieval.retrievalMode || 'metadata-candidate-search+heuristic-rerank',
        evidenceClassificationVersion: 'phase4-v2',
        evidenceClasses: Object.values(EVIDENCE_CLASSIFICATION),
      },
    };
  },
  'knowledge.retrieve.company': async ctx => {
    const queryText = ctx.inputRefs?.company_retrieval_query || ctx.outputs?.company_retrieval_query || '';
    const intents = ctx.inputRefs?.company_retrieval_intents || ctx.outputs?.company_retrieval_intents || [];
    const retrieval = await retrieveCompanyProfileSections({
      queryText,
      intents,
      limit: 5,
    });
    const additionalEvidence = normalizeClassifiedEvidence(ctx.inputRefs?.classified_evidence);
    return {
      company_sections: retrieval.sections,
      company_evidence: retrieval.sections.map(section => ({
        sourceType: 'company',
        sourceId: section.sectionId,
        title: section.title,
        sourceVersion: section.sourceVersion || retrieval.sourceVersion || null,
        classification: EVIDENCE_CLASSIFICATION.ANDERSEN_CAPABILITY_FRAMEWORK_CONTENT,
        rationale: Array.isArray(section.reasons) ? section.reasons.join(', ') : '',
      })).concat(additionalEvidence),
      company_retrieval_trace: {
        query: retrieval.query,
        intents: retrieval.intents,
        sourceVersion: retrieval.sourceVersion,
        intentResolution: retrieval.intentResolution,
        candidates: retrieval.candidates,
        rationale: retrieval.rationale || [],
        retrievalMode: retrieval.retrievalMode || 'metadata-candidate-search+heuristic-rerank',
        evidenceClassificationVersion: 'phase4-v2',
        evidenceClasses: Object.values(EVIDENCE_CLASSIFICATION),
      },
    };
  },
  'analysis.legal': async ctx => runAgent('legal', ctx.context, ctx.conversation, {}, ctx.priorityInstructions, ctx.signal),
  'analysis.solution': async ctx => runAgent('architect', ctx.context, ctx.conversation, {}, ctx.priorityInstructions, ctx.signal),
  'analysis.estimation': async ctx => runEstimator(ctx.context, ctx.conversation, ctx.priorityInstructions, ctx.signal),
  'proposal.integrate': async ctx => buildFinalProposalMarkdown(
    ctx.dealName,
    ctx.context,
    ctx.conversation,
    ctx.outputs,
    ctx.priorityInstructions,
    ctx.signal
  ),
  // Phase 2 introduces quality capabilities as placeholders that can be fully implemented in Phase 5.
  'quality.coverage': async () => JSON.stringify({ findings: [], status: 'pass' }),
  'quality.consistency': async () => JSON.stringify({ findings: [], status: 'pass' }),
  'quality.evidence': async () => JSON.stringify({ findings: [], status: 'pass' }),
};
