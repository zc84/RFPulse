import { query } from '../../db.js';

export const DEFAULT_ESTIMATION_POLICY = Object.freeze({
  version: 1,
  currency: 'USD',
  defaultRoleRate: 50,
  qaOverheadPercent: 30,
  pmOverheadPercent: 15,
  taskSizing: { minHours: 8, maxHours: 40, incrementHours: 0.25 },
  contingency: { highRiskMinimumPercent: 12 },
  plausibility: { maxCapacityMultiplier: 1.2, minCapacityMultiplier: 0.12, effortDriftTolerancePercent: 10, minimumDriftHours: 8 },
});

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeEstimationPolicy(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    ...DEFAULT_ESTIMATION_POLICY,
    ...source,
    version: numberOr(source.version, DEFAULT_ESTIMATION_POLICY.version),
    defaultRoleRate: numberOr(source.defaultRoleRate, DEFAULT_ESTIMATION_POLICY.defaultRoleRate),
    qaOverheadPercent: numberOr(source.qaOverheadPercent, DEFAULT_ESTIMATION_POLICY.qaOverheadPercent),
    pmOverheadPercent: numberOr(source.pmOverheadPercent, DEFAULT_ESTIMATION_POLICY.pmOverheadPercent),
    taskSizing: { ...DEFAULT_ESTIMATION_POLICY.taskSizing, ...(source.taskSizing || {}) },
    contingency: { ...DEFAULT_ESTIMATION_POLICY.contingency, ...(source.contingency || {}) },
    plausibility: { ...DEFAULT_ESTIMATION_POLICY.plausibility, ...(source.plausibility || {}) },
  };
}

export async function loadEstimationPolicy(queryFn = query) {
  try {
    const result = await queryFn(
      `SELECT value FROM global_settings WHERE key = 'ai_estimation_policy' LIMIT 1`
    );
    const raw = result.rows?.[0]?.value;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return normalizeEstimationPolicy(parsed);
  } catch (error) {
    if (error?.code === '42P01' || error instanceof SyntaxError) return normalizeEstimationPolicy();
    throw error;
  }
}
