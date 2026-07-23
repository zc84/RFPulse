import { Router } from 'express';
import { query } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { ensureDefaultAgents, getOpenAIKey, listOpenAIModels, validateOpenAIKey } from '../services/aiOrchestrator.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getProposalTemplateSettings, saveProposalTemplate, deleteProposalTemplate } from '../services/proposalTemplate.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
const SYSTEM_DIR = path.join(UPLOAD_DIR, 'system');
if (!fs.existsSync(SYSTEM_DIR)) {
  fs.mkdirSync(SYSTEM_DIR, { recursive: true });
}

const OPENAI_KEY_MASK = '••••••••••••••••••••••••••';
const TEMPLATE_FILENAME = 'proposal-template.docx';
const RUNTIME_SETTING_KEYS = ['ai_runtime_v2_enabled', 'ai_runtime_v2_shadow_mode', 'ai_framework_retrieval_enabled', 'ai_estimation_policy'];
const templateUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, SYSTEM_DIR),
    filename: (req, file, cb) => cb(null, TEMPLATE_FILENAME),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isDocx = file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || path.extname(file.originalname || '').toLowerCase() === '.docx';
    cb(isDocx ? null : new Error('Proposal template must be a DOCX file.'), isDocx);
  },
});

router.get('/settings', authenticate, requireRole('Superadmin'), async (req, res, next) => {
  try {
    const key = await getOpenAIKey();
    const proposalTemplate = await getProposalTemplateSettings();
    res.json({
      openai_api_key: key ? OPENAI_KEY_MASK : '',
      has_key: !!key,
      proposal_template_name: proposalTemplate.original_name || '',
      proposal_template_uploaded_at: proposalTemplate.uploaded_at || null,
      has_proposal_template: proposalTemplate.has_template,
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

router.get('/models', authenticate, requireRole('Superadmin'), async (req, res, next) => {
  try {
    const models = await listOpenAIModels();
    res.json({ models });
  } catch (err) {
    if (err.message?.includes('OpenAI API key not configured') || err.message?.includes('API key')) {
      return res.status(400).json({ error: err.message || 'OpenAI API key is not configured.' });
    }
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

router.get('/runtime-settings', authenticate, requireRole('Superadmin'), async (req, res, next) => {
  try {
    const result = await query('SELECT key, value FROM global_settings WHERE key = ANY($1::text[])', [RUNTIME_SETTING_KEYS]);
    const values = Object.fromEntries(result.rows.map(row => [row.key, row.value]));
    res.json({
      ai_runtime_v2_enabled: values.ai_runtime_v2_enabled === 'true',
      ai_runtime_v2_shadow_mode: values.ai_runtime_v2_shadow_mode !== 'false',
      ai_framework_retrieval_enabled: values.ai_framework_retrieval_enabled !== 'false',
      ai_estimation_policy: JSON.parse(values.ai_estimation_policy || '{}'),
    });
  } catch (err) {
    next(err);
  }
});

router.put('/runtime-settings', authenticate, requireRole('Superadmin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const booleans = ['ai_runtime_v2_enabled', 'ai_runtime_v2_shadow_mode', 'ai_framework_retrieval_enabled'];
    for (const key of booleans) {
      if (body[key] !== undefined && typeof body[key] !== 'boolean') {
        return res.status(400).json({ error: `${key} must be boolean` });
      }
    }
    if (body.ai_estimation_policy !== undefined && (!body.ai_estimation_policy || typeof body.ai_estimation_policy !== 'object' || Array.isArray(body.ai_estimation_policy))) {
      return res.status(400).json({ error: 'ai_estimation_policy must be an object' });
    }

    const updates = [];
    for (const key of booleans) {
      if (body[key] !== undefined) updates.push([key, String(body[key])]);
    }
    if (body.ai_estimation_policy !== undefined) updates.push(['ai_estimation_policy', JSON.stringify(body.ai_estimation_policy)]);
    for (const [key, value] of updates) {
      await query(
        `INSERT INTO global_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [key, value],
      );
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/proposal-template', authenticate, requireRole('Superadmin'), templateUpload.single('template'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Proposal template file is required' });
    const metadata = await saveProposalTemplate(req.file.path, req.file.originalname);
    res.json({
      proposal_template_name: metadata.originalName,
      proposal_template_uploaded_at: metadata.uploadedAt,
      has_proposal_template: true,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/proposal-template', authenticate, requireRole('Superadmin'), async (req, res, next) => {
  try {
    await deleteProposalTemplate();
    res.json({
      proposal_template_name: '',
      proposal_template_uploaded_at: null,
      has_proposal_template: false,
    });
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

router.get('/prompts/all', authenticate, requireRole('Superadmin'), async (req, res, next) => {
  try {
    await ensureDefaultAgents();
    const result = await query('SELECT * FROM agent_prompt_templates ORDER BY kind, sort_order, id');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.put('/prompts/:key', authenticate, requireRole('Superadmin'), async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || typeof content !== 'string') return res.status(400).json({ error: 'Prompt content is required' });
    const result = await query(
      `UPDATE agent_prompt_templates SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE prompt_key = $2 RETURNING *`,
      [content, req.params.key]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Prompt template not found' });
    res.json(result.rows[0]);
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
