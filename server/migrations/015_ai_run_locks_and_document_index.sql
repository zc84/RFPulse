-- Prevent overlapping AI workflow executions and speed up per-deal document lookups.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE ai_sessions
  DROP CONSTRAINT IF EXISTS ai_sessions_status_check;

ALTER TABLE ai_sessions
  ADD CONSTRAINT ai_sessions_status_check
  CHECK (status IN ('active', 'running', 'completed', 'failed', 'cancelled'));

CREATE TABLE IF NOT EXISTS ai_run_locks (
  deal_id INTEGER PRIMARY KEY REFERENCES deals(id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES ai_sessions(id) ON DELETE SET NULL,
  operation VARCHAR(20) NOT NULL CHECK (operation IN ('start', 'message', 'validate')),
  lock_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_deal_id ON documents(deal_id);
