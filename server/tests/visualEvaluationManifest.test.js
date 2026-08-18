import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { VISUAL_TYPES } from '../visuals/domain/catalog.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(directory, 'fixtures', 'visualEvaluationManifest.json');
const rubricPath = path.join(directory, 'fixtures', 'visualQualityRubric.json');

test('visual evaluation manifest is synthetic and covers every public type', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.confidentiality, 'synthetic');
  const coveredTypes = new Set(manifest.cases.map(entry => entry.type));
  for (const type of VISUAL_TYPES) {
    assert.ok(coveredTypes.has(type), `Missing evaluation case for ${type}`);
  }
});

test('manual reference image metadata records provenance without embedding customer files', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.referenceImages.length, 2);
  for (const reference of manifest.referenceImages) {
    assert.equal(reference.availability, 'local-manual-only');
    assert.match(reference.sha256, /^[a-f0-9]{64}$/);
    assert.equal(reference.width, 1536);
    assert.equal(reference.height, 1024);
    assert.equal(reference.bestKnownCommit, '2365aa2');
  }
});

test('visual quality rubric has a complete weighted threshold and repeat policy', () => {
  const rubric = JSON.parse(fs.readFileSync(rubricPath, 'utf8'));
  assert.equal(rubric.minimumRunsPerAiFixture, 3);
  assert.equal(rubric.minimumWeightedScore, 85);
  assert.equal(
    rubric.criteria.reduce((sum, criterion) => sum + criterion.weight, 0),
    100
  );
  assert.ok(rubric.hardFailures.includes('reversed-mandatory-relationship'));
});
