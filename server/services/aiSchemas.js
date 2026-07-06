import { z } from 'zod';

export const TEAM_ROLES = [
  'Architect',
  'Backend Engineer',
  'Frontend Engineer',
  'Data Engineer',
  'AI Engineer',
  'DevOps Engineer',
  'BA',
  'PM',
  'QA',
];

export const DEFAULT_ROLE_RATES = {
  Architect: 90,
  'Backend Engineer': 55,
  'Frontend Engineer': 55,
  'Data Engineer': 65,
  'AI Engineer': 65,
  'DevOps Engineer': 65,
  BA: 50,
  PM: 50,
  QA: 45,
};

export const DEFAULT_QA_OVERHEAD_PERCENT = 30;
export const DEFAULT_PM_OVERHEAD_PERCENT = 15;

export const DELIVERY_ROLES = TEAM_ROLES.filter(role => role !== 'PM' && role !== 'QA');

export const coordinatorDecisionSchema = z.object({
  status: z.enum(['clarifying', 'routing']),
  questions: z.array(z.string()).nullable(),
  plan: z.array(z.enum(['legal', 'architect', 'estimator'])).nullable(),
  reasoning: z.string().nullable(),
});

export const dealPropertiesSchema = z.object({
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  budget: z.number().nullable(),
  clientName: z.string().nullable(),
  description: z.string().max(1200).nullable(),
});

export const estimatorResultSchema = z.object({
  workBreakdown: z.array(z.object({
    phase: z.string().min(1),
    workstream: z.string().min(1),
    title: z.string().min(1),
    efforts: z.number().min(8).max(40).multipleOf(0.25),
    assigned: z.enum(DELIVERY_ROLES),
    notes: z.string().max(240),
  })).min(1),
  contingencyPercent: z.number().int().min(0).max(100),
  estimatedDuration: z.string().min(1),
  basisOfEstimate: z.array(z.string()).min(1),
  commercialProposal: z.string().min(1),
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

export function validateEstimatorResult(value) {
  const raw = structuredClone(value);
  raw.workBreakdown = (raw.workBreakdown || []).map(task => ({
    phase: task.phase || 'Legacy',
    workstream: task.workstream || 'Ungrouped',
    title: String(task.title || '').replace(/^AI:\s*/i, ''),
    efforts: task.efforts,
    assigned: task.assigned,
    notes: task.notes ?? (task.aiAssisted ? 'Includes AI-assisted production and manual validation.' : ''),
  }));
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
  const targetQaEffort = roundToQuarterHour(baseEffort * (DEFAULT_QA_OVERHEAD_PERCENT / 100));
  const qaOngoingEffort = targetQaEffort;
  const qaEffort = qaOngoingEffort;
  const pmEffort = roundToQuarterHour((baseEffort + qaEffort) * (DEFAULT_PM_OVERHEAD_PERCENT / 100));
  const activeRoles = [...new Set([...workBreakdown.map(task => task.assigned), 'QA', 'PM'])];
  const teamComposition = activeRoles.map(team => ({ team, rate: DEFAULT_ROLE_RATES[team] }));
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
  return {
    ...parsed,
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
}

export function parseEstimatorOutput(raw) {
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return validateEstimatorResult(value);
}

export function buildEstimatorReportSummary(raw) {
  const result = parseEstimatorOutput(raw);
  return JSON.stringify({
    totalEffort: result.totalEffort,
    baseEffort: result.baseEffort,
    qaOngoingEffort: result.qaOngoingEffort,
    qaEffort: result.qaEffort,
    pmEffort: result.pmEffort,
    totalCost: result.totalCost,
    qaOverheadPercent: DEFAULT_QA_OVERHEAD_PERCENT,
    pmOverheadPercent: DEFAULT_PM_OVERHEAD_PERCENT,
    contingencyPercent: result.contingencyPercent,
    estimatedDuration: result.estimatedDuration,
    commercialProposal: result.commercialProposal,
    phasePricing: result.phasePricing,
    softwareLicenses: result.softwareLicenses,
    hardware: result.hardware,
    teamComposition: result.teamComposition,
    basisOfEstimate: result.basisOfEstimate,
    assumptions: result.assumptions,
    exclusions: result.exclusions,
    risks: result.risks,
    detailedWbsArtifact: 'AI Detailed WBS.xlsx',
  }, null, 2);
}
