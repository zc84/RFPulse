INSERT INTO global_settings (key, value)
VALUES (
  'ai_estimation_policy',
  '{"version":1,"currency":"USD","defaultRoleRate":50,"qaOverheadPercent":30,"pmOverheadPercent":15,"taskSizing":{"minHours":8,"maxHours":40,"incrementHours":0.25},"contingency":{"highRiskMinimumPercent":12},"plausibility":{"maxCapacityMultiplier":1.2,"minCapacityMultiplier":0.12,"effortDriftTolerancePercent":10,"minimumDriftHours":8}}'
)
ON CONFLICT (key) DO NOTHING;
