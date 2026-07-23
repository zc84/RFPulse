import { workflowPlanSchema } from './planSchemas.js';

function requiredRefsFromSchema(schema) {
  if (!schema || typeof schema !== 'object') return [];
  if (!Array.isArray(schema.required)) return [];
  return schema.required
    .map(item => String(item || '').trim())
    .filter(Boolean);
}

function detectCycle(tasksById) {
  const visiting = new Set();
  const visited = new Set();

  function dfs(taskId) {
    if (visited.has(taskId)) return false;
    if (visiting.has(taskId)) return true;
    visiting.add(taskId);
    const task = tasksById.get(taskId);
    for (const dep of task.dependsOn || []) {
      if (!tasksById.has(dep)) continue;
      if (dfs(dep)) return true;
    }
    visiting.delete(taskId);
    visited.add(taskId);
    return false;
  }

  for (const taskId of tasksById.keys()) {
    if (dfs(taskId)) return true;
  }
  return false;
}

export function compileWorkflowPlan(rawPlan, { capabilityCatalogue = [], budgets = {} } = {}) {
  const parsed = workflowPlanSchema.parse(rawPlan);
  const capabilitiesByKey = new Map(
    (capabilityCatalogue || []).map(cap => [cap.capabilityKey, cap])
  );
  const enabledKeys = new Set(capabilitiesByKey.keys());
  const externallyAvailableInputs = new Set(
    Array.isArray(budgets.externallyAvailableInputs)
      ? budgets.externallyAvailableInputs.map(item => String(item || '').trim()).filter(Boolean)
      : [
        'coordinator_context',
        'evidence_items',
        'requirement_inventory',
        'source_documents',
        'deal_ai_notes',
        'context_summary',
        'framework_retrieval_query',
        'framework_retrieval_intents',
        'company_retrieval_query',
        'company_retrieval_intents',
      ]
  );

  const errors = [];
  const tasksById = new Map();

  if (parsed.tasks.length > (budgets.maxTasks || parsed.budgets.maxTasks || 24)) {
    errors.push(`Task count ${parsed.tasks.length} exceeds maxTasks budget.`);
  }

  for (const task of parsed.tasks) {
    if (tasksById.has(task.id)) {
      errors.push(`Duplicate task id: ${task.id}`);
      continue;
    }
    tasksById.set(task.id, task);

    if (!enabledKeys.has(task.capability)) {
      errors.push(`Task ${task.id} references unavailable capability: ${task.capability}`);
      continue;
    }

    const capability = capabilitiesByKey.get(task.capability);
    const requiredInputs = requiredRefsFromSchema(capability?.inputSchema);
    const requiredOutputs = requiredRefsFromSchema(capability?.outputSchema);
    const declaredInputs = new Set(task.inputs || []);
    const declaredOutputs = new Set(task.outputs || []);
    const permittedTools = new Set(Array.isArray(capability?.permittedTools) ? capability.permittedTools : []);

    for (const requiredInput of requiredInputs) {
      if (!declaredInputs.has(requiredInput)) {
        errors.push(`Task ${task.id} is missing required input \`${requiredInput}\` for capability ${task.capability}.`);
      }
    }

    for (const requiredOutput of requiredOutputs) {
      if (!declaredOutputs.has(requiredOutput)) {
        errors.push(`Task ${task.id} is missing required output \`${requiredOutput}\` for capability ${task.capability}.`);
      }
    }

    for (const tool of task.tools || []) {
      if (!permittedTools.has(tool)) {
        errors.push(`Task ${task.id} uses disallowed tool \`${tool}\` for capability ${task.capability}.`);
      }
    }
  }

  for (const task of parsed.tasks) {
    for (const dep of task.dependsOn || []) {
      if (!tasksById.has(dep)) {
        errors.push(`Task ${task.id} depends on unknown task: ${dep}`);
      }
    }

    const producedByDependencies = new Set();
    for (const dep of task.dependsOn || []) {
      const depTask = tasksById.get(dep);
      for (const outputRef of depTask?.outputs || []) {
        producedByDependencies.add(outputRef);
      }
    }

    for (const inputRef of task.inputs || []) {
      const isExternal = externallyAvailableInputs.has(inputRef) || String(inputRef).startsWith('external:');
      if (!isExternal && !producedByDependencies.has(inputRef)) {
        errors.push(`Task ${task.id} input \`${inputRef}\` is not satisfied by dependencies or external inputs.`);
      }
    }
  }

  if (detectCycle(tasksById)) {
    errors.push('Workflow plan contains a cycle.');
  }

  return {
    valid: errors.length === 0,
    errors,
    plan: parsed,
  };
}
