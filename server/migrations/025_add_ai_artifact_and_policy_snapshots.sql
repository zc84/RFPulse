ALTER TABLE ai_sessions
  ADD COLUMN IF NOT EXISTS artifact_plan JSONB,
  ADD COLUMN IF NOT EXISTS estimation_policy_snapshot JSONB;
