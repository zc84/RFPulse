import { validateExecutorBudgets } from '../engine/budgetGuard.js';
import { executeDagPlan } from '../engine/dagExecutor.js';
import { runCapabilityTask } from '../engine/taskRunner.js';

export async function executeWorkflowPlan({
  plan,
  capabilityCatalogue,
  runtimeContext,
  persistedTaskStates = {},
  persistedOutputRefs = {},
  externalInputs = {},
  signal = null,
  onTaskStart = null,
  onTaskCompleted = null,
  onTaskFailed = null,
}) {
  const budgetValidation = validateExecutorBudgets(plan);
  if (!budgetValidation.valid) {
    throw new Error(`Workflow plan budgets are invalid: ${budgetValidation.errors.join('; ')}`);
  }

  return executeDagPlan({
    plan,
    capabilityCatalogue,
    initialTaskStates: persistedTaskStates,
    initialOutputRefs: persistedOutputRefs,
    externalInputs,
    maxParallelTasks: budgetValidation.limits.maxParallelTasks,
    signal,
    onTaskStart,
    onTaskCompleted,
    onTaskFailed,
    runTask: async (task, context) => runCapabilityTask({
      task,
      inputs: context.inputs,
      runtimeContext: {
        ...runtimeContext,
        outputs: {
          ...(runtimeContext?.outputs || {}),
          ...(context?.outputRefs || {}),
        },
      },
    }),
  });
}
