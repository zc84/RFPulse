-- Ensure CMS status/domain options include values already present on deals.

INSERT INTO platform_config_options (type, value, sort_order)
SELECT type, value, sort_order
FROM (
  SELECT 'status' AS type, status AS value, 1000 + ROW_NUMBER() OVER (ORDER BY status) * 10 AS sort_order
  FROM (SELECT DISTINCT status FROM deals WHERE status IS NOT NULL AND TRIM(status) <> '') deal_statuses
  UNION ALL
  SELECT 'domain' AS type, domain AS value, 1000 + ROW_NUMBER() OVER (ORDER BY domain) * 10 AS sort_order
  FROM (SELECT DISTINCT domain FROM deals WHERE domain IS NOT NULL AND TRIM(domain) <> '') deal_domains
) existing_values
ON CONFLICT (type, value) DO NOTHING;
