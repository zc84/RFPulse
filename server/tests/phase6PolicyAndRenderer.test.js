import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEstimationPolicy } from '../ai-runtime/policies/estimationPolicy.js';
import { getArtifactRenderer, validateArtifactRendererSelection } from '../ai-runtime/artifacts/artifactRendererRegistry.js';
import { validateEstimatorResult } from '../services/aiSchemas.js';

function estimate() {
  return {
    implementationTeam: ['Backend'],
    workBreakdown: [{ phase: 'Build', workstream: 'API', title: 'Implement API', efforts: 8, assigned: 'Backend', notes: '' }],
    contingencyPercent: 0,
    estimatedDuration: '1 week',
    basisOfEstimate: ['Initial scope'],
    commercialProposal: 'TBC',
    estimateConfidence: 'medium',
    confidenceRationale: 'Initial estimate',
    topUncertaintyDrivers: ['Scope'],
    phasePricing: [{ phase: 'Build', scopeSummary: 'API', effortHours: 8, amount: 800, pricingBasis: 'Rate card' }],
    softwareLicenses: [],
    hardware: [],
    assumptions: [],
    exclusions: [],
    risks: [],
  };
}

test('phase6 estimation policy overrides default overhead and rate values', () => {
  const policy = normalizeEstimationPolicy({ defaultRoleRate: 100, qaOverheadPercent: 25, pmOverheadPercent: 10 });
  const result = validateEstimatorResult(estimate(), { estimationPolicy: policy });
  assert.equal(result.teamComposition.find(item => item.team === 'Backend').rate, 100);
  assert.equal(result.qaEffort, 2);
  assert.equal(result.pmEffort, 1);
  assert.equal(result.totalCost, 1100);
  assert.deepEqual(result.estimationPolicy, policy);
});

test('phase6 artifact renderer registry validates selected outputs', () => {
  assert.equal(getArtifactRenderer('proposal-docx').tool, 'artifact.render.docx');
  assert.equal(validateArtifactRendererSelection({ selectedArtifactKeys: ['proposal-docx', 'detailed-wbs-xlsx'] }).length, 2);
  assert.throws(() => validateArtifactRendererSelection({ selectedArtifactKeys: ['missing-artifact'] }), /No renderer registered/);
});
