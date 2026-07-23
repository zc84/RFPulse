import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const benchmarks = [
  { name: 'phase1-requirements', script: 'server/scripts/phase1RequirementsBenchmark.js', read: report => report.recall >= 0.95 },
  { name: 'phase2-planner', script: 'server/scripts/phase2PlannerBenchmark.js', read: report => report.summary?.executableRate >= 0.99 && report.summary?.appropriateRate >= 0.9 },
  { name: 'phase4-knowledge', script: 'server/scripts/phase4KnowledgeRetrievalBenchmark.js', read: report => report.summary?.averageRecallAt5 >= 0.85 },
];

function parseReport(stdout) {
  const value = String(stdout || '').trim();
  const starts = [];
  for (let index = value.indexOf('{'); index >= 0; index = value.indexOf('{', index + 1)) {
    starts.push(index);
  }
  for (let index = starts.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(value.slice(starts[index]));
    } catch {
      // Database/debug logs may contain object-like braces before the final report.
    }
  }
  throw new Error('Benchmark did not emit a parseable JSON report.');
}

const results = [];
for (const benchmark of benchmarks) {
  try {
    const { stdout } = await execFileAsync(process.execPath, [benchmark.script], { cwd: process.cwd(), maxBuffer: 4 * 1024 * 1024 });
    const report = parseReport(stdout);
    results.push({ name: benchmark.name, pass: benchmark.read(report), report });
  } catch (error) {
    let report = null;
    try { report = parseReport(error.stdout || ''); } catch { /* retain execution failure */ }
    results.push({ name: benchmark.name, pass: false, error: error.message, report });
  }
}

const report = {
  benchmark: 'phase7-release-gate',
  generatedAt: new Date().toISOString(),
  pass: results.every(result => result.pass),
  results: results.map(result => ({ name: result.name, pass: result.pass, error: result.error || null, summary: result.report?.summary || result.report || null })),
};

console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
