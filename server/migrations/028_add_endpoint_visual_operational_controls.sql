CREATE TABLE IF NOT EXISTS endpoint_visual_usage_budget (
  window_type TEXT NOT NULL CHECK (window_type IN ('hour', 'day')),
  window_start TIMESTAMPTZ NOT NULL,
  planner_calls INTEGER NOT NULL DEFAULT 0 CHECK (planner_calls >= 0),
  image_calls INTEGER NOT NULL DEFAULT 0 CHECK (image_calls >= 0),
  qa_calls INTEGER NOT NULL DEFAULT 0 CHECK (qa_calls >= 0),
  regeneration_calls INTEGER NOT NULL DEFAULT 0 CHECK (regeneration_calls >= 0),
  cost_units INTEGER NOT NULL DEFAULT 0 CHECK (cost_units >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (window_type, window_start)
);

CREATE INDEX IF NOT EXISTS endpoint_visual_usage_budget_updated_idx
  ON endpoint_visual_usage_budget (updated_at);

CREATE OR REPLACE FUNCTION reserve_endpoint_visual_budget(
  p_planner_calls INTEGER,
  p_image_calls INTEGER,
  p_qa_calls INTEGER,
  p_regeneration_calls INTEGER,
  p_cost_units INTEGER,
  p_hourly_planner_limit INTEGER,
  p_hourly_image_limit INTEGER,
  p_hourly_qa_limit INTEGER,
  p_hourly_regeneration_limit INTEGER,
  p_hourly_cost_limit INTEGER,
  p_daily_planner_limit INTEGER,
  p_daily_image_limit INTEGER,
  p_daily_qa_limit INTEGER,
  p_daily_regeneration_limit INTEGER,
  p_daily_cost_limit INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_hour_start TIMESTAMPTZ := date_trunc('hour', NOW());
  v_day_start TIMESTAMPTZ := date_trunc('day', NOW());
  v_hour endpoint_visual_usage_budget%ROWTYPE;
  v_day endpoint_visual_usage_budget%ROWTYPE;
BEGIN
  IF p_planner_calls < 0
     OR p_image_calls < 0
     OR p_qa_calls < 0
     OR p_regeneration_calls < 0
     OR p_cost_units < 0 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO endpoint_visual_usage_budget (window_type, window_start)
  VALUES ('hour', v_hour_start), ('day', v_day_start)
  ON CONFLICT (window_type, window_start) DO NOTHING;

  SELECT * INTO v_hour
  FROM endpoint_visual_usage_budget
  WHERE window_type = 'hour' AND window_start = v_hour_start
  FOR UPDATE;

  SELECT * INTO v_day
  FROM endpoint_visual_usage_budget
  WHERE window_type = 'day' AND window_start = v_day_start
  FOR UPDATE;

  IF v_hour.planner_calls + p_planner_calls > p_hourly_planner_limit
     OR v_hour.image_calls + p_image_calls > p_hourly_image_limit
     OR v_hour.qa_calls + p_qa_calls > p_hourly_qa_limit
     OR v_hour.regeneration_calls + p_regeneration_calls > p_hourly_regeneration_limit
     OR v_hour.cost_units + p_cost_units > p_hourly_cost_limit
     OR v_day.planner_calls + p_planner_calls > p_daily_planner_limit
     OR v_day.image_calls + p_image_calls > p_daily_image_limit
     OR v_day.qa_calls + p_qa_calls > p_daily_qa_limit
     OR v_day.regeneration_calls + p_regeneration_calls > p_daily_regeneration_limit
     OR v_day.cost_units + p_cost_units > p_daily_cost_limit THEN
    RETURN FALSE;
  END IF;

  UPDATE endpoint_visual_usage_budget
  SET planner_calls = planner_calls + p_planner_calls,
      image_calls = image_calls + p_image_calls,
      qa_calls = qa_calls + p_qa_calls,
      regeneration_calls = regeneration_calls + p_regeneration_calls,
      cost_units = cost_units + p_cost_units,
      updated_at = NOW()
  WHERE (window_type = 'hour' AND window_start = v_hour_start)
     OR (window_type = 'day' AND window_start = v_day_start);

  DELETE FROM endpoint_visual_usage_budget
  WHERE window_start < date_trunc('day', NOW()) - INTERVAL '14 days';

  RETURN TRUE;
END;
$$;

CREATE TABLE IF NOT EXISTS endpoint_visual_provider_leases (
  lease_id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS endpoint_visual_provider_leases_expiry_idx
  ON endpoint_visual_provider_leases (expires_at);

CREATE OR REPLACE FUNCTION claim_endpoint_visual_provider_lease(
  p_lease_id UUID,
  p_max_concurrent INTEGER,
  p_ttl_seconds INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_active INTEGER;
BEGIN
  IF p_max_concurrent < 1 OR p_ttl_seconds < 1 THEN
    RETURN FALSE;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('endpoint_visual_provider_leases'));

  DELETE FROM endpoint_visual_provider_leases WHERE expires_at <= NOW();
  SELECT COUNT(*) INTO v_active FROM endpoint_visual_provider_leases;
  IF v_active >= p_max_concurrent THEN
    RETURN FALSE;
  END IF;

  INSERT INTO endpoint_visual_provider_leases (lease_id, expires_at)
  VALUES (p_lease_id, NOW() + make_interval(secs => p_ttl_seconds));
  RETURN TRUE;
END;
$$;
