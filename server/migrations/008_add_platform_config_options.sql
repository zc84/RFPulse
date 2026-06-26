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
VALUES
  ('status', 'New', 10),
  ('status', 'In Progress', 20),
  ('status', 'Won', 30),
  ('status', 'Lost', 40),
  ('status', 'TBC', 50),
  ('domain', 'Healthcare', 10),
  ('domain', 'Fintech', 20),
  ('domain', 'Retail', 30),
  ('domain', 'Education', 40),
  ('domain', 'Government', 50),
  ('domain', 'Manufacturing', 60),
  ('domain', 'Technology', 70),
  ('domain', 'TBC', 80)
ON CONFLICT (type, value) DO NOTHING;
