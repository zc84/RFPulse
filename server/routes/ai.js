import { Router } from 'express';
import { query } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { buildDealContextBundle, summarizeContextBundle } from '../services/documentExtractor.js';
import {
  coordinatorStep,
  buildReportFromOutputs,
  coordinatorReviewStep,
  runAgentPlan,
  ensureDefaultAgents,
  extractDealProperties,
  callAgent,
} from '../services/aiOrchestrator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const router = Router({ mergeParams: true });

function parseDealId(id) {
  const numericId = parseInt(id.replace('D-', ''), 10);
  if (isNaN(numericId)) return null;
  return numericId;
}

async function getDealWithDocs(numericId) {
  const dealResult = await query('SELECT * FROM deals WHERE id = $1', [numericId]);
  if (dealResult.rows.length === 0) return null;
  const docResult = await query('SELECT * FROM documents WHERE deal_id = $1', [numericId]);
  return {
    deal: dealResult.rows[0],
    documents: docResult.rows,
  };
}

async function getOrCreateSession(dealId, contextBundle, coordinatorContext) {
  const existing = await query('SELECT * FROM ai_sessions WHERE deal_id = $1 ORDER BY id DESC LIMIT 1', [dealId]);
  if (existing.rows.length > 0) {
    const session = existing.rows[0];
    const updates = [];
    const params = [];
    let idx = 1;
    if (contextBundle) {
      updates.push(`extracted_context = $${idx++}`);
      params.push(contextBundle);
    }
    if (coordinatorContext) {
      updates.push(`coordinator_context = $${idx++}`);
      params.push(coordinatorContext);
    }
    if (updates.length > 0) {
      params.push(session.id);
      await query(`UPDATE ai_sessions SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx}`, params);
    }
    return session;
  }

  const result = await query(
    'INSERT INTO ai_sessions (deal_id, extracted_context, coordinator_context, status) VALUES ($1, $2, $3, $4) RETURNING *',
    [dealId, contextBundle || '', coordinatorContext || null, 'active']
  );
  return result.rows[0];
}

async function getSessionMessages(sessionId) {
  const result = await query('SELECT * FROM ai_messages WHERE session_id = $1 ORDER BY created_at ASC, id ASC', [sessionId]);
  return result.rows;
}

async function addMessage(sessionId, role, content, agentSlug = null) {
  const result = await query(
    'INSERT INTO ai_messages (session_id, role, content, agent_slug) VALUES ($1, $2, $3, $4) RETURNING *',
    [sessionId, role, content, agentSlug]
  );
  return result.rows[0];
}

async function getChatMessages(dealId) {
  const result = await query('SELECT * FROM ai_chat_messages WHERE deal_id = $1 ORDER BY created_at ASC, id ASC', [dealId]);
  return result.rows;
}

async function addChatMessage(dealId, role, content) {
  const result = await query(
    'INSERT INTO ai_chat_messages (deal_id, role, content) VALUES ($1, $2, $3) RETURNING *',
    [dealId, role, content]
  );
  return result.rows[0];
}

async function buildChatContext(dealId, documents) {
  const aiDocs = documents.filter(d => d.source === 'ai');
  const userDocs = documents.filter(d => d.source === 'user' || !d.source);
  const aiExtracted = await buildDealContextBundle(`D-${dealId}`, aiDocs);
  const userExtracted = await buildDealContextBundle(`D-${dealId}`, userDocs);
  const parts = [];
  parts.push('## AI Documents (primary context)');
  for (const doc of aiExtracted) {
    parts.push(`--- ${doc.name} ---`);
    parts.push(doc.success ? doc.text : `[Could not extract: ${doc.error}]`);
    parts.push('');
  }
  parts.push('## User Documents (reference context)');
  for (const doc of userExtracted) {
    parts.push(`--- ${doc.name} ---`);
    parts.push(doc.success ? doc.text : `[Could not extract: ${doc.error}]`);
    parts.push('');
  }
  return parts.join('\n').trim();
}

async function getAgentOutputs(sessionId) {
  const result = await query('SELECT * FROM ai_agent_outputs WHERE session_id = $1', [sessionId]);
  const outputs = {};
  for (const row of result.rows) {
    outputs[row.agent_slug] = row.content;
  }
  return outputs;
}

