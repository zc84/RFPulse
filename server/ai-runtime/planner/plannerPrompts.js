export const PLANNER_PROMPT_VERSION = 2;

export function buildPlannerSystemPrompt() {
  return `You are the Workflow Planner for an AI-native RFP runtime.

Your task: produce a JSON WorkflowPlan using only enabled capabilities from the provided catalogue.

Rules:
1. Use capability keys exactly as given.
2. Build an executable DAG (no cycles, valid dependencies).
3. Keep task count within budget.
4. Include acceptanceCriteria for each task.
5. Prefer the minimal complete plan over over-planning.
6. For tender/RFP work, requirement extraction and submission compliance are mandatory foundations. Include requirements.extract before proposal structure/authoring whenever evidence_items are available, and keep quality/submission gates in the executable plan or rely on the runtime release gate.
7. If clarification is required, set clarificationRequired=true and provide focused clarifications.
8. Return JSON only.`;
}

export function buildPlannerUserPrompt({ objective, contextSummary, capabilityCatalogue, budgets, requiredArtifacts }) {
  return [
    `## Objective\n${objective}`,
    `## Context Summary\n${contextSummary || 'No context provided.'}`,
    `## Capability Catalogue\n${JSON.stringify(capabilityCatalogue, null, 2)}`,
    `## Planner Budgets\n${JSON.stringify(budgets, null, 2)}`,
    `## Required Artifact Intent\n${JSON.stringify(requiredArtifacts || [], null, 2)}`,
    'Return a valid WorkflowPlan JSON object that follows the provided schema expectations.',
  ].join('\n\n');
}

export function buildPlannerRepairUserPrompt({
  objective,
  contextSummary,
  capabilityCatalogue,
  budgets,
  requiredArtifacts,
  invalidPlan,
  validationErrors,
}) {
  return [
    `## Objective\n${objective}`,
    `## Context Summary\n${contextSummary || 'No context provided.'}`,
    `## Capability Catalogue\n${JSON.stringify(capabilityCatalogue, null, 2)}`,
    `## Planner Budgets\n${JSON.stringify(budgets, null, 2)}`,
    `## Required Artifact Intent\n${JSON.stringify(requiredArtifacts || [], null, 2)}`,
    `## Invalid WorkflowPlan Candidate\n${JSON.stringify(invalidPlan || {}, null, 2)}`,
    `## Validation Errors To Fix\n${JSON.stringify(validationErrors || [], null, 2)}`,
    'Repair the invalid plan and return ONLY a corrected WorkflowPlan JSON object. Keep changes minimal while making the plan executable.',
  ].join('\n\n');
}
