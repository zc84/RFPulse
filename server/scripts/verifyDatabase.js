import 'dotenv/config';
import { pool, query } from '../db.js';

const requiredTables = [
  'users',
  'deals',
  'documents',
  'ai_sessions',
  'ai_workflow_steps',
  'ai_capabilities',
  'ai_evidence_items',
  'ai_requirements',
  'ai_claims',
  'ai_claim_evidence',
  'ai_findings',
  'knowledge_sections',
];

async function verifyDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to verify the database.');

  const result = await query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])`,
    [requiredTables],
  );
  const found = new Set(result.rows.map(row => row.table_name));
  const missing = requiredTables.filter(table => !found.has(table));
  if (missing.length > 0) throw new Error(`Database verification failed; missing tables: ${missing.join(', ')}`);

  const migrationCheck = await query(
    `SELECT COUNT(*)::int AS count
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ai_sessions'
        AND column_name IN ('workflow_plan', 'artifact_plan', 'estimation_policy_snapshot')`,
  );
  if (migrationCheck.rows[0].count !== 3) throw new Error('Database verification failed; ai_sessions migrations are incomplete.');

  console.log(`Database verification passed (${requiredTables.length} required tables and migrated session columns).`);
}

verifyDatabase()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
