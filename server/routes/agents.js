import { Router } from 'express';
import { query } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { ensureDefaultAgents, getOpenAIKey, validateOpenAIKey } from '../services/aiOrchestrator.js';

const router = Router();

const OPENAI_KEY_MASK = '••••••••••••••••••••••••••';

router.get('/settings', authenticate, requireRole('Superadmin'), async (req, res, next) => {
  try {
    const key = await getOpenAIKey();
    res.json({
      openai_api_key: key ? OPENAI_KEY_MASK : '',
      has_key: !!key,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/validate', authenticate, async (req, res, next) => {
  try {
    const result = await validateOpenAIKey();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/settings', authenticate, requireRole('Superadmin'), async (req, res, next) => {
  try {
    const { openai_api_key } = req.body;
    if (openai_api_key === undefined || openai_api_key === null) {
      return res.status(400).json({ error: 'openai_api_key is required' });
    }

    await query(
      `INSERT INTO global_settings (key, value)
       VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      ['openai_api_key', openai_api_key]
    );

    res.json({ openai_api_key: OPENAI_KEY_MASK, has_key: true });
  } catch (err) {
    next(err);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    await ensureDefaultAgents();
    const isSuperadmin = req.user.role === 'Superadmin';
    const result = await query('SELECT * FROM agents ORDER BY sort_order, id');
    const agents = result.rows.map(a => {
      if (isSuperadmin) return a;
      return {
        slug: a.slug,
        name: a.name,
        is_enabled: a.is_enabled,
      };
    });
    res.json(agents);
  } catch (err) {
    next(err);
  }
});

router.get('/:slug', authenticate, async (req, res, next) => {
  try {
    const isSuperadmin = req.user.role === 'Superadmin';
    const result = await query('SELECT * FROM agents WHERE slug = $1', [req.params.slug]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Agent not found' });
    const agent = result.rows[0];
    if (!isSuperadmin) {
      return res.json({ slug: agent.slug, name: agent.name, is_enabled: agent.is_enabled });
    }
    res.json(agent);
  } catch (err) {
    next(err);
  }
});

router.put('/:slug', authenticate, requireRole('Superadmin'), async (req, res, next) => {
  try {
    const {
      name,
      model,
      system_prompt,
      temperature,
      max_tokens,
      top_p,
      presence_penalty,
      frequency_penalty,
      is_enabled,
      sort_order,
    } = req.body;

    const existing = await query('SELECT id FROM agents WHERE slug = $1', [req.params.slug]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Agent not found' });

    await query(
      `UPDATE agents
       SET name = $1,
           model = $2,
           system_prompt = $3,
           temperature = $4,
           max_tokens = $5,
           top_p = $6,
           presence_penalty = $7,
           frequency_penalty = $8,
           is_enabled = $9,
           sort_order = $10,
           updated_at = CURRENT_TIMESTAMP
       WHERE slug = $11`,
      [
        name,
        model,
        system_prompt,
        temperature,
        max_tokens,
        top_p,
        presence_penalty,
        frequency_penalty,
        is_enabled,
        sort_order,
        req.params.slug,
      ]
    );

    const result = await query('SELECT * FROM agents WHERE slug = $1', [req.params.slug]);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
