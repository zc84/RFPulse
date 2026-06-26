-- Ensure the validator agent and chat-agent have distinct, stable sort orders.
UPDATE agents SET sort_order = 6, updated_at = CURRENT_TIMESTAMP WHERE slug = 'validator';
UPDATE agents SET sort_order = 7, updated_at = CURRENT_TIMESTAMP WHERE slug = 'chat-agent';
