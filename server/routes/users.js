import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

function formatUser(row) {
  return {
    id: `U-${String(row.id).padStart(3, '0')}`,
    name: row.name,
    email: row.email,
    role: row.role,
  };
}

router.get('/', authenticate, requireRole('Superadmin'), async (req, res, next) => {
  try {
    const result = await query('SELECT id, name, email, role FROM users ORDER BY created_at DESC');
    res.json(result.rows.map(formatUser));
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, requireRole('Superadmin'), async (req, res, next) => {
  try {
    const { name, email, role, password } = req.body;
    if (!name || !email || !role || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (name, email, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name.trim(), email.toLowerCase(), role, passwordHash]
    );

    res.status(201).json(formatUser(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, requireRole('Superadmin'), async (req, res, next) => {
  try {
    const numericId = parseInt(req.params.id.replace('U-', ''), 10);
    if (isNaN(numericId)) return res.status(400).json({ error: 'Invalid user id' });

    const { name, email, role, password } = req.body;

    if (email) {
      const existing = await query(
        'SELECT id FROM users WHERE email = $1 AND id <> $2',
        [email.toLowerCase(), numericId]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email already in use' });
      }
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx++}`); params.push(name.trim()); }
    if (email !== undefined) { updates.push(`email = $${idx++}`); params.push(email.toLowerCase()); }
    if (role !== undefined) { updates.push(`role = $${idx++}`); params.push(role); }
    if (password) { updates.push(`password_hash = $${idx++}`); params.push(await bcrypt.hash(password, 10)); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(numericId);
    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, email, role`,
      params
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(formatUser(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, requireRole('Superadmin'), async (req, res, next) => {
  try {
    const numericId = parseInt(req.params.id.replace('U-', ''), 10);
    if (isNaN(numericId)) return res.status(400).json({ error: 'Invalid user id' });

    if (req.user.userId === numericId) {
      return res.status(403).json({ error: 'Cannot delete yourself' });
    }

    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [numericId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
