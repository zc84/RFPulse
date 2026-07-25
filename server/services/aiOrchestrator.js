import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { query } from '../db.js';
import { DEFAULT_PROMPT_TEMPLATES, getDefaultAgents } from './aiPrompts.js';
import {
  buildEstimatorReportSummary,
  coordinatorChatArtifactDecisionSchema,
  coordinatorDecisionSchema,
  dealPropertiesSchema,
  estimatorResultSchema,
  isEstimatorAccuracyPolicyError,
  parseEstimatorOutput,
  validateEstimatorResult,
} from './aiSchemas.js';
import { loadEstimationPolicy } from '../ai-runtime/policies/estimationPolicy.js';

const DEFAULT_AGENT_SLUGS = ['coordinator', 'legal', 'architect', 'estimator', 'frontend-dev'];
const REQUIRED_SPECIALIST_SLUGS = ['legal', 'architect', 'estimator'];
const MARKDOWN_HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;
const ARCHITECTURE_SECTION_PATTERNS = [
  /^\s*#{1,6}\s+.*\b(proposed architecture|solution architecture|technical solution|proposed solution|solution overview|architecture)\b.*$/i,
];
const EXCLUDED_ARCHITECTURE_SUBSECTION_PATTERNS = [
  /^\s*#{1,6}\s+.*\b(implementation plan|timeline|delivery plan|roadmap|project schedule|schedule|wbs|work breakdown)\b.*$/i,
];

function createAiError(message, status = 502) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  return error;
}

function createCancellationError(message = 'AI run cancelled.') {
  const error = createAiError(message, 499);
  error.code = 'AI_RUN_CANCELLED';
  error.isCancellation = true;
  return error;
}

function isCancellationError(err) {
  return Boolean(
    err?.isCancellation
      || err?.code === 'AI_RUN_CANCELLED'
      || err?.name === 'AbortError'
      || err?.code === 'ABORT_ERR'
      || err?.status === 499
  );
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  const reason = signal.reason;
  if (reason instanceof Error) throw reason;
  throw createCancellationError();
}

async function abortableDelay(ms, signal) {
  if (!signal) {
    await new Promise(resolve => setTimeout(resolve, ms));
    return;
  }
  await Promise.race([
    new Promise(resolve => setTimeout(resolve, ms)),
    new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason instanceof Error ? signal.reason : createCancellationError()), { once: true });
    }),
  ]);
}

function isServerError(err) {
  return (
    err.status >= 500 ||
    err.message === 'Internal server error' ||
    /^HTTP 5\d\d\b/.test(err.message || '')
  );
}

function describeOpenAIError(err) {
  const statusText = err.status ? `HTTP ${err.status}` : 'request error';
  if (isServerError(err)) {
    return `OpenAI request failed after retries (${statusText}). Please try again in a moment.`;
  }
  return err.message || 'OpenAI request failed.';
}

function isPreviousResponseNotFoundError(err) {
  const code = err?.code || err?.error?.code || err?.details?.code;
  const param = err?.param || err?.error?.param || err?.details?.param;
  const message = String(err?.message || err?.error?.message || err?.details?.message || '');
  return (
    code === 'previous_response_not_found'
    || param === 'previous_response_id'
    || /previous response.+not found/i.test(message)
  );
}

function stripResponseChainParams(params) {
  if (!params || typeof params !== 'object') {
    return { sanitized: params, removedKeys: [] };
  }

  const sanitized = { ...params };
  const responseChainKeys = [
    'previous_response_id',
    'previousResponseId',
    'previous_response',
    'response_id',
  ];
  const removedKeys = [];

  for (const key of responseChainKeys) {
    if (key in sanitized) {
      delete sanitized[key];
      removedKeys.push(key);
    }
  }

  return { sanitized, removedKeys };
}

async function createChatCompletionWithFallback(client, params, signal, slug) {
  const requestOptions = signal ? { signal } : undefined;
  try {
    return await client.chat.completions.create(params, requestOptions);
  } catch (err) {
    if (!isPreviousResponseNotFoundError(err)) {
      throw err;
    }

    const { sanitized, removedKeys } = stripResponseChainParams(params);
    if (removedKeys.length > 0) {
      console.warn('OpenAI previous response id was not found; retrying without response-chain params.', {
        agent: slug,
        removedKeys,
      });
    } else {
      console.warn('OpenAI previous response id was not found; retrying once with the same request.', {
        agent: slug,
      });
    }

    return await client.chat.completions.create(sanitized, requestOptions);
  }
}

function parseAgentJson(raw, label, schema) {
  if (!raw || !raw.trim()) {
    throw createAiError(`${label} returned an empty response instead of JSON. Please try again.`);
  }

  try {
    const parsed = JSON.parse(raw);
    return schema.parse(parsed);
  } catch (err) {
    if (err instanceof SyntaxError) {
      const preview = raw.length > 240 ? `${raw.slice(0, 240)}...` : raw;
      throw createAiError(`${label} returned invalid or incomplete JSON. Preview: ${preview}`);
    }

    if (err.name === 'ZodError') {
      throw createAiError(`${label} returned JSON with an unexpected shape: ${err.message}`);
    }

    throw err;
  }
}

export async function getOpenAIKey() {
  const result = await query('SELECT value FROM global_settings WHERE key = $1', ['openai_api_key']);
  return result.rows[0]?.value || null;
}

export async function getOpenAIClient() {
  const apiKey = await getOpenAIKey();
  if (!apiKey) throw new Error('OpenAI API key not configured');
  return new OpenAI({ apiKey });
}

