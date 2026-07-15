import assert from 'node:assert/strict';
import test from 'node:test';

import { executeDagPlan } from '../ai-runtime/engine/dagExecutor.js';
import { executeWorkflowPlan } from '../ai-runtime/application/executePlan.js';

function samplePlan() {
  return {
    objective: 'Phase 3 executor test plan',
    clarificationRequired: false,
    clarifications: [],
    tasks: [
      {
        id: 't-legal',
        capability: 'analysis.legal',
        dependsOn: [],
        inputs: ['coordinator_context'],
        outputs: ['legal_analysis'],
        acceptanceCriteria: ['legal done'],
        priority: 'high',
      },
      {
        id: 't-solution',
        capability: 'analysis.solution',
        dependsOn: [],
        inputs: ['coordinator_context'],
        outputs: ['solution_design'],
        acceptanceCriteria: ['solution done'],
        priority: 'high',
      },
      {
        id: 't-estimate',
        capability: 'analysis.estimation',
        dependsOn: ['t-legal', 't-solution'],
        inputs: ['legal_analysis', 'solution_design'],
        outputs: ['estimation_package'],
        acceptanceCriteria: ['estimate done'],
        priority: 'high',
      },
    ],
    qualityGates: [],
    artifactIntent: [],
    budgets: {
      maxTasks: 24,
      maxRepairCycles: 2,
      maxParallelTasks: 2,
    },
  };
}

const capabilityCatalogue = [
  { capabilityKey: 'analysis.legal', retryPolicy: { maxAttempts: 1 } },
  { capabilityKey: 'analysis.solution', retryPolicy: { maxAttempts: 1 } },
  { capabilityKey: 'analysis.estimation', retryPolicy: { maxAttempts: 2 } },
];

test('phase3 dag executor runs dependencies and produces output refs', async () => {
  const plan = samplePlan();
  const runOrder = [];

  const result = await executeDagPlan({
    plan,
    capabilityCatalogue,
    externalInputs: {
      coordinator_context: 'ctx',
    },
    runTask: async (task, context) => {
      runOrder.push(task.id);
      if (task.id === 't-legal') return { rawResult: 'L', outputRefs: { legal_analysis: 'L' } };
      if (task.id === 't-solution') return { rawResult: 'S', outputRefs: { solution_design: 'S' } };
      assert.equal(context.inputs.legal_analysis, 'L');
      assert.equal(context.inputs.solution_design, 'S');
      return { rawResult: 'E', outputRefs: { estimation_package: 'E' } };
    },
  });

  assert.equal(result.taskStates['t-legal'].status, 'completed');
  assert.equal(result.taskStates['t-solution'].status, 'completed');
  assert.equal(result.taskStates['t-estimate'].status, 'completed');
  assert.equal(result.outputRefs.estimation_package, 'E');
  assert.ok(runOrder.includes('t-estimate'));
});

test('phase3 dag executor retries failed task according to retry policy', async () => {
  const plan = samplePlan();
  let estimateAttempt = 0;

  const result = await executeDagPlan({
    plan,
    capabilityCatalogue,
    externalInputs: {
      coordinator_context: 'ctx',
    },
    runTask: async task => {
      if (task.id === 't-legal') return { rawResult: 'L', outputRefs: { legal_analysis: 'L' } };
      if (task.id === 't-solution') return { rawResult: 'S', outputRefs: { solution_design: 'S' } };
      estimateAttempt += 1;
      if (estimateAttempt === 1) {
        throw new Error('transient estimator failure');
      }
      return { rawResult: 'E', outputRefs: { estimation_package: 'E' } };
    },
  });

  assert.equal(estimateAttempt, 2);
  assert.equal(result.taskStates['t-estimate'].status, 'completed');
  assert.equal(result.taskStates['t-estimate'].attempt, 2);
});

