import { Router } from 'express';
import { query } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

function formatDeal(row) {
  return {
    id: `D-${String(row.id).padStart(3, '0')}`,
    name: row.name,
    status: row.status,
    dueDate: row.due_date,
    budget: Number(row.budget),
    domain: row.domain,
    description: row.description,
    createdAt: row.created_at,
  };
}

function formatDocument(row) {
  return {
    id: `doc-${row.id}`,
    name: row.name,
    size: row.size,
    uploadedAt: row.uploaded_at,
  };
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM deals ORDER BY created_at DESC'
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

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const numericId = parseInt(req.params.id.replace('D-', ''), 10);
    if (isNaN(numericId)) return res.status(400).json({ error: 'Invalid deal id' });

    const dealResult = await query('SELECT * FROM deals WHERE id = $1', [numericId]);
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
    const { name, status, dueDate, budget, domain, description, documents = [] } = req.body;
    if (!name || !status || !dueDate || !budget || !domain) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await query(
      `INSERT INTO deals (name, status, due_date, budget, domain, description)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name.trim(), status, dueDate, budget, domain, description || null]
    );

    const dealId = result.rows[0].id;

    for (const doc of documents) {
      await query(
        `INSERT INTO documents (deal_id, name, size, uploaded_at)
         VALUES ($1, $2, $3, $4)`,
        [dealId, doc.name, doc.size, doc.uploaded_at]
      );
    }

    const deal = await query('SELECT * FROM deals WHERE id = $1', [dealId]);
    const docs = await query('SELECT * FROM documents WHERE deal_id = $1', [dealId]);

    res.status(201).json({
      ...formatDeal(deal.rows[0]),
      documents: docs.rows.map(formatDocument),
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, requireRole('Superadmin', 'Editor'), async (req, res, next) => {
  try {
    const numericId = parseInt(req.params.id.replace('D-', ''), 10);
    if (isNaN(numericId)) return res.status(400).json({ error: 'Invalid deal id' });

    const { name, status, dueDate, budget, domain, description, documents } = req.body;
    const existing = await query('SELECT id FROM deals WHERE id = $1', [numericId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    await query(
      `UPDATE deals
       SET name = COALESCE($1, name),
           status = COALESCE($2, status),
           due_date = COALESCE($3, due_date),
           budget = COALESCE($4, budget),
           domain = COALESCE($5, domain),
           description = COALESCE($6, description)
       WHERE id = $7`,
      [name?.trim(), status, dueDate, budget, domain, description, numericId]
    );

    if (Array.isArray(documents)) {
      await query('DELETE FROM documents WHERE deal_id = $1', [numericId]);
      for (const doc of documents) {
        await query(
          `INSERT INTO documents (deal_id, name, size, uploaded_at)
           VALUES ($1, $2, $3, $4)`,
          [numericId, doc.name, doc.size, doc.uploaded_at]
        );
      }
    }

    const deal = await query('SELECT * FROM deals WHERE id = $1', [numericId]);
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
