DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS deals CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
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
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  size VARCHAR(50) NOT NULL,
  uploaded_at DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_due_date ON deals(due_date);
