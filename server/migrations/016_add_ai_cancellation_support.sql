CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE ai_sessions
  DROP CONSTRAINT IF EXISTS ai_sessions_status_check;

ALTER TABLE ai_sessions
  ADD CONSTRAINT ai_sessions_status_check
  CHECK (status IN ('active', 'running', 'completed', 'failed', 'cancelled'));

ALTER TABLE ai_workflow_steps
  DROP CONSTRAINT IF EXISTS ai_workflow_steps_status_check;

ALTER TABLE ai_workflow_steps
  ADD CONSTRAINT ai_workflow_steps_status_check
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'));

ALTER TABLE ai_run_locks
  DROP CONSTRAINT IF EXISTS ai_run_locks_operation_check;

ALTER TABLE ai_run_locks
  ADD COLUMN IF NOT EXISTS lock_token UUID;

ALTER TABLE ai_run_locks
  ALTER COLUMN lock_token SET DEFAULT gen_random_uuid();

UPDATE ai_run_locks
SET lock_token = gen_random_uuid()
WHERE lock_token IS NULL;

ALTER TABLE ai_run_locks
  ALTER COLUMN lock_token SET NOT NULL;

ALTER TABLE ai_run_locks
  DROP CONSTRAINT IF EXISTS ai_run_locks_lock_token_unique;

ALTER TABLE ai_run_locks
  ADD CONSTRAINT ai_run_locks_lock_token_unique UNIQUE (lock_token);

ALTER TABLE ai_run_locks
  ADD CONSTRAINT ai_run_locks_operation_check
  CHECK (operation IN ('start', 'message', 'validate'));
