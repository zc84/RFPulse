import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, query } from './db.js';
import { ensureDefaultAgents } from './services/aiOrchestrator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPERADMIN = {
  name: 'd.sharstabitau',
  email: 'd.sharstabitau@andersenlab.com',
  password: 'Toriabra909',
  role: 'Superadmin',
};

async function seed() {
  try {
    const passwordHash = await bcrypt.hash(SUPERADMIN.password, 10);

    const userResult = await query(
      `INSERT INTO users (name, email, role, password_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE SET
         email = EXCLUDED.email,
         role = EXCLUDED.role
       RETURNING id`,
      [SUPERADMIN.name, SUPERADMIN.email, SUPERADMIN.role, passwordHash]
    );

    const superadminId = userResult.rows[0].id;
    console.log(`Seeded superadmin user ${SUPERADMIN.name} (id=${superadminId})`);

    const companyProfile = await fs.readFile(
      path.join(__dirname, 'seed-data', 'andersen-profile.md'),
      'utf8'
    );
    let profileResult = await query(
      `UPDATE company_profile
       SET content = $2, updated_at = CURRENT_TIMESTAMP
       WHERE name = $1
       RETURNING id`,
      ['Andersen Lab', companyProfile.trim()]
    );
    if (profileResult.rowCount === 0) {
      profileResult = await query(
        `INSERT INTO company_profile (name, content)
         VALUES ($1, $2)
         RETURNING id`,
        ['Andersen Lab', companyProfile.trim()]
      );
    }
    console.log(`Seeded Andersen Lab company profile (id=${profileResult.rows[0].id})`);

    await ensureDefaultAgents();
    console.log('Synchronized default AI agent prompts.');

    console.log('Deal seed data is disabled; preserving existing deals.');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
