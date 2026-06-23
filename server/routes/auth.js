import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { signToken, authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'User not found' });
    res.json({
      id: `U-${String(result.rows[0].id).padStart(3, '0')}`,
      name: result.rows[0].name,
      email: result.rows[0].email,
      role: result.rows[0].role,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await query(
      'SELECT id, name, email, role, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'email_not_found' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'wrong_password' });
    }

    const { password_hash, ...publicUser } = user;
    const token = signToken(publicUser);

    res.json({ user: publicUser, token });
  } catch (err) {
    next(err);
  }
});

export default router;
