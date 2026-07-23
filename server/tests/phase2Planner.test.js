import assert from 'node:assert/strict';
import test from 'node:test';

import { compileWorkflowPlan } from '../ai-runtime/planner/planCompiler.js';
import { mapSpecialistsToCapabilities } from '../ai-runtime/capabilities/agentCapabilityAdapters.js';
import { generateWorkflowPlanShadow } from '../ai-runtime/planner/plannerService.js';

function capabilityCatalogue() {
  return [
    {
      capabilityKey: 'analysis.legal',
      inputSchema: { type: 'object', required: ['coordinator_context'] },
      outputSchema: { type: 'object', required: ['legal_analysis'] },
      permittedTools: ['agent.call.legal'],
    },
    {
      capabilityKey: 'analysis.solution',
      inputSchema: { type: 'object', required: ['coordinator_context'] },
      outputSchema: { type: 'object', required: ['solution_design'] },
      permittedTools: ['agent.call.architect'],
    },
    {
      capabilityKey: 'analysis.estimation',
      inputSchema: { type: 'object', required: ['solution_design', 'legal_analysis'] },
      outputSchema: { type: 'object', required: ['estimation_package'] },
      permittedTools: ['agent.call.estimator'],
    },
    {
      capabilityKey: 'proposal.integrate',
      inputSchema: { type: 'object', required: ['legal_analysis', 'solution_design', 'estimation_package'] },
      outputSchema: { type: 'object', required: ['proposal_markdown'] },
      permittedTools: ['agent.call.coordinator.final-report'],
    },
    { capabilityKey: 'quality.coverage', inputSchema: { type: 'object' }, outputSchema: { type: 'object' }, permittedTools: ['validator.coverage.check'] },
    { capabilityKey: 'quality.consistency', inputSchema: { type: 'object' }, outputSchema: { type: 'object' }, permittedTools: ['validator.consistency.check'] },
    { capabilityKey: 'quality.evidence', inputSchema: { type: 'object' }, outputSchema: { type: 'object' }, permittedTools: ['validator.evidence.check'] },
  ];
}

function validPlan() {
  return {
    objective: 'Produce compliant proposal package',
    clarificationRequired: false,
    clarifications: [],
    tasks: [
      {
        id: 'analyze-legal',
        capability: 'analysis.legal',
        dependsOn: [],
        inputs: ['coordinator_context'],
        outputs: ['legal_analysis'],
        tools: ['agent.call.legal'],
        acceptanceCriteria: ['Legal constraints captured'],
        priority: 'high',
      },
      {
        id: 'design-solution',
        capability: 'analysis.solution',
        dependsOn: [],
        inputs: ['coordinator_context'],
        outputs: ['solution_design'],
        tools: ['agent.call.architect'],
        acceptanceCriteria: ['Architecture aligns with requirements'],
        priority: 'high',
      },
      {
        id: 'estimate-delivery',
        capability: 'analysis.estimation',
        dependsOn: ['analyze-legal', 'design-solution'],
        inputs: ['solution_design', 'legal_analysis'],
        outputs: ['estimation_package'],
        tools: ['agent.call.estimator'],
        acceptanceCriteria: ['Estimate reconciles scope and pricing'],
        priority: 'high',
      },
      {
        id: 'integrate-proposal',
        capability: 'proposal.integrate',
        dependsOn: ['analyze-legal', 'design-solution', 'estimate-delivery'],
        inputs: ['legal_analysis', 'solution_design', 'estimation_package'],
        outputs: ['proposal_markdown'],
        tools: ['agent.call.coordinator.final-report'],
        acceptanceCriteria: ['Proposal integrates specialist outputs'],
        priority: 'critical',
      },
    ],
    qualityGates: ['quality.coverage', 'quality.consistency', 'quality.evidence'],
    artifactIntent: ['proposal-docx', 'detailed-wbs-xlsx'],
    budgets: {
      maxTasks: 24,
      maxRepairCycles: 2,
      maxParallelTasks: 4,
    },
  };
}

test('phase2 compiler accepts a valid capability-based workflow plan', () => {
  const compiled = compileWorkflowPlan(validPlan(), {
    capabilityCatalogue: capabilityCatalogue(),
    budgets: { maxTasks: 24 },
  });

  assert.equal(compiled.valid, true);
  assert.deepEqual(compiled.errors, []);
  assert.equal(compiled.plan.tasks.length, 4);
});

test('phase2 compiler rejects unknown capability keys', () => {
  const plan = validPlan();
  plan.tasks[0].capability = 'analysis.unknown';
  const compiled = compileWorkflowPlan(plan, {
    capabilityCatalogue: capabilityCatalogue(),
    budgets: { maxTasks: 24 },
  });

  assert.equal(compiled.valid, false);
  assert.ok(compiled.errors.some(error => /unavailable capability/i.test(error)));
});

