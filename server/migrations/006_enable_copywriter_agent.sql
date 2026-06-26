-- Enable the Copywriter agent for the assessment workflow.

UPDATE agents
SET is_enabled = TRUE,
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'copywriter';
