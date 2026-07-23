import { query } from '../../db.js';

const DEFAULT_CAPABILITIES = [
  {
    capabilityKey: 'requirements.extract',
    version: 1,
    name: 'Structured requirement extraction',
    description: 'Extract atomic tender requirements, document role, provenance, gaps, and conflicts from evidence.',
    inputSchema: { type: 'object', required: ['evidence_items'] },
    outputSchema: { type: 'object', required: ['requirements', 'documentRole', 'missingAppendices'] },
    permittedTools: ['requirements.extract.structured'],
    defaultModel: 'gpt-5.5',
    concurrencyClass: 'extraction',
    retryPolicy: { maxAttempts: 1 },
  },
  {
    capabilityKey: 'knowledge.retrieve.framework',
    version: 1,
    name: 'Framework knowledge retrieval',
    description: 'Retrieve relevant Andersen Delivery Framework sections for the current task intent.',
    inputSchema: { type: 'object', required: ['framework_retrieval_query'] },
    outputSchema: { type: 'object', required: ['framework_sections'] },
    permittedTools: ['knowledge.framework.search'],
    defaultModel: 'gpt-5.5',
    concurrencyClass: 'knowledge',
    retryPolicy: { maxAttempts: 1 },
  },
  {
    capabilityKey: 'knowledge.retrieve.company',
    version: 1,
    name: 'Company knowledge retrieval',
    description: 'Retrieve relevant approved company profile sections for evidence-backed company claims.',
    inputSchema: { type: 'object', required: ['company_retrieval_query'] },
    outputSchema: { type: 'object', required: ['company_sections'] },
    permittedTools: ['knowledge.company.search'],
    defaultModel: 'gpt-5.5',
    concurrencyClass: 'knowledge',
    retryPolicy: { maxAttempts: 1 },
  },
  {
    capabilityKey: 'analysis.legal',
    version: 1,
    name: 'Legal analysis',
    description: 'Analyze procurement, legal, and compliance obligations.',
    inputSchema: { type: 'object', required: ['coordinator_context'] },
    outputSchema: { type: 'object', required: ['legal_analysis'] },
    permittedTools: ['agent.call.legal'],
    defaultModel: 'gpt-5.5',
    concurrencyClass: 'analysis',
    retryPolicy: { maxAttempts: 1 },
  },
  {
    capabilityKey: 'analysis.solution',
    version: 1,
    name: 'Solution analysis',
    description: 'Design proposed solution architecture and delivery approach.',
    inputSchema: { type: 'object', required: ['coordinator_context'] },
    outputSchema: { type: 'object', required: ['solution_design'] },
    permittedTools: ['agent.call.architect'],
    defaultModel: 'gpt-5.5',
    concurrencyClass: 'analysis',
    retryPolicy: { maxAttempts: 1 },
  },
  {
    capabilityKey: 'analysis.estimation',
    version: 1,
    name: 'Estimation analysis',
    description: 'Build effort, pricing, and WBS estimation package.',
    inputSchema: { type: 'object', required: ['solution_design', 'legal_analysis'] },
    outputSchema: { type: 'object', required: ['estimation_package'] },
    permittedTools: ['agent.call.estimator'],
    defaultModel: 'gpt-5.5',
    concurrencyClass: 'analysis',
    retryPolicy: { maxAttempts: 1 },
  },
  {
    capabilityKey: 'proposal.structure',
    version: 1,
    name: 'Proposal structure planning',
    description: 'Build a requirement-led proposal section/file structure plan.',
    inputSchema: { type: 'object', required: ['requirement_inventory', 'context_summary'] },
    outputSchema: { type: 'object', required: ['sections', 'summary'] },
    permittedTools: ['proposal.structure.plan'],
    defaultModel: 'gpt-5.5',
    concurrencyClass: 'proposal',
    retryPolicy: { maxAttempts: 1 },
  },
  {
    capabilityKey: 'proposal.integrate',
    version: 1,
    name: 'Proposal integration',
    description: 'Integrate specialist outputs into final proposal markdown.',
    inputSchema: { type: 'object', required: ['legal_analysis', 'solution_design', 'estimation_package'] },
    outputSchema: { type: 'object', required: ['proposal_markdown'] },
    permittedTools: ['agent.call.coordinator.final-report'],
    defaultModel: 'gpt-5.5',
    concurrencyClass: 'integration',
    retryPolicy: { maxAttempts: 1 },
  },
  {
    capabilityKey: 'proposal.section-author',
    version: 1,
    name: 'Scoped proposal section authoring',
    description: 'Author proposal sections from scoped requirements and retrieved evidence.',
    inputSchema: { type: 'object', required: ['requirements', 'evidence_items'] },
    outputSchema: { type: 'object', required: ['sections', 'markdown'] },
    permittedTools: ['proposal.section.author', 'knowledge.framework.search', 'knowledge.company.search'],
    defaultModel: 'gpt-5.5',
    concurrencyClass: 'proposal',
    retryPolicy: { maxAttempts: 1 },
  },
  {
    capabilityKey: 'artifact.plan',
    version: 1,
    name: 'Artifact package planning',
    description: 'Select the artifact package to render from proposal, estimation, and submission context.',
    inputSchema: { type: 'object', required: ['proposal_markdown'] },
    outputSchema: { type: 'object', required: ['artifact_plan'] },
    permittedTools: ['artifact.plan.build'],
    defaultModel: 'gpt-5.5',
    concurrencyClass: 'artifact',
    retryPolicy: { maxAttempts: 1 },
  },
  {
    capabilityKey: 'repair.plan',
    version: 1,
    name: 'Repair plan generation',
    description: 'Convert quality findings into targeted repair task instructions.',
    inputSchema: { type: 'object', required: ['findings'] },
    outputSchema: { type: 'object', required: ['repair_tasks'] },
    permittedTools: ['quality.repair.plan'],
    defaultModel: 'gpt-5.5',
    concurrencyClass: 'quality',
    retryPolicy: { maxAttempts: 1 },
  },
  {
    capabilityKey: 'quality.coverage',
    version: 1,
    name: 'Coverage quality gate',
    description: 'Validate requirement/proposal coverage and identify gaps.',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object', required: ['findingRefs'] },
    permittedTools: ['validator.coverage.check'],
    defaultModel: 'gpt-5.5',
    concurrencyClass: 'quality',
    retryPolicy: { maxAttempts: 1 },
  },
  {
    capabilityKey: 'quality.consistency',
    version: 1,
    name: 'Consistency quality gate',
    description: 'Validate cross-artifact consistency.',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object', required: ['findingRefs'] },
    permittedTools: ['validator.consistency.check'],
    defaultModel: 'gpt-5.5',
    concurrencyClass: 'quality',
    retryPolicy: { maxAttempts: 1 },
  },
  {
    capabilityKey: 'quality.evidence',
    version: 1,
    name: 'Evidence quality gate',
    description: 'Validate evidence grounding of key claims.',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object', required: ['findingRefs'] },
    permittedTools: ['validator.evidence.check'],
    defaultModel: 'gpt-5.5',
    concurrencyClass: 'quality',
    retryPolicy: { maxAttempts: 1 },
  },
  {
    capabilityKey: 'quality.estimation',
    version: 1,
    name: 'Estimation reconciliation gate',
    description: 'Validate that delivery commitments reconcile with effort, schedule, WBS, and commercial assumptions.',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object', required: ['findingRefs'] },
    permittedTools: ['validator.estimation.check'],
    defaultModel: 'gpt-5.5',
    concurrencyClass: 'quality',
    retryPolicy: { maxAttempts: 1 },
  },
  {
    capabilityKey: 'quality.submission',
    version: 1,
    name: 'Submission compliance gate',
    description: 'Validate explicit handling of tender submission instructions, required forms, and attachment obligations.',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object', required: ['findingRefs'] },
    permittedTools: ['validator.submission.check'],
    defaultModel: 'gpt-5.5',
    concurrencyClass: 'quality',
    retryPolicy: { maxAttempts: 1 },
  },
  {
    capabilityKey: 'quality.framework-company',
    version: 1,
    name: 'Framework/company accuracy gate',
    description: 'Validate that Andersen methodology and company claims are grounded in approved knowledge.',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object', required: ['findingRefs'] },
    permittedTools: ['validator.framework-company.check'],
    defaultModel: 'gpt-5.5',
    concurrencyClass: 'quality',
    retryPolicy: { maxAttempts: 1 },
  },
  {
    capabilityKey: 'quality.style-usability',
    version: 1,
    name: 'Style and usability gate',
    description: 'Validate proposal readability, placeholders, section structure, and evaluator scanability.',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object', required: ['findingRefs'] },
    permittedTools: ['validator.style-usability.check'],
    defaultModel: 'gpt-5.5',
    concurrencyClass: 'quality',
    retryPolicy: { maxAttempts: 1 },
  },
];

