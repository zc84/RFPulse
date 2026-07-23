import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGoldenBenchmarkManifest } from '../ai-runtime/evaluation/goldenBenchmark.js';

function pack(id) {
  return {
    id,
    category: 'technical implementation RFP',
    sourcePack: `fixtures/${id}.zip`,
    criticalRequirements: ['security'],
    expectedCapabilities: ['analysis.solution'],
    requiredArtifacts: ['proposal-docx'],
    prohibitedUnsupportedClaims: ['unverified certification'],
    expectedFileStructure: ['proposal.docx'],
    smePreference: 'unrated',
  };
}

test('golden benchmark validator accepts a complete 12-pack manifest', () => {
  const result = validateGoldenBenchmarkManifest({ packs: Array.from({ length: 12 }, (_, index) => pack(`pack-${index + 1}`)) });
  assert.equal(result.valid, true);
});

test('golden benchmark validator rejects incomplete or under-labeled manifests', () => {
  const result = validateGoldenBenchmarkManifest({ packs: [pack('one'), { id: 'one' }] });
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /12–20 packs/);
  assert.match(result.errors.join('\n'), /Duplicate pack id/);
  assert.match(result.errors.join('\n'), /criticalRequirements is required/);
});
