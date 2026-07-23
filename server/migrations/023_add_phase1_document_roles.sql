ALTER TABLE ai_evidence_items
  ADD COLUMN IF NOT EXISTS document_role VARCHAR(60) NOT NULL DEFAULT 'unknown';

CREATE INDEX IF NOT EXISTS idx_ai_evidence_items_document_role
  ON ai_evidence_items(document_role);
