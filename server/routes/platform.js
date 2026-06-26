import { Router } from 'express';
import { pool, query } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
const OPTION_TYPES = new Set(['status', 'domain']);

function parseOptionId(id) {
  const numericId = parseInt(String(id), 10);
  return Number.isNaN(numericId) ? null : numericId;
}

async function ensurePlatformOptionsReady() {
  await query(`
    CREATE TABLE IF NOT EXISTS platform_config_options (
      id SERIAL PRIMARY KEY,
      type VARCHAR(50) NOT NULL CHECK (type IN ('status', 'domain')),
      value VARCHAR(100) NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (type, value)
    )
  `);

  await syncDealValuesToOptions();
}

async function syncDealValuesToOptions() {
  await query(`
    INSERT INTO platform_config_options (type, value, sort_order)
    SELECT type, value, sort_order
    FROM (
      SELECT 'status' AS type, status AS value, 1000 + ROW_NUMBER() OVER (ORDER BY status) * 10 AS sort_order
      FROM (SELECT DISTINCT status FROM deals WHERE status IS NOT NULL AND TRIM(status) <> '') deal_statuses
      UNION ALL
      SELECT 'domain' AS type, domain AS value, 1000 + ROW_NUMBER() OVER (ORDER BY domain) * 10 AS sort_order
      FROM (SELECT DISTINCT domain FROM deals WHERE domain IS NOT NULL AND TRIM(domain) <> '') deal_domains
    ) existing_values
    ON CONFLICT (type, value) DO NOTHING
  `);
}

router.get('/options', authenticate, async (req, res, next) => {
  try {
    await ensurePlatformOptionsReady();
    const result = await query('SELECT * FROM platform_config_options ORDER BY type, sort_order, value');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/options', authenticate, requireRole('Superadmin'), async (req, res, next) => {
  try {
    await ensurePlatformOptionsReady();
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
  const client = await pool.connect();
  try {
    await ensurePlatformOptionsReady();
    const id = parseOptionId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid option id' });
    const { value, sort_order } = req.body;
    if (!value || !String(value).trim()) return res.status(400).json({ error: 'Value is required' });

    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM platform_config_options WHERE id = $1 FOR UPDATE', [id]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Option not found' });
    }

    const option = existing.rows[0];
    const nextValue = String(value).trim();
    const usageColumn = option.type === 'status' ? 'status' : 'domain';

    if (option.value !== nextValue) {
      const duplicate = await client.query(
        'SELECT id FROM platform_config_options WHERE type = $1 AND value = $2 AND id <> $3',
        [option.type, nextValue, id]
      );
      if (duplicate.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `${option.type} already exists.` });
      }
    }

    const result = await client.query(
      `UPDATE platform_config_options
       SET value = $1, sort_order = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [nextValue, Number.isFinite(Number(sort_order)) ? Number(sort_order) : option.sort_order, id]
    );

    if (option.value !== nextValue) {
      await client.query(`UPDATE deals SET ${usageColumn} = $1 WHERE ${usageColumn} = $2`, [nextValue, option.value]);
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

router.delete('/options/:id', authenticate, requireRole('Superadmin'), async (req, res, next) => {
  try {
    await ensurePlatformOptionsReady();
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