test('phase2 compiler rejects cycles and unknown dependencies', () => {
  const plan = validPlan();
  plan.tasks[0].dependsOn = ['integrate-proposal'];
  const compiled = compileWorkflowPlan(plan, {
    capabilityCatalogue: capabilityCatalogue(),
    budgets: { maxTasks: 24 },
  });

  assert.equal(compiled.valid, false);
  assert.ok(compiled.errors.some(error => /cycle/i.test(error)));

  const planWithUnknownDep = validPlan();
  planWithUnknownDep.tasks[0].dependsOn = ['missing-task'];
  const compiledUnknown = compileWorkflowPlan(planWithUnknownDep, {
    capabilityCatalogue: capabilityCatalogue(),
    budgets: { maxTasks: 24 },
  });
  assert.equal(compiledUnknown.valid, false);
  assert.ok(compiledUnknown.errors.some(error => /unknown task/i.test(error)));
});

test('phase2 specialist adapter mapping converts legacy specialists to capabilities', () => {
  const mapped = mapSpecialistsToCapabilities(['legal', 'architect', 'estimator']);
  assert.deepEqual(mapped, [
    'analysis.legal',
    'analysis.solution',
    'analysis.estimation',
    'proposal.integrate',
  ]);

  const mappedSingle = mapSpecialistsToCapabilities(['architect']);
  assert.deepEqual(mappedSingle, ['analysis.solution', 'proposal.integrate']);
});

test('phase2 compiler rejects missing required contracts, unsatisfied inputs, and disallowed tools', () => {
  const plan = validPlan();
  plan.tasks[2].dependsOn = ['design-solution']; // no legal dependency for required legal_analysis input
  plan.tasks[2].inputs = ['solution_design', 'external:not-allowed', 'legal_analysis'];
  plan.tasks[2].tools = ['agent.call.legal']; // wrong tool for analysis.estimation

  const compiled = compileWorkflowPlan(plan, {
    capabilityCatalogue: [
      {
        capabilityKey: 'analysis.legal',
        inputSchema: { type: 'object', required: ['coordinator_context'] },
        outputSchema: { type: 'object', required: ['legal_analysis'] },
        permittedTools: ['agent.call.legal'],
      },
      {
        capabilityKey: 'analysis.solution',
        inputSchema: { type: 'object', required: ['coordinator_context'] },
        outputSchema: { type: 'object', required: ['solution_design'] },
        permittedTools: ['agent.call.architect'],
      },
      {
        capabilityKey: 'analysis.estimation',
        inputSchema: { type: 'object', required: ['solution_design', 'legal_analysis'] },
        outputSchema: { type: 'object', required: ['estimation_package'] },
        permittedTools: ['agent.call.estimator'],
      },
      {
        capabilityKey: 'proposal.integrate',
        inputSchema: { type: 'object', required: ['legal_analysis', 'solution_design', 'estimation_package'] },
        outputSchema: { type: 'object', required: ['proposal_markdown'] },
        permittedTools: ['agent.call.coordinator.final-report'],
      },
    ],
    budgets: { maxTasks: 24 },
  });

  assert.equal(compiled.valid, false);
  assert.ok(compiled.errors.some(error => /not satisfied by dependencies/i.test(error)));
  assert.ok(compiled.errors.some(error => /not satisfied by dependencies/i.test(error)));
  assert.ok(compiled.errors.some(error => /disallowed tool/i.test(error)));
});

