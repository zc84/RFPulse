import { capabilityAdapterHandlers } from '../capabilities/agentCapabilityAdapters.js';

function withLegacyAliases(task, rawResult, refs) {
  const mapped = { ...refs };
  if (task.capability === 'analysis.legal') {
    mapped.legal = rawResult;
  }
  if (task.capability === 'analysis.solution') {
    mapped.architect = rawResult;
  }
  if (task.capability === 'analysis.estimation') {
    mapped.estimator = rawResult;
  }
  return mapped;
}

function mapTaskOutputs(task, rawResult) {
  if (rawResult && typeof rawResult === 'object' && !Array.isArray(rawResult)) {
    const direct = {};
    for (const outputRef of task.outputs || []) {
      if (outputRef in rawResult) {
        direct[outputRef] = rawResult[outputRef];
      }
    }
    if (Object.keys(direct).length > 0) {
      return withLegacyAliases(task, rawResult, direct);
    }
  }

  if ((task.outputs || []).length === 1) {
    return withLegacyAliases(task, rawResult, {
      [task.outputs[0]]: rawResult,
    });
  }

  const fallback = {};
  for (const outputRef of task.outputs || []) {
    fallback[outputRef] = rawResult;
  }
  return withLegacyAliases(task, rawResult, fallback);
}

export async function runCapabilityTask({ task, inputs, runtimeContext }) {
  const handler = capabilityAdapterHandlers[task.capability];
  if (!handler) {
    throw new Error(`No capability adapter handler found for capability: ${task.capability}`);
  }

  const ctx = {
    ...runtimeContext,
    inputRefs: inputs,
    task,
    outputs: {
      ...(runtimeContext.outputs || {}),
      ...inputs,
    },
  };

  const rawResult = await handler(ctx);
  const outputRefs = mapTaskOutputs(task, rawResult);
  return {
    rawResult,
    outputRefs,
  };
}
