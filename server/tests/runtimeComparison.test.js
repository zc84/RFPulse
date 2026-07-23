import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRuntimeReports } from '../ai-runtime/evaluation/runtimeComparison.js';

const passingMetrics = {
  criticalRequirementRecall: 0.98,
  mandatoryRequirementResponseMapping: 0.97,
  frameworkRetrievalPrecisionAt5: 0.9,
  factualClaimEvidenceCoverage: 0.99,
  unsupportedHighImpactCommitments: 0,
  validPlannerDagRate: 1,
  resumeSuccessRate: 1,
  artifactCrossConsistencyAfterRepair: 0.98,
  smePreferenceRate: 0.85,
};

test('runtime comparison passes a v2 report that meets release thresholds', () => {
  const result = compareRuntimeReports({ legacy: {}, v2: { metrics: passingMetrics } });
  assert.equal(result.pass, true);
  assert.equal(result.checks.every(check => check.pass), true);
});

test('runtime comparison reports metric deltas against legacy', () => {
  const result = compareRuntimeReports({
    legacy: { metrics: { criticalRequirementRecall: 0.9 } },
    v2: { metrics: { ...passingMetrics, criticalRequirementRecall: 0.98 } },
  });
  assert.equal(result.comparison.criticalRequirementRecall.delta, 0.08);
  assert.equal(result.comparison.criticalRequirementRecall.legacy, 0.9);
});

test('runtime comparison fails on unsupported high-impact commitments', () => {
  const result = compareRuntimeReports({
    legacy: {},
    v2: { metrics: { ...passingMetrics, unsupportedHighImpactCommitments: 1 } },
  });
  assert.equal(result.pass, false);
  assert.equal(result.checks.find(check => check.key === 'unsupportedHighImpactCommitments').pass, false);
});
