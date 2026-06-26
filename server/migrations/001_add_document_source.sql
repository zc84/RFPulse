-- Migration: add source flag to documents and create chat history table
-- Run this against an existing database to apply schema changes without data loss.

-- 1. Add source flag to documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) CHECK (source IN ('user', 'ai'));

-- 2. Backfill existing documents as user-uploaded
UPDATE documents
  SET source = 'user'
  WHERE source IS NULL;

-- 3. Create chat history table for the new AI Chat agent
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id SERIAL PRIMARY KEY,
  deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'agent')),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_deal_id ON ai_chat_messages(deal_id);
