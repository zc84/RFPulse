import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { signToken, authenticate } from '../middleware/auth.js';

const router = Router();

function formatUser(row) {
  return {
    id: `U-${String(row.id).padStart(3, '0')}`,
    name: row.name,
    email: row.email,
    role: row.role,
  };
}

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'User not found' });
    res.json(formatUser(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

router.put('/me', authenticate, async (req, res, next) => {
  try {
    const numericId = req.user.userId;
    const { name, email, currentPassword, newPassword } = req.body;

    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (email && !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email' });
    }

    if (name !== undefined && name.trim()) {
      const existingUsername = await query(
        'SELECT id FROM users WHERE LOWER(name) = LOWER($1) AND id <> $2',
        [name.trim(), numericId]
      );
      if (existingUsername.rows.length > 0) {
        return res.status(409).json({ error: 'Username already in use' });
      }
    }

    if (email) {
      const existingEmail = await query(
        'SELECT id FROM users WHERE email = $1 AND id <> $2',
        [email.toLowerCase(), numericId]
      );
      if (existingEmail.rows.length > 0) {
        return res.status(409).json({ error: 'Email already in use' });
      }
    }

    if (newPassword !== undefined && newPassword !== '') {
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required' });
      }

      const passwordResult = await query('SELECT password_hash FROM users WHERE id = $1', [numericId]);
      if (passwordResult.rows.length === 0) return res.status(401).json({ error: 'User not found' });
      const valid = await bcrypt.compare(currentPassword, passwordResult.rows[0].password_hash);
      if (!valid) {
        return res.status(403).json({ error: 'Current password is incorrect' });
      }
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx++}`); params.push(name.trim()); }
    if (email !== undefined) { updates.push(`email = $${idx++}`); params.push(email ? email.toLowerCase() : null); }
    if (newPassword) { updates.push(`password_hash = $${idx++}`); params.push(await bcrypt.hash(newPassword, 10)); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(numericId);
    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, email, role`,
      params
    );

    const user = result.rows[0];
    const token = signToken(user);
    res.json({ user: formatUser(user), token });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await query(
      'SELECT id, name, email, role, password_hash FROM users WHERE LOWER(name) = LOWER($1)',
      [username.trim()]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'username_not_found' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'wrong_password' });
    }

    const { password_hash, ...publicUser } = user;
    const token = signToken(publicUser);

    res.json({
      user: {
        ...publicUser,
        id: `U-${String(publicUser.id).padStart(3, '0')}`,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
