import OpenAI from 'openai';
import { z } from 'zod';
import { query } from '../db.js';
import { getDefaultAgents } from './aiPrompts.js';

const coordinatorSchema = z.object({
  status: z.enum(['clarifying', 'routing', 'ready_to_write']),
  questions: z.array(z.string()).optional(),
  plan: z.array(z.string()).optional(),
  reasoning: z.string().optional(),
  context: z.string().optional(),
});

const DEFAULT_AGENT_SLUGS = ['coordinator', 'legal', 'architect', 'estimator', 'frontend-dev'];

export async function getOpenAIKey() {
  const result = await query('SELECT value FROM global_settings WHERE key = $1', ['openai_api_key']);
  return result.rows[0]?.value || null;
}

export async function getOpenAIClient() {
  const apiKey = await getOpenAIKey();
  if (!apiKey) throw new Error('OpenAI API key not configured');
  return new OpenAI({ apiKey });
}

export async function validateOpenAIKey() {
  const apiKey = await getOpenAIKey();
  if (!apiKey) return { valid: false, error: 'OpenAI API key not configured' };

  try {
    const client = new OpenAI({ apiKey });
    await client.models.list({ limit: 1 });
    return { valid: true, error: null };
  } catch (err) {
    return { valid: false, error: err.message || 'Invalid OpenAI API key' };
  }
}

export async function loadAgentConfig(slug) {
  const result = await query('SELECT * FROM agents WHERE slug = $1', [slug]);
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

export async function loadAllAgents() {
  const result = await query('SELECT * FROM agents ORDER BY sort_order, id');
  return result.rows;
}

export async function ensureDefaultAgents() {
  const defaults = getDefaultAgents();
  for (const agent of defaults) {
    const existing = await query('SELECT id FROM agents WHERE slug = $1', [agent.slug]);
    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO agents (slug, name, model, system_prompt, temperature, max_tokens, top_p, presence_penalty, frequency_penalty, is_enabled, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          agent.slug,
          agent.name,
          agent.model,
          agent.system_prompt,
          agent.temperature,
          agent.max_tokens,
          agent.top_p,
          agent.presence_penalty,
          agent.frequency_penalty,
          agent.is_enabled,
          agent.sort_order,
        ]
      );
    }
  }
}

function formatAgentOutputs(agentOutputs) {
  if (!agentOutputs || Object.keys(agentOutputs).length === 0) return '';
  const parts = ['## Agent outputs so far'];
  for (const [slug, content] of Object.entries(agentOutputs)) {
    parts.push(`--- ${slug} ---`);
    parts.push(content);
    parts.push('');
  }
  return parts.join('\n').trim();
}

function formatConversation(messages) {
  if (!messages || messages.length === 0) return '';
  return messages
    .map(m => {
      const label = m.role === 'coordinator' ? 'Coordinator' : m.role === 'agent' ? `Agent:${m.agent_slug || 'unknown'}` : 'User';
      return `${label}: ${m.content}`;
    })
    .join('\n\n');
}

