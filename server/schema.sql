DROP TABLE IF EXISTS ai_agent_outputs CASCADE;
DROP TABLE IF EXISTS ai_messages CASCADE;
DROP TABLE IF EXISTS ai_sessions CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS global_settings CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS deals CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('Superadmin', 'Editor', 'Viewer')),
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE deals (
  id SERIAL PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('New', 'In Progress', 'Won', 'Lost', 'TBC')),
  due_date DATE NOT NULL,
  budget NUMERIC(15, 2) NOT NULL,
  domain VARCHAR(100) NOT NULL,
  client_name VARCHAR(255),
  classification VARCHAR(1) CHECK (classification IN ('A', 'B', 'C')),
  description TEXT,
  assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  size VARCHAR(50) NOT NULL,
  filename VARCHAR(255),
  source VARCHAR(20) CHECK (source IN ('user', 'ai')),
  uploaded_at DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_due_date ON deals(due_date);
CREATE INDEX idx_deals_assignee_id ON deals(assignee_id);

CREATE TABLE deal_locks (
  id SERIAL PRIMARY KEY,
  deal_id INTEGER NOT NULL UNIQUE REFERENCES deals(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_heartbeat_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deal_locks_deal_id ON deal_locks(deal_id);
CREATE INDEX idx_deal_locks_user_id ON deal_locks(user_id);

CREATE TABLE global_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE agents (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  model VARCHAR(100) NOT NULL,
  system_prompt TEXT NOT NULL,
  temperature NUMERIC(3, 2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 4096,
  top_p NUMERIC(3, 2) DEFAULT 1.0,
  presence_penalty NUMERIC(4, 2) DEFAULT 0.0,
  frequency_penalty NUMERIC(4, 2) DEFAULT 0.0,
  is_enabled BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_sessions (
  id SERIAL PRIMARY KEY,
  deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  current_agent_plan JSONB,
  extracted_context TEXT,
  coordinator_context TEXT,
  final_report_document_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('coordinator', 'user', 'agent')),
  agent_slug VARCHAR(50),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_agent_outputs (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  agent_slug VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (session_id, agent_slug)
);

CREATE TABLE ai_chat_messages (
  id SERIAL PRIMARY KEY,
  deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'agent')),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_sessions_deal_id ON ai_sessions(deal_id);
CREATE INDEX idx_ai_messages_session_id ON ai_messages(session_id);
CREATE INDEX idx_ai_agent_outputs_session_id ON ai_agent_outputs(session_id);
CREATE INDEX idx_ai_chat_messages_deal_id ON ai_chat_messages(deal_id);
