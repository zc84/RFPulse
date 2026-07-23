import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { extractRequirementsFromEvidence } from '../services/evidenceInventory.js';

const benchmarkPath = path.resolve('server/tests/fixtures/phase1RequirementsBenchmark.json');
const cases = JSON.parse(await readFile(benchmarkPath, 'utf8'));
const results = cases.map(item => {
  const requirements = extractRequirementsFromEvidence([{
    sourceDocumentId: item.id,
    locator: 'benchmark',
    contentHash: item.id,
    content: item.evidence,
  }]);
  const normalized = requirements.map(requirement => requirement.text.toLowerCase());
  const matched = item.critical.filter(marker => normalized.some(text => text.includes(marker.toLowerCase())));
  return {
    id: item.id,
    expected: item.critical.length,
    matched: matched.length,
    recall: item.critical.length ? matched.length / item.critical.length : 1,
    missing: item.critical.filter(marker => !matched.includes(marker)),
  };
});
const expected = results.reduce((sum, item) => sum + item.expected, 0);
const matched = results.reduce((sum, item) => sum + item.matched, 0);
const recall = expected ? matched / expected : 1;
const report = { benchmark: 'phase1-critical-requirement-recall', target: 0.9, recall, cases: results };
console.log(JSON.stringify(report, null, 2));
if (recall < report.target) process.exitCode = 1;
