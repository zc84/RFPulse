import { z } from 'zod';

export const artifactKeySchema = z.enum([
  'proposal-docx',
  'architecture-diagram',
  'timeline-diagram',
  'detailed-wbs-xlsx',
  'compliance-matrix-xlsx',
  'submission-manifest',
]);

export const artifactSpecSchema = z.object({
  key: artifactKeySchema,
  type: artifactKeySchema,
  enabled: z.boolean(),
  required: z.boolean().default(false),
  reason: z.string().nullable(),
});

export const artifactPlanSchema = z.object({
  planVersion: z.number().int().positive().default(1),
  artifacts: z.array(artifactSpecSchema).min(1),
  selectedArtifactKeys: z.array(artifactKeySchema),
  summary: z.object({
    explicitIntentCount: z.number().int().nonnegative(),
    selectedArtifactCount: z.number().int().nonnegative(),
    skippedArtifactCount: z.number().int().nonnegative(),
  }),
});

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function hasAny(text, patterns) {
  return patterns.some(pattern => pattern.test(text));
}

function normalizeArtifactKeys(value) {
  return [...new Set(
    (Array.isArray(value) ? value : [])
      .map(item => String(item || '').trim())
      .filter(Boolean)
  )];
}

function buildArtifactSpec({ key, enabled, reason, required = false }) {
  return {
    key,
    type: key,
    enabled: Boolean(enabled),
    required: Boolean(required),
    reason: String(reason || '').trim() || null,
  };
}

function inferArchitectureNeed(proposalMarkdown = '', proposalStructure = null) {
  const text = normalizeText(proposalMarkdown);
  const sectionTitles = Array.isArray(proposalStructure?.sections)
    ? proposalStructure.sections.map(section => normalizeText(section.title)).join(' ')
    : '';
  return hasAny(`${text} ${sectionTitles}`, [
    /\barchitecture\b/,
    /\bsolution\b/,
    /\bintegration\b/,
    /\bdeployment\b/,
    /\bsecurity\b/,
    /\btechnical\b/,
  ]);
}

function inferTimelineNeed(proposalMarkdown = '', estimationPackage = '') {
  const text = normalizeText(`${proposalMarkdown} ${estimationPackage}`);
  return hasAny(text, [
    /\btimeline\b/,
    /\bmilestone\b/,
    /\bphase\b/,
    /\bsprint\b/,
    /\bweek\b/,
    /\bmonth\b/,
    /\bdelivery plan\b/,
  ]);
}

function inferWbsNeed(estimationPackage = '', proposalMarkdown = '') {
  const text = normalizeText(`${estimationPackage} ${proposalMarkdown}`);
  return hasAny(text, [
    /\bworkbreakdown\b/,
    /\bwork breakdown\b/,
    /\bwbs\b/,
    /\beffort\b/,
    /\bpricing\b/,
    /\bcommercial\b/,
    /\bestimate\b/,
    /\bbudget\b/,
  ]);
}

function readResponseProfile(proposalStructure) {
  return proposalStructure?.responseInstructions?.responseProfile
    || proposalStructure?.summary?.responseProfile
    || null;
}

