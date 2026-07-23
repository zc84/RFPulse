-- Ensure the runtime fallback cannot skip the authoritative requirement inventory.
UPDATE global_settings
SET value = jsonb_set(
  value::jsonb,
  '{tasks}',
  (
    '[
      {"id":"extract-requirements","capability":"requirements.extract","dependsOn":[],"inputs":["evidence_items"],"outputs":["requirement_inventory"],"acceptanceCriteria":["Atomic requirements preserve source locators, hashes, obligation levels, and submission gaps"],"priority":"critical"},
      {"id":"analyze-legal","capability":"analysis.legal","dependsOn":["extract-requirements"],"inputs":["coordinator_context"],"outputs":["legal_analysis"],"acceptanceCriteria":["Key procurement and legal constraints identified"],"priority":"high"},
      {"id":"design-solution","capability":"analysis.solution","dependsOn":["extract-requirements"],"inputs":["coordinator_context"],"outputs":["solution_design"],"acceptanceCriteria":["Core architecture decisions trace to requirements"],"priority":"high"},
      {"id":"estimate-delivery","capability":"analysis.estimation","dependsOn":["analyze-legal","design-solution"],"inputs":["solution_design","legal_analysis"],"outputs":["estimation_package"],"acceptanceCriteria":["Effort and pricing align with scoped solution"],"priority":"high"},
      {"id":"integrate-proposal","capability":"proposal.integrate","dependsOn":["analyze-legal","design-solution","estimate-delivery","extract-requirements"],"inputs":["legal_analysis","solution_design","estimation_package","requirement_inventory"],"outputs":["proposal_markdown"],"acceptanceCriteria":["Final proposal integrates specialist outputs and the requirement inventory"],"priority":"critical"}
    ]'::jsonb
  )::text
)
WHERE key = 'ai_planner_fallback_plan'
  AND value IS NOT NULL
  AND value::jsonb ? 'tasks';

-- Do not change ai_runtime_v2_enabled here. Migrations are intentionally
-- idempotent and run on every deploy; overwriting this operator-controlled
-- rollback switch would make an emergency disable non-persistent.