async function saveAgentOutput(sessionId, slug, content) {
  await query(
    `INSERT INTO ai_agent_outputs (session_id, agent_slug, content)
     VALUES ($1, $2, $3)
     ON CONFLICT (session_id, agent_slug) DO UPDATE SET content = EXCLUDED.content, created_at = CURRENT_TIMESTAMP`,
    [sessionId, slug, content]
  );
}

function writeMarkdownChunks(filePath, markdown) {
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(filePath, { encoding: 'utf-8' });
    const chunkSize = 64 * 1024;
    let position = 0;

    stream.on('error', reject);
    stream.on('finish', resolve);

    function writeNext() {
      if (position >= markdown.length) {
        stream.end();
        return;
      }
      const chunk = markdown.slice(position, position + chunkSize);
      position += chunk.length;
      if (!stream.write(chunk)) {
        stream.once('drain', writeNext);
      } else {
        setImmediate(writeNext);
      }
    }

    writeNext();
  });
}

async function deleteAiDocuments(dealId) {
  const aiDocs = await query('SELECT * FROM documents WHERE deal_id = $1 AND source = $2', [dealId, 'ai']);
  for (const doc of aiDocs.rows) {
    if (doc.filename) {
      const filePath = path.join(UPLOAD_DIR, String(dealId), doc.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }
  if (aiDocs.rows.length > 0) {
    await query('DELETE FROM documents WHERE deal_id = $1 AND source = $2', [dealId, 'ai']);
  }
  return aiDocs.rows;
}

async function saveFinalReport(dealId, sessionId, markdown) {
  const dealDir = path.join(UPLOAD_DIR, String(dealId));
  if (!fs.existsSync(dealDir)) {
    fs.mkdirSync(dealDir, { recursive: true });
  }

  const filename = `assessment-report-${Date.now()}.md`;
  const filePath = path.join(dealDir, filename);
  await writeMarkdownChunks(filePath, markdown);

  const sizeBytes = Buffer.byteLength(markdown, 'utf-8');
  const size = sizeBytes >= 1024 * 1024
    ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
    : `${(sizeBytes / 1024).toFixed(0)} KB`;
  const today = new Date().toISOString().split('T')[0];

  const docResult = await query(
    `INSERT INTO documents (deal_id, name, size, filename, source, uploaded_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [dealId, 'AI Assessment Report.md', size, filename, 'ai', today]
  );

  const documentId = docResult.rows[0].id;
  await query(
    'UPDATE ai_sessions SET final_report_document_id = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
    [documentId, 'completed', sessionId]
  );

  return documentId;
}

router.post('/start', authenticate, requireRole('Superadmin', 'Editor'), async (req, res, next) => {
  try {
    await ensureDefaultAgents();
    const dealId = parseDealId(req.params.id);
    if (!dealId) return res.status(400).json({ error: 'Invalid deal id' });

    const data = await getDealWithDocs(dealId);
    if (!data) return res.status(404).json({ error: 'Deal not found' });

    const aiDocs = (await query('SELECT * FROM documents WHERE deal_id = $1 AND source = $2', [dealId, 'ai'])).rows;
    const force = req.body.force === true;
    if (aiDocs.length > 0 && !force) {
      return res.status(409).json({
        error: 'AI documents already exist for this deal.',
        hasExistingAiDocs: true,
        aiDocs: aiDocs.map(d => ({ id: `doc-${d.id}`, name: d.name })),
      });
    }
    if (aiDocs.length > 0 && force) {
      await deleteAiDocuments(dealId);
    }

    const extractedDocs = await buildDealContextBundle(req.params.id, data.documents);
    const contextBundle = summarizeContextBundle(extractedDocs);
    const session = await getOrCreateSession(dealId, contextBundle);
    const messages = await getSessionMessages(session.id);

    const coordinatorResult = await coordinatorStep(contextBundle, messages);

    const coordinatorContext = coordinatorResult.status === 'routing' ? coordinatorResult.context : null;
    if (coordinatorContext) {
      await query('UPDATE ai_sessions SET coordinator_context = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [coordinatorContext, session.id]);
    }

    if (coordinatorResult.status === 'clarifying' && coordinatorResult.questions?.length) {
      const content = coordinatorResult.questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
      await addMessage(session.id, 'coordinator', content);
    }

    await query('UPDATE ai_sessions SET current_agent_plan = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
      coordinatorResult.status === 'routing' ? JSON.stringify(coordinatorResult.plan || []) : null,
      session.id,
    ]);

    const updatedMessages = await getSessionMessages(session.id);

    res.json({
      sessionId: session.id,
      status: coordinatorResult.status,
      plan: coordinatorResult.plan,
      reasoning: coordinatorResult.reasoning,
      messages: updatedMessages,
      extractedDocs: extractedDocs.map(d => ({ id: d.id, name: d.name, size: d.size, success: d.success })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/message', authenticate, requireRole('Superadmin', 'Editor'), async (req, res, next) => {
  try {
    const dealId = parseDealId(req.params.id);
    if (!dealId) return res.status(400).json({ error: 'Invalid deal id' });

    const { content } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const session = await getOrCreateSession(dealId, '');
    await addMessage(session.id, 'user', content);

    const messages = await getSessionMessages(session.id);
    const contextBundle = session.extracted_context || '';
    const agentOutputs = await getAgentOutputs(session.id);

    const coordinatorResult = await coordinatorStep(contextBundle, messages, agentOutputs);

    // Persist coordinator context when it is produced for routing.
    const coordinatorContext = coordinatorResult.status === 'routing' && coordinatorResult.context
      ? coordinatorResult.context
      : session.coordinator_context || null;
    if (coordinatorResult.context && coordinatorResult.status === 'routing') {
      await query('UPDATE ai_sessions SET coordinator_context = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [coordinatorResult.context, session.id]);
    }

    const agentContext = coordinatorContext || contextBundle;

    let newAgentOutputs = null;
    let finalReportDocumentId = null;
    let proposedUpdates = null;

    if (coordinatorResult.status === 'routing' && coordinatorResult.plan?.length) {
      await addMessage(session.id, 'agent', `Running agents: ${coordinatorResult.plan.join(', ')}`, 'coordinator');
      newAgentOutputs = await runAgentPlan(agentContext, messages, coordinatorResult.plan);
      for (const [slug, output] of Object.entries(newAgentOutputs)) {
        await saveAgentOutput(session.id, slug, output);
        await addMessage(session.id, 'agent', `Agent ${slug} completed.`, 'coordinator');
      }
      await query('UPDATE ai_sessions SET current_agent_plan = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
        JSON.stringify([]),
        session.id,
      ]);
      // After routing, automatically run coordinator again to decide next step.
      const updatedMessages = await getSessionMessages(session.id);
      const updatedOutputs = await getAgentOutputs(session.id);
      const nextResult = await coordinatorStep(contextBundle, updatedMessages, updatedOutputs);
      if (nextResult.status === 'ready_to_write') {
        const dealRow = await query('SELECT name FROM deals WHERE id = $1', [dealId]);
        const dealName = dealRow.rows[0]?.name || 'Untitled Deal';
        const draftReport = buildReportFromOutputs(dealName, agentContext, updatedOutputs);
        const finalReport = await coordinatorReviewStep(contextBundle, draftReport);
        finalReportDocumentId = await saveFinalReport(dealId, session.id, finalReport);
        try {
          proposedUpdates = await extractDealProperties(contextBundle);
        } catch (extractErr) {
          console.error('Property extraction failed:', extractErr);
        }
        await addMessage(session.id, 'agent', 'Assessment report generated and reviewed.', 'coordinator');
      } else if (nextResult.status === 'clarifying' && nextResult.questions?.length) {
        const qContent = nextResult.questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
        await addMessage(session.id, 'coordinator', qContent);
      }
    } else if (coordinatorResult.status === 'ready_to_write') {
      const updatedOutputs = await getAgentOutputs(session.id);
      if (Object.keys(updatedOutputs).length === 0) {
        // No agent outputs yet, run the default plan.
        const defaultPlan = ['legal', 'architect', 'estimator'];
        await addMessage(session.id, 'agent', `Running agents: ${defaultPlan.join(', ')}`, 'coordinator');
        newAgentOutputs = await runAgentPlan(agentContext, messages, defaultPlan);
        for (const [slug, output] of Object.entries(newAgentOutputs)) {
          await saveAgentOutput(session.id, slug, output);
        }
      }
      const finalOutputs = await getAgentOutputs(session.id);
      const dealRow = await query('SELECT name FROM deals WHERE id = $1', [dealId]);
      const dealName = dealRow.rows[0]?.name || 'Untitled Deal';
      const draftReport = buildReportFromOutputs(dealName, agentContext, finalOutputs);
      const finalReport = await coordinatorReviewStep(contextBundle, draftReport);
      finalReportDocumentId = await saveFinalReport(dealId, session.id, finalReport);
      try {
        proposedUpdates = await extractDealProperties(contextBundle);
      } catch (extractErr) {
        console.error('Property extraction failed:', extractErr);
      }
      await addMessage(session.id, 'agent', 'Assessment report generated and reviewed.', 'coordinator');
    } else if (coordinatorResult.status === 'clarifying' && coordinatorResult.questions?.length) {
      const qContent = coordinatorResult.questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
      await addMessage(session.id, 'coordinator', qContent);
    }

    const updatedMessages = await getSessionMessages(session.id);
    const updatedSession = await query('SELECT * FROM ai_sessions WHERE id = $1', [session.id]);

    res.json({
      sessionId: session.id,
      status: updatedSession.rows[0].status,
      messages: updatedMessages,
      finalReportDocumentId,
      proposedUpdates,
      agentOutputs: newAgentOutputs || undefined,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/session', authenticate, requireRole('Superadmin', 'Editor'), async (req, res, next) => {
  try {
    const dealId = parseDealId(req.params.id);
    if (!dealId) return res.status(400).json({ error: 'Invalid deal id' });

    const session = await query('SELECT * FROM ai_sessions WHERE deal_id = $1 ORDER BY id DESC LIMIT 1', [dealId]);
    if (session.rows.length === 0) {
      return res.json({ session: null, messages: [] });
    }

    const messages = await getSessionMessages(session.rows[0].id);
    const outputs = await getAgentOutputs(session.rows[0].id);

    res.json({
      session: session.rows[0],
      messages,
      agentOutputs: outputs,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/chat', authenticate, requireRole('Superadmin', 'Editor'), async (req, res, next) => {
  try {
    const dealId = parseDealId(req.params.id);
    if (!dealId) return res.status(400).json({ error: 'Invalid deal id' });

    const messages = await getChatMessages(dealId);
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

router.post('/chat', authenticate, requireRole('Superadmin', 'Editor'), async (req, res, next) => {
  try {
    await ensureDefaultAgents();
    const dealId = parseDealId(req.params.id);
    if (!dealId) return res.status(400).json({ error: 'Invalid deal id' });

    const { content } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const data = await getDealWithDocs(dealId);
    if (!data) return res.status(404).json({ error: 'Deal not found' });

    const dealContext = formatDealForChat(data.deal);
    const docContext = await buildChatContext(dealId, data.documents);

    await addChatMessage(dealId, 'user', content);
    const history = await getChatMessages(dealId);

    const messages = [
      {
        role: 'user',
        content: [
          '## Deal metadata',
          dealContext,
          '## Document context',
          docContext,
          '## Conversation history',
          ...history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`),
          `User: ${content}`,
        ].join('\n\n'),
      },
    ];

    const response = await callAgent('chat-agent', messages);
    await addChatMessage(dealId, 'agent', response);
    const updatedHistory = await getChatMessages(dealId);

    res.json({ messages: updatedHistory });
  } catch (err) {
    next(err);
  }
});

function formatDealForChat(deal) {
  return [
    `- Name: ${deal.name || 'Untitled'}`,
    `- Status: ${deal.status || 'N/A'}`,
    `- Due Date: ${deal.due_date || 'N/A'}`,
    `- Budget: ${deal.budget || 'N/A'}`,
    `- Domain: ${deal.domain || 'N/A'}`,
    `- Client: ${deal.client_name || 'N/A'}`,
    `- Classification: ${deal.classification || 'N/A'}`,
    `- Description: ${deal.description || 'N/A'}`,
  ].join('\n');
}

export default router;
