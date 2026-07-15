import { query } from '../../db.js';
import { listEnabledCapabilities } from '../capabilities/capabilityRegistry.js';
import { executeWorkflowPlan } from './executePlan.js';

function parseJsonObject(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseWorkflowPlanFromSession(session) {
  const raw = session?.workflow_plan;
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function getDynamicTaskStateSnapshot(sessionId) {
  const result = await query(
    `SELECT task_id, status, attempt, output_refs, error
     FROM ai_workflow_steps
     WHERE session_id = $1
       AND task_id IS NOT NULL`,
    [sessionId]
  );

  const taskStates = {};
  const outputRefs = {};
  for (const row of result.rows) {
    const refs = parseJsonObject(row.output_refs, {});
    taskStates[row.task_id] = {
      status: row.status,
      attempt: Number(row.attempt || 1),
      outputRefs: refs,
      error: row.error || null,
    };
    if (row.status === 'completed') {
      Object.assign(outputRefs, refs);
    }
  }

  return { taskStates, outputRefs };
}

async function markDynamicTaskRunning({ sessionId, dealId, task, capabilityVersion = null, attempt = 1, maxAttempts = 1, startedAt = null, inputRefs = [] }) {
  const stepKey = `task:${task.id}`;
  await query(
    `INSERT INTO ai_workflow_steps (
       session_id, deal_id, step_key, status, task_id, capability_key, capability_version,
       depends_on, input_refs, output_refs, acceptance_criteria, attempt, metrics,
       started_at, updated_at
     ) VALUES (
       $1, $2, $3, 'running', $4, $5, $6,
       $7, $8, '{}'::jsonb, $9, $10, $11,
       COALESCE($12::timestamptz, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
     )
     ON CONFLICT (session_id, step_key)
     DO UPDATE SET
       status = 'running',
       task_id = EXCLUDED.task_id,
       capability_key = EXCLUDED.capability_key,
       capability_version = EXCLUDED.capability_version,
       depends_on = EXCLUDED.depends_on,
       input_refs = EXCLUDED.input_refs,
       acceptance_criteria = EXCLUDED.acceptance_criteria,
       attempt = EXCLUDED.attempt,
       metrics = EXCLUDED.metrics,
       error = NULL,
       started_at = COALESCE($12::timestamptz, CURRENT_TIMESTAMP),
       updated_at = CURRENT_TIMESTAMP`,
    [
      sessionId,
      dealId,
      stepKey,
      task.id,
      task.capability,
      capabilityVersion,
      JSON.stringify(task.dependsOn || []),
      JSON.stringify(inputRefs || []),
      JSON.stringify(task.acceptanceCriteria || []),
      attempt,
      JSON.stringify({
        maxAttempts,
        inputCount: Array.isArray(inputRefs) ? inputRefs.length : 0,
      }),
      startedAt,
    ]
  );
}

async function markDynamicTaskCompleted({
  sessionId,
  dealId,
  task,
  outputRefs = {},
  rawResult = null,
  attempt = 1,
  maxAttempts = 1,
  durationMs = null,
  startedAt = null,
  completedAt = null,
  inputRefs = [],
}) {
  const stepKey = `task:${task.id}`;
  await query(
    `INSERT INTO ai_workflow_steps (
       session_id, deal_id, step_key, status, artifact, task_id, capability_key,
       depends_on, input_refs, output_refs, acceptance_criteria, attempt, metrics,
       started_at, completed_at, updated_at
     ) VALUES (
       $1, $2, $3, 'completed', $4, $5, $6,
       $7, $8, $9, $10, $11, $12,
       COALESCE($13::timestamptz, CURRENT_TIMESTAMP), COALESCE($14::timestamptz, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
     )
     ON CONFLICT (session_id, step_key)
     DO UPDATE SET
       status = 'completed',
       artifact = EXCLUDED.artifact,
       task_id = EXCLUDED.task_id,
       capability_key = EXCLUDED.capability_key,
       depends_on = EXCLUDED.depends_on,
       input_refs = EXCLUDED.input_refs,
       output_refs = EXCLUDED.output_refs,
       acceptance_criteria = EXCLUDED.acceptance_criteria,
       attempt = EXCLUDED.attempt,
       metrics = EXCLUDED.metrics,
       error = NULL,
       completed_at = COALESCE($14::timestamptz, CURRENT_TIMESTAMP),
       updated_at = CURRENT_TIMESTAMP`,
    [
      sessionId,
      dealId,
      stepKey,
      typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult),
      task.id,
      task.capability,
      JSON.stringify(task.dependsOn || []),
      JSON.stringify(inputRefs || []),
      JSON.stringify(outputRefs || {}),
      JSON.stringify(task.acceptanceCriteria || []),
      attempt,
      JSON.stringify({
        durationMs,
        maxAttempts,
        completedAt,
        outputCount: Object.keys(outputRefs || {}).length,
      }),
      startedAt,
      completedAt,
    ]
  );
}

async function markDynamicTaskFailed({
  sessionId,
  dealId,
  task,
  error,
  attempt = 1,
  maxAttempts = 1,
  cancelled = false,
  startedAt = null,
  failedAt = null,
  inputRefs = [],
}) {
  const stepKey = `task:${task.id}`;
  await query(
    `INSERT INTO ai_workflow_steps (
       session_id, deal_id, step_key, status, error, task_id, capability_key,
       depends_on, input_refs, acceptance_criteria, attempt, metrics,
       started_at, completed_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       $8, $9, $10, $11, $12,
       COALESCE($13::timestamptz, CURRENT_TIMESTAMP), COALESCE($14::timestamptz, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
     )
     ON CONFLICT (session_id, step_key)
     DO UPDATE SET
       status = EXCLUDED.status,
       error = EXCLUDED.error,
       task_id = EXCLUDED.task_id,
       capability_key = EXCLUDED.capability_key,
       depends_on = EXCLUDED.depends_on,
       input_refs = EXCLUDED.input_refs,
       acceptance_criteria = EXCLUDED.acceptance_criteria,
       attempt = EXCLUDED.attempt,
       metrics = EXCLUDED.metrics,
       completed_at = COALESCE($14::timestamptz, CURRENT_TIMESTAMP),
       updated_at = CURRENT_TIMESTAMP`,
    [
      sessionId,
      dealId,
      stepKey,
      cancelled ? 'cancelled' : 'failed',
      error?.message || String(error),
      task.id,
      task.capability,
      JSON.stringify(task.dependsOn || []),
      JSON.stringify(inputRefs || []),
      JSON.stringify(task.acceptanceCriteria || []),
      attempt,
      JSON.stringify({ maxAttempts, failedAt, cancelled }),
      startedAt,
      failedAt,
    ]
  );
}

async function persistPhase3RunTrace({ sessionId, dealId, runTrace, status = 'completed' }) {
  const trace = runTrace && typeof runTrace === 'object' ? runTrace : {};
  const summary = trace.summary && typeof trace.summary === 'object' ? trace.summary : {};
  const events = Array.isArray(trace.events) ? trace.events : [];
  await query(
    `INSERT INTO ai_workflow_steps (
       session_id, deal_id, step_key, status, artifact, metrics,
       started_at, completed_at, updated_at
     ) VALUES (
       $1, $2, 'phase3-run-trace', $3, $4, $5,
       COALESCE($6::timestamptz, CURRENT_TIMESTAMP), COALESCE($7::timestamptz, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
     )
     ON CONFLICT (session_id, step_key)
     DO UPDATE SET
       status = EXCLUDED.status,
       artifact = EXCLUDED.artifact,
       metrics = EXCLUDED.metrics,
       started_at = COALESCE($6::timestamptz, ai_workflow_steps.started_at, CURRENT_TIMESTAMP),
       completed_at = COALESCE($7::timestamptz, CURRENT_TIMESTAMP),
       updated_at = CURRENT_TIMESTAMP`,
    [
      sessionId,
      dealId,
      status,
      JSON.stringify(summary),
      JSON.stringify({
        startedAt: trace.startedAt || null,
        finishedAt: trace.finishedAt || null,
        eventCount: events.length,
        summary,
      }),
      trace.startedAt || null,
      trace.finishedAt || null,
    ]
  );
}

export async function runPhase3PlanExecution({
  session,
  dealId,
  dealName,
  contextBundle,
  messages,
  aiNotes,
  externalInputs,
  signal,
  publishSessionUpdate,
}) {
  const workflowPlan = parseWorkflowPlanFromSession(session);
  if (!workflowPlan || !Array.isArray(workflowPlan.tasks) || workflowPlan.tasks.length === 0) {
    return null;
  }

  const capabilityCatalogue = await listEnabledCapabilities();
  const capabilityVersionByKey = new Map(capabilityCatalogue.map(cap => [cap.capabilityKey, cap.version || null]));
  const snapshot = await getDynamicTaskStateSnapshot(session.id);

  try {
    const execution = await executeWorkflowPlan({
      plan: workflowPlan,
      capabilityCatalogue,
      runtimeContext: {
        context: contextBundle,
        conversation: messages,
        priorityInstructions: aiNotes,
        signal,
        dealName,
        outputs: snapshot.outputRefs,
      },
      persistedTaskStates: snapshot.taskStates,
      persistedOutputRefs: snapshot.outputRefs,
      externalInputs,
      signal,
      onTaskStart: async (task, meta) => {
        await markDynamicTaskRunning({
          sessionId: session.id,
          dealId,
          task,
          capabilityVersion: capabilityVersionByKey.get(task.capability) ?? null,
          attempt: meta.attempt,
          maxAttempts: meta.maxAttempts,
          startedAt: meta.startedAt,
          inputRefs: meta.inputRefs || [],
        });
        await publishSessionUpdate?.(session.id, dealId);
      },
      onTaskCompleted: async (task, meta) => {
        await markDynamicTaskCompleted({
          sessionId: session.id,
          dealId,
          task,
          outputRefs: meta.outputRefs,
          rawResult: meta.rawResult,
          attempt: meta.attempt,
          maxAttempts: meta.maxAttempts,
          durationMs: meta.durationMs,
          startedAt: meta.startedAt,
          completedAt: meta.completedAt,
          inputRefs: meta.inputRefs || [],
        });
        await publishSessionUpdate?.(session.id, dealId);
      },
      onTaskFailed: async (task, meta) => {
        await markDynamicTaskFailed({
          sessionId: session.id,
          dealId,
          task,
          error: meta.error,
          attempt: meta.attempt,
          maxAttempts: meta.maxAttempts,
          cancelled: Boolean(meta.cancelled),
          startedAt: meta.startedAt,
          failedAt: meta.failedAt,
          inputRefs: meta.inputRefs || [],
        });
        await publishSessionUpdate?.(session.id, dealId, { immediate: true });
      },
    });

    await persistPhase3RunTrace({
      sessionId: session.id,
      dealId,
      runTrace: execution.runTrace,
      status: 'completed',
    });
    await publishSessionUpdate?.(session.id, dealId);
    return execution;
  } catch (error) {
    if (error?.executionSnapshot?.runTrace) {
      await persistPhase3RunTrace({
        sessionId: session.id,
        dealId,
        runTrace: error.executionSnapshot.runTrace,
        status: 'failed',
      });
      await publishSessionUpdate?.(session.id, dealId, { immediate: true });
    }
    throw error;
  }
}
