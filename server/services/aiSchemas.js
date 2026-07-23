import { z } from 'zod';
import { DEFAULT_ESTIMATION_POLICY, normalizeEstimationPolicy } from '../ai-runtime/policies/estimationPolicy.js';

export const DEFAULT_ROLE_RATE = DEFAULT_ESTIMATION_POLICY.defaultRoleRate;
const RESERVED_OVERHEAD_ROLES = new Set(['PM', 'QA']);

export const DEFAULT_QA_OVERHEAD_PERCENT = DEFAULT_ESTIMATION_POLICY.qaOverheadPercent;
export const DEFAULT_PM_OVERHEAD_PERCENT = DEFAULT_ESTIMATION_POLICY.pmOverheadPercent;

export const coordinatorDecisionSchema = z.object({
  status: z.enum(['clarifying', 'routing']),
  questions: z.array(z.string()).nullable(),
  plan: z.array(z.enum(['legal', 'architect', 'estimator'])).nullable(),
  reasoning: z.string().nullable(),
});

export const coordinatorChatArtifactDecisionSchema = z.object({
  action: z.enum(['generate_diagrams', 'chat_reply']),
  diagramTypes: z.array(z.enum(['architecture', 'timeline'])).nullable(),
  reasoning: z.string().nullable(),
});

export const requirementsExtractSchema = z.object({
  documentRole: z.enum([
    'rfp',
    'terms_and_conditions',
    'technical_specification',
    'pricing_template',
    'response_template',
    'reference',
    'unknown',
  ]),
  requirements: z.array(z.object({
    text: z.string().min(20),
    category: z.string().min(1),
    obligationLevel: z.enum(['mandatory', 'should', 'optional', 'informational']),
    responseType: z.enum(['narrative', 'form', 'attachment', 'commercial', 'evidence']),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    sourceLocator: z.string().min(1),
    sourceEvidenceHash: z.string().min(1),
    status: z.enum(['open', 'gap', 'covered']).default('open'),
    conflictTopic: z.string().nullable().default(null),
  })).default([]),
  missingAppendices: z.array(z.string().min(1)).default([]),
});

export const dealPropertiesSchema = z.object({
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  budget: z.number().nullable(),
  clientName: z.string().nullable(),
  description: z.string().max(1200).nullable(),
});

export const estimatorResultSchema = z.object({
  implementationTeam: z.array(z.string().min(1).max(80)).min(1),
  workBreakdown: z.array(z.object({
    phase: z.string().min(1),
    workstream: z.string().min(1),
    title: z.string().min(1),
    efforts: z.number().min(8).max(40).multipleOf(0.25),
    assigned: z.string().min(1).max(80),
    notes: z.string().max(240),
  })).min(1),
  contingencyPercent: z.number().int().min(0).max(100),
  estimatedDuration: z.string().min(1),
  basisOfEstimate: z.array(z.string()).min(1),
  commercialProposal: z.string().min(1),
  estimateConfidence: z.enum(['low', 'medium', 'high']),
  confidenceRationale: z.string().min(1),
  topUncertaintyDrivers: z.array(z.string().min(1)).min(1).max(5),
  phasePricing: z.array(z.object({
    phase: z.string().min(1),
    scopeSummary: z.string().min(1),
    effortHours: z.number().min(0),
    amount: z.number().min(0),
    pricingBasis: z.string().min(1),
  })).min(1),
  softwareLicenses: z.array(z.object({
    item: z.string().min(1),
    amount: z.number().min(0),
    pricingBasis: z.string().min(1),
    included: z.boolean(),
    notes: z.string().min(1),
  })),
  hardware: z.array(z.object({
    item: z.string().min(1),
    amount: z.number().min(0),
    pricingBasis: z.string().min(1),
    included: z.boolean(),
    notes: z.string().min(1),
  })),
  assumptions: z.array(z.string()),
  exclusions: z.array(z.string()),
  risks: z.array(z.object({
    risk: z.string().min(1),
    impact: z.string().min(1),
    mitigation: z.string().min(1),
  })),
});

function parseDurationToWeeks(durationText) {
  const text = String(durationText || '').toLowerCase();
  if (!text.trim()) return null;

  const capture = (unitPattern) => {
    const match = text.match(unitPattern);
    return match ? Number(match[1]) : null;
  };

  const weeks = capture(/(\d+(?:\.\d+)?)\s*(?:week|weeks|wk|w)\b/);
  if (weeks) return weeks;

  const days = capture(/(\d+(?:\.\d+)?)\s*(?:business\s*)?(?:day|days|d)\b/);
  if (days) return days / 5;

  const months = capture(/(\d+(?:\.\d+)?)\s*(?:month|months|mo)\b/);
  if (months) return months * 4.345;

  return null;
}