export async function callAgent(slug, messages, options = {}) {
  const agent = await loadAgentConfig(slug);
  if (!agent) throw new Error(`Agent ${slug} not found`);
  if (!agent.is_enabled) throw new Error(`Agent ${slug} is disabled`);

  const systemPrompt = options.systemPrompt || agent.system_prompt;

  const params = {
    model: agent.model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature: Number(agent.temperature),
    max_tokens: Number(agent.max_tokens),
    top_p: Number(agent.top_p),
    presence_penalty: Number(agent.presence_penalty),
    frequency_penalty: Number(agent.frequency_penalty),
    response_format: options.json ? { type: 'json_object' } : undefined,
  };

  const MAX_RETRIES = 3;
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const client = await getOpenAIClient();
      const response = await client.chat.completions.create(params);
      return response.choices[0].message.content || '';
    } catch (err) {
      lastError = err;
      const isStreamError =
        err.message?.includes('stream error') ||
        err.message?.includes('INTERNAL_ERROR') ||
        err.code === 'ERR_HTTP2_STREAM_ERROR';
      if (isStreamError && attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export async function coordinatorStep(contextBundle, conversation, agentOutputs = {}) {
  const agent = await loadAgentConfig('coordinator');
  if (!agent) throw new Error('Coordinator agent not found');

  const outputsSummary = formatAgentOutputs(agentOutputs);
  const conversationText = formatConversation(conversation);

  const systemPrompt = `${agent.system_prompt}\n\nYou must output a JSON object with this exact schema:\n{\n  "status": "clarifying" | "routing" | "ready_to_write",\n  "questions": ["..."],\n  "plan": ["legal", "architect", "estimator"],\n  "reasoning": "...",\n  "context": "A structured, factual summary of the deal that specialist agents will use as their sole source of information."\n}\n\n- Use "clarifying" when you need more information from the user.\n- Use "routing" when you have enough information and want to call specialized agents. Include the plan array and a complete context summary.\n- Use "ready_to_write" when specialized agents have already produced outputs and you want to generate the final report.\n- The context field is required for "routing" and must contain all facts the Legal, Architect, and Estimator agents need to do their jobs.`;

  const messages = [
    {
      role: 'user',
      content: [
        '## Deal context',
        contextBundle,
        outputsSummary,
        '## Conversation so far',
        conversationText || 'No conversation yet.',
      ].filter(Boolean).join('\n\n'),
    },
  ];

  const raw = await callAgent('coordinator', messages, { json: true });
  const parsed = JSON.parse(raw);
  const validated = coordinatorSchema.parse(parsed);

  return {
    ...validated,
    raw,
  };
}

export async function runAgent(slug, context, conversation, priorOutputs = {}) {
  const outputsSummary = formatAgentOutputs(priorOutputs);
  const conversationText = formatConversation(conversation);

  const messages = [
    {
      role: 'user',
      content: [
        '## Coordinator context summary',
        context,
        outputsSummary,
        '## Conversation so far',
        conversationText || 'No conversation yet.',
      ].filter(Boolean).join('\n\n'),
    },
  ];

  return await callAgent(slug, messages);
}

const REPORT_REVIEW_PROMPT = `You are the Coordinator, acting as a senior quality reviewer. You have just written a draft assessment report. Your job is to review the draft against the original deal requirements and identify any gaps, missed points, or inaccuracies.

## Your responsibilities
1. Compare the draft report to the original deal requirements.
2. Identify any requirements, constraints, or evaluation criteria that are not fully addressed.
3. Flag assumptions that should be explicitly stated.
4. Assign a Confidence Win Score (0-100%) that reflects how complete and accurate the report is relative to the source material.
5. Write a concise explanation for the score.

## Output format
Output ONLY the following Markdown block — nothing else, no preamble, no report content:

## Coordinator Review

**Confidence Win Score:** [0-100]%

**Score Explanation:** [2-4 sentences explaining the score based on document completeness, clarity of requirements, and how well the report addresses them]

### Findings & Gaps
- [List any missed requirements, gaps, or assumptions]
- [If no material gaps are found, state: "No material gaps identified. The report appears to address all stated requirements."]

### Submission Requirements

List every item the RFP/Tender explicitly requested the vendor to provide as part of the submission, formatted as a Markdown table:

| # | Item (exact wording from RFP) | Section | Status |
|---|---|---|---|
| 1 | [exact item as written] | [section reference] | Included in this report \| Must be supplied as a separate attachment \| Optional |

If none were explicitly requested, state: "No explicit submission requirements identified beyond the assessment report itself."

## Quality standards
- Be honest and rigorous. Do not inflate the score.
- Cite the specific requirement or document section when flagging a gap.
- Keep findings concise and actionable.
- Always include the Submission Requirements block, even if the list is empty.
- Output ONLY the Coordinator Review block above. Do NOT repeat or include any part of the draft report.`;

export function buildReportFromOutputs(dealName, coordinatorContext, agentOutputs) {
  const AGENT_ORDER = ['legal', 'architect', 'estimator'];
  const parts = [`# Assessment Report: ${dealName || 'Untitled Deal'}`, ''];

  if (coordinatorContext) {
    parts.push('## Deal Context', '', coordinatorContext.trim(), '');
  }

  for (const slug of AGENT_ORDER) {
    if (agentOutputs[slug]) {
      parts.push('---', '', agentOutputs[slug].trim(), '');
    }
  }

  for (const [slug, content] of Object.entries(agentOutputs)) {
    if (!AGENT_ORDER.includes(slug) && content) {
      parts.push('---', '', content.trim(), '');
    }
  }

  return parts.join('\n');
}

export async function coordinatorReviewStep(context, draftReport) {
  const messages = [
    {
      role: 'user',
      content: [
        '## Original deal context',
        context,
        '## Draft assessment report',
        draftReport,
      ].filter(Boolean).join('\n\n'),
    },
  ];

  const reviewSection = await callAgent('coordinator', messages, { systemPrompt: REPORT_REVIEW_PROMPT });

  // Inject the review section after the first heading line, before the rest of the report.
  const titleLineEnd = draftReport.indexOf('\n');
  if (titleLineEnd === -1) return reviewSection + '\n\n' + draftReport;
  const titleLine = draftReport.slice(0, titleLineEnd);
  const reportBody = draftReport.slice(titleLineEnd);
  return titleLine + '\n\n' + reviewSection.trim() + '\n' + reportBody;
}

export async function runAgentPlan(context, conversation, plan) {
  const outputs = {};
  for (const slug of plan) {
    if (!DEFAULT_AGENT_SLUGS.includes(slug)) continue;
    if (slug === 'coordinator') continue;
    outputs[slug] = await runAgent(slug, context, conversation, outputs);
  }
  return outputs;
}

export { DEFAULT_AGENT_SLUGS };
