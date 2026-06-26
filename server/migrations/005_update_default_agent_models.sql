-- Update default agent model assignments to the balanced GPT-5.x configuration.

UPDATE agents
SET model = CASE slug
  WHEN 'coordinator' THEN 'gpt-5.5'
  WHEN 'legal' THEN 'gpt-5.5'
  WHEN 'architect' THEN 'gpt-5.5'
  WHEN 'estimator' THEN 'gpt-5.5'
  WHEN 'copywriter' THEN 'gpt-5.5'
  WHEN 'frontend-dev' THEN 'gpt-5.5-codex'
  WHEN 'validator' THEN 'gpt-5.5'
  WHEN 'chat-agent' THEN 'gpt-5.4-mini'
  ELSE model
END,
updated_at = CURRENT_TIMESTAMP
WHERE slug IN (
  'coordinator',
  'legal',
  'architect',
  'estimator',
  'copywriter',
  'frontend-dev',
  'validator',
  'chat-agent'
);