function createEstimatorAccuracyPolicyError(violations) {
  const details = violations.map(v => `[${v.code}] ${v.message}`).join('; ');
  const error = new Error(`Estimator accuracy policy failed: ${details}`);
  error.code = 'ESTIMATOR_ACCURACY_POLICY_FAILED';
  error.violations = violations;
  return error;
}

export function isEstimatorAccuracyPolicyError(err) {
  return err?.code === 'ESTIMATOR_ACCURACY_POLICY_FAILED' && Array.isArray(err?.violations);
}

export function evaluateEstimatorAccuracyPolicy(result, policyContext = {}) {
  const estimationPolicy = normalizeEstimationPolicy(policyContext.estimationPolicy);
  const violations = [];
  const weeks = parseDurationToWeeks(result.estimatedDuration);
  const deliveryTeamSize = result.implementationTeam.length;

  if (weeks && deliveryTeamSize > 0) {
    const expectedCapacityHours = deliveryTeamSize * weeks * 40;
    const maxRealisticEffort = expectedCapacityHours * estimationPolicy.plausibility.maxCapacityMultiplier;
    const minRealisticEffort = expectedCapacityHours * estimationPolicy.plausibility.minCapacityMultiplier;
    if (result.baseEffort > maxRealisticEffort) {
      violations.push({
        code: 'effort_duration_unrealistic',
        severity: 'high',
        message: `Base effort (${result.baseEffort}h) is too high for ${deliveryTeamSize} delivery role(s) over ${result.estimatedDuration}.`,
        details: {
          baseEffortHours: result.baseEffort,
          deliveryTeamSize,
          estimatedDuration: result.estimatedDuration,
          expectedCapacityHours,
        },
      });
    }
    if (result.baseEffort < minRealisticEffort) {
      violations.push({
        code: 'effort_duration_unrealistic',
        severity: 'medium',
        message: `Base effort (${result.baseEffort}h) is likely too low for the stated duration (${result.estimatedDuration}) and team size (${deliveryTeamSize}).`,
        details: {
          baseEffortHours: result.baseEffort,
          deliveryTeamSize,
          estimatedDuration: result.estimatedDuration,
          expectedCapacityHours,
        },
      });
    }
  }

  const pricedEffort = result.phasePricing.reduce((sum, phase) => sum + phase.effortHours, 0);
  const effortDrift = Math.abs(pricedEffort - result.baseEffort);
  const driftTolerance = Math.max(
    estimationPolicy.plausibility.minimumDriftHours,
    result.baseEffort * (estimationPolicy.plausibility.effortDriftTolerancePercent / 100)
  );
  if (effortDrift > driftTolerance) {
    violations.push({
      code: 'phase_pricing_effort_drift',
      severity: 'high',
      message: `Phase pricing effort total (${pricedEffort}h) drifts from WBS base effort (${result.baseEffort}h) beyond tolerance (${Math.round(driftTolerance * 100) / 100}h).`,
      details: {
        pricedEffortHours: pricedEffort,
        baseEffortHours: result.baseEffort,
        driftHours: effortDrift,
        toleranceHours: driftTolerance,
      },
    });
  }

  const highRiskScope = policyContext.highRiskScope === true;
  const uncertaintyHigh = String(policyContext.sourceUncertaintyLevel || '').toLowerCase() === 'high';
  const integrationHigh = String(policyContext.integrationComplexity || '').toLowerCase() === 'high';
  const dependencyCritical = String(policyContext.dependencyCriticality || '').toLowerCase() === 'high';
  const elevatedRiskSignals = highRiskScope || uncertaintyHigh || integrationHigh || dependencyCritical || (result.risks?.length || 0) >= 3;
  if (elevatedRiskSignals && result.contingencyPercent < estimationPolicy.contingency.highRiskMinimumPercent) {
    violations.push({
      code: 'contingency_too_low_for_risk',
      severity: 'medium',
      message: `Contingency (${result.contingencyPercent}%) is too low for the current risk/uncertainty profile.`,
      details: {
        contingencyPercent: result.contingencyPercent,
        sourceUncertaintyLevel: policyContext.sourceUncertaintyLevel || null,
        dependencyCriticality: policyContext.dependencyCriticality || null,
        integrationComplexity: policyContext.integrationComplexity || null,
      },
    });
  }

  if (uncertaintyHigh) {
    const assumptionsCount = (result.assumptions || []).length;
    if (assumptionsCount < 2) {
      violations.push({
        code: 'assumptions_coverage_missing',
        severity: 'medium',
        message: 'High source uncertainty requires explicit key assumptions (minimum 2).',
        details: {
          assumptionsCount,
          sourceUncertaintyLevel: policyContext.sourceUncertaintyLevel,
        },
      });
    }
  }

  return violations;
}

const diagramNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  purpose: z.string().max(180),
  technology: z.string().max(80),
  icon: z.string().max(50),
  groupId: z.string().nullable(),
  kind: z.enum(['actor', 'channel', 'service', 'data', 'integration', 'security', 'operations', 'step']),
});

export const architectureDiagramsSchema = z.object({
  diagrams: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    type: z.enum(['overview', 'detailed', 'workflow', 'integration', 'data-flow', 'sequence']),
    title: z.string().min(1).max(100),
    description: z.string().max(300),
    direction: z.enum(['RIGHT', 'DOWN']),
    groups: z.array(z.object({
      id: z.string().min(1),
      label: z.string().min(1).max(80),
      parentId: z.string().nullable(),
      kind: z.enum(['actor', 'cloud', 'network', 'layer', 'trust-zone', 'workflow']),
    })),
    nodes: z.array(diagramNodeSchema).min(2).max(30),
    edges: z.array(z.object({
      source: z.string().min(1),
      target: z.string().min(1),
      label: z.string().max(80),
      interaction: z.enum(['sync', 'async', 'event', 'data']),
    })).min(1).max(50),
  })).min(1).max(5),
}).refine(value => value.diagrams.some(diagram => diagram.type === 'overview'), {
  message: 'At least one overview architecture diagram is required.',
  path: ['diagrams'],
});

export const reportReviewSchema = z.object({
  status: z.enum(['pass', 'revise']),
  coverageScore: z.number().int().min(0).max(100),
  findings: z.array(z.object({
    severity: z.enum(['high', 'medium', 'low']),
    issue: z.string().min(1),
    requiredFix: z.string().min(1),
  })),
  tbcItems: z.array(z.string()),
});

