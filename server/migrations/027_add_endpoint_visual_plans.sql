CREATE TABLE IF NOT EXISTS endpoint_visual_plans (
  token_hash CHAR(64) PRIMARY KEY,
  plan JSONB NOT NULL,
  source_digest CHAR(64) NOT NULL,
  versions JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  render_count INTEGER NOT NULL DEFAULT 0 CHECK (render_count >= 0),
  max_renders INTEGER NOT NULL DEFAULT 3 CHECK (max_renders > 0),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS endpoint_visual_plans_expiry_idx
  ON endpoint_visual_plans (expires_at);

CREATE TABLE IF NOT EXISTS endpoint_visual_idempotency (
  route TEXT NOT NULL,
  key_hash CHAR(64) NOT NULL,
  request_digest CHAR(64) NOT NULL,
  claim_token UUID,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'complete', 'failed')),
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (route, key_hash)
);

CREATE INDEX IF NOT EXISTS endpoint_visual_idempotency_expiry_idx
  ON endpoint_visual_idempotency (expires_at);

ALTER TABLE endpoint_visual_idempotency
  ADD COLUMN IF NOT EXISTS claim_token UUID;

CREATE TABLE IF NOT EXISTS endpoint_visual_daily_budget (
  usage_date DATE PRIMARY KEY,
  planner_calls INTEGER NOT NULL DEFAULT 0 CHECK (planner_calls >= 0),
  image_calls INTEGER NOT NULL DEFAULT 0 CHECK (image_calls >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
