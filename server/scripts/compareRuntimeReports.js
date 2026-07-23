import { readFile } from 'node:fs/promises';
import { compareRuntimeReports } from '../ai-runtime/evaluation/runtimeComparison.js';

const [legacyPath, v2Path] = process.argv.slice(2);
if (!legacyPath || !v2Path) {
  console.error('Usage: node server/scripts/compareRuntimeReports.js <legacy-report.json> <v2-report.json>');
  process.exitCode = 2;
} else {
  const [legacy, v2] = await Promise.all([
    readFile(legacyPath, 'utf8').then(JSON.parse),
    readFile(v2Path, 'utf8').then(JSON.parse),
  ]);
  const report = {
    benchmark: 'legacy-v2-runtime-comparison',
    generatedAt: new Date().toISOString(),
    ...compareRuntimeReports({ legacy, v2 }),
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exitCode = 1;
}
