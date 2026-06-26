import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, query } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..', '..');
const schemaPath = path.join(rootDir, 'server', 'schema.sql');
const migrationsDir = path.join(rootDir, 'server', 'migrations');

async function runSqlFile(filePath) {
  const sql = await fs.readFile(filePath, 'utf8');
  if (!sql.trim()) return;
  console.log(`Applying ${path.relative(rootDir, filePath)}`);
  await query(sql);
}

async function setupDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to set up the database.');
  }

  await runSqlFile(schemaPath);

  const migrationFiles = (await fs.readdir(migrationsDir))
    .filter(file => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  for (const file of migrationFiles) {
    await runSqlFile(path.join(migrationsDir, file));
  }

  console.log('Database schema is up to date.');
}

setupDatabase()
  .catch(err => {
    console.error('Database setup failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