export function validateEstimatorResult(value, options = {}) {
  const estimationPolicy = normalizeEstimationPolicy(options.estimationPolicy || options.policyContext?.estimationPolicy);
  const raw = structuredClone(value);
  if (!raw.estimateConfidence) {
    raw.estimateConfidence = 'medium';
  }
  if (!raw.confidenceRationale) {
    raw.confidenceRationale = 'Confidence is based on the available scope and assumptions at estimation time.';
  }
  if (!Array.isArray(raw.topUncertaintyDrivers) || raw.topUncertaintyDrivers.length === 0) {
    raw.topUncertaintyDrivers = (raw.risks || [])
      .map(item => item?.risk)
      .filter(Boolean)
      .slice(0, 5);
    if (raw.topUncertaintyDrivers.length === 0) {
      raw.topUncertaintyDrivers = ['Final scope and dependencies confirmation'];
    }
  }
  raw.workBreakdown = (raw.workBreakdown || []).map(task => ({
    phase: task.phase || 'Legacy',
    workstream: task.workstream || 'Ungrouped',
    title: String(task.title || '').replace(/^AI:\s*/i, ''),
    efforts: task.efforts,
    assigned: String(task.assigned || '').trim(),
    notes: task.notes ?? (task.aiAssisted ? 'Includes AI-assisted production and manual validation.' : ''),
  }));
  if (!Array.isArray(raw.implementationTeam) || raw.implementationTeam.length === 0) {
    raw.implementationTeam = [...new Set((raw.workBreakdown || []).map(task => task.assigned).filter(Boolean))];
  }
  raw.implementationTeam = [...new Set(raw.implementationTeam.map(role => String(role || '').trim()).filter(Boolean))];
  delete raw.teamComposition;
  const parsed = estimatorResultSchema.parse(raw);
  const firstSeen = new Map();
  const grouped = new Map();
  parsed.workBreakdown.forEach((task, index) => {
    const group = `${task.phase}\u0000${task.workstream}`;
    if (!firstSeen.has(group)) firstSeen.set(group, index);
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(task);
  });
  const workBreakdown = [...grouped.entries()]
    .sort((a, b) => firstSeen.get(a[0]) - firstSeen.get(b[0]))
    .flatMap(([, tasks]) => tasks);
  const roundToQuarterHour = value => Math.round(value * 4) / 4;
  const baseEffort = workBreakdown.reduce((sum, task) => sum + task.efforts, 0);
  const explicitQaEffort = 0;
  const targetQaEffort = roundToQuarterHour(baseEffort * (estimationPolicy.qaOverheadPercent / 100));
  const qaOngoingEffort = targetQaEffort;
  const qaEffort = qaOngoingEffort;
  const pmEffort = roundToQuarterHour((baseEffort + qaEffort) * (estimationPolicy.pmOverheadPercent / 100));

  const deliveryRoleWithOverhead = parsed.implementationTeam.find(role => RESERVED_OVERHEAD_ROLES.has(role));
  if (deliveryRoleWithOverhead) {
    throw new Error(`implementationTeam must list delivery roles only. "${deliveryRoleWithOverhead}" is added automatically as overhead.`);
  }

  const overheadTaskRole = workBreakdown.find(task => RESERVED_OVERHEAD_ROLES.has(task.assigned));
  if (overheadTaskRole) {
    throw new Error(`Estimator task role "${overheadTaskRole.assigned}" is reserved for automatic overhead rows and cannot be assigned directly.`);
  }

  const implementationRoleSet = new Set(parsed.implementationTeam);
  const unknownTaskRole = workBreakdown.find(task => !implementationRoleSet.has(task.assigned));
  if (unknownTaskRole) {
    throw new Error(`Estimator task role "${unknownTaskRole.assigned}" must be listed in implementationTeam.`);
  }
  const activeRoles = [...new Set([...parsed.implementationTeam, 'QA', 'PM'])];
  const teamComposition = activeRoles.map(team => ({ team, rate: estimationPolicy.defaultRoleRate }));
  const rateByRole = new Map(teamComposition.map(item => [item.team, item.rate]));
  const costRows = [
    ...workBreakdown.map(task => ({
      efforts: task.efforts,
      rate: rateByRole.get(task.assigned),
    })),
    { efforts: qaOngoingEffort, rate: rateByRole.get('QA') },
    { efforts: pmEffort, rate: rateByRole.get('PM') },
  ];
  const totalCost = costRows.some(row => row.rate === null || row.rate === undefined)
    ? null
    : costRows.reduce((sum, row) => sum + row.efforts * row.rate, 0);
  const result = {
    ...parsed,
    estimationPolicy,
    workBreakdown,
    teamComposition,
    baseEffort,
    explicitQaEffort,
    qaOngoingEffort,
    qaEffort,
    pmEffort,
    totalEffort: baseEffort + qaEffort + pmEffort,
    totalCost,
  };

  const violations = evaluateEstimatorAccuracyPolicy(result, { ...(options.policyContext || {}), estimationPolicy });
  if (violations.length > 0) {
    throw createEstimatorAccuracyPolicyError(violations);
  }

  return result;
}

export function parseEstimatorOutput(raw, options = {}) {
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return validateEstimatorResult(value, options);
}

export function buildEstimatorReportSummary(raw, options = {}) {
  const result = parseEstimatorOutput(raw, options);
  return JSON.stringify({
    totalEffort: result.totalEffort,
    baseEffort: result.baseEffort,
    qaOngoingEffort: result.qaOngoingEffort,
    qaEffort: result.qaEffort,
    pmEffort: result.pmEffort,
    totalCost: result.totalCost,
    qaOverheadPercent: options.estimationPolicy?.qaOverheadPercent ?? DEFAULT_QA_OVERHEAD_PERCENT,
    pmOverheadPercent: options.estimationPolicy?.pmOverheadPercent ?? DEFAULT_PM_OVERHEAD_PERCENT,
    contingencyPercent: result.contingencyPercent,
    estimatedDuration: result.estimatedDuration,
    estimateConfidence: result.estimateConfidence,
    confidenceRationale: result.confidenceRationale,
    topUncertaintyDrivers: result.topUncertaintyDrivers,
    commercialProposal: result.commercialProposal,
    phasePricing: result.phasePricing,
    softwareLicenses: result.softwareLicenses,
    hardware: result.hardware,
    teamComposition: result.teamComposition,
    basisOfEstimate: result.basisOfEstimate,
    assumptions: result.assumptions,
    exclusions: result.exclusions,
    risks: result.risks,
    implementationTeam: result.implementationTeam,
    detailedWbsArtifact: 'AI Detailed WBS.xlsx',
  }, null, 2);
}
