CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_workflow_steps_session_step_key
  ON ai_workflow_steps(session_id, step_key);
