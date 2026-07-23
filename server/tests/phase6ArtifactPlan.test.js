import assert from 'node:assert/strict';
import test from 'node:test';

import { buildArtifactPlan, isArtifactSelected, validateArtifactPlan } from '../ai-runtime/artifacts/artifactPlanningService.js';

test('phase6 artifact plan can keep the package proposal-only when explicitly requested', () => {
  const plan = buildArtifactPlan({
    artifactIntent: ['proposal-docx'],
    proposalMarkdown: '## Executive Summary\nShort proposal.',
  });

  assert.deepEqual(plan.selectedArtifactKeys, ['proposal-docx']);
  assert.equal(isArtifactSelected(plan, 'proposal-docx'), true);
  assert.equal(isArtifactSelected(plan, 'architecture-diagram'), false);
  assert.equal(isArtifactSelected(plan, 'timeline-diagram'), false);
  assert.equal(isArtifactSelected(plan, 'detailed-wbs-xlsx'), false);
});

test('phase6 artifact plan infers broader package from technical and estimation content', () => {
  const plan = buildArtifactPlan({
    proposalMarkdown: [
      '## Solution Overview',
      'Architecture, security, deployment, and integration approach.',
      '## Delivery Approach',
      'Timeline includes phases, milestones, and a 12 week schedule.',
    ].join('\n'),
    estimationPackage: 'Detailed WBS, effort estimate, pricing basis, and work breakdown by phase.',
  });

  assert.equal(isArtifactSelected(plan, 'proposal-docx'), true);
  assert.equal(isArtifactSelected(plan, 'architecture-diagram'), true);
  assert.equal(isArtifactSelected(plan, 'timeline-diagram'), true);
  assert.equal(isArtifactSelected(plan, 'detailed-wbs-xlsx'), true);
  assert.equal(plan.summary.selectedArtifactCount, 4);
});

test('phase6 artifact plan has a validated typed specification contract', () => {
  const plan = buildArtifactPlan({ artifactIntent: ['proposal-docx'] });
  assert.equal(validateArtifactPlan(plan).planVersion, 1);
  assert.throws(() => validateArtifactPlan({
    ...plan,
    artifacts: [{ key: 'unknown', type: 'unknown', enabled: true }],
  }));
});

test('phase6 artifact plan does not select physical compliance matrix even for mandatory requirements', () => {
  const plan = buildArtifactPlan({
    proposalMarkdown: '## Compliance\nMandatory submission requirements are addressed.',
    requirementInventory: [{ id: 1, text: 'Provide a signed response', obligation_level: 'mandatory' }],
  });
  assert.equal(isArtifactSelected(plan, 'compliance-matrix-xlsx'), false);
  assert.match(
    String(plan.artifacts.find(item => item.key === 'compliance-matrix-xlsx')?.reason || ''),
    /physical compliance-matrix workbook generation is disabled/i
  );
});

test('phase6 artifact plan always adds a readiness manifest for mandatory tender artifacts', () => {
  const plan = buildArtifactPlan({
    artifactIntent: ['proposal-docx'],
    contextSummary: 'Format 1 requires a signed power of attorney and Format 2 requires a signed quotation.',
    requirementInventory: [
      { id: 1, obligation_level: 'mandatory', response_type: 'form', text: 'Submit signed power of attorney.' },
      { id: 2, obligation_level: 'mandatory', response_type: 'commercial', text: 'Submit quotation in Format 2.' },
    ],
  });

  assert.equal(isArtifactSelected(plan, 'submission-manifest'), true);
  assert.equal(plan.artifacts.find(item => item.key === 'submission-manifest').required, true);
});
