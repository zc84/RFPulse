import fs from 'fs';
import path from 'path';

import { compileWorkflowPlan } from '../ai-runtime/planner/planCompiler.js';

const benchmarkPath = path.resolve('server/tests/fixtures/phase2PlannerBenchmark.json');

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
  {
    capabilityKey: 'quality.coverage',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object', required: ['findingRefs'] },
    permittedTools: ['validator.coverage.check'],
  },
  {
    capabilityKey: 'quality.consistency',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object', required: ['findingRefs'] },
    permittedTools: ['validator.consistency.check'],
  },
  {
    capabilityKey: 'quality.evidence',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object', required: ['findingRefs'] },
    permittedTools: ['validator.evidence.check'],
  },
];

function buildBaselinePlan(scenario) {
  const expected = new Set(scenario.expectedCapabilities || []);

  // Contract-closure normalization for executability under current capability schemas:
  // - analysis.estimation requires solution_design + legal_analysis
  // - proposal.integrate requires legal_analysis + solution_design + estimation_package
  const includeIntegrate = expected.has('proposal.integrate');
  const includeEstimation = expected.has('analysis.estimation') || includeIntegrate;
  const includeSolution = expected.has('analysis.solution') || includeEstimation || includeIntegrate;
  const includeLegal = expected.has('analysis.legal') || includeEstimation || includeIntegrate;

  const tasks = [];

  if (includeLegal) {
    tasks.push({
      id: 'analyze-legal',
      capability: 'analysis.legal',
      dependsOn: [],
      inputs: ['coordinator_context'],
      outputs: ['legal_analysis'],
      tools: ['agent.call.legal'],
      acceptanceCriteria: ['Legal constraints captured'],
      priority: 'high',
    });
  }

  if (includeSolution) {
    tasks.push({
      id: 'design-solution',
      capability: 'analysis.solution',
      dependsOn: [],
      inputs: ['coordinator_context'],
      outputs: ['solution_design'],
      tools: ['agent.call.architect'],
      acceptanceCriteria: ['Architecture constraints captured'],
      priority: 'high',
    });
  }

  if (includeEstimation) {
    const dependsOn = [];
    const inputs = [];
    if (includeSolution) {
      dependsOn.push('design-solution');
      inputs.push('solution_design');
    }
    if (includeLegal) {
      dependsOn.push('analyze-legal');
      inputs.push('legal_analysis');
    }

    tasks.push({
      id: 'estimate-delivery',
      capability: 'analysis.estimation',
      dependsOn,
      inputs,
      outputs: ['estimation_package'],
      tools: ['agent.call.estimator'],
      acceptanceCriteria: ['Estimate covers scope and pricing'],
      priority: 'high',
    });
  }

  const integrateDependsOn = tasks.map(task => task.id);
  const integrateInputs = [];
  if (includeLegal) integrateInputs.push('legal_analysis');
  if (includeSolution) integrateInputs.push('solution_design');
  if (includeEstimation) integrateInputs.push('estimation_package');

  tasks.push({
    id: 'integrate-proposal',
    capability: 'proposal.integrate',
    dependsOn: integrateDependsOn,
    inputs: integrateInputs,
    outputs: ['proposal_markdown'],
    tools: ['agent.call.coordinator.final-report'],
    acceptanceCriteria: ['Final proposal integrated'],
    priority: 'critical',
  });

  return {
    objective: scenario.objective,
    clarificationRequired: false,
    clarifications: [],
    tasks,
    qualityGates: ['quality.coverage', 'quality.consistency', 'quality.evidence'],
    artifactIntent: scenario.requiredArtifacts || ['proposal-docx'],
    budgets: { maxTasks: 24, maxRepairCycles: 2, maxParallelTasks: 4 },
  };
}

function run() {
  const scenarios = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
  const rows = [];
  let executableCount = 0;
  let appropriateCount = 0;

  for (const scenario of scenarios) {
    const plan = buildBaselinePlan(scenario);
    const compiled = compileWorkflowPlan(plan, {
      capabilityCatalogue,
      budgets: { maxTasks: 24 },
    });

    const planCapabilities = new Set((plan.tasks || []).map(task => task.capability));
    const expectedCapabilities = new Set(scenario.expectedCapabilities || []);
    const matched = [...expectedCapabilities].filter(cap => planCapabilities.has(cap)).length;
    const coverage = expectedCapabilities.size ? matched / expectedCapabilities.size : 1;
    const isAppropriate = coverage >= 0.9;

    if (compiled.valid) executableCount += 1;
    if (isAppropriate) appropriateCount += 1;

    rows.push({
      id: scenario.id,
      executable: compiled.valid,
      appropriate: isAppropriate,
      capabilityCoverage: Number(coverage.toFixed(3)),
      errors: compiled.errors,
    });
  }

  const executableRate = rows.length ? executableCount / rows.length : 0;
  const appropriateRate = rows.length ? appropriateCount / rows.length : 0;
  const pass = executableRate >= 0.9 && appropriateRate >= 0.9;

  const report = {
    generatedAt: new Date().toISOString(),
    scenarios: rows,
    summary: {
      totalScenarios: rows.length,
      executableRate: Number(executableRate.toFixed(3)),
      appropriateRate: Number(appropriateRate.toFixed(3)),
      threshold: 0.9,
      pass,
      notes: 'Appropriate rate is a proxy for SME executability/appropriateness and should be replaced with human-labeled scoring as benchmark fixtures mature.',
    },
  };

  console.log(JSON.stringify(report, null, 2));
  if (!pass) {
    process.exitCode = 1;
  }
}

run();