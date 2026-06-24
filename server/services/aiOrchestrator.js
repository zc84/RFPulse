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

const DEFAULT_AGENT_SLUGS = ['coordinator', 'legal', 'architect', 'estimator', 'copywriter', 'frontend-dev'];

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
  const client = await getOpenAIClient();
  const agent = await loadAgentConfig(slug);
  if (!agent) throw new Error(`Agent ${slug} not found`);
  if (!agent.is_enabled) throw new Error(`Agent ${slug} is disabled`);

  const response = await client.chat.completions.create({
    model: agent.model,
    messages: [
      { role: 'system', content: agent.system_prompt },
      ...messages,
    ],
    temperature: Number(agent.temperature),
    max_tokens: Number(agent.max_tokens),
    top_p: Number(agent.top_p),
    presence_penalty: Number(agent.presence_penalty),
    frequency_penalty: Number(agent.frequency_penalty),
    response_format: options.json ? { type: 'json_object' } : undefined,
  });

  return response.choices[0].message.content || '';
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

export async function copywriterStep(context, conversation, agentOutputs) {
  const outputsSummary = formatAgentOutputs(agentOutputs);
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

  return await callAgent('copywriter', messages);
}

export async function runAgentPlan(context, conversation, plan) {
  const outputs = {};
  for (const slug of plan) {
    if (!DEFAULT_AGENT_SLUGS.includes(slug)) continue;
    if (slug === 'coordinator' || slug === 'copywriter') continue;
    outputs[slug] = await runAgent(slug, context, conversation, outputs);
  }
  return outputs;
}

export { DEFAULT_AGENT_SLUGS };
