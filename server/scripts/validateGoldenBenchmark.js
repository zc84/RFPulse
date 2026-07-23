import { readFile } from 'node:fs/promises';
import { validateGoldenBenchmarkManifest } from '../ai-runtime/evaluation/goldenBenchmark.js';

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error('Usage: node server/scripts/validateGoldenBenchmark.js <manifest.json>');
  process.exitCode = 2;
} else {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const result = { benchmark: 'golden-benchmark-manifest', manifestPath, ...validateGoldenBenchmarkManifest(manifest) };
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
}
