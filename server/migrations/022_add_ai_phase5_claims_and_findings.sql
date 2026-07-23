CREATE TABLE IF NOT EXISTS ai_claims (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  artifact_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  section_key VARCHAR(160),
  claim_text TEXT NOT NULL,
  classification VARCHAR(40) NOT NULL DEFAULT 'source_fact',
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_claims_session_id ON ai_claims(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_claims_deal_id ON ai_claims(deal_id);

CREATE TABLE IF NOT EXISTS ai_claim_evidence (
  claim_id INTEGER NOT NULL REFERENCES ai_claims(id) ON DELETE CASCADE,
  evidence_item_id INTEGER NOT NULL REFERENCES ai_evidence_items(id) ON DELETE CASCADE,
  relationship VARCHAR(30) NOT NULL DEFAULT 'supports',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (claim_id, evidence_item_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_claim_evidence_claim_id ON ai_claim_evidence(claim_id);

CREATE TABLE IF NOT EXISTS ai_findings (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  gate_key VARCHAR(120) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  requirement_id INTEGER REFERENCES ai_requirements(id) ON DELETE SET NULL,
  artifact_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  issue TEXT NOT NULL,
  required_fix TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  repair_task_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_findings_session_id ON ai_findings(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_findings_deal_id ON ai_findings(deal_id);
CREATE INDEX IF NOT EXISTS idx_ai_findings_gate_key ON ai_findings(gate_key);

ALTER TABLE ai_sessions
  ADD COLUMN IF NOT EXISTS quality_status VARCHAR(30),
  ADD COLUMN IF NOT EXISTS repair_cycle INTEGER NOT NULL DEFAULT 0;
