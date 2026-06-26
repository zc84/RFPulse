import bcrypt from 'bcryptjs';
import { pool, query } from './db.js';

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

    console.log('Deal seed data is disabled; preserving existing deals.');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
