import {
  callAgent,
  runAgent,
  runEstimator,
  buildFinalProposalMarkdown,
} from '../../services/aiOrchestrator.js';
import { requirementsExtractSchema } from '../../services/aiSchemas.js';
import {
  classifyDocumentRole,
  extractRequirementsFromEvidence,
} from '../../services/evidenceInventory.js';
import { retrieveFrameworkSections } from '../knowledge/frameworkRetriever.js';
import { retrieveCompanyProfileSections } from '../knowledge/companyProfileRetriever.js';
import { buildArtifactPlan } from '../artifacts/artifactPlanningService.js';
import {
  authorProposalSections,
  buildProposalStructure,
  buildRepairTasksFromFindings,
  evaluateConsistencyGate,
  evaluateCoverageGate,
  evaluateEvidenceGate,
  evaluateEstimationReconciliationGate,
  evaluateFrameworkCompanyAccuracyGate,
  evaluateStyleUsabilityGate,
  evaluateSubmissionComplianceGate,
} from '../quality/phase5QualityService.js';

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
  'requirements.extract': async ctx => {
    const evidenceItems = Array.isArray(ctx.inputRefs?.evidence_items) ? ctx.inputRefs.evidence_items : [];
    const evidencePack = evidenceItems.map(item => ({
      locator: item.locator || item.sourceLocator || 'unknown',
      contentHash: item.contentHash || item.content_hash || 'unknown',
      content: String(item.content || '').slice(0, 12000),
      documentName: item.metadata?.documentName || item.sourceDocumentName || null,
    }));
    const deterministic = extractRequirementsFromEvidence(evidenceItems);
    const fallback = {
      documentRole: classifyDocumentRole({
        name: evidencePack.map(item => item.documentName).filter(Boolean).join(' '),
        text: evidencePack.map(item => item.content).join('\n'),
      }),
      requirements: deterministic.map(item => ({
        text: item.text,
        category: item.category,
        obligationLevel: item.obligationLevel,
        responseType: item.responseType,
        priority: item.priority,
        sourceLocator: item.sourceLocator,
        sourceEvidenceHash: item.metadata?.sourceEvidenceHash || 'unknown',
        status: item.status,
        conflictTopic: item.conflictGroup,
      })),
      missingAppendices: deterministic
        .filter(item => item.status === 'gap')
        .map(item => item.text),
    };

    if (ctx.inputRefs?.structuredExtraction === false || evidencePack.length === 0) {
      return { ...fallback, extractionMode: 'deterministic-fallback' };
    }

    try {
      const raw = await callAgent('coordinator', [{
        role: 'user',
        content: [
          'Extract an atomic, auditable requirement inventory from the evidence below.',
          'Preserve exact sourceLocator and sourceEvidenceHash values. Do not invent requirements or evidence hashes.',
          'Classify the document role and explicitly list referenced but missing appendices.',
          JSON.stringify(evidencePack),
        ].join('\n\n'),
      }], {
        taskPromptKey: 'coordinator.context',
        schema: requirementsExtractSchema,
        schemaName: 'requirements_extract',
        maxTokens: 12000,
        signal: ctx.signal,
      });
      const parsed = requirementsExtractSchema.parse(JSON.parse(raw));
      return { ...parsed, extractionMode: 'structured-llm', deterministicBaseline: fallback };
    } catch (error) {
      if (ctx.signal?.aborted) throw error;
      return { ...fallback, extractionMode: 'deterministic-fallback', extractionWarning: error.message };
    }
  },
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
  'proposal.structure': async ctx => buildProposalStructure({
    requirementInventory: Array.isArray(ctx.inputRefs?.requirement_inventory) ? ctx.inputRefs.requirement_inventory : [],
    contextSummary: ctx.inputRefs?.context_summary || ctx.context || '',
    existingMarkdown: ctx.inputRefs?.proposal_markdown || '',
  }),
  'proposal.section-author': async ctx => {
    const proposalStructure = ctx.inputRefs?.proposal_structure || ctx.inputRefs?.proposal_model?.structure || null;
    const retrievalQuery = [
      ...(Array.isArray(proposalStructure?.sections) ? proposalStructure.sections : [])
        .map(section => `${section.title || ''} ${section.rationale || ''}`),
      ctx.inputRefs?.context_summary || '',
    ].join('\n');
    const frameworkSections = Array.isArray(ctx.inputRefs?.framework_sections)
      ? ctx.inputRefs.framework_sections
      : (await retrieveFrameworkSections({
        queryText: retrievalQuery,
        intents: ['delivery-methodology', 'quality', 'governance'],
        limit: 5,
      })).sections;
    const companySections = Array.isArray(ctx.inputRefs?.company_sections)
      ? ctx.inputRefs.company_sections
      : (await retrieveCompanyProfileSections({
        queryText: retrievalQuery,
        intents: ['company-profile', 'delivery-capability'],
        limit: 5,
      })).sections;

    return authorProposalSections({
      proposalStructure,
      requirements: Array.isArray(ctx.inputRefs?.requirements) ? ctx.inputRefs.requirements : [],
      evidenceItems: Array.isArray(ctx.inputRefs?.evidence_items) ? ctx.inputRefs.evidence_items : [],
      frameworkSections,
      companySections,
      existingMarkdown: ctx.inputRefs?.proposal_markdown || '',
    });
  },
  'artifact.plan': async ctx => ({
    artifact_plan: buildArtifactPlan({
      artifactIntent: Array.isArray(ctx.inputRefs?.artifact_intent) ? ctx.inputRefs.artifact_intent : [],
      proposalMarkdown: ctx.inputRefs?.proposal_markdown || '',
      proposalStructure: ctx.inputRefs?.proposal_structure || ctx.inputRefs?.proposal_model?.structure || null,
      estimationPackage: ctx.inputRefs?.estimation_package || ctx.outputs?.estimator || '',
      contextSummary: ctx.inputRefs?.context_summary || ctx.context || '',
      requirementInventory: Array.isArray(ctx.inputRefs?.requirements) ? ctx.inputRefs.requirements : [],
    }),
  }),
  'proposal.integrate': async ctx => buildFinalProposalMarkdown(
    ctx.dealName,
    ctx.context,
    ctx.conversation,
    ctx.outputs,
    ctx.priorityInstructions,
    ctx.signal
  ),
  'quality.coverage': async ctx => evaluateCoverageGate(
    Array.isArray(ctx.inputRefs?.requirements) ? ctx.inputRefs.requirements : [],
    ctx.inputRefs?.proposal_model || { markdown: '', sections: [] }
  ),
  'quality.consistency': async ctx => evaluateConsistencyGate(
    ctx.inputRefs?.proposal_model || { markdown: '', sections: [] }
  ),
  'quality.evidence': async ctx => evaluateEvidenceGate(
    Array.isArray(ctx.inputRefs?.claims) ? ctx.inputRefs.claims : [],
    Array.isArray(ctx.inputRefs?.claim_evidence_links) ? ctx.inputRefs.claim_evidence_links : []
  ),
  'quality.estimation': async ctx => evaluateEstimationReconciliationGate(
    ctx.inputRefs?.proposal_model || { markdown: '', sections: [] }
  ),
  'quality.submission': async ctx => evaluateSubmissionComplianceGate(
    Array.isArray(ctx.inputRefs?.requirements) ? ctx.inputRefs.requirements : [],
    ctx.inputRefs?.proposal_model || { markdown: '', sections: [] }
  ),
  'quality.framework-company': async ctx => evaluateFrameworkCompanyAccuracyGate(
    Array.isArray(ctx.inputRefs?.claims) ? ctx.inputRefs.claims : [],
    Array.isArray(ctx.inputRefs?.claim_evidence_links) ? ctx.inputRefs.claim_evidence_links : []
  ),
  'quality.style-usability': async ctx => evaluateStyleUsabilityGate(
    ctx.inputRefs?.proposal_model || { markdown: '', sections: [] }
  ),
  'repair.plan': async ctx => ({
    repair_tasks: buildRepairTasksFromFindings(Array.isArray(ctx.inputRefs?.findings) ? ctx.inputRefs.findings : []),
  }),
};
