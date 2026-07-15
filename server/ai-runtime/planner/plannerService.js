import { query } from '../../db.js';
import { callAgent } from '../../services/aiOrchestrator.js';
import { listEnabledCapabilities } from '../capabilities/capabilityRegistry.js';
import { compileWorkflowPlan } from './planCompiler.js';
import { workflowPlanSchema } from './planSchemas.js';
import { PLANNER_PROMPT_VERSION, buildPlannerRepairUserPrompt, buildPlannerUserPrompt } from './plannerPrompts.js';

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function synthesizeFallbackPlan({ requiredArtifacts = [] } = {}) {
  return {
    objective: 'Produce a compliant proposal package from extracted tender evidence',
    clarificationRequired: false,
    clarifications: [],
    tasks: [
      {
        id: 'analyze-legal',
        capability: 'analysis.legal',
        dependsOn: [],
        inputs: ['coordinator_context'],
        outputs: ['legal_analysis'],
        acceptanceCriteria: ['Key legal and procurement constraints captured'],
        priority: 'high',
      },
      {
        id: 'design-solution',
        capability: 'analysis.solution',
        dependsOn: [],
        inputs: ['coordinator_context'],
        outputs: ['solution_design'],
        acceptanceCriteria: ['Core architecture aligns with requirements'],
        priority: 'high',
      },
      {
        id: 'estimate-delivery',
        capability: 'analysis.estimation',
        dependsOn: ['analyze-legal', 'design-solution'],
        inputs: ['solution_design', 'legal_analysis'],
        outputs: ['estimation_package'],
        acceptanceCriteria: ['Estimate reconciles effort, duration, and pricing'],
        priority: 'high',
      },
      {
        id: 'integrate-proposal',
        capability: 'proposal.integrate',
        dependsOn: ['analyze-legal', 'design-solution', 'estimate-delivery'],
        inputs: ['legal_analysis', 'solution_design', 'estimation_package'],
        outputs: ['proposal_markdown'],
        acceptanceCriteria: ['Proposal integrates all specialist outputs'],
        priority: 'critical',
      },
    ],
    qualityGates: ['quality.coverage', 'quality.consistency', 'quality.evidence'],
    artifactIntent: requiredArtifacts.length > 0 ? requiredArtifacts : ['proposal-docx', 'detailed-wbs-xlsx'],
    budgets: { maxTasks: 24, maxRepairCycles: 2, maxParallelTasks: 4 },
  };
}

async function getSetting(key, queryFn = query) {
  const result = await queryFn('SELECT value FROM global_settings WHERE key = $1', [key]);
  return result.rows[0]?.value ?? null;
}

export async function ensureRuntimeVersionColumnDefaults(queryFn = query) {
  await queryFn(`
    UPDATE ai_sessions
    SET runtime_version = COALESCE(runtime_version, 'legacy')
    WHERE runtime_version IS NULL
  `);
}

