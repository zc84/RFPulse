import { z } from 'zod';
import { DEFAULT_MAX_VISUALS, MAX_VISUALS, VISUAL_TYPES } from './catalog.js';

const boundedText = (maximum = 2_000) => z.string().trim().min(1).max(maximum);
const idSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
const visualTypeSchema = z.enum(VISUAL_TYPES);
const audienceSchema = z.enum(['executive', 'business', 'technical', 'mixed']);
const evidenceRefSchema = z.object({
  factId: idSchema,
  sourceId: z.literal('structured_data'),
  canonicalPath: boundedText(500),
  sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
  valueDigest: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

const evidenceListSchema = z.array(evidenceRefSchema).min(1).max(32);

const architectureComponentSchema = z.object({
  id: idSchema,
  label: boundedText(160),
  technology: boundedText(120).optional(),
  description: boundedText(500).optional(),
  boundaryId: idSchema.optional(),
}).strict();

const architectureRelationshipSchema = z.object({
  id: idSchema.optional(),
  from: idSchema,
  to: idSchema,
  label: boundedText(160).optional(),
  protocol: boundedText(80).optional(),
}).strict();

const architectureBoundarySchema = z.object({
  id: idSchema,
  label: boundedText(120),
  parentId: idSchema.optional(),
}).strict();

const detailedArchitectureSourceSchema = z.object({
  components: z.array(architectureComponentSchema).max(100).optional(),
  relationships: z.array(architectureRelationshipSchema).max(200).optional(),
  boundaries: z.array(architectureBoundarySchema).max(30).optional(),
}).strict();

const cloudResourceSchema = z.object({
  id: idSchema,
  label: boundedText(160),
  service: boundedText(120).optional(),
  resourceType: boundedText(120).optional(),
  boundaryId: idSchema.optional(),
}).strict();

const cloudSourceSchema = z.object({
  provider: z.enum(['aws', 'azure', 'gcp']),
  boundaries: z.array(z.object({
    id: idSchema,
    label: boundedText(160),
    kind: boundedText(80).optional(),
    parentId: idSchema.optional(),
  }).strict()).max(50).optional(),
  resources: z.array(cloudResourceSchema).max(150),
  relationships: z.array(architectureRelationshipSchema).max(300).optional(),
}).strict();

const c4ElementSchema = z.object({
  id: idSchema,
  label: boundedText(160),
  kind: z.enum(['person', 'software-system', 'container', 'component']),
  technology: boundedText(120).optional(),
  description: boundedText(500).optional(),
  boundaryId: idSchema.optional(),
}).strict();

const c4SourceSchema = z.object({
  level: z.enum(['context', 'container', 'component']),
  elements: z.array(c4ElementSchema).max(150),
  boundaries: z.array(architectureBoundarySchema).max(50).optional(),
  relationships: z.array(z.object({
    from: idSchema,
    to: idSchema,
    label: boundedText(160).optional(),
    technology: boundedText(120).optional(),
  }).strict()).max(300),
}).strict();

const timelineTaskSchema = z.object({
  id: idSchema,
  label: boundedText(160),
  start: z.iso.date(),
  end: z.iso.date(),
  group: boundedText(120).optional(),
  dependencies: z.array(idSchema).max(30).default([]),
  milestone: z.boolean().default(false),
}).strict();

export const structuredDataSchema = z.object({
  architecture: detailedArchitectureSourceSchema.optional(),
  cloudArchitecture: cloudSourceSchema.optional(),
  c4: c4SourceSchema.optional(),
  timeline: z.array(timelineTaskSchema).max(200).optional(),
}).strict();

const sourceSchema = z.object({
  proposal_markdown: boundedText(100_000).optional(),
  architecture_markdown: boundedText(100_000).optional(),
  structured_data: structuredDataSchema.optional(),
}).strict().refine(
  source => Boolean(
    source.proposal_markdown
      || source.architecture_markdown
      || (source.structured_data && Object.keys(source.structured_data).length > 0)
  ),
  { message: 'At least one textual or structured source must be provided.' }
);

const contextSchema = z.object({
  proposal_type: boundedText(120).optional(),
  audience: z.array(audienceSchema).max(4).optional(),
  stage: boundedText(80).optional(),
  goals: z.array(boundedText(300)).max(20).optional(),
  customer_priorities: z.array(boundedText(200)).max(20).optional(),
}).strict().default({});

const selectionSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('auto'),
    preferred_types: z.array(visualTypeSchema).max(VISUAL_TYPES.length).default([]),
    excluded_types: z.array(visualTypeSchema).max(VISUAL_TYPES.length).default([]),
    max_visuals: z.number().int().min(0).max(MAX_VISUALS).default(DEFAULT_MAX_VISUALS),
  }).strict(),
  z.object({
    mode: z.literal('recommend'),
    preferred_types: z.array(visualTypeSchema).max(VISUAL_TYPES.length).default([]),
    excluded_types: z.array(visualTypeSchema).max(VISUAL_TYPES.length).default([]),
    max_visuals: z.number().int().min(0).max(MAX_VISUALS).default(DEFAULT_MAX_VISUALS),
  }).strict(),
  z.object({
    mode: z.literal('explicit'),
    types: z.array(visualTypeSchema).min(1).max(VISUAL_TYPES.length),
    excluded_types: z.array(visualTypeSchema).max(VISUAL_TYPES.length).default([]),
    max_visuals: z.number().int().min(1).max(MAX_VISUALS).default(DEFAULT_MAX_VISUALS),
  }).strict(),
]);