test('phase2 planner service repairs an invalid primary plan in one pass before fallback', async () => {
  let callCount = 0;
  const capabilityCatalogue = [
    {
      capabilityKey: 'analysis.legal',
      inputSchema: { type: 'object', required: ['coordinator_context'] },
      outputSchema: { type: 'object', required: ['legal_analysis'] },
      permittedTools: ['agent.call.legal'],
    },
    {
      capabilityKey: 'analysis.solution',
      inputSchema: { type: 'object', required: ['coordinator_context'] },
      outputSchema: { type: 'object', required: ['solution_design'] },
      permittedTools: ['agent.call.architect'],
    },
    {
      capabilityKey: 'analysis.estimation',
      inputSchema: { type: 'object', required: ['solution_design', 'legal_analysis'] },
      outputSchema: { type: 'object', required: ['estimation_package'] },
      permittedTools: ['agent.call.estimator'],
    },
    {
      capabilityKey: 'proposal.integrate',
      inputSchema: { type: 'object', required: ['legal_analysis', 'solution_design', 'estimation_package'] },
      outputSchema: { type: 'object', required: ['proposal_markdown'] },
      permittedTools: ['agent.call.coordinator.final-report'],
    },
  ];

  const invalidPrimaryPlan = {
    ...validPlan(),
    tasks: [
      {
        ...validPlan().tasks[0],
        tools: ['agent.call.architect'],
      },
      ...validPlan().tasks.slice(1),
    ],
  };

  const repairedPlan = validPlan();

  const result = await generateWorkflowPlanShadow({
    objective: 'Test planner repair',
    contextSummary: 'Synthetic context',
    queryFn: async () => ({ rows: [{ value: JSON.stringify(validPlan()) }] }),
    capabilityCatalogueOverride: capabilityCatalogue,
    agentCaller: async () => {
      callCount += 1;
      return JSON.stringify(callCount === 1 ? invalidPrimaryPlan : repairedPlan);
    },
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.usedRepair, true);
  assert.equal(result.usedFallback, false);
});

test('phase2 planner service uses synthesized fallback when configured fallback is invalid', async () => {
  const result = await generateWorkflowPlanShadow({
    objective: 'Fallback synthesis check',
    contextSummary: 'Synthetic context',
    queryFn: async () => ({ rows: [{ value: '{"invalid":true}' }] }),
    capabilityCatalogueOverride: [
      {
        capabilityKey: 'analysis.legal',
        inputSchema: { type: 'object', required: ['coordinator_context'] },
        outputSchema: { type: 'object', required: ['legal_analysis'] },
        permittedTools: ['agent.call.legal'],
      },
      {
        capabilityKey: 'analysis.solution',
        inputSchema: { type: 'object', required: ['coordinator_context'] },
        outputSchema: { type: 'object', required: ['solution_design'] },
        permittedTools: ['agent.call.architect'],
      },
      {
        capabilityKey: 'analysis.estimation',
        inputSchema: { type: 'object', required: ['solution_design', 'legal_analysis'] },
        outputSchema: { type: 'object', required: ['estimation_package'] },
        permittedTools: ['agent.call.estimator'],
      },
      {
        capabilityKey: 'proposal.integrate',
        inputSchema: { type: 'object', required: ['legal_analysis', 'solution_design', 'estimation_package'] },
        outputSchema: { type: 'object', required: ['proposal_markdown'] },
        permittedTools: ['agent.call.coordinator.final-report'],
      },
    ],
    agentCaller: async () => {
      throw new Error('force fallback path');
    },
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.usedFallback, true);
  assert.ok(Array.isArray(result.configuredFallbackErrors));
  assert.ok(result.configuredFallbackErrors.length > 0);
});

test('phase2 planner synthesized fallback remains valid when requirements.extract is enabled', async () => {
  const result = await generateWorkflowPlanShadow({
    objective: 'Fallback synthesis with requirement extraction',
    contextSummary: 'Synthetic context',
    queryFn: async () => ({ rows: [{ value: '{"invalid":true}' }] }),
    capabilityCatalogueOverride: [
      {
        capabilityKey: 'requirements.extract',
        inputSchema: { type: 'object', required: ['evidence_items'] },
        outputSchema: { type: 'object', required: ['requirements', 'documentRole', 'missingAppendices'] },
        permittedTools: ['requirements.extract.structured'],
      },
      {
        capabilityKey: 'analysis.legal',
        inputSchema: { type: 'object', required: ['coordinator_context'] },
        outputSchema: { type: 'object', required: ['legal_analysis'] },
        permittedTools: ['agent.call.legal'],
      },
      {
        capabilityKey: 'analysis.solution',
        inputSchema: { type: 'object', required: ['coordinator_context'] },
        outputSchema: { type: 'object', required: ['solution_design'] },
        permittedTools: ['agent.call.architect'],
      },
      {
        capabilityKey: 'analysis.estimation',
        inputSchema: { type: 'object', required: ['solution_design', 'legal_analysis'] },
        outputSchema: { type: 'object', required: ['estimation_package'] },
        permittedTools: ['agent.call.estimator'],
      },
      {
        capabilityKey: 'proposal.integrate',
        inputSchema: { type: 'object', required: ['legal_analysis', 'solution_design', 'estimation_package'] },
        outputSchema: { type: 'object', required: ['proposal_markdown'] },
        permittedTools: ['agent.call.coordinator.final-report'],
      },
    ],
    agentCaller: async () => {
      throw new Error('force fallback path');
    },
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.usedFallback, true);
  const extractTask = result.plan.tasks.find(task => task.id === 'extract-requirements');
  assert.ok(extractTask);
  assert.ok(extractTask.outputs.includes('requirements'));
  assert.ok(extractTask.outputs.includes('documentRole'));
  assert.ok(extractTask.outputs.includes('missingAppendices'));
  assert.ok(extractTask.outputs.includes('requirement_inventory'));
});
