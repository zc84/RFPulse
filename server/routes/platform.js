import { Router } from 'express';
import { query } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
const OPTION_TYPES = new Set(['status', 'domain']);

function parseOptionId(id) {
  const numericId = parseInt(String(id), 10);
  return Number.isNaN(numericId) ? null : numericId;
}

router.get('/options', authenticate, async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM platform_config_options ORDER BY type, sort_order, value');
    res.json(result.rows);
  } catch (err) {
    if (err.code === '42P01') {
      return res.json([]);
    }
    next(err);
  }
});

router.post('/options', authenticate, requireRole('Superadmin'), async (req, res, next) => {
  try {
    const { type, value } = req.body;
    if (!OPTION_TYPES.has(type)) return res.status(400).json({ error: 'Invalid option type' });
    if (!value || !String(value).trim()) return res.status(400).json({ error: 'Value is required' });

    const maxSort = await query('SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM platform_config_options WHERE type = $1', [type]);
    const result = await query(
      `INSERT INTO platform_config_options (type, value, sort_order)
       VALUES ($1, $2, $3)
       ON CONFLICT (type, value) DO UPDATE SET value = EXCLUDED.value
       RETURNING *`,
      [type, String(value).trim(), Number(maxSort.rows[0].max_sort) + 10]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/options/:id', authenticate, requireRole('Superadmin'), async (req, res, next) => {
  try {
    const id = parseOptionId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid option id' });
    const { value, sort_order } = req.body;
    if (!value || !String(value).trim()) return res.status(400).json({ error: 'Value is required' });

    const result = await query(
      `UPDATE platform_config_options
       SET value = $1, sort_order = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [String(value).trim(), Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Option not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/options/:id', authenticate, requireRole('Superadmin'), async (req, res, next) => {
  try {
    const id = parseOptionId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid option id' });

    const existing = await query('SELECT * FROM platform_config_options WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Option not found' });
    const option = existing.rows[0];
    const usageColumn = option.type === 'status' ? 'status' : 'domain';
    const usage = await query(`SELECT COUNT(*)::int AS count FROM deals WHERE ${usageColumn} = $1`, [option.value]);
    if (usage.rows[0].count > 0) {
      return res.status(409).json({ error: `Cannot delete ${option.type}; it is used by ${usage.rows[0].count} deal(s).` });
    }

    await query('DELETE FROM platform_config_options WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