const requestIntentSchema = z.object({
  intent: boundedText(1_000),
  language: z.string().trim().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/).default('en'),
}).strict();

const renderOptionsSchema = z.object({
  format: z.literal('png').default('png'),
  delivery: z.literal('base64').default('base64'),
  failure_policy: z.enum(['atomic', 'best_effort']).default('best_effort'),
  style_preset: z.literal('professional-light-v1').default('professional-light-v1'),
}).strict().default({});

const sourceRequestBase = {
  mode: z.literal('source').default('source'),
  source: sourceSchema,
  context: contextSchema,
  selection: selectionSchema,
  request: requestIntentSchema,
};

export const visualPlanRequestSchema = z.object(sourceRequestBase).strict();

const inlineRenderRequestSchema = z.object({
  ...sourceRequestBase,
  selection: selectionSchema.refine(value => value.mode !== 'recommend', {
    message: 'The recommend selection mode is only valid for the plan endpoint.',
  }),
  render: renderOptionsSchema,
  include_plan: z.boolean().default(false),
}).strict();

const tokenRenderRequestSchema = z.object({
  mode: z.literal('plan_token'),
  plan_token: z.string().min(32).max(4_096),
  render: renderOptionsSchema,
  include_plan: z.boolean().default(false),
}).strict();

export const visualRenderRequestSchema = z.discriminatedUnion('mode', [
  inlineRenderRequestSchema,
  tokenRenderRequestSchema,
]);

export const proposalProfileSchema = z.object({
  proposalType: boundedText(120).optional(),
  audiences: z.array(audienceSchema).max(4),
  themes: z.array(boundedText(160)).max(30),
  goals: z.array(boundedText(300)).max(20),
  availableFactClasses: z.array(boundedText(120)).max(30),
  inferredFields: z.array(boundedText(120)).max(30),
}).strict();

export const candidateDecisionSchema = z.object({
  type: visualTypeSchema,
  decision: z.enum(['selected', 'omitted', 'blocked']),
  purpose: boundedText(500).optional(),
  relevance: z.number().min(0).max(1),
  evidenceCoverage: z.number().min(0).max(1),
  audienceFit: z.array(audienceSchema).max(4),
  reasonCodes: z.array(z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,79}$/)).max(20),
}).strict();

const presentationSchema = z.object({
  emphasis: z.array(boundedText(160)).max(12).default([]),
  direction: z.enum(['LR', 'TB']).default('LR'),
  density: z.enum(['sparse', 'balanced', 'dense']).default('balanced'),
}).strict();

const artifactEnvelope = {
  id: idSchema,
  title: boundedText(160),
  purpose: boundedText(500),
  audience: audienceSchema,
  required: z.boolean(),
  dependsOn: z.array(idSchema).max(20),
  presentation: presentationSchema,
};

export const overviewContentSchema = z.object({
  groups: z.array(z.object({
    label: boundedText(120),
    componentLabels: z.array(boundedText(160)).min(1).max(20),
  }).strict()).min(1).max(12),
  relationships: z.array(z.object({
    sourceLabel: boundedText(160),
    targetLabel: boundedText(160),
    label: boundedText(120).optional(),
  }).strict()).max(40),
  audienceEmphasis: z.array(boundedText(160)).max(10),
}).strict();

const exactComponentSchema = z.object({
  id: idSchema,
  label: boundedText(160),
  technology: boundedText(120).optional(),
  description: boundedText(500).optional(),
  boundaryId: idSchema.optional(),
  evidence: evidenceListSchema,
}).strict();