export async function generateOpenAIImageArtifact({
  client = null,
  prompt,
  title,
  description,
  signal = null,
  model = process.env.AI_IMAGE_MODEL || 'gpt-image-2',
  size = '1536x1024',
  quality = 'high',
  background = 'opaque',
  n = 1,
}) {
  throwIfAborted(signal);
  const imageClient = client || await getOpenAIClient();
  const response = await imageClient.images.generate({
    model,
    prompt,
    size,
    quality,
    output_format: 'png',
    background,
    n,
  }, signal ? { signal } : undefined);
  const image = response.data?.[0];
  if (!image?.b64_json) {
    throw createAiError(`Image generation for "${title || 'diagram'}" returned no PNG output. Please try again.`);
  }
  return {
    title,
    description: description || '',
    format: response.output_format || 'png',
    png: Buffer.from(image.b64_json, 'base64'),
    revisedPrompt: image.revised_prompt || null,
  };
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

export async function listOpenAIModels() {
  const apiKey = await getOpenAIKey();
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const client = new OpenAI({ apiKey });
  const page = await client.models.list();
  return (page.data || [])
    .map(model => ({
      id: model.id,
      created: model.created || null,
      owned_by: model.owned_by || null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
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
    const existing = await query('SELECT id, prompt_version FROM agents WHERE slug = $1', [agent.slug]);
    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO agents (slug, name, model, system_prompt, temperature, max_tokens, top_p, presence_penalty, frequency_penalty, is_enabled, sort_order, prompt_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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
          agent.prompt_version,
        ]
      );
    } else if (Number(existing.rows[0].prompt_version || 1) < agent.prompt_version) {
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
             prompt_version = $11,
             updated_at = CURRENT_TIMESTAMP
         WHERE slug = $12`,
        [
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
          agent.prompt_version,
          agent.slug,
        ]
      );
    }
  }
  await query("DELETE FROM agent_prompt_templates WHERE prompt_key LIKE 'copywriter.%'");
  await query("DELETE FROM agents WHERE slug = 'copywriter'");
  for (const [index, prompt] of DEFAULT_PROMPT_TEMPLATES.entries()) {
    await query(
      `INSERT INTO agent_prompt_templates (prompt_key, agent_slug, name, kind, content, prompt_version, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (prompt_key) DO UPDATE SET
         agent_slug = EXCLUDED.agent_slug,
         name = EXCLUDED.name,
         kind = EXCLUDED.kind,
         content = CASE WHEN agent_prompt_templates.prompt_version < EXCLUDED.prompt_version THEN EXCLUDED.content ELSE agent_prompt_templates.content END,
         prompt_version = GREATEST(agent_prompt_templates.prompt_version, EXCLUDED.prompt_version),
         sort_order = EXCLUDED.sort_order,
         updated_at = CURRENT_TIMESTAMP`,
      [prompt.key, prompt.agent_slug, prompt.name, prompt.kind, prompt.content, prompt.version, index]
    );
  }
}

export async function loadPromptTemplates(agentSlug, taskPromptKey = null) {
  if (taskPromptKey && agentSlug !== 'coordinator') {
    throw new Error(`Task prompt templates are coordinator-only. Received "${taskPromptKey}" for agent ${agentSlug}`);
  }
  const keys = ['shared.source-boundaries', 'shared.multilingual', 'shared.ai-notes'];
  if (taskPromptKey) keys.push(taskPromptKey);
  const result = await query(
    `SELECT * FROM agent_prompt_templates WHERE prompt_key = ANY($1)
     ORDER BY CASE kind WHEN 'shared' THEN 0 ELSE 1 END, sort_order, id`,
    [keys]
  );
  const byKey = new Map(result.rows.map(row => [row.prompt_key, row]));
  for (const key of keys) {
    if (!byKey.has(key)) throw new Error(`Required database prompt template "${key}" is missing`);
  }
  if (taskPromptKey && byKey.get(taskPromptKey).agent_slug !== agentSlug) {
    throw new Error(`Prompt template "${taskPromptKey}" does not belong to agent ${agentSlug}`);
  }
  return keys.map(key => byKey.get(key));
}

function clipText(text, maxChars = Infinity, tail = false) {
  const value = String(text || '');
  if (!Number.isFinite(maxChars) || maxChars <= 0 || value.length <= maxChars) {
    return value;
  }
  if (tail) {
    return `...[trimmed to last ${maxChars} chars]\n${value.slice(-maxChars)}`;
  }
  return `${value.slice(0, maxChars)}\n...[trimmed after ${maxChars} chars]`;
}

function clipTextBalanced(text, maxChars = Infinity) {
  const value = String(text || '');
  if (!Number.isFinite(maxChars) || maxChars <= 0 || value.length <= maxChars) return value;
  const headChars = Math.ceil(maxChars * 0.62);
  const tailChars = Math.max(0, maxChars - headChars);
  return `${value.slice(0, headChars)}\n...[middle omitted to preserve both opening instructions and closing risks/assumptions]...\n${value.slice(-tailChars)}`;
}

function formatAgentOutputs(agentOutputs, maxChars = Infinity) {
  if (!agentOutputs || Object.keys(agentOutputs).length === 0) return '';
  const parts = ['## Agent outputs so far'];
  let length = parts[0].length;
  for (const [slug, content] of Object.entries(agentOutputs)) {
    const section = `--- ${slug} ---\n${String(content || '').trim()}\n`;
    const projected = length + section.length;
    if (Number.isFinite(maxChars) && projected > maxChars) {
      parts.push(`--- ${slug} ---`, clipText(content, Math.max(2000, maxChars - length - 40), true), '');
      parts.push(`...[additional agent outputs trimmed to keep the proposal prompt within limits]`);
      break;
    }
    parts.push(`--- ${slug} ---`);
    parts.push(String(content || '').trim());
    parts.push('');
    length = projected;
  }
  return parts.join('\n').trim();
}

function formatConversation(messages, maxChars = Infinity) {
  if (!messages || messages.length === 0) return '';
  const text = messages
    .map(m => {
      const label = m.role === 'coordinator' ? 'Coordinator' : m.role === 'agent' ? `Agent:${m.agent_slug || 'unknown'}` : 'User';
      return `${label}: ${m.content}`;
    })
    .join('\n\n');
  return clipText(text, maxChars, true);
}

function compactCoordinatorSourceContext(text, maxChars = 16000) {
  if (!text) return '';
  const trimmed = String(text).trim();
  if (trimmed.length <= maxChars) return trimmed;

  const lines = trimmed.split('\n');
  const keepPatterns = [
    /^--- .+ ---$/,
    /^## Page \d+/,
    /^#{1,6}\s+/,
    /^\d+(?:\.\d+)*\s+[A-Z]/,
    /TABLE OF CONTENTS/i,
    /(?:scope|objective|deliverable|submission|deadline|timetable|evaluation|weight|appendix|technical|security|integration|data|workflow|architecture|deployment|pricing|cost|license|support|maintenance|acceptance|sla|audit|question|clarification|mandatory|language|residency|confidentiality|liability|insurance|bond|termination|ip|compliance)/i,
  ];

  const selected = [];
  let selectedLength = 0;
  let lastWasBlank = false;
  for (const line of lines) {
    const value = line.trim();
    if (!value) {
      if (!lastWasBlank && selected.length > 0) selected.push('');
      lastWasBlank = true;
      continue;
    }
    lastWasBlank = false;
    if (keepPatterns.some(pattern => pattern.test(value))) {
      selected.push(value);
      selectedLength += value.length + 1;
      if (selectedLength >= maxChars) break;
    }
  }

  const compacted = selected.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return compacted.slice(0, maxChars).trim();
}

function buildCoordinatorFallbackDecision(contextBundle, existingCoordinatorContext = null, reasoning = null) {
  const context = existingCoordinatorContext || compactCoordinatorSourceContext(contextBundle);
  return {
    status: 'routing',
    questions: null,
    plan: REQUIRED_SPECIALIST_SLUGS,
    reasoning: reasoning || 'Coordinator timed out while preparing the routing decision. Using default specialist routing for the available RFP evidence.',
    context,
    raw: null,
  };
}

function shouldForceCoordinatorRouting(validated, contextBundle) {
  if (!validated || validated.status !== 'clarifying') return false;
  const text = [validated.reasoning, ...(validated.questions || []), contextBundle]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
  const tenderPackGap = /appendix|boq|bill of quantities|technical specifications|delivery schedule|sla|submission|evaluation|pricing rules|commercial terms|legal terms|procurement platform|response format|terms and conditions/.test(text);
  const substantialRfp = /scope|requirements|workflow|architecture|integration|security|compliance|deliverable/.test(text) && String(contextBundle || '').length > 5000;
  return tenderPackGap && substantialRfp;
}

export function splitCoordinatorSourceContext(text, maxChars = 45000) {
  if (!text || text.length <= maxChars) return [text || ''];
  const sections = text.split(/(?=^--- .+ ---$)/gm).filter(Boolean);
  const chunks = [];
  let current = '';
  const append = section => {
    if (current) chunks.push(current.trim());
    current = section;
  };
  for (const section of sections.length > 1 ? sections : [text]) {
    if (section.length > maxChars) {
      if (current) append('');
      for (let offset = 0; offset < section.length; offset += maxChars) {
        chunks.push(section.slice(offset, offset + maxChars).trim());
      }
      current = '';
    } else if (!current || current.length + section.length <= maxChars) {
      current += section;
    } else {
      append(section);
    }
  }
  if (current) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

export async function buildCoordinatorContext(contextBundle, conversation, priorityInstructions = '', signal = null) {
  throwIfAborted(signal);
  const conversationText = formatConversation(conversation, 6000);
  const chunks = splitCoordinatorSourceContext(contextBundle);
  const summaries = [];
  for (let index = 0; index < chunks.length; index++) {
    throwIfAborted(signal);
    const messages = [{
      role: 'user',
      content: [
        `## Deal context — source part ${index + 1} of ${chunks.length}`,
        chunks[index],
        chunks.length === 1 ? '## Conversation so far' : '',
        chunks.length === 1 ? (conversationText || 'No conversation yet.') : '',
      ].filter(Boolean).join('\n\n'),
    }];
    const summary = await callAgent('coordinator', messages, {
      taskPromptKey: 'coordinator.context',
      priorityInstructions,
      maxTokens: 24576,
      allowPartialOnLength: true,
      partialNote: `Coordinator source summary part ${index + 1} reached its output limit.`,
      signal,
    });
    if (!summary.trim()) throw createAiError(`Coordinator returned an empty source summary for part ${index + 1}.`);
    summaries.push(summary.trim());
  }
  const context = summaries.length === 1
    ? summaries[0]
    : await callAgent('coordinator', [{
        role: 'user',
        content: [
          '## Coordinator-produced partial evidence summaries',
          summaries.map((summary, index) => `### Part ${index + 1}\n${summary}`).join('\n\n'),
          '## Conversation so far',
          conversationText || 'No conversation yet.',
        ].join('\n\n'),
      }], {
        taskPromptKey: 'coordinator.context',
        priorityInstructions,
        maxTokens: 24576,
        allowPartialOnLength: true,
        partialNote: 'The consolidated Coordinator summary reached its output limit.',
        signal,
      });
  if (!context.trim()) {
    throw createAiError('Coordinator returned an empty specialist context. Please try again.');
  }
  return context.trim();
}

