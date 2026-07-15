CREATE TABLE IF NOT EXISTS knowledge_sections (
  id SERIAL PRIMARY KEY,
  source_type VARCHAR(40) NOT NULL,
  section_id VARCHAR(160) NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  rfp_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  engagement_models JSONB NOT NULL DEFAULT '[]'::jsonb,
  content TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  source_version VARCHAR(80),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_type, section_id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_sections_source_type
  ON knowledge_sections(source_type);

CREATE INDEX IF NOT EXISTS idx_knowledge_sections_source_version
  ON knowledge_sections(source_type, source_version);