const exactRelationshipSchema = z.object({
  from: idSchema,
  to: idSchema,
  label: boundedText(160).optional(),
  protocol: boundedText(80).optional(),
  evidence: evidenceListSchema,
}).strict();

const detailsContentSchema = z.object({
  components: z.array(exactComponentSchema).min(2).max(100),
  relationships: z.array(exactRelationshipSchema).min(1).max(200),
  boundaries: z.array(z.object({
    id: idSchema,
    label: boundedText(160),
    parentId: idSchema.optional(),
    evidence: evidenceListSchema,
  }).strict()).max(30),
}).strict();

const cloudContentSchema = z.object({
  provider: z.enum(['aws', 'azure', 'gcp']),
  resources: z.array(z.object({
    id: idSchema,
    label: boundedText(160),
    service: boundedText(120).optional(),
    resourceType: boundedText(120).optional(),
    boundaryId: idSchema.optional(),
    evidence: evidenceListSchema,
  }).strict()).min(1).max(150),
  boundaries: z.array(z.object({
    id: idSchema,
    label: boundedText(160),
    kind: boundedText(80).optional(),
    parentId: idSchema.optional(),
    evidence: evidenceListSchema,
  }).strict()).max(50),
  relationships: z.array(exactRelationshipSchema).max(300),
  evidence: evidenceListSchema,
}).strict();

const c4ContentSchema = z.object({
  level: z.enum(['context', 'container', 'component']),
  elements: z.array(z.object({
    id: idSchema,
    label: boundedText(160),
    kind: z.enum(['person', 'software-system', 'container', 'component']),
    technology: boundedText(120).optional(),
    description: boundedText(500).optional(),
    boundaryId: idSchema.optional(),
    evidence: evidenceListSchema,
  }).strict()).min(2).max(150),
  boundaries: z.array(z.object({
    id: idSchema,
    label: boundedText(160),
    parentId: idSchema.optional(),
    evidence: evidenceListSchema,
  }).strict()).max(50),
  relationships: z.array(z.object({
    from: idSchema,
    to: idSchema,
    label: boundedText(160).optional(),
    technology: boundedText(120).optional(),
    evidence: evidenceListSchema,
  }).strict()).min(1).max(300),
  evidence: evidenceListSchema,
}).strict();

const ganttContentSchema = z.object({
  tasks: z.array(z.object({
    id: idSchema,
    label: boundedText(160),
    start: z.iso.date(),
    end: z.iso.date(),
    dependencies: z.array(idSchema).max(30).optional(),
    milestone: z.boolean(),
    group: boundedText(120).optional(),
    evidence: evidenceListSchema,
  }).strict()).min(1).max(200),
  milestones: z.array(z.object({
    id: idSchema,
    label: boundedText(160),
    date: z.iso.date(),
    evidence: evidenceListSchema,
  }).strict()).max(50).optional(),
}).strict();

const artifactPlanUnionSchema = z.discriminatedUnion('type', [
  z.object({
    ...artifactEnvelope,
    type: z.literal('architecture-overview'),
    fidelityClass: z.literal('conceptual'),
    content: overviewContentSchema,
  }).strict(),
  z.object({
    ...artifactEnvelope,
    type: z.literal('architecture-details'),
    fidelityClass: z.literal('structural_exact'),
    content: detailsContentSchema,
  }).strict(),
  z.object({
    ...artifactEnvelope,
    type: z.literal('cloud-architecture'),
    fidelityClass: z.literal('structural_exact'),
    content: cloudContentSchema,
  }).strict(),
  z.object({
    ...artifactEnvelope,
    type: z.literal('architecture-c4'),
    fidelityClass: z.literal('structural_exact'),
    content: c4ContentSchema,
  }).strict(),
  z.object({
    ...artifactEnvelope,
    type: z.literal('gantt'),
    fidelityClass: z.literal('data_exact'),
    content: ganttContentSchema,
  }).strict(),
]);

function reportDuplicateIds(items, path, context) {
  const seen = new Set();
  items.forEach((item, index) => {
    if (seen.has(item.id)) {
      context.addIssue({
        code: 'custom',
        path: [...path, index, 'id'],
        message: `Duplicate ID '${item.id}'.`,
      });
    }
    seen.add(item.id);
  });
  return seen;
}

function reportRelationshipReferences(relationships, elementIds, path, context) {
  relationships.forEach((relationship, index) => {
    for (const endpoint of ['from', 'to']) {
      if (!elementIds.has(relationship[endpoint])) {
        context.addIssue({
          code: 'custom',
          path: [...path, index, endpoint],
          message: `Unknown element ID '${relationship[endpoint]}'.`,
        });
      }
    }
  });
}