export function requireCoordinatorContext(context) {
  if (!context || !String(context).trim()) {
    throw createAiError('Coordinator context is required before specialist agents can run.');
  }
  return String(context).trim();
}

export async function callAgent(slug, messages, options = {}) {
  throwIfAborted(options.signal);
  const agent = await loadAgentConfig(slug);
  if (!agent) throw new Error(`Agent ${slug} not found`);
  if (!agent.is_enabled) throw new Error(`Agent ${slug} is disabled`);

  const templates = await loadPromptTemplates(slug, options.taskPromptKey || null);
  const baseSystemPrompt = [agent.system_prompt, ...templates.map(item => `# ${item.name.toUpperCase()}\n${item.content}`)].join('\n\n');
  const priorityInstructions = clipText(String(options.priorityInstructions || '').trim(), 8000, true);
  const systemPrompt = priorityInstructions
    ? [
      '# DEAL AI NOTES',
      '<deal_ai_notes>',
      priorityInstructions,
      '</deal_ai_notes>',
      baseSystemPrompt,
    ].join('\n\n')
    : baseSystemPrompt;
  console.info('Preparing AI agent request', {
    agent: slug,
    hasHighPriorityDealNotes: Boolean(priorityInstructions),
    highPriorityDealNotesLength: priorityInstructions.length,
  });

  let params = {
    model: agent.model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature: Number(agent.temperature),
    max_tokens: options.maxTokens ? Number(options.maxTokens) : Number(agent.max_tokens),
    top_p: Number(agent.top_p),
    presence_penalty: Number(agent.presence_penalty),
    frequency_penalty: Number(agent.frequency_penalty),
    response_format: options.schema
      ? zodResponseFormat(options.schema, options.schemaName || `${slug}_response`)
      : options.json
        ? { type: 'json_object' }
        : undefined,
  };

  const MAX_RETRIES = 6;
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      throwIfAborted(options.signal);
      const client = await getOpenAIClient();
      const response = await createChatCompletionWithFallback(client, params, options.signal, slug);
      const choice = response.choices?.[0];
      if (!choice) {
        throw createAiError(`OpenAI returned no choices for agent ${slug}.`);
      }
      const content = choice.message?.content || '';
      if (choice.finish_reason === 'length') {
        if (options.allowPartialOnLength && content.trim()) {
          const note = options.partialNote || 'This response reached the output limit and was capped. Continue with the available content and treat missing details as assumptions.';
          return `${content.trim()}\n\n## Output Note\n${note}`;
        }
        throw createAiError(`Agent ${slug} response was truncated before completion. Increase max tokens for this agent and try again.`);
      }
      return content;
    } catch (err) {
      lastError = err;
      if (isCancellationError(err)) {
        throw err;
      }
      if (err.expose) {
        throw err;
      }
      const isStreamError =
        err.message?.includes('stream error') ||
        err.message?.includes('INTERNAL_ERROR') ||
        err.code === 'ERR_HTTP2_STREAM_ERROR';
      const isTransientServerError = isServerError(err);
      if ((isStreamError || isTransientServerError) && attempt < MAX_RETRIES) {
        await abortableDelay(1000 * attempt, options.signal);
        continue;
      }
      if (isServerError(err)) {
        throw createAiError(describeOpenAIError(err));
      }
      if (
        (err.code === 'unsupported_parameter' || err.code === 'unsupported_value') &&
        err.param &&
        attempt < MAX_RETRIES
      ) {
        if (err.param === 'max_tokens' && params.max_tokens) {
          params = {
            ...params,
            max_completion_tokens: params.max_tokens,
            max_tokens: undefined,
          };
          continue;
        }

        if (err.param === 'response_format' && options.schema) {
          throw createAiError(`Agent ${slug} does not support the required structured output schema.`);
        }

        if (err.param in params) {
          params = {
            ...params,
            [err.param]: undefined,
          };
          continue;
        }
      }
      throw err;
    }
  }
  throw createAiError(describeOpenAIError(lastError));
}

