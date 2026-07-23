const DEFAULT_THRESHOLDS = {
  criticalRequirementRecall: 0.95,
  mandatoryRequirementResponseMapping: 0.95,
  frameworkRetrievalPrecisionAt5: 0.85,
  factualClaimEvidenceCoverage: 0.95,
  unsupportedHighImpactCommitments: 0,
  validPlannerDagRate: 0.99,
  resumeSuccessRate: 1,
  artifactCrossConsistencyAfterRepair: 0.97,
  smePreferenceRate: 0.8,
};

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function metric(report, key) {
  return number(report?.metrics?.[key] ?? report?.summary?.[key] ?? report?.[key]);
}

export function compareRuntimeReports({ legacy, v2, thresholds = {} } = {}) {
  const limits = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const v2Metrics = Object.fromEntries(Object.keys(limits).map(key => [key, metric(v2, key)]));
  const legacyMetrics = Object.fromEntries(Object.keys(limits).map(key => [key, metric(legacy, key)]));
  const checks = [
    ['criticalRequirementRecall', v2Metrics.criticalRequirementRecall >= limits.criticalRequirementRecall],
    ['mandatoryRequirementResponseMapping', v2Metrics.mandatoryRequirementResponseMapping >= limits.mandatoryRequirementResponseMapping],
    ['frameworkRetrievalPrecisionAt5', v2Metrics.frameworkRetrievalPrecisionAt5 >= limits.frameworkRetrievalPrecisionAt5],
    ['factualClaimEvidenceCoverage', v2Metrics.factualClaimEvidenceCoverage >= limits.factualClaimEvidenceCoverage],
    ['unsupportedHighImpactCommitments', v2Metrics.unsupportedHighImpactCommitments <= limits.unsupportedHighImpactCommitments],
    ['validPlannerDagRate', v2Metrics.validPlannerDagRate >= limits.validPlannerDagRate],
    ['resumeSuccessRate', v2Metrics.resumeSuccessRate >= limits.resumeSuccessRate],
    ['artifactCrossConsistencyAfterRepair', v2Metrics.artifactCrossConsistencyAfterRepair >= limits.artifactCrossConsistencyAfterRepair],
    ['smePreferenceRate', v2Metrics.smePreferenceRate >= limits.smePreferenceRate],
  ].map(([key, pass]) => ({ key, pass, value: v2Metrics[key], threshold: limits[key] }));

  const comparison = Object.fromEntries(Object.keys(limits).map(key => [
    key,
    { legacy: legacyMetrics[key], v2: v2Metrics[key], delta: Number((v2Metrics[key] - legacyMetrics[key]).toFixed(4)) },
  ]));

  return {
    pass: checks.every(check => check.pass),
    thresholds: limits,
    checks,
    comparison,
  };
}

export { DEFAULT_THRESHOLDS };
