-- Add editable platform configuration options for deal statuses and domains.

ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_status_check;

CREATE TABLE IF NOT EXISTS platform_config_options (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL CHECK (type IN ('status', 'domain')),
  value VARCHAR(100) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (type, value)
);

ALTER TABLE platform_config_options DROP CONSTRAINT IF EXISTS platform_config_options_type_check;
ALTER TABLE platform_config_options
  ADD CONSTRAINT platform_config_options_type_check CHECK (type IN ('status', 'domain'));

DELETE FROM platform_config_options WHERE type NOT IN ('status', 'domain');

INSERT INTO platform_config_options (type, value, sort_order)
SELECT type, value, sort_order
FROM (
  SELECT 'status' AS type, status AS value, 1000 + ROW_NUMBER() OVER (ORDER BY status) * 10 AS sort_order
  FROM (SELECT DISTINCT status FROM deals WHERE status IS NOT NULL AND TRIM(status) <> '') deal_statuses
  UNION ALL
  SELECT 'domain' AS type, domain AS value, 1000 + ROW_NUMBER() OVER (ORDER BY domain) * 10 AS sort_order
  FROM (SELECT DISTINCT domain FROM deals WHERE domain IS NOT NULL AND TRIM(domain) <> '') deal_domains
) existing_values
ON CONFLICT (type, value) DO NOTHING;