export async function generateWorkflowPlanShadow({
  objective,
  contextSummary,
  requiredArtifacts = ['proposal-docx', 'detailed-wbs-xlsx'],
  budgets = { maxTasks: 24, maxRepairCycles: 2, maxParallelTasks: 4 },
  priorityInstructions = '',
  signal = null,
  queryFn = query,
  capabilityCatalogueOverride = null,
  agentCaller = callAgent,
}) {
  const capabilityCatalogue = Array.isArray(capabilityCatalogueOverride)
    ? capabilityCatalogueOverride
    : await listEnabledCapabilities(queryFn);
  const fallbackRaw = await getSetting('ai_planner_fallback_plan', queryFn);
  const synthesizedFallbackPlan = synthesizeFallbackPlan({ requiredArtifacts });
  const configuredFallbackPlan = safeJsonParse(fallbackRaw);

  let compiledConfiguredFallback;
  if (!configuredFallbackPlan) {
    compiledConfiguredFallback = { valid: false, errors: ['Configured fallback plan is missing or not parseable.'] };
  } else {
    try {
      compiledConfiguredFallback = compileWorkflowPlan(configuredFallbackPlan, { capabilityCatalogue, budgets });
    } catch (err) {
      compiledConfiguredFallback = {
        valid: false,
        errors: [`Configured fallback plan failed schema validation: ${err.message || String(err)}`],
      };
    }
  }

  const fallbackPlan = compiledConfiguredFallback.valid
    ? configuredFallbackPlan
    : synthesizedFallbackPlan;

  let candidatePlan = null;
  let plannerModel = 'coordinator';

  try {
    const raw = await agentCaller('coordinator', [{
      role: 'user',
      content: buildPlannerUserPrompt({
        objective,
        contextSummary,
        capabilityCatalogue,
        budgets,
        requiredArtifacts,
      }),
    }], {
      priorityInstructions,
      schema: workflowPlanSchema,
      schemaName: 'workflow_plan',
      maxTokens: 8192,
      signal,
    });
    candidatePlan = safeJsonParse(raw);
  } catch {
    candidatePlan = null;
  }

  const compiledPrimary = candidatePlan
    ? compileWorkflowPlan(candidatePlan, { capabilityCatalogue, budgets })
    : { valid: false, errors: ['Planner did not return a parseable plan.'] };

  if (compiledPrimary.valid) {
    return {
      plan: compiledPrimary.plan,
      validation: compiledPrimary,
      plannerModel,
      plannerPromptVersion: PLANNER_PROMPT_VERSION,
      usedFallback: false,
      usedRepair: false,
    };
  }

  let repairedPlan = null;
  try {
    if (candidatePlan) {
      const repairedRaw = await agentCaller('coordinator', [{
        role: 'user',
        content: buildPlannerRepairUserPrompt({
          objective,
          contextSummary,
          capabilityCatalogue,
          budgets,
          requiredArtifacts,
          invalidPlan: candidatePlan,
          validationErrors: compiledPrimary.errors,
        }),
      }], {
        priorityInstructions,
        schema: workflowPlanSchema,
        schemaName: 'workflow_plan_repair',
        maxTokens: 8192,
        signal,
      });

      repairedPlan = safeJsonParse(repairedRaw);
    }
  } catch {
    repairedPlan = null;
  }

  const compiledRepair = repairedPlan
    ? compileWorkflowPlan(repairedPlan, { capabilityCatalogue, budgets })
    : { valid: false, errors: ['Planner repair did not return a parseable plan.'] };

  if (compiledRepair.valid) {
    return {
      plan: compiledRepair.plan,
      validation: compiledRepair,
      plannerModel,
      plannerPromptVersion: PLANNER_PROMPT_VERSION,
      usedFallback: false,
      usedRepair: true,
      repairReason: compiledPrimary.errors,
    };
  }

  const compiledFallback = compileWorkflowPlan(fallbackPlan, { capabilityCatalogue, budgets });
  if (!compiledFallback.valid) {
    throw new Error(`Fallback workflow plan is invalid: ${compiledFallback.errors.join('; ')}`);
  }

  return {
    plan: compiledFallback.plan,
    validation: compiledFallback,
    plannerModel,
    plannerPromptVersion: PLANNER_PROMPT_VERSION,
    usedFallback: true,
    usedRepair: false,
    fallbackReason: compiledPrimary.errors,
    repairErrors: compiledRepair.errors,
    configuredFallbackErrors: compiledConfiguredFallback.valid ? [] : compiledConfiguredFallback.errors,
  };
}

export async function persistWorkflowPlanSnapshot({
  sessionId,
  runObjective,
  workflowPlan,
  plannerModel,
  plannerPromptVersion,
  runtimeVersion = 'legacy',
  queryFn = query,
}) {
  await queryFn(
    `UPDATE ai_sessions
     SET workflow_plan = $1,
         workflow_plan_version = COALESCE(workflow_plan_version, 1),
         planner_model = $2,
         planner_prompt_version = $3,
         run_objective = $4,
         runtime_version = $5,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $6`,
    [
      JSON.stringify(workflowPlan),
      plannerModel,
      plannerPromptVersion,
      runObjective,
      runtimeVersion,
      sessionId,
    ]
  );
}

export async function isShadowModeEnabled(queryFn = query) {
  const value = await getSetting('ai_runtime_v2_shadow_mode', queryFn);
  return String(value || 'false').toLowerCase() === 'true';
}
