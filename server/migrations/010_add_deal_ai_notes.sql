-- Add deal-specific AI notes that are injected into coordinator and validator prompts.

ALTER TABLE deals ADD COLUMN IF NOT EXISTS ai_notes TEXT;
