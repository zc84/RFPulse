CREATE TABLE IF NOT EXISTS ai_evidence_items (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  source_document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  source_type VARCHAR(40) NOT NULL DEFAULT 'client_document',
  locator TEXT,
  content TEXT NOT NULL,
  language VARCHAR(16),
  confidence NUMERIC(5,4),
  content_hash VARCHAR(64) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (session_id, source_document_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_ai_evidence_items_session_id ON ai_evidence_items(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_evidence_items_deal_id ON ai_evidence_items(deal_id);
CREATE INDEX IF NOT EXISTS idx_ai_evidence_items_source_document_id ON ai_evidence_items(source_document_id);

CREATE TABLE IF NOT EXISTS ai_requirements (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  source_document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  source_locator TEXT,
  text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  category VARCHAR(80),
  obligation_level VARCHAR(20) NOT NULL DEFAULT 'informational'
    CHECK (obligation_level IN ('mandatory', 'should', 'optional', 'informational')),
  response_type VARCHAR(40) NOT NULL DEFAULT 'narrative'
    CHECK (response_type IN ('narrative', 'form', 'attachment', 'commercial', 'evidence')),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  conflict_group VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_requirements_session_id ON ai_requirements(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_requirements_deal_id ON ai_requirements(deal_id);
CREATE INDEX IF NOT EXISTS idx_ai_requirements_source_document_id ON ai_requirements(source_document_id);