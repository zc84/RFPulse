import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  DEFAULT_CAPABILITIES,
  applyVisualSelectionPolicy,
  createStructuredFactIndex,
  visualArtifactPlanSchema,
  visualPlanRequestSchema,
} from '../domain/index.js';
import {
  ENDPOINT_VISUAL_PLANNER_PROMPT_VERSION,
  ENDPOINT_VISUAL_PLANNER_SYSTEM_PROMPT,
  buildEndpointVisualPlannerUserPrompt,
} from '../infrastructure/endpointVisualPlannerPrompt.js';
import { canonicalJson } from '../domain/facts.js';
import { visualError } from '../domain/errors.js';

export const ENDPOINT_VISUAL_SCHEMA_VERSION = '1';
export const ENDPOINT_RENDERER_POLICY_VERSION = 'endpoint-renderer-policy-v1';

const plannerAudienceSchema = z.enum(['executive', 'business', 'technical', 'mixed']);
const plannerVisualTypeSchema = z.enum([
  'architecture-overview',
  'architecture-details',
  'cloud-architecture',
  'architecture-c4',
  'gantt',
]);

// OpenAI strict structured outputs require every property to be present.
// Nullable fields are normalized back to optional domain fields after parsing.
const plannerDraftSchema = z.object({
  proposalProfile: z.object({
    proposalType: z.string().trim().min(1).max(120).nullable(),
    audiences: z.array(plannerAudienceSchema).max(4),
    themes: z.array(z.string().trim().min(1).max(160)).max(30),
    goals: z.array(z.string().trim().min(1).max(300)).max(20),
    availableFactClasses: z.array(z.string().trim().min(1).max(120)).max(30),
    inferredFields: z.array(z.string().trim().min(1).max(120)).max(30),
  }).strict(),
  candidates: z.array(z.object({
    type: plannerVisualTypeSchema,
    decision: z.enum(['selected', 'omitted', 'blocked']),
    purpose: z.string().trim().min(1).max(500).nullable(),
    relevance: z.number().min(0).max(1),
    evidenceCoverage: z.number().min(0).max(1),
    audienceFit: z.array(plannerAudienceSchema).max(4),
    reasonCodes: z.array(z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,79}$/)).max(20),
  }).strict()).max(5),
  requestSummary: z.string().trim().min(1).max(1_000),
  overview: z.object({
    title: z.string().trim().min(1).max(160),
    purpose: z.string().trim().min(1).max(500),
    audience: plannerAudienceSchema,
    content: z.object({
      groups: z.array(z.object({
        label: z.string().trim().min(1).max(120),
        componentLabels: z.array(z.string().trim().min(1).max(160)).min(1).max(20),
      }).strict()).min(1).max(12),
      relationships: z.array(z.object({
        sourceLabel: z.string().trim().min(1).max(160),
        targetLabel: z.string().trim().min(1).max(160),
        label: z.string().trim().min(1).max(120).nullable(),
      }).strict()).max(40),
      audienceEmphasis: z.array(z.string().trim().min(1).max(160)).max(10),
    }).strict(),
  }).strict().nullable(),
  warnings: z.array(z.string().trim().min(1).max(500)).max(30),
}).strict();

function normalizePlannerDraft(value) {
  const { proposalType, ...profile } = value.proposalProfile;
  return {
    ...value,
    proposalProfile: {
      ...profile,
      ...(proposalType ? { proposalType } : {}),
    },
    candidates: value.candidates.map(candidate => {
      const { purpose, ...decision } = candidate;
      return {
        ...decision,
        ...(purpose ? { purpose } : {}),
      };
    }),
    overview: value.overview
      ? {
        ...value.overview,
        content: {
          ...value.overview.content,
          relationships: value.overview.content.relationships.map(relationship => ({
            sourceLabel: relationship.sourceLabel,
            targetLabel: relationship.targetLabel,
            ...(relationship.label ? { label: relationship.label } : {}),
          })),
        },
      }
      : undefined,
  };
}

function digestSource(source) {
  return createHash('sha256').update(canonicalJson(source)).digest('hex');
}

function evidenceForPrefix(factIndex, prefix) {
  const refs = factIndex.facts
    .filter(fact => fact.canonicalPath === prefix || fact.canonicalPath.startsWith(`${prefix}/`))
    .slice(0, 32)
    .map(({ factId, sourceId, canonicalPath, sourceDigest, valueDigest }) => ({
      factId,
      sourceId,
      canonicalPath,
      sourceDigest,
      valueDigest,
    }));
  if (refs.length === 0) {
    throw visualError('PLAN_INVALID', `No canonical evidence exists for '${prefix}'.`, 422);
  }
  return refs;
}

function commonArtifactFields(type, draft, context, index) {
  const candidate = draft.candidates.find(item => item.type === type);
  return {
    id: `visual-${index + 1}-${type}`,
    title: candidate?.purpose || type,
    purpose: candidate?.purpose || `Explain ${type}`,
    audience: candidate?.audienceFit?.[0] || context.audience?.[0] || 'mixed',
    required: true,
    dependsOn: [],
    presentation: {
      emphasis: [],
      direction: type === 'gantt' ? 'LR' : 'LR',
      density: 'balanced',
    },
  };
}

