-- Remove legacy default CMS options that were previously seeded.
-- Values currently used by deals are kept because they are existing deal data.

DELETE FROM platform_config_options p
WHERE p.type = 'status'
  AND p.value IN ('New', 'In Progress', 'Won', 'Lost', 'TBC')
  AND NOT EXISTS (
    SELECT 1 FROM deals d WHERE d.status = p.value
  );

DELETE FROM platform_config_options p
WHERE p.type = 'domain'
  AND p.value IN ('Healthcare', 'Fintech', 'Retail', 'Education', 'Government', 'Manufacturing', 'Technology', 'TBC')
  AND NOT EXISTS (
    SELECT 1 FROM deals d WHERE d.domain = p.value
  );
