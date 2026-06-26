import { Router } from 'express';
import { query } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
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

function formatDeal(row) {
  return {
    id: `D-${String(row.id).padStart(3, '0')}`,
    name: row.name,
    status: row.status,
    dueDate: row.due_date ? (() => { const d = new Date(row.due_date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })() : null,
    budget: Number(row.budget),
    domain: row.domain,
    clientName: row.client_name,
    classification: row.classification,
    description: row.description,
    assigneeId: row.assignee_id ? String(row.assignee_id) : null,
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

router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT d.*, u.name AS assignee_name FROM deals d LEFT JOIN users u ON d.assignee_id = u.id ORDER BY d.created_at DESC'
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

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const numericId = parseInt(req.params.id.replace('D-', ''), 10);
    if (isNaN(numericId)) return res.status(400).json({ error: 'Invalid deal id' });

    const dealResult = await query('SELECT d.*, u.name AS assignee_name FROM deals d LEFT JOIN users u ON d.assignee_id = u.id WHERE d.id = $1', [numericId]);
    if (dealResult.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const docResult = await query('SELECT * FROM documents WHERE deal_id = $1', [numericId]);

    res.json({
      ...formatDeal(dealResult.rows[0]),
      documents: docResult.rows.map(formatDocument),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, requireRole('Superadmin', 'Editor'), async (req, res, next) => {
  try {
    const { name, status, dueDate, budget, domain, clientName, classification, description, assigneeId, documents = [] } = req.body;
    if (!name || !status || !dueDate || !budget || !domain) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const effectiveAssigneeId = assigneeId || req.user.userId;

    const result = await query(
      `INSERT INTO deals (name, status, due_date, budget, domain, client_name, classification, description, assignee_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [name.trim(), status, dueDate, budget, domain, clientName || null, classification || null, description || null, effectiveAssigneeId]
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
    const existing = await query('SELECT id FROM deals WHERE id = $1', [numericId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });

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
      [name?.trim(), status, dueDate, budget, domain, clientName || null, classification || null, description || null, assigneeId || null, numericId]
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
