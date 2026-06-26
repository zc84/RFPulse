ALTER TABLE deals ADD COLUMN IF NOT EXISTS assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deals_assignee_id ON deals(assignee_id);
