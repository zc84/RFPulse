ALTER TABLE ai_workflow_steps
  ADD COLUMN IF NOT EXISTS task_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS capability_key VARCHAR(120),
  ADD COLUMN IF NOT EXISTS capability_version INTEGER,
  ADD COLUMN IF NOT EXISTS depends_on JSONB,
  ADD COLUMN IF NOT EXISTS input_refs JSONB,
  ADD COLUMN IF NOT EXISTS output_refs JSONB,
  ADD COLUMN IF NOT EXISTS acceptance_criteria JSONB,
  ADD COLUMN IF NOT EXISTS attempt INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS model_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS prompt_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS metrics JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_workflow_steps_session_task_id
  ON ai_workflow_steps(session_id, task_id)
  WHERE task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_workflow_steps_task_id
  ON ai_workflow_steps(task_id);