export function buildArtifactPlan({
  artifactIntent = [],
  proposalMarkdown = '',
  proposalStructure = null,
  estimationPackage = '',
  contextSummary = '',
  requirementInventory = [],
} = {}) {
  const explicitIntent = normalizeArtifactKeys(artifactIntent);
  const explicitSelection = new Set(explicitIntent);
  const hasExplicitSelection = explicitSelection.size > 0;
  const normalizedContext = normalizeText(contextSummary);
  const responseProfile = readResponseProfile(proposalStructure);
  const mandatoryOverrides = proposalStructure?.summary?.mandatoryArtifactOverrides || {};

  const wantsProposal = true;
  const inferredArchitecture = inferArchitectureNeed(proposalMarkdown, proposalStructure);
  const inferredWbs = inferWbsNeed(estimationPackage, proposalMarkdown);
  const wantsArchitecture = Boolean(mandatoryOverrides.architecture || (hasExplicitSelection
    ? explicitSelection.has('architecture-diagram')
    : (responseProfile !== 'service-team' && responseProfile !== 'rfi' && inferredArchitecture)));
  const wantsTimeline = hasExplicitSelection
    ? explicitSelection.has('timeline-diagram')
    : inferTimelineNeed(proposalMarkdown, estimationPackage);
  const wantsWbs = Boolean(mandatoryOverrides.pricing || mandatoryOverrides.wbs || (hasExplicitSelection
    ? explicitSelection.has('detailed-wbs-xlsx')
    : (responseProfile !== 'rfi' && inferredWbs)));
  const wantsComplianceMatrix = false;
  const hasSubmissionObligations = requirementInventory.some(item => {
    const text = normalizeText(`${item?.text || ''} ${item?.category || ''} ${item?.response_type || ''}`);
    return item?.obligation_level === 'mandatory'
      && /attachment|form|annex|appendix|signature|signed|template|format|submission|deadline|portal|excel|xlsx|pdf|docx|quotation|power of attorney|seal|stamp|design option|demo/.test(text);
  });
  const wantsSubmissionManifest = explicitSelection.has('submission-manifest')
    || hasSubmissionObligations
    || (!hasExplicitSelection && /submission|quotation|format 1|format 2|power of attorney|design option|signed|sealed/i.test(`${proposalMarkdown} ${contextSummary}`));

  const artifacts = [
    buildArtifactSpec({
      key: 'proposal-docx',
      enabled: wantsProposal,
      required: true,
      reason: 'Primary proposal document is part of every selected output package.',
    }),
    buildArtifactSpec({
      key: 'architecture-diagram',
      enabled: wantsArchitecture,
      required: Boolean(mandatoryOverrides.architecture),
      reason: wantsArchitecture
        ? (mandatoryOverrides.architecture
            ? 'The RFP explicitly requires an architecture-oriented artifact.'
            : 'The solution-build profile and proposal content indicate architecture worth visualizing.')
        : `Architecture was not selected for the ${responseProfile || 'current'} response profile and no mandatory override exists.`,
    }),
    buildArtifactSpec({
      key: 'timeline-diagram',
      enabled: wantsTimeline,
      reason: wantsTimeline
        ? 'Proposal or estimate includes schedule and milestone content that benefits from a timeline view.'
        : 'No schedule-heavy content was requested or inferred.',
    }),
    buildArtifactSpec({
      key: 'detailed-wbs-xlsx',
      enabled: wantsWbs,
      required: Boolean(mandatoryOverrides.pricing || mandatoryOverrides.wbs),
      reason: wantsWbs
        ? (mandatoryOverrides.pricing || mandatoryOverrides.wbs
            ? 'The RFP explicitly requires pricing, estimation, or a work-breakdown deliverable.'
            : 'The response profile includes estimation content that should remain deterministic.')
        : `A WBS was not selected for the ${responseProfile || 'current'} response profile and no mandatory override exists.`,
    }),
    buildArtifactSpec({
      key: 'compliance-matrix-xlsx',
      enabled: wantsComplianceMatrix,
      reason: 'Physical compliance-matrix workbook generation is disabled; compliance evidence must stay embedded in report content and internal quality findings.',
    }),
    buildArtifactSpec({
      key: 'submission-manifest',
      enabled: wantsSubmissionManifest,
      required: hasSubmissionObligations,
      reason: wantsSubmissionManifest
        ? 'Mandatory tender instructions require an auditable submission-package manifest and completion status.'
        : 'No submission-package obligations were detected.',
    }),
  ];

  if (!wantsTimeline && /\btimeline\b/.test(normalizedContext)) {
    const timeline = artifacts.find(item => item.key === 'timeline-diagram');
    if (timeline) {
      timeline.enabled = true;
      timeline.reason = 'Client instructions explicitly mention a timeline-oriented output.';
    }
  }

  return artifactPlanSchema.parse({
    planVersion: 1,
    artifacts,
    selectedArtifactKeys: artifacts.filter(item => item.enabled).map(item => item.key),
    summary: {
      explicitIntentCount: explicitSelection.size,
      selectedArtifactCount: artifacts.filter(item => item.enabled).length,
      skippedArtifactCount: artifacts.filter(item => !item.enabled).length,
    },
  });
}

export function validateArtifactPlan(plan) {
  return artifactPlanSchema.parse(plan);
}

export function isArtifactSelected(artifactPlan, artifactKey) {
  return Boolean(
    artifactPlan?.artifacts?.some(artifact => artifact.key === artifactKey && artifact.enabled)
  );
}
