import { Router } from 'express';
import { query } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dealId = parseInt(req.params.id.replace('D-', ''), 10);
    if (isNaN(dealId)) return cb(new Error('Invalid deal id'), '');
    const dealDir = path.join(UPLOAD_DIR, String(dealId));
    if (!fs.existsSync(dealDir)) {
      fs.mkdirSync(dealDir, { recursive: true });
    }
    cb(null, dealDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname}`;
    cb(null, unique);
  },
});

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

const router = Router();

function formatUserId(id) {
  return `U-${String(id).padStart(3, '0')}`;
}

function parseUserId(id) {
  if (id === undefined || id === null || id === '') return null;
  const numericId = parseInt(String(id).replace('U-', ''), 10);
  return Number.isNaN(numericId) ? NaN : numericId;
}

function formatDeal(row) {
  return {
    id: `D-${String(row.id).padStart(3, '0')}`,
    name: row.name,
    status: row.status,
    dueDate: row.due_date ? (() => { const d = new Date(row.due_date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })() : null,
    budget: row.budget === null ? null : Number(row.budget),
    domain: row.domain,
    clientName: row.client_name,
    classification: row.classification,
    description: row.description,
    assigneeId: row.assignee_id ? formatUserId(row.assignee_id) : null,
    assigneeName: row.assignee_name || null,
    createdAt: row.created_at,
  };
}

function formatDocument(row) {
  return {
    id: `doc-${row.id}`,
    name: row.name,
    size: row.size,
    filename: row.filename,
    source: row.source || 'user',
    uploadedAt: row.uploaded_at,
  };
}

const LOCK_TTL_MS = 10 * 60 * 1000;

function isLockExpired(lastHeartbeatAt) {
  if (!lastHeartbeatAt) return true;
  return Date.now() - new Date(lastHeartbeatAt).getTime() > LOCK_TTL_MS;
}

function formatLockFromRow(row) {
  if (!row.lock_user_id || isLockExpired(row.lock_last_heartbeat_at)) return null;
  return {
    userId: formatUserId(row.lock_user_id),
    userName: row.lock_user_name,
    lockedAt: row.lock_locked_at,
    lastHeartbeatAt: row.lock_last_heartbeat_at,
  };
}

async function getActiveLock(dealId) {
  const result = await query(
    'SELECT dl.*, u.name AS user_name FROM deal_locks dl JOIN users u ON dl.user_id = u.id WHERE dl.deal_id = $1',
    [dealId]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  if (isLockExpired(row.last_heartbeat_at)) return null;
  return {
    userId: formatUserId(row.user_id),
    userName: row.user_name,
    lockedAt: row.locked_at,
    lastHeartbeatAt: row.last_heartbeat_at,
  };
}

async function acquireLock(dealId, userId) {
  const active = await getActiveLock(dealId);
  if (active && active.userId !== formatUserId(userId)) {
    return { success: false, lock: active };
  }
  await query(
    `INSERT INTO deal_locks (deal_id, user_id, locked_at, last_heartbeat_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (deal_id) DO UPDATE
     SET user_id = EXCLUDED.user_id, locked_at = EXCLUDED.locked_at, last_heartbeat_at = EXCLUDED.last_heartbeat_at`,
    [dealId, userId]
  );
  return { success: true, lock: await getActiveLock(dealId) };
}

async function heartbeatLock(dealId, userId) {
  const active = await getActiveLock(dealId);
  if (!active || active.userId !== formatUserId(userId)) {
    return { success: false, lock: active };
  }
  await query(
    'UPDATE deal_locks SET last_heartbeat_at = CURRENT_TIMESTAMP WHERE deal_id = $1 AND user_id = $2',
    [dealId, userId]
  );
  return { success: true, lock: await getActiveLock(dealId) };
}

async function releaseLock(dealId, userId) {
  const active = await getActiveLock(dealId);
  if (!active) return { success: true, lock: null };
  if (active.userId !== formatUserId(userId)) {
    return { success: false, lock: active };
  }
  await query('DELETE FROM deal_locks WHERE deal_id = $1', [dealId]);
  return { success: true, lock: null };
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT d.*, u.name AS assignee_name,
              dl.user_id AS lock_user_id, lu.name AS lock_user_name,
              dl.locked_at AS lock_locked_at, dl.last_heartbeat_at AS lock_last_heartbeat_at
       FROM deals d
       LEFT JOIN users u ON d.assignee_id = u.id
       LEFT JOIN deal_locks dl ON d.id = dl.deal_id
       LEFT JOIN users lu ON dl.user_id = lu.id
       ORDER BY d.created_at DESC`
    );

    const dealIds = result.rows.map(r => r.id);
    const documents = dealIds.length
      ? (await query('SELECT * FROM documents WHERE deal_id = ANY($1::int[])', [dealIds])).rows
      : [];

    const docsByDeal = documents.reduce((acc, doc) => {
      acc[doc.deal_id] = acc[doc.deal_id] || [];
      acc[doc.deal_id].push(formatDocument(doc));
      return acc;
    }, {});

    const deals = result.rows.map(row => ({
      ...formatDeal(row),
      lock: formatLockFromRow(row),
      documents: docsByDeal[row.id] || [],
    }));

    res.json(deals);
  } catch (err) {
    next(err);
  }
});

