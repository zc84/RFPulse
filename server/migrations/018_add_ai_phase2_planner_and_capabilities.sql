ALTER TABLE ai_sessions
  ADD COLUMN IF NOT EXISTS workflow_plan JSONB,
  ADD COLUMN IF NOT EXISTS workflow_plan_version INTEGER,
  ADD COLUMN IF NOT EXISTS planner_model VARCHAR(100),
  ADD COLUMN IF NOT EXISTS planner_prompt_version INTEGER,
  ADD COLUMN IF NOT EXISTS run_objective TEXT,
  ADD COLUMN IF NOT EXISTS runtime_version VARCHAR(30) DEFAULT 'legacy';

CREATE TABLE IF NOT EXISTS ai_capabilities (
  id SERIAL PRIMARY KEY,
  capability_key VARCHAR(120) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  permitted_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_model VARCHAR(100),
  concurrency_class VARCHAR(40) DEFAULT 'default',
  cost_weight NUMERIC(6,3) DEFAULT 1,
  retry_policy JSONB NOT NULL DEFAULT '{"maxAttempts":1}'::jsonb,
  requires_human_approval BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (capability_key, version)
);

CREATE INDEX IF NOT EXISTS idx_ai_capabilities_key_enabled
  ON ai_capabilities(capability_key, enabled);

INSERT INTO global_settings (key, value)
VALUES
  ('ai_runtime_v2_enabled', 'false'),
  ('ai_runtime_v2_shadow_mode', 'true'),
  ('ai_planner_fallback_plan', '{"objective":"Deliver complete proposal package","clarificationRequired":false,"clarifications":[],"tasks":[{"id":"analyze-legal","capability":"analysis.legal","dependsOn":[],"inputs":["coordinator_context"],"outputs":["legal_analysis"],"acceptanceCriteria":["Key procurement and legal constraints identified"],"priority":"high"},{"id":"design-solution","capability":"analysis.solution","dependsOn":[],"inputs":["coordinator_context"],"outputs":["solution_design"],"acceptanceCriteria":["Core architecture decisions trace to requirements"],"priority":"high"},{"id":"estimate-delivery","capability":"analysis.estimation","dependsOn":["design-solution"],"inputs":["solution_design","legal_analysis"],"outputs":["estimation_package"],"acceptanceCriteria":["Effort and pricing align with scoped solution"],"priority":"high"},{"id":"integrate-proposal","capability":"proposal.integrate","dependsOn":["analyze-legal","design-solution","estimate-delivery"],"inputs":["legal_analysis","solution_design","estimation_package"],"outputs":["proposal_markdown"],"acceptanceCriteria":["Final proposal integrates specialist outputs"],"priority":"critical"}],"qualityGates":["quality.coverage","quality.consistency","quality.evidence","quality.estimation","quality.submission","quality.framework-company","quality.style-usability"],"artifactIntent":["proposal-docx","detailed-wbs-xlsx"],"budgets":{"maxTasks":24,"maxRepairCycles":2,"maxParallelTasks":4}}')
ON CONFLICT (key) DO NOTHING;
