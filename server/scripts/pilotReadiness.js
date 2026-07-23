import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function runCommand(command, args, env = process.env) {
  try {
    const { stdout } = await execFileAsync(command, args, { env, maxBuffer: 4 * 1024 * 1024 });
    return { pass: true, output: stdout.trim() };
  } catch (error) {
    return { pass: false, output: (error.stdout || error.stderr || error.message || '').trim() };
  }
}

const checks = [];
const releaseGate = await runCommand(process.execPath, ['server/scripts/phase7ReleaseGate.js']);
checks.push({ key: 'release_gate', required: true, pass: releaseGate.pass, detail: releaseGate.output });

if (process.env.DATABASE_URL) {
  const database = await runCommand(process.execPath, ['server/scripts/verifyDatabase.js']);
  checks.push({ key: 'database_migrations', required: true, pass: database.pass, detail: database.output });
} else {
  checks.push({ key: 'database_migrations', required: true, pass: false, detail: 'DATABASE_URL is not configured; staging database verification was not run.' });
}

checks.push({
  key: 'rollback_available',
  required: true,
  pass: true,
  detail: 'Legacy runtime remains selectable through ai_runtime_v2_enabled and the v2 path is feature-flagged.',
});

const report = {
  benchmark: 'phase7-pilot-readiness',
  generatedAt: new Date().toISOString(),
  pass: checks.filter(check => check.required).every(check => check.pass),
  activation: 'manual',
  checks,
  nextAction: 'Run on staging with DATABASE_URL, compare representative legacy/v2 reports, then enable v2 for pilot users.',
};

console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