function reportBoundaryHierarchy(boundaries, boundaryIds, context) {
  const parentById = new Map(boundaries.map(boundary => [boundary.id, boundary.parentId]));
  boundaries.forEach((boundary, index) => {
    if (boundary.parentId && !boundaryIds.has(boundary.parentId)) {
      context.addIssue({
        code: 'custom',
        path: ['content', 'boundaries', index, 'parentId'],
        message: `Unknown parent boundary ID '${boundary.parentId}'.`,
      });
    }
    const visited = new Set();
    let current = boundary.id;
    while (current) {
      if (visited.has(current)) {
        context.addIssue({
          code: 'custom',
          path: ['content', 'boundaries', index, 'parentId'],
          message: 'Boundary hierarchy must be acyclic.',
        });
        break;
      }
      visited.add(current);
      current = parentById.get(current);
    }
  });
}

function reportDependencyCycles(tasks, context) {
  const dependencyMap = new Map(tasks.map(task => [task.id, task.dependencies ?? []]));
  const visiting = new Set();
  const visited = new Set();

  function visit(id) {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const cyclic = (dependencyMap.get(id) ?? []).some(visit);
    visiting.delete(id);
    visited.add(id);
    return cyclic;
  }

  if (tasks.some(task => visit(task.id))) {
    context.addIssue({
      code: 'custom',
      path: ['content', 'tasks'],
      message: 'Gantt task dependencies must be acyclic.',
    });
  }
}

export const artifactPlanSchema = artifactPlanUnionSchema.superRefine((artifact, context) => {
  if (artifact.type === 'architecture-overview') return;

  if (artifact.type === 'gantt') {
    const taskIds = reportDuplicateIds(artifact.content.tasks, ['content', 'tasks'], context);
    artifact.content.tasks.forEach((task, index) => {
      if (task.start > task.end) {
        context.addIssue({
          code: 'custom',
          path: ['content', 'tasks', index, 'end'],
          message: 'Task end date must not precede its start date.',
        });
      }
      (task.dependencies ?? []).forEach((dependency, dependencyIndex) => {
        if (!taskIds.has(dependency)) {
          context.addIssue({
            code: 'custom',
            path: ['content', 'tasks', index, 'dependencies', dependencyIndex],
            message: `Unknown task dependency '${dependency}'.`,
          });
        }
      });
    });
    reportDependencyCycles(artifact.content.tasks, context);
    return;
  }

  const elementKey = artifact.type === 'architecture-c4' ? 'elements'
    : artifact.type === 'cloud-architecture' ? 'resources'
      : 'components';
  const elementIds = reportDuplicateIds(
    artifact.content[elementKey],
    ['content', elementKey],
    context
  );
  const boundaryIds = reportDuplicateIds(
    artifact.content.boundaries,
    ['content', 'boundaries'],
    context
  );
  reportBoundaryHierarchy(artifact.content.boundaries, boundaryIds, context);
  reportRelationshipReferences(
    artifact.content.relationships,
    elementIds,
    ['content', 'relationships'],
    context
  );
  artifact.content[elementKey].forEach((element, index) => {
    if (element.boundaryId && !boundaryIds.has(element.boundaryId)) {
      context.addIssue({
        code: 'custom',
        path: ['content', elementKey, index, 'boundaryId'],
        message: `Unknown boundary ID '${element.boundaryId}'.`,
      });
    }
  });
});

export const visualArtifactPlanSchema = z.object({
  version: z.literal('1'),
  proposalProfile: proposalProfileSchema,
  candidates: z.array(candidateDecisionSchema).max(VISUAL_TYPES.length),
  requestSummary: boundedText(1_000),
  artifacts: z.array(artifactPlanSchema).max(MAX_VISUALS),
  warnings: z.array(boundedText(500)).max(30),
}).strict().superRefine((plan, context) => {
  const artifactIds = reportDuplicateIds(plan.artifacts, ['artifacts'], context);
  plan.artifacts.forEach((artifact, artifactIndex) => {
    artifact.dependsOn.forEach((dependency, dependencyIndex) => {
      if (!artifactIds.has(dependency)) {
        context.addIssue({
          code: 'custom',
          path: ['artifacts', artifactIndex, 'dependsOn', dependencyIndex],
          message: `Unknown artifact dependency '${dependency}'.`,
        });
      }
    });
  });
});

export {
  audienceSchema,
  evidenceRefSchema,
  selectionSchema,
  sourceSchema,
  visualTypeSchema,
};
