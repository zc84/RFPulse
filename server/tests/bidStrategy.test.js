import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBidQualificationSnapshot,
  classifyResponseProfile,
  evaluateCompetitivenessReadiness,
} from '../ai-runtime/strategy/bidStrategyService.js';
import { buildProposalStructure } from '../ai-runtime/quality/phase5QualityService.js';
import { buildArtifactPlan, isArtifactSelected } from '../ai-runtime/artifacts/artifactPlanningService.js';

test('classifies solution-build, service-team, and RFI response profiles', () => {
  assert.equal(classifyResponseProfile({ contextSummary: 'Design and build a platform with API integration and deployment architecture.' }).profile, 'solution-build');
  assert.equal(classifyResponseProfile({ contextSummary: 'Dedicated team staff augmentation with CVs, seniority and a T&M rate card.' }).profile, 'service-team');
  assert.equal(classifyResponseProfile({ contextSummary: 'Request for information and supplier capability questionnaire.' }).profile, 'rfi');
});

test('service-team structure does not invent target-system architecture', () => {
  const structure = buildProposalStructure({
    contextSummary: 'Dedicated team and staff augmentation response requiring CVs and a rate card.',
  });
  assert.equal(structure.summary.responseProfile, 'service-team');
  assert.ok(structure.sections.some(section => section.key === 'team-composition'));
  assert.ok(!structure.sections.some(section => section.key === 'solution-overview'));

  const artifacts = buildArtifactPlan({
    proposalStructure: structure,
    proposalMarkdown: 'Our solution delivery team provides technical expertise and security engineering.',
  });
  assert.equal(isArtifactSelected(artifacts, 'architecture-diagram'), false);
});

test('mandatory RFP requirements override the response profile artifact defaults', () => {
  const requirements = [
    { obligation_level: 'mandatory', response_type: 'commercial', text: 'Submit a detailed rate card and pricing workbook.' },
    { obligation_level: 'mandatory', text: 'Provide a solution architecture diagram.' },
  ];
  const structure = buildProposalStructure({
    requirementInventory: requirements,
    contextSummary: 'Dedicated team staff augmentation with named CVs.',
  });
  const artifacts = buildArtifactPlan({ artifactIntent: ['proposal-docx'], proposalStructure: structure, requirementInventory: requirements });
  assert.equal(structure.summary.responseProfile, 'service-team');
  assert.equal(isArtifactSelected(artifacts, 'architecture-diagram'), true);
  assert.equal(isArtifactSelected(artifacts, 'detailed-wbs-xlsx'), true);
  assert.equal(artifacts.artifacts.find(item => item.key === 'architecture-diagram').required, true);
  assert.ok(structure.sections.some(section => section.key === 'solution-overview'));
});

test('qualification snapshot exposes blockers and never hides verification work', () => {
  const result = buildBidQualificationSnapshot({
    requirementInventory: [
      { obligation_level: 'mandatory', priority: 'critical', status: 'gap', text: 'A signed bid bond is required.' },
      { obligation_level: 'mandatory', status: 'open', text: 'Provide ISO certificate and insurance evidence.' },
    ],
  });
  assert.equal(result.recommendation, 'no-go');
  assert.equal(result.counts.criticalGaps, 1);
  assert.ok(result.conditions.some(condition => /verify internally/i.test(condition)));
});

test('an open critical requirement is work to complete, not an automatic no-go', () => {
  const result = buildBidQualificationSnapshot({
    requirementInventory: [
      { obligation_level: 'mandatory', priority: 'critical', status: 'open', text: 'Submit before the stated deadline.' },
    ],
  });
  assert.notEqual(result.recommendation, 'no-go');
  assert.equal(result.counts.criticalGaps, 0);
});

test('competitiveness remains separate and not assessable without real benchmarks', () => {
  const result = evaluateCompetitivenessReadiness({
    requirementInventory: [{ response_type: 'commercial', text: 'Provide pricing.' }],
    estimate: { totalHours: 1200 },
  });
  assert.equal(result.applicable, true);
  assert.equal(result.separateFromCompliance, true);
  assert.equal(result.verdict, 'not-assessable');
  assert.ok(result.missingInputs.some(item => /benchmark/i.test(item)));
});