test('phase3 dag executor supports resume from persisted completed outputs', async () => {
  const plan = samplePlan();
  let legalRuns = 0;
  let solutionRuns = 0;

  const result = await executeDagPlan({
    plan,
    capabilityCatalogue,
    initialTaskStates: {
      't-legal': {
        status: 'completed',
        attempt: 1,
        outputRefs: { legal_analysis: 'L' },
      },
    },
    initialOutputRefs: {
      legal_analysis: 'L',
    },
    externalInputs: {
      coordinator_context: 'ctx',
    },
    runTask: async task => {
      if (task.id === 't-legal') {
        legalRuns += 1;
        return { rawResult: 'L2', outputRefs: { legal_analysis: 'L2' } };
      }
      if (task.id === 't-solution') {
        solutionRuns += 1;
        return { rawResult: 'S', outputRefs: { solution_design: 'S' } };
      }
      return { rawResult: 'E', outputRefs: { estimation_package: 'E' } };
    },
  });

  assert.equal(legalRuns, 0);
  assert.equal(solutionRuns, 1);
  assert.equal(result.taskStates['t-legal'].status, 'completed');
  assert.equal(result.outputRefs.legal_analysis, 'L');
});

test('phase3 application executeWorkflowPlan rejects invalid budgets', async () => {
  const invalidPlan = {
    ...samplePlan(),
    budgets: {
      maxTasks: 0,
      maxRepairCycles: 2,
      maxParallelTasks: 2,
    },
  };

  await assert.rejects(
    () => executeWorkflowPlan({
      plan: invalidPlan,
      capabilityCatalogue,
      runtimeContext: {},
    }),
    /invalid/i
  );
});

test('phase3 dag executor marks pending tasks as cancelled when run is aborted', async () => {
  const plan = samplePlan();
  const controller = new AbortController();
  const failedEvents = [];
  let legalCompleted = false;

  await assert.rejects(
    () => executeDagPlan({
      plan,
      capabilityCatalogue,
      signal: controller.signal,
      externalInputs: {
        coordinator_context: 'ctx',
      },
      runTask: async task => {
        if (task.id === 't-legal' && !legalCompleted) {
          legalCompleted = true;
          controller.abort(Object.assign(new Error('cancelled by test'), { code: 'AI_RUN_CANCELLED', isCancellation: true, status: 499 }));
          return { rawResult: 'L', outputRefs: { legal_analysis: 'L' } };
        }
        if (task.id === 't-solution') {
          throw Object.assign(new Error('cancelled'), { code: 'AI_RUN_CANCELLED', isCancellation: true, status: 499 });
        }
        return { rawResult: 'E', outputRefs: { estimation_package: 'E' } };
      },
      onTaskFailed: async (task, meta) => {
        failedEvents.push({ taskId: task.id, cancelled: Boolean(meta.cancelled) });
      },
    }),
    err => {
      assert.ok(err?.executionSnapshot);
      assert.equal(err.executionSnapshot.taskStates['t-estimate'].status, 'cancelled');
      return true;
    }
  );

  assert.ok(failedEvents.some(event => event.taskId === 't-estimate' && event.cancelled));
});

test('phase3 dag executor returns run trace summary and preserves idempotent completed state', async () => {
  const plan = samplePlan();

  const result = await executeDagPlan({
    plan,
    capabilityCatalogue,
    initialTaskStates: {
      't-legal': {
        status: 'completed',
        attempt: 1,
        outputRefs: { legal_analysis: 'L' },
      },
      't-solution': {
        status: 'completed',
        attempt: 1,
        outputRefs: { solution_design: 'S' },
      },
      't-estimate': {
        status: 'completed',
        attempt: 1,
        outputRefs: { estimation_package: 'E' },
      },
    },
    initialOutputRefs: {
      legal_analysis: 'L',
      solution_design: 'S',
      estimation_package: 'E',
    },
    externalInputs: {
      coordinator_context: 'ctx',
    },
    runTask: async () => {
      throw new Error('No task should run when all are already completed');
    },
  });

  assert.equal(result.taskStates['t-estimate'].status, 'completed');
  assert.equal(result.outputRefs.estimation_package, 'E');
  assert.ok(result.runTrace);
  assert.ok(result.runTrace.summary);
  assert.equal(result.runTrace.summary.totalTasks, 3);
  assert.equal(result.runTrace.summary.completedTasks, 3);
  assert.equal(result.runTrace.summary.failedTasks, 0);
  assert.equal(result.runTrace.summary.cancelledTasks, 0);
  assert.ok(Number.isFinite(result.runTrace.summary.eventCount));
});
