-- Persist per-deal AI workflow progress and artifacts for resumable runs.

CREATE TABLE IF NOT EXISTS ai_workflow_steps (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  step_key VARCHAR(80) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  artifact TEXT,
  error TEXT,
  metadata JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (session_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_workflow_steps_session_id ON ai_workflow_steps(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_workflow_steps_deal_id ON ai_workflow_steps(deal_id);