function normalizeCapabilityRow(row) {
  return {
    id: row.id,
    capabilityKey: row.capability_key,
    version: row.version,
    name: row.name,
    description: row.description,
    inputSchema: row.input_schema || {},
    outputSchema: row.output_schema || {},
    permittedTools: Array.isArray(row.permitted_tools) ? row.permitted_tools : [],
    defaultModel: row.default_model || null,
    concurrencyClass: row.concurrency_class || 'default',
    costWeight: Number(row.cost_weight || 1),
    retryPolicy: row.retry_policy || { maxAttempts: 1 },
    requiresHumanApproval: Boolean(row.requires_human_approval),
    enabled: Boolean(row.enabled),
    metadata: row.metadata || {},
  };
}

export async function ensureDefaultCapabilities(queryFn = query) {
  for (const capability of DEFAULT_CAPABILITIES) {
    await queryFn(
      `INSERT INTO ai_capabilities
        (capability_key, version, name, description, input_schema, output_schema, permitted_tools, default_model, concurrency_class, retry_policy, enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (capability_key, version)
       DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         input_schema = EXCLUDED.input_schema,
         output_schema = EXCLUDED.output_schema,
         permitted_tools = EXCLUDED.permitted_tools,
         default_model = EXCLUDED.default_model,
         concurrency_class = EXCLUDED.concurrency_class,
         retry_policy = EXCLUDED.retry_policy,
         updated_at = CURRENT_TIMESTAMP`,
      [
        capability.capabilityKey,
        capability.version,
        capability.name,
        capability.description,
        JSON.stringify(capability.inputSchema || {}),
        JSON.stringify(capability.outputSchema || {}),
        JSON.stringify(capability.permittedTools || []),
        capability.defaultModel,
        capability.concurrencyClass || 'default',
        JSON.stringify(capability.retryPolicy || { maxAttempts: 1 }),
        true,
      ]
    );
  }
}

export async function listEnabledCapabilities(queryFn = query) {
  const result = await queryFn(
    `SELECT *
     FROM ai_capabilities
     WHERE enabled = TRUE
     ORDER BY capability_key ASC, version DESC`
  );

  const latestByKey = new Map();
  for (const row of result.rows) {
    if (!latestByKey.has(row.capability_key)) {
      latestByKey.set(row.capability_key, normalizeCapabilityRow(row));
    }
  }

  return [...latestByKey.values()];
}