function buildOverviewArtifact({ source, draft, context, index }) {
  const common = commonArtifactFields('architecture-overview', draft, context, index);
  const architecture = source.structured_data?.architecture;
  const cloud = source.structured_data?.cloudArchitecture;
  const c4 = source.structured_data?.c4;
  const structuredOverview = [
    {
      elements: architecture?.components,
      boundaries: architecture?.boundaries,
      relationships: architecture?.relationships,
    },
    {
      elements: cloud?.resources,
      boundaries: cloud?.boundaries,
      relationships: cloud?.relationships,
    },
    {
      elements: c4?.elements,
      boundaries: c4?.boundaries,
      relationships: c4?.relationships,
    },
  ].find(candidate => candidate.elements?.length > 0);
  const elements = structuredOverview?.elements || [];
  const boundaries = structuredOverview?.boundaries || [];
  const relationships = structuredOverview?.relationships || [];
  if (!structuredOverview && draft.overview) {
    return {
      ...common,
      title: draft.overview.title,
      purpose: draft.overview.purpose,
      audience: draft.overview.audience,
      type: 'architecture-overview',
      fidelityClass: 'conceptual',
      content: draft.overview.content,
    };
  }
  if (elements.length === 0) {
    throw visualError('PLAN_INVALID', 'The planner selected architecture-overview but returned no overview content.', 422);
  }
  const labelById = new Map(elements.map(item => [item.id, item.label]));
  return {
    ...common,
    title: draft.overview?.title || common.title,
    purpose: 'Provide an executive conceptual view of the proposed solution architecture.',
    audience: draft.overview?.audience || common.audience,
    type: 'architecture-overview',
    fidelityClass: 'conceptual',
    content: {
      groups: (boundaries.length ? boundaries : [{ id: 'solution', label: 'Proposed solution' }]).map(boundary => ({
        label: boundary.label,
        componentLabels: elements
          .filter(item => boundaries.length === 0 || item.boundaryId === boundary.id)
          .map(item => item.label),
      })).filter(group => group.componentLabels.length > 0),
      relationships: relationships.map(edge => ({
        sourceLabel: labelById.get(edge.from) || edge.from,
        targetLabel: labelById.get(edge.to) || edge.to,
        label: edge.label || edge.protocol || edge.technology,
      })),
      audienceEmphasis: context.customer_priorities || [],
    },
  };
}

function buildDetailsArtifact({ source, factIndex, draft, context, index }) {
  const data = source.structured_data?.architecture;
  if (!data) throw visualError('PLAN_INVALID', 'Structured architecture data is required.', 422);
  return {
    ...commonArtifactFields('architecture-details', draft, context, index),
    type: 'architecture-details',
    fidelityClass: 'structural_exact',
    content: {
      components: (data.components || []).map((item, itemIndex) => ({
        ...item,
        evidence: evidenceForPrefix(factIndex, `/structured_data/architecture/components/${itemIndex}`),
      })),
      relationships: (data.relationships || []).map((item, itemIndex) => ({
        ...item,
        evidence: evidenceForPrefix(factIndex, `/structured_data/architecture/relationships/${itemIndex}`),
      })),
      boundaries: (data.boundaries || []).map((item, itemIndex) => ({
        ...item,
        evidence: evidenceForPrefix(factIndex, `/structured_data/architecture/boundaries/${itemIndex}`),
      })),
    },
  };
}

function buildCloudArtifact({ source, factIndex, draft, context, index }) {
  const data = source.structured_data?.cloudArchitecture;
  if (!data) throw visualError('PLAN_INVALID', 'Structured cloud architecture data is required.', 422);
  return {
    ...commonArtifactFields('cloud-architecture', draft, context, index),
    type: 'cloud-architecture',
    fidelityClass: 'structural_exact',
    content: {
      provider: data.provider,
      resources: data.resources.map((item, itemIndex) => ({
        ...item,
        evidence: evidenceForPrefix(factIndex, `/structured_data/cloudArchitecture/resources/${itemIndex}`),
      })),
      boundaries: (data.boundaries || []).map((item, itemIndex) => ({
        ...item,
        evidence: evidenceForPrefix(factIndex, `/structured_data/cloudArchitecture/boundaries/${itemIndex}`),
      })),
      relationships: (data.relationships || []).map((item, itemIndex) => ({
        ...item,
        evidence: evidenceForPrefix(factIndex, `/structured_data/cloudArchitecture/relationships/${itemIndex}`),
      })),
      evidence: evidenceForPrefix(factIndex, '/structured_data/cloudArchitecture/provider'),
    },
  };
}

