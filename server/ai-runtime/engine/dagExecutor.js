import { getMaxAttemptsForTask, shouldRetryTask } from './retryPolicy.js';
import { TASK_STATUSES, isTerminalTaskStatus } from './stateMachine.js';

function isCancellationError(err) {
  return Boolean(
    err?.isCancellation
      || err?.code === 'AI_RUN_CANCELLED'
      || err?.name === 'AbortError'
      || err?.code === 'ABORT_ERR'
      || err?.status === 499
  );
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  const reason = signal.reason;
  if (reason instanceof Error) throw reason;
  const error = new Error('AI run cancelled.');
  error.code = 'AI_RUN_CANCELLED';
  error.isCancellation = true;
  error.status = 499;
  throw error;
}

function getReadyTasks(tasks, states) {
  return tasks.filter(task => {
    const state = states.get(task.id);
    if (!state || state.status !== TASK_STATUSES.PENDING) return false;
    return (task.dependsOn || []).every(dep => states.get(dep)?.status === TASK_STATUSES.COMPLETED);
  });
}

function getBlockedTasks(tasks, states) {
  return tasks.filter(task => {
    const state = states.get(task.id);
    if (!state || state.status !== TASK_STATUSES.PENDING) return false;
    return (task.dependsOn || []).some(dep => {
      const depStatus = states.get(dep)?.status;
      return depStatus === TASK_STATUSES.FAILED || depStatus === TASK_STATUSES.CANCELLED;
    });
  });
}

function buildTaskInputs(task, outputRefs, externalInputs = {}) {
  const resolved = {};
  for (const inputRef of task.inputs || []) {
    if (Object.prototype.hasOwnProperty.call(outputRefs, inputRef)) {
      resolved[inputRef] = outputRefs[inputRef];
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(externalInputs, inputRef)) {
      resolved[inputRef] = externalInputs[inputRef];
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(externalInputs, `external:${inputRef}`)) {
      resolved[inputRef] = externalInputs[`external:${inputRef}`];
    }
  }
  return resolved;
}

async function executeTaskWithRetry({
  task,
  states,
  capabilitiesByKey,
  runTask,
  outputRefs,
  externalInputs,
  signal,
  onTaskStart,
  onTaskCompleted,
  onTaskFailed,
  onTraceEvent,
}) {
  const capability = capabilitiesByKey.get(task.capability) || null;
  const maxAttempts = getMaxAttemptsForTask(task, capability);
  let attempt = Math.max(1, Number(states.get(task.id)?.attempt || 1));
  let lastError = null;
  let lastStartedAt = null;
  let lastInputRefs = [];

  try {
    while (attempt <= maxAttempts) {
      throwIfAborted(signal);
      const startedAt = Date.now();
      const inputs = buildTaskInputs(task, outputRefs, externalInputs);
      lastStartedAt = new Date(startedAt).toISOString();
      lastInputRefs = Object.keys(inputs);
      await onTaskStart?.(task, {
        attempt,
        maxAttempts,
        startedAt: lastStartedAt,
        inputRefs: lastInputRefs,
      });
      await onTraceEvent?.({
        type: 'task_attempt_started',
        taskId: task.id,
        capability: task.capability,
        attempt,
        maxAttempts,
        startedAt: lastStartedAt,
        inputRefs: lastInputRefs,
      });
      try {
      const result = await runTask(task, {
        attempt,
        inputs,
        outputRefs,
      });
      const durationMs = Date.now() - startedAt;
      const completedAtIso = new Date().toISOString();
      await onTaskCompleted?.(task, {
        attempt,
        maxAttempts,
        durationMs,
        completedAt: completedAtIso,
        inputRefs: lastInputRefs,
        outputRefs: result.outputRefs || {},
        rawResult: result.rawResult ?? null,
        startedAt: lastStartedAt,
      });
      await onTraceEvent?.({
        type: 'task_attempt_completed',
        taskId: task.id,
        capability: task.capability,
        attempt,
        maxAttempts,
        durationMs,
        completedAt: completedAtIso,
        inputRefs: lastInputRefs,
        outputRefs: Object.keys(result.outputRefs || {}),
      });
      states.set(task.id, { status: TASK_STATUSES.COMPLETED, attempt, outputRefs: result.outputRefs || {} });
      return result;
      } catch (error) {
        lastError = error;
        const canRetry = shouldRetryTask({ attempt, maxAttempts, error });
        await onTraceEvent?.({
          type: 'task_attempt_failed',
          taskId: task.id,
          capability: task.capability,
          attempt,
          maxAttempts,
          retryScheduled: canRetry,
          error: error?.message || String(error),
          cancelled: isCancellationError(error),
          failedAt: new Date().toISOString(),
        });
        if (!canRetry) break;
        attempt += 1;
        states.set(task.id, { status: TASK_STATUSES.PENDING, attempt });
      }
    }
  } catch (error) {
    lastError = error;
  }

  if (isCancellationError(lastError)) {
    states.set(task.id, { status: TASK_STATUSES.CANCELLED, attempt, error: lastError?.message || String(lastError) });
  } else {
    states.set(task.id, { status: TASK_STATUSES.FAILED, attempt, error: lastError?.message || String(lastError) });
  }
  await onTaskFailed?.(task, {
    attempt,
    maxAttempts,
    error: lastError,
    cancelled: isCancellationError(lastError),
    startedAt: lastStartedAt,
    failedAt: new Date().toISOString(),
    inputRefs: lastInputRefs,
  });
  throw lastError;
}