export async function coordinatorStep(
  contextBundle,
  conversation,
  agentOutputs = {},
  existingCoordinatorContext = null,
  priorityInstructions = '',
  signal = null,
  expectedSpecialists = REQUIRED_SPECIALIST_SLUGS
) {
  throwIfAborted(signal);
  const agent = await loadAgentConfig('coordinator');
  if (!agent) throw new Error('Coordinator agent not found');

  const outputsSummary = formatAgentOutputs(agentOutputs, 5000);
  const conversationText = formatConversation(conversation, 3000);
  const hasAgentOutputs = agentOutputs && Object.keys(agentOutputs).length > 0;
  // Readiness is relative to the specialists this session actually committed to (which may be
  // a subset the Coordinator chose), not always the full set — otherwise a deliberately
  // reduced plan could never reach "ready_to_write" and would loop.
  const expected = [...resolveRequestedSpecialists(expectedSpecialists)];
  const hasRequiredOutputs = expected.every(slug => Boolean(agentOutputs?.[slug]));
  if (hasRequiredOutputs) {
    return {
      status: 'ready_to_write',
      questions: null,
      plan: null,
      reasoning: 'All required specialist outputs are present.',
      context: existingCoordinatorContext || undefined,
      raw: null,
    };
  }
  const coordinatorContext = clipTextBalanced(existingCoordinatorContext || compactCoordinatorSourceContext(contextBundle), 12000);

  const messages = [
    {
      role: 'user',
      content: [
        priorityInstructions ? `## High Priority AI Notes\n${priorityInstructions}` : '',
        coordinatorContext ? '## Coordinator context summary' : '## Deal context',
        coordinatorContext || clipText(contextBundle, 12000, true),
        outputsSummary,
        '## Conversation so far',
        conversationText || 'No conversation yet.',
      ].filter(Boolean).join('\n\n'),
    },
  ];

  const timeoutMs = Number(process.env.AI_COORDINATOR_TIMEOUT_MS || 90000);
  const timeoutController = new AbortController();
  let timeoutTriggered = false;
  const timeout = setTimeout(() => {
    timeoutTriggered = true;
    timeoutController.abort(createCancellationError('Coordinator routing timed out. Using a fallback specialist route.'));
  }, timeoutMs);

  if (signal) {
    if (signal.aborted) {
      timeoutController.abort(signal.reason);
    } else {
      signal.addEventListener('abort', () => timeoutController.abort(signal.reason), { once: true });
    }
  }

  try {
    const raw = await callAgent('coordinator', messages, {
      taskPromptKey: 'coordinator.decision',
      priorityInstructions,
      schema: coordinatorDecisionSchema,
      schemaName: 'coordinator_decision',
      maxTokens: 6144,
      signal: timeoutController.signal,
    });
    const validated = parseAgentJson(raw, 'Coordinator', coordinatorDecisionSchema);
    const forcedRouting = shouldForceCoordinatorRouting(validated, contextBundle);
    let normalized;
    if (forcedRouting) {
      // Safety override: the model tried to stop and clarify on a substantial tender pack.
      // Force the full specialist route rather than trusting a (missing) plan.
      normalized = { ...validated, status: 'routing', questions: null, plan: [...REQUIRED_SPECIALIST_SLUGS] };
    } else if (validated.status === 'routing') {
      // Honor the Coordinator's chosen specialists (normalized/deduped, with dependencies and
      // the all-three fallback applied) instead of silently replacing them with the full set.
      normalized = { ...validated, questions: null, plan: [...resolveRequestedSpecialists(validated.plan)] };
    } else {
      normalized = { ...validated, plan: null };
    }

    return {
      ...normalized,
      context: coordinatorContext || undefined,
      raw,
    };
  } catch (err) {
    if (timeoutTriggered) {
      return buildCoordinatorFallbackDecision(contextBundle, coordinatorContext, 'Coordinator decision exceeded the time limit. Using fallback specialist routing.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function inferDiagramTypesFromIntent(chatIntent = '') {
  const text = String(chatIntent || '').toLowerCase();
  const wantsArchitecture = /\b(architecture|system\s+design|solution\s+design|component|integration|data\s+flow|flowchart)\b/.test(text);
  const wantsTimeline = /\b(timeline|gantt|roadmap|schedule|milestone)\b/.test(text);
  if (wantsArchitecture && wantsTimeline) return ['architecture', 'timeline'];
  if (wantsTimeline) return ['timeline'];
  return ['architecture'];
}

function normalizeChatArtifactDecision(validated, chatIntent = '') {
  if (!validated || typeof validated !== 'object') {
    return {
      action: 'chat_reply',
      diagramTypes: null,
      reasoning: 'Coordinator returned an empty chat artifact decision. Falling back to standard chat reply.',
    };
  }

  if (validated.action !== 'generate_diagrams') {
    return {
      ...validated,
      action: 'chat_reply',
      diagramTypes: null,
    };
  }

  const allowed = new Set(['architecture', 'timeline']);
  const normalizedTypes = Array.isArray(validated.diagramTypes)
    ? validated.diagramTypes.filter(type => allowed.has(type))
    : [];

  return {
    ...validated,
    action: 'generate_diagrams',
    diagramTypes: normalizedTypes.length > 0 ? [...new Set(normalizedTypes)] : inferDiagramTypesFromIntent(chatIntent),
  };
}

export async function coordinatorChatArtifactStep(
  chatIntent,
  conversation,
  routingContext,
  priorityInstructions = '',
  signal = null
) {
  throwIfAborted(signal);

  const conversationText = formatConversation(conversation, 4000);
  const contextText = clipTextBalanced(String(routingContext || ''), 12000);
  const messages = [{
    role: 'user',
    content: [
      '## Chat intent',
      String(chatIntent || '').trim() || 'N/A',
      contextText ? '## Session and artifact context' : '',
      contextText || '',
      '## Conversation so far',
      conversationText || 'No conversation yet.',
    ].filter(Boolean).join('\n\n'),
  }];

  try {
    const raw = await callAgent('coordinator', messages, {
      taskPromptKey: 'coordinator.chat-artifact-routing',
      priorityInstructions,
      schema: coordinatorChatArtifactDecisionSchema,
      schemaName: 'coordinator_chat_artifact_routing',
      maxTokens: 2048,
      signal,
    });
    const validated = parseAgentJson(raw, 'Coordinator (chat artifact routing)', coordinatorChatArtifactDecisionSchema);
    return {
      ...normalizeChatArtifactDecision(validated, chatIntent),
      raw,
    };
  } catch (err) {
    if (isCancellationError(err)) throw err;
    return {
      action: 'chat_reply',
      diagramTypes: null,
      reasoning: `Coordinator chat artifact routing failed: ${err.message || 'unknown error'}`,
      raw: null,
    };
  }
}

export function buildSpecialistMessages(context, priorOutputs = {}) {
  const outputsSummary = formatAgentOutputs(priorOutputs, 8000);
  return [
    {
      role: 'user',
      content: [
        '## Coordinator-approved context',
        context,
        outputsSummary,
      ].filter(Boolean).join('\n\n'),
    },
  ];
}

export async function runAgent(slug, context, conversation, priorOutputs = {}, priorityInstructions = '', signal = null) {
  return await callAgent(slug, buildSpecialistMessages(context, priorOutputs), {
    priorityInstructions,
    maxTokens: slug === 'architect' ? 32768 : 8192,
    signal,
  });
}

export async function buildEstimatorBrief(context, conversation, agentOutputs, priorityInstructions = '', signal = null) {
  const outputsSummary = formatAgentOutputs(agentOutputs, 8000);
  const conversationText = formatConversation(conversation, 6000);
  const messages = [
    {
      role: 'user',
      content: [
        '## Coordinator context summary',
        context,
        outputsSummary,
        '## Required Estimation Basis Pack',
        [
          'Include a dedicated "Estimation Basis Pack" section in your brief with explicit fields:',
          '- scopeCertaintyLevel: low | medium | high',
          '- dependencyCriticality: low | medium | high',
          '- integrationComplexity: low | medium | high (include integration count)',
          '- nonFunctionalLoadAndSecurity: low | medium | high with key drivers',
          '- sourceUncertaintyLevel: low | medium | high',
          'If evidence is missing, set the level conservatively and explain as an assumption.',
        ].join('\n'),
        '## Conversation so far',
        conversationText || 'No conversation yet.',
      ].filter(Boolean).join('\n\n'),
    },
  ];

  return await callAgent('coordinator', messages, {
    taskPromptKey: 'coordinator.estimator-brief',
    priorityInstructions,
    maxTokens: 6144,
    allowPartialOnLength: true,
    partialNote: 'The estimator brief reached the output limit and was capped. Estimator should flag any missing details as assumptions.',
    signal,
  });
}

export function extractEstimatorPolicyContext(brief) {
  const text = String(brief || '');
  const matchLevel = label => {
    const re = new RegExp(`(?:${label})\\s*[:\\-]\\s*(low|medium|high)\\b`, 'i');
    const match = text.match(re);
    const level = match?.[1];
    return typeof level === 'string' ? level.toLowerCase() : null;
  };

  const sourceUncertaintyLevel = matchLevel('sourceUncertaintyLevel|source uncertainty level|scope certainty level');
  const dependencyCriticality = matchLevel('dependencyCriticality|dependency criticality');
  const integrationComplexity = matchLevel('integrationComplexity|integration complexity');
  const nonFunctionalLoadAndSecurity = matchLevel('nonFunctionalLoadAndSecurity|non-functional load and security');

  const highRiskScope = [sourceUncertaintyLevel, dependencyCriticality, integrationComplexity, nonFunctionalLoadAndSecurity]
    .some(level => level === 'high');

  return {
    sourceUncertaintyLevel,
    dependencyCriticality,
    integrationComplexity,
    nonFunctionalLoadAndSecurity,
    highRiskScope,
  };
}

function formatEstimatorViolationsForCorrection(violations) {
  return violations
    .map((violation, index) => `${index + 1}. [${violation.code}] ${violation.message}`)
    .join('\n');
}

export async function applyEstimatorOnePassCorrection(initialValue, options = {}) {
  const policyContext = options.policyContext || {};
  try {
    return {
      value: validateEstimatorResult(initialValue, { policyContext }),
      corrected: false,
      violations: [],
    };
  } catch (err) {
    if (!isEstimatorAccuracyPolicyError(err) || typeof options.requestCorrection !== 'function') {
      throw err;
    }
    const correctedValue = await options.requestCorrection(err.violations);
    return {
      value: validateEstimatorResult(correctedValue, { policyContext }),
      corrected: true,
      violations: err.violations,
    };
  }
}

export async function runEstimator(context, conversation, priorityInstructions = '', signal = null) {
  const estimationPolicy = await loadEstimationPolicy();
  const policyContext = { ...extractEstimatorPolicyContext(context), estimationPolicy };
  const messages = [
    {
      role: 'user',
      content: [
        '## Coordinator estimation brief',
        context,
      ].join('\n\n'),
    },
  ];
  const raw = await callAgent('estimator', messages, {
    priorityInstructions,
    schema: estimatorResultSchema,
    schemaName: 'estimator_result',
    maxTokens: 32768,
    signal,
  });

  const initialParsed = parseAgentJson(raw, 'Estimator', estimatorResultSchema);
  const evaluated = await applyEstimatorOnePassCorrection(initialParsed, {
    policyContext,
    requestCorrection: async violations => {
      const correctionRaw = await callAgent('estimator', [{
        role: 'user',
        content: [
          '## Coordinator estimation brief',
          context,
          '## Accuracy policy violations to fix',
          formatEstimatorViolationsForCorrection(violations),
          'Return a corrected JSON output that resolves all violations while preserving requested scope. Keep any uncertain items in assumptions, risks, and confidence rationale.',
        ].join('\n\n'),
      }], {
        priorityInstructions,
        schema: estimatorResultSchema,
        schemaName: 'estimator_result_correction',
        maxTokens: 32768,
        signal,
      });
      return parseAgentJson(correctionRaw, 'Estimator (correction)', estimatorResultSchema);
    },
  });

  return JSON.stringify(evaluated.value, null, 2);
}

export async function buildRoleBrief(role, sourceContext, conversation, priorityInstructions = '', signal = null) {
  const conversationText = formatConversation(conversation, 5000);
  return callAgent('coordinator', [{
    role: 'user',
    content: `## Extracted source context\n${clipText(sourceContext, 12000, true)}\n\n## Conversation\n${conversationText || 'No conversation yet.'}`,
  }], {
    taskPromptKey: role === 'legal' ? 'coordinator.legal-brief' : 'coordinator.architect-brief',
    priorityInstructions,
    maxTokens: 24576,
    signal,
  });
}

function appendArchitectureDiagramPrompt(report) {
  const prompt = [
    '## Architecture Diagram Prompt',
    'Use the proposal above as the source of truth and generate client-ready PNG diagrams for the solution architecture.',
    'Use the exact tech stack named in the proposal. Do not substitute a generic stack, an authority-approved provider, or a different implementation just because it has a nicer icon set.',
    'Treat WBS content, implementation plans, timelines, schedules, roadmaps, pricing, and effort tables as out of scope for these architecture images.',
    'Produce a concise set of architecture visuals suitable for direct embedding in the final report (typically one primary diagram, optionally one supporting view when strictly necessary).',
    'Each diagram should contain only elements grounded in the report: actors, channels, services, data stores, external systems, environments, and security boundaries.',
    'Use small, tech-stack-native icons where relevant for services, platforms, databases, cloud components, and infrastructure layers.',
    'If a technology does not have a native icon, use a neutral label or simple glyph instead of an unrelated icon.',
    'Keep labels concise, typography legible, spacing balanced, and the overall style professional and presentation-ready.',
    'Do not embed a Gantt chart, delivery plan, WBS table, calendar strip, dates row, or pricing table into the architecture diagrams.',
    'Output PNG image content intended for report embedding (not as standalone client artifact files).',
  ].join('\n\n');

  return `${report.trim()}\n\n${prompt}`;
}

function extractArchitectureDiagramSource(report) {
  const body = stripArchitectureDiagramPrompt(report);
  const lines = body.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const heading = MARKDOWN_HEADING_PATTERN.exec(line);
    if (!heading || !ARCHITECTURE_SECTION_PATTERNS.some(pattern => pattern.test(line))) continue;

    const sectionLevel = heading[1].length;
    let end = i + 1;
    while (end < lines.length) {
      const nextHeading = MARKDOWN_HEADING_PATTERN.exec(lines[end].trim());
      if (nextHeading && nextHeading[1].length <= sectionLevel) break;
      end += 1;
    }

    const kept = [lines[i]];
    let skipSubsectionLevel = null;
    for (let cursor = i + 1; cursor < end; cursor += 1) {
      const currentLine = lines[cursor];
      const currentHeading = MARKDOWN_HEADING_PATTERN.exec(currentLine.trim());

      if (skipSubsectionLevel !== null) {
        if (currentHeading && currentHeading[1].length <= skipSubsectionLevel) {
          skipSubsectionLevel = null;
        } else {
          continue;
        }
      }

      if (currentHeading && EXCLUDED_ARCHITECTURE_SUBSECTION_PATTERNS.some(pattern => pattern.test(currentLine.trim()))) {
        skipSubsectionLevel = currentHeading[1].length;
        continue;
      }

      kept.push(currentLine);
    }

    const extracted = kept.join('\n').trim();
    if (extracted) return extracted;
  }

  return body.trim();
}

function buildArchitectureDiagramImagePrompt(report, variant) {
  const base = [
    'You are generating a polished enterprise architecture diagram as a PNG image.',
    'Use the proposal below as the source of truth.',
    'Use only architecture content from the proposal. Ignore WBS content, implementation plans, delivery timelines, schedules, roadmap lanes, pricing, and effort tables.',
    'Use the exact tech stack named in the proposal. Do not replace it with a generic platform or provider-approved substitute.',
    'Use native icons for the technologies named in the report wherever possible. If a native icon is unavailable, use a simple neutral glyph instead of an unrelated icon.',
    'Style requirements: white background, dark navy headline, subtle rounded cards, dashed trust boundaries, clean arrows, legible labels, spacious layout, and a presentation-ready finish.',
    variant === 'overview'
      ? 'Create an executive overview architecture diagram that shows the main user, security edge, application layer, data/search layer, AI/integration layer, and operations/support boundaries.'
      : 'Create a supporting architecture diagram that shows the main solution components, external systems, and data flows in more detail while remaining clear and compact.',
    'The output should look like a professional solution architecture slide, not a marketing illustration.',
    'Do not generate a title page, cover page, brochure, poster, photorealistic scene, or document mockup.',
    'Avoid large decorative text blocks. Prioritize component boxes, connectors, trust boundaries, and explicit labels.',
    'Do not embed a WBS, Gantt chart, date row, roadmap strip, or tabular schedule into the diagram.',
    'Render the diagram as a single landscape PNG.',
    'Assessment report:',
    clipText(report, 12000, true).trim(),
  ];
  return base.join('\n\n');
}

function stripArchitectureDiagramPrompt(report) {
  const marker = '\n\n## Architecture Diagram Prompt';
  const idx = report.indexOf(marker);
  return idx >= 0 ? report.slice(0, idx).trim() : report.trim();
}

export async function generateArchitectureDiagramImages(report, signal = null, clientOverride = null) {
  const reportBody = clipText(extractArchitectureDiagramSource(report), 12000, true);
  const images = [];
  const variants = [
    {
      key: 'overview',
      title: 'Architecture Diagram',
      description: 'Solution architecture view showing core platform layers, trust boundaries, and primary data and interaction paths.',
    },
  ];

  const client = clientOverride || await getOpenAIClient();
  for (const variant of variants) {
    images.push(await generateOpenAIImageArtifact({
      client,
      prompt: buildArchitectureDiagramImagePrompt(reportBody, variant.key),
      title: variant.title,
      description: variant.description,
      signal,
    }));
  }

  return images;
}

function buildFallbackProposalMarkdown(dealName, coordinatorContext, agentOutputs) {
  const AGENT_ORDER = ['legal', 'architect', 'estimator'];
  const parts = [`# Proposal: ${dealName || 'Untitled Deal'}`, ''];

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

export function buildReportFromOutputs(dealName, coordinatorContext, agentOutputs) {
  return buildFallbackProposalMarkdown(dealName, coordinatorContext, agentOutputs);
}

export async function buildFinalProposalMarkdown(dealName, coordinatorContext, conversation, agentOutputs, priorityInstructions = '', signal = null) {
  const safeCoordinatorContext = clipTextBalanced(coordinatorContext, 9000);
  const safePriorityInstructions = clipText(priorityInstructions, 3000, true);
  const safeOutputsSummary = formatAgentOutputs(agentOutputs, 10000);
  const safeConversation = formatConversation(conversation, 3000);
  const messages = [{
    role: 'user',
    content: [
      dealName ? `## Deal Name\n${dealName}` : '',
      safePriorityInstructions ? `## High Priority AI Notes\n${safePriorityInstructions}` : '',
      coordinatorContext ? '## Coordinator context summary' : '',
      safeCoordinatorContext || '',
      '## Specialist outputs',
      safeOutputsSummary,
      agentOutputs.estimator ? `## Estimator summary\n${clipText(buildEstimatorReportSummary(agentOutputs.estimator), 2000, true)}` : '',
      '## Conversation so far',
      safeConversation || 'No conversation yet.',
    ].filter(Boolean).join('\n\n'),
  }];

  try {
    const raw = await callAgent('coordinator', messages, {
      taskPromptKey: 'coordinator.final-report',
      priorityInstructions,
      maxTokens: 12288,
      signal,
    });
    return raw.trim() || buildFallbackProposalMarkdown(dealName, coordinatorContext, agentOutputs);
  } catch (err) {
    if (isCancellationError(err)) throw err;
    console.error('Coordinator final proposal draft failed; using fallback assembly.', err);
    return buildFallbackProposalMarkdown(dealName, coordinatorContext, agentOutputs);
  }
}

export function buildArchitectureDiagramPromptInput(report) {
  return appendArchitectureDiagramPrompt(report);
}

export async function extractDealProperties(contextBundle, priorityInstructions = '', signal = null) {
  const messages = [
    {
      role: 'user',
      content: ['## Extracted deal context', contextBundle].join('\n\n'),
    },
  ];

  const raw = await callAgent('coordinator', messages, {
    taskPromptKey: 'coordinator.deal-properties',
    priorityInstructions,
    schema: dealPropertiesSchema,
    schemaName: 'deal_properties',
    maxTokens: 1000,
    signal,
  });
  const validated = parseAgentJson(raw, 'Deal property extractor', dealPropertiesSchema);
  return validated;
}

export async function runAgentPlan(
  context,
  conversation,
  plan,
  dealName = null,
  onOutput = null,
  priorityInstructions = '',
  sourceContext = context,
  signal = null
) {
  throwIfAborted(signal);
  const outputs = {};
  if (onOutput?.existingOutputs) {
    Object.assign(outputs, onOutput.existingOutputs);
  }
  const runTrackedStep = async (slug, task) => {
    if (onOutput?.onStepStart) await onOutput.onStepStart(slug);
    try {
      return await task();
    } catch (err) {
      if (onOutput?.onStepFailed) await onOutput.onStepFailed(slug, err);
      throw err;
    }
  };
  const emitOutput = async (slug, output) => {
    outputs[slug] = output;
    if (onOutput) await onOutput(slug, output);
  };

  const requested = resolveRequestedSpecialists(plan);
  const shouldRun = slug => requested.has(slug);

  // Only build evidence briefs for specialists that will actually run — building a brief is a
  // Coordinator LLM call, so skipping unused ones is a direct cost/latency saving.
  const briefResults = await Promise.all(['legal', 'architect'].filter(shouldRun).map(async slug => {
    const key = `${slug}-brief`;
    if (outputs[key]) return [key, outputs[key]];
    const brief = await runTrackedStep(key, () => buildRoleBrief(slug, sourceContext, conversation, priorityInstructions, signal));
    return [key, brief];
  }));
  for (const [slug, output] of briefResults) await emitOutput(slug, output);

  const parallelSpecialists = ['legal', 'architect'].filter(shouldRun);
  const parallelResults = await Promise.all(
    parallelSpecialists
      .filter(slug => !outputs[slug])
      .map(async slug => [
        slug,
        await runTrackedStep(slug, () => runAgent(slug, outputs[`${slug}-brief`], conversation, {}, priorityInstructions, signal)),
      ])
  );
  for (const [slug, output] of parallelResults) {
    await emitOutput(slug, output);
  }

  if (shouldRun('estimator')) {
    if (!outputs['estimator-brief']) {
      const estimatorBrief = await runTrackedStep(
        'estimator-brief',
        () => buildEstimatorBrief(context, conversation, outputs, priorityInstructions, signal)
      );
      await emitOutput('estimator-brief', estimatorBrief);
    }
    if (!outputs.estimator) {
      const estimatorOutput = await runTrackedStep(
        'estimator',
        () => runEstimator(outputs['estimator-brief'], conversation, priorityInstructions, signal)
      );
      parseEstimatorOutput(estimatorOutput);
      await emitOutput('estimator', estimatorOutput);
    }
  }

  return outputs;
}

export function resolveRequestedSpecialists(plan) {
  const valid = Array.isArray(plan)
    ? plan.filter(slug => REQUIRED_SPECIALIST_SLUGS.includes(slug))
    : [];
  // No explicit, valid selection → fall back to the full specialist set. This keeps the
  // safe default (all three) for real tender packs and for legacy callers that pass null.
  if (valid.length === 0) return new Set(REQUIRED_SPECIALIST_SLUGS);
  const chosen = new Set(valid);
  // Dependency: the Estimator sizes a proposed solution, so it can only run when the
  // Architect has produced a design to estimate against.
  if (chosen.has('estimator')) chosen.add('architect');
  // Return in canonical order so downstream sequencing is deterministic regardless of
  // the order the Coordinator listed the specialists.
  return new Set(REQUIRED_SPECIALIST_SLUGS.filter(slug => chosen.has(slug)));
}

export { DEFAULT_AGENT_SLUGS };