function buildC4Artifact({ source, factIndex, draft, context, index }) {
  const data = source.structured_data?.c4;
  if (!data) throw visualError('PLAN_INVALID', 'Structured C4 data is required.', 422);
  return {
    ...commonArtifactFields('architecture-c4', draft, context, index),
    type: 'architecture-c4',
    fidelityClass: 'structural_exact',
    content: {
      level: data.level,
      elements: data.elements.map((item, itemIndex) => ({
        ...item,
        evidence: evidenceForPrefix(factIndex, `/structured_data/c4/elements/${itemIndex}`),
      })),
      boundaries: (data.boundaries || []).map((item, itemIndex) => ({
        ...item,
        evidence: evidenceForPrefix(factIndex, `/structured_data/c4/boundaries/${itemIndex}`),
      })),
      relationships: data.relationships.map((item, itemIndex) => ({
        ...item,
        evidence: evidenceForPrefix(factIndex, `/structured_data/c4/relationships/${itemIndex}`),
      })),
      evidence: evidenceForPrefix(factIndex, '/structured_data/c4/level'),
    },
  };
}

function buildGanttArtifact({ source, factIndex, draft, context, index }) {
  const tasks = source.structured_data?.timeline;
  if (!tasks) throw visualError('PLAN_INVALID', 'Structured timeline data is required.', 422);
  return {
    ...commonArtifactFields('gantt', draft, context, index),
    type: 'gantt',
    fidelityClass: 'data_exact',
    content: {
      tasks: tasks.map((item, itemIndex) => ({
        ...item,
        evidence: evidenceForPrefix(factIndex, `/structured_data/timeline/${itemIndex}`),
      })),
    },
  };
}

const builders = {
  'architecture-overview': buildOverviewArtifact,
  'architecture-details': buildDetailsArtifact,
  'cloud-architecture': buildCloudArtifact,
  'architecture-c4': buildC4Artifact,
  gantt: buildGanttArtifact,
};

export function createPlanVisualsUseCase({
  provider,
  planStore,
  budgetGate = { reserve: async () => {} },
  capabilities = DEFAULT_CAPABILITIES,
  plannerModel = process.env.ENDPOINT_VISUAL_PLANNER_MODEL || 'gpt-4.1-mini',
}) {
  return async function planVisuals(input, { signal } = {}) {
    const request = visualPlanRequestSchema.parse(input);
    await budgetGate.reserve({ plannerCalls: 1, imageCalls: 0 });
    const factIndex = createStructuredFactIndex(request.source.structured_data || {});
    const sourceDigest = digestSource(request.source);
    const promptFacts = factIndex.facts.map(fact => ({
      factId: fact.factId,
      canonicalPath: fact.canonicalPath,
      value: fact.value,
      sourceDigest: fact.sourceDigest,
      valueDigest: fact.valueDigest,
    }));
    const completion = await provider.completeStructured({
      schema: plannerDraftSchema,
      schemaName: 'endpoint_visual_plan_draft',
      systemPrompt: ENDPOINT_VISUAL_PLANNER_SYSTEM_PROMPT,
      userPrompt: buildEndpointVisualPlannerUserPrompt({
        source: request.source,
        context: request.context,
        selection: request.selection,
        canonicalFacts: promptFacts,
        enabledTypes: Object.keys(capabilities).filter(type => capabilities[type]),
      }),
      signal,
    });
    const draft = normalizePlannerDraft(completion.value);
    const policy = applyVisualSelectionPolicy({
      source: request.source,
      selection: request.selection,
      candidates: draft.candidates,
      capabilities,
    });
    const artifacts = policy.selectedTypes.map((type, index) => builders[type]({
      source: request.source,
      factIndex,
      draft,
      context: request.context,
      index,
    }));
    const plan = visualArtifactPlanSchema.parse({
      version: ENDPOINT_VISUAL_SCHEMA_VERSION,
      proposalProfile: draft.proposalProfile,
      candidates: policy.decisions,
      requestSummary: draft.requestSummary,
      artifacts,
      warnings: draft.warnings,
    });
    const versions = {
      schema: ENDPOINT_VISUAL_SCHEMA_VERSION,
      prompt: ENDPOINT_VISUAL_PLANNER_PROMPT_VERSION,
      model: completion.model || plannerModel,
      rendererPolicy: ENDPOINT_RENDERER_POLICY_VERSION,
    };

    let issued = null;
    if (policy.renderable && plan.artifacts.length > 0) {
      issued = await planStore.issue({ plan, sourceDigest, versions });
    }

    return {
      plan,
      policy,
      sourceDigest,
      versions,
      planToken: issued?.token || null,
      expiresAt: issued?.expiresAt || null,
      usage: completion.usage || null,
      estimates: {
        plannerCalls: 1,
        imageCalls: plan.artifacts.filter(artifact => artifact.type === 'architecture-overview').length,
        deterministicRenders: plan.artifacts.filter(artifact => artifact.type !== 'architecture-overview').length,
        latencyBand: plan.artifacts.some(artifact => artifact.type === 'architecture-overview') ? 'high' : 'medium',
        costBand: plan.artifacts.some(artifact => artifact.type === 'architecture-overview') ? 'medium' : 'low',
      },
    };
  };
}

export { plannerDraftSchema };