export async function executeDagPlan({
  plan,
  capabilityCatalogue = [],
  runTask,
  initialTaskStates = {},
  initialOutputRefs = {},
  externalInputs = {},
  maxParallelTasks = null,
  signal = null,
  onTaskStart = null,
  onTaskCompleted = null,
  onTaskFailed = null,
}) {
  const runStartedAt = new Date().toISOString();
  const traceEvents = [];
  const pushTraceEvent = event => {
    traceEvents.push({
      ...event,
      timestamp: new Date().toISOString(),
    });
  };

  const tasks = Array.isArray(plan?.tasks) ? plan.tasks : [];
  const limits = Number(maxParallelTasks || plan?.budgets?.maxParallelTasks || 4);
  const capabilitiesByKey = new Map((capabilityCatalogue || []).map(cap => [cap.capabilityKey, cap]));
  const outputRefs = { ...(initialOutputRefs || {}) };
  const states = new Map();

  for (const task of tasks) {
    const existing = initialTaskStates?.[task.id];
    states.set(task.id, {
      status: existing?.status || TASK_STATUSES.PENDING,
      attempt: Math.max(1, Number(existing?.attempt || 1)),
      outputRefs: existing?.outputRefs || {},
      error: existing?.error || null,
    });
    if (existing?.status === TASK_STATUSES.COMPLETED && existing?.outputRefs) {
      Object.assign(outputRefs, existing.outputRefs);
    }
  }

  try {
    while (true) {
    throwIfAborted(signal);
    const allTerminal = tasks.every(task => isTerminalTaskStatus(states.get(task.id)?.status));
    if (allTerminal) break;

    const blocked = getBlockedTasks(tasks, states);
    for (const task of blocked) {
      states.set(task.id, {
        status: TASK_STATUSES.FAILED,
        attempt: states.get(task.id)?.attempt || 1,
        error: 'Blocked by failed dependency.',
      });
      await onTaskFailed?.(task, {
        attempt: states.get(task.id)?.attempt || 1,
        error: new Error('Blocked by failed dependency.'),
        cancelled: false,
      });
    }

    const ready = getReadyTasks(tasks, states);
    if (ready.length === 0) {
      const pendingCount = tasks.filter(task => states.get(task.id)?.status === TASK_STATUSES.PENDING).length;
      if (pendingCount === 0) break;
      throw new Error('No ready tasks available while pending tasks remain. Plan execution is stuck.');
    }

    const batch = ready.slice(0, Math.max(1, limits));
    await Promise.all(batch.map(async task => {
      states.set(task.id, {
        status: TASK_STATUSES.RUNNING,
        attempt: states.get(task.id)?.attempt || 1,
      });
      const result = await executeTaskWithRetry({
        task,
        states,
        capabilitiesByKey,
        runTask,
        outputRefs,
        externalInputs,
        signal,
        onTaskStart,
        onTaskCompleted,
        onTaskFailed,
        onTraceEvent: pushTraceEvent,
      });
      Object.assign(outputRefs, result.outputRefs || {});
    }));
    }
  } catch (error) {
    if (isCancellationError(error)) {
      for (const task of tasks) {
        const state = states.get(task.id);
        if (state?.status === TASK_STATUSES.PENDING) {
          const blockedInputs = buildTaskInputs(task, outputRefs, externalInputs);
          states.set(task.id, {
            ...state,
            status: TASK_STATUSES.CANCELLED,
            error: state.error || 'Cancelled before execution.',
          });
          await onTaskFailed?.(task, {
            attempt: state.attempt || 1,
            maxAttempts: getMaxAttemptsForTask(task, capabilitiesByKey.get(task.capability) || null),
            error,
            cancelled: true,
            startedAt: null,
            failedAt: new Date().toISOString(),
            inputRefs: Object.keys(blockedInputs),
          });
          pushTraceEvent({
            type: 'task_cancelled_before_start',
            taskId: task.id,
            capability: task.capability,
            attempt: state.attempt || 1,
            inputRefs: Object.keys(blockedInputs),
          });
        }
      }
    }
    error.executionSnapshot = {
      taskStates: Object.fromEntries(states.entries()),
      outputRefs: { ...outputRefs },
      runTrace: {
        startedAt: runStartedAt,
        finishedAt: new Date().toISOString(),
        events: traceEvents,
      },
    };
    throw error;
  }

  const taskStates = Object.fromEntries(states.entries());
  const summary = {
    totalTasks: tasks.length,
    completedTasks: Object.values(taskStates).filter(state => state.status === TASK_STATUSES.COMPLETED).length,
    failedTasks: Object.values(taskStates).filter(state => state.status === TASK_STATUSES.FAILED).length,
    cancelledTasks: Object.values(taskStates).filter(state => state.status === TASK_STATUSES.CANCELLED).length,
    maxAttempt: Math.max(0, ...Object.values(taskStates).map(state => Number(state.attempt || 0))),
    eventCount: traceEvents.length,
  };

  return {
    taskStates,
    outputRefs,
    runTrace: {
      startedAt: runStartedAt,
      finishedAt: new Date().toISOString(),
      events: traceEvents,
      summary,
    },
  };
}