router.get('/documents/:id/share', async (req, res, next) => {
  try {
    const docId = parseInt(req.params.id.replace('doc-', ''), 10);
    if (isNaN(docId)) return res.status(400).json({ error: 'Invalid document id' });

    const result = await query('SELECT * FROM documents WHERE id = $1', [docId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const doc = result.rows[0];
    if (!doc.filename) return res.status(404).json({ error: 'File not available' });

    const filePath = path.join(UPLOAD_DIR, String(doc.deal_id), doc.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });

    res.download(filePath, doc.name);
  } catch (err) {
    next(err);
  }
});

router.get('/documents/:id/download', authenticate, async (req, res, next) => {
  try {
    const docId = parseInt(req.params.id.replace('doc-', ''), 10);
    if (isNaN(docId)) return res.status(400).json({ error: 'Invalid document id' });

    const result = await query('SELECT * FROM documents WHERE id = $1', [docId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const doc = result.rows[0];
    if (!doc.filename) return res.status(404).json({ error: 'File not available' });

    const filePath = path.join(UPLOAD_DIR, String(doc.deal_id), doc.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });

    res.download(filePath, doc.name);
  } catch (err) {
    next(err);
  }
});

router.delete('/documents/:id', authenticate, requireRole('Superadmin', 'Editor'), async (req, res, next) => {
  try {
    const docId = parseInt(req.params.id.replace('doc-', ''), 10);
    if (isNaN(docId)) return res.status(400).json({ error: 'Invalid document id' });

    const result = await query('SELECT * FROM documents WHERE id = $1', [docId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const doc = result.rows[0];
    if (doc.filename) {
      const filePath = path.join(UPLOAD_DIR, String(doc.deal_id), doc.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await query('DELETE FROM documents WHERE id = $1', [docId]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post('/:id/lock', authenticate, async (req, res, next) => {
  try {
    const numericId = parseInt(req.params.id.replace('D-', ''), 10);
    if (isNaN(numericId)) return res.status(400).json({ error: 'Invalid deal id' });

    const existing = await query('SELECT id FROM deals WHERE id = $1', [numericId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const result = await acquireLock(numericId, req.user.userId);
    if (!result.success) {
      return res.status(409).json({ error: 'Deal is locked', lock: result.lock });
    }
    res.json({ lock: result.lock });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/unlock', authenticate, async (req, res, next) => {
  try {
    const numericId = parseInt(req.params.id.replace('D-', ''), 10);
    if (isNaN(numericId)) return res.status(400).json({ error: 'Invalid deal id' });

    const result = await releaseLock(numericId, req.user.userId);
    if (!result.success) {
      return res.status(409).json({ error: 'Deal is locked by another user', lock: result.lock });
    }
    res.json({ lock: null });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/heartbeat', authenticate, async (req, res, next) => {
  try {
    const numericId = parseInt(req.params.id.replace('D-', ''), 10);
    if (isNaN(numericId)) return res.status(400).json({ error: 'Invalid deal id' });

    const result = await heartbeatLock(numericId, req.user.userId);
    if (!result.success) {
      return res.status(409).json({ error: 'Deal is locked by another user', lock: result.lock });
    }
    res.json({ lock: result.lock });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const numericId = parseInt(req.params.id.replace('D-', ''), 10);
    if (isNaN(numericId)) return res.status(400).json({ error: 'Invalid deal id' });

    const dealResult = await query(
      `SELECT d.*, u.name AS assignee_name,
              dl.user_id AS lock_user_id, lu.name AS lock_user_name,
              dl.locked_at AS lock_locked_at, dl.last_heartbeat_at AS lock_last_heartbeat_at
       FROM deals d
       LEFT JOIN users u ON d.assignee_id = u.id
       LEFT JOIN deal_locks dl ON d.id = dl.deal_id
       LEFT JOIN users lu ON dl.user_id = lu.id
       WHERE d.id = $1`,
      [numericId]
    );
    if (dealResult.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const docResult = await query('SELECT * FROM documents WHERE deal_id = $1', [numericId]);

    res.json({
      ...formatDeal(dealResult.rows[0]),
      lock: formatLockFromRow(dealResult.rows[0]),
      documents: docResult.rows.map(formatDocument),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, requireRole('Superadmin', 'Editor'), async (req, res, next) => {
  try {
    const { name, status, dueDate, budget, domain, clientName, classification, description, assigneeId, documents = [] } = req.body;
    if (!name || !status || !dueDate || !domain) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const normalizedBudget = budget === undefined || budget === null || budget === '' ? null : Number(budget);
    if (normalizedBudget !== null && (!Number.isFinite(normalizedBudget) || normalizedBudget <= 0)) {
      return res.status(400).json({ error: 'Invalid budget' });
    }

    const parsedAssigneeId = parseUserId(assigneeId);
    if (Number.isNaN(parsedAssigneeId)) {
      return res.status(400).json({ error: 'Invalid assignee id' });
    }
    const effectiveAssigneeId = parsedAssigneeId || req.user.userId;

    const result = await query(
      `INSERT INTO deals (name, status, due_date, budget, domain, client_name, classification, description, assignee_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [name.trim(), status, dueDate, normalizedBudget, domain, clientName || null, classification || null, description || null, effectiveAssigneeId]
    );

    const dealId = result.rows[0].id;

    for (const doc of documents) {
      await query(
        `INSERT INTO documents (deal_id, name, size, filename, source, uploaded_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [dealId, doc.name, doc.size, doc.filename || null, doc.source || 'user', doc.uploadedAt || doc.uploaded_at]
      );
    }

    const deal = await query('SELECT d.*, u.name AS assignee_name FROM deals d LEFT JOIN users u ON d.assignee_id = u.id WHERE d.id = $1', [dealId]);
    const docs = await query('SELECT * FROM documents WHERE deal_id = $1', [dealId]);

    res.status(201).json({
      ...formatDeal(deal.rows[0]),
      documents: docs.rows.map(formatDocument),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/documents', authenticate, requireRole('Superadmin', 'Editor'), upload.array('files'), async (req, res, next) => {
  try {
    const dealId = parseInt(req.params.id.replace('D-', ''), 10);
    if (isNaN(dealId)) return res.status(400).json({ error: 'Invalid deal id' });

    const existing = await query('SELECT id FROM deals WHERE id = $1', [dealId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const today = new Date().toISOString().split('T')[0];
    const source = req.body.source === 'ai' ? 'ai' : 'user';
    const results = [];
    for (const file of files) {
      const size = file.size >= 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${(file.size / 1024).toFixed(0)} KB`;
      const docResult = await query(
        `INSERT INTO documents (deal_id, name, size, filename, source, uploaded_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [dealId, file.originalname, size, file.filename, source, today]
      );
      const inserted = await query('SELECT * FROM documents WHERE id = $1', [docResult.rows[0].id]);
      results.push(formatDocument(inserted.rows[0]));
    }

    res.status(201).json(results);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, requireRole('Superadmin', 'Editor'), async (req, res, next) => {
  try {
    const numericId = parseInt(req.params.id.replace('D-', ''), 10);
    if (isNaN(numericId)) return res.status(400).json({ error: 'Invalid deal id' });

    const { name, status, dueDate, budget, domain, clientName, classification, description, assigneeId } = req.body;
    const existing = await query('SELECT * FROM deals WHERE id = $1', [numericId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const existingDeal = existing.rows[0];
    const has = (field) => Object.prototype.hasOwnProperty.call(req.body, field);

    const nextName = has('name') ? name?.trim() : existingDeal.name;
    const nextStatus = has('status') ? status : existingDeal.status;
    const nextDueDate = has('dueDate') ? dueDate : existingDeal.due_date;
    const nextDomain = has('domain') ? domain : existingDeal.domain;
    const nextClientName = has('clientName') ? clientName || null : existingDeal.client_name;
    const nextClassification = has('classification') ? classification || null : existingDeal.classification;
    const nextDescription = has('description') ? description || null : existingDeal.description;
    const parsedAssigneeId = has('assigneeId') ? parseUserId(assigneeId) : existingDeal.assignee_id;
    if (Number.isNaN(parsedAssigneeId)) {
      return res.status(400).json({ error: 'Invalid assignee id' });
    }
    const normalizedBudget = has('budget')
      ? (budget === undefined || budget === null || budget === '' ? null : Number(budget))
      : (existingDeal.budget === null ? null : Number(existingDeal.budget));
    if (normalizedBudget !== null && (!Number.isFinite(normalizedBudget) || normalizedBudget <= 0)) {
      return res.status(400).json({ error: 'Invalid budget' });
    }
    if (!nextName || !nextStatus || !nextDueDate || !nextDomain) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await query(
      `UPDATE deals
       SET name = $1,
           status = $2,
           due_date = $3,
           budget = $4,
           domain = $5,
           client_name = $6,
           classification = $7,
           description = $8,
           assignee_id = $9
       WHERE id = $10`,
      [nextName, nextStatus, nextDueDate, normalizedBudget, nextDomain, nextClientName, nextClassification, nextDescription, parsedAssigneeId, numericId]
    );

    const deal = await query('SELECT d.*, u.name AS assignee_name FROM deals d LEFT JOIN users u ON d.assignee_id = u.id WHERE d.id = $1', [numericId]);
    const docs = await query('SELECT * FROM documents WHERE deal_id = $1', [numericId]);

    res.json({
      ...formatDeal(deal.rows[0]),
      documents: docs.rows.map(formatDocument),
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, requireRole('Superadmin', 'Editor'), async (req, res, next) => {
  try {
    const numericId = parseInt(req.params.id.replace('D-', ''), 10);
    if (isNaN(numericId)) return res.status(400).json({ error: 'Invalid deal id' });

    const existing = await query('SELECT id FROM deals WHERE id = $1', [numericId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    await query('DELETE FROM deals WHERE id = $1', [numericId]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
