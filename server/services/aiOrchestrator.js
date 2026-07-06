import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { query } from '../db.js';
import { DEFAULT_PROMPT_TEMPLATES, getDefaultAgents } from './aiPrompts.js';
import {
  buildEstimatorReportSummary,
  coordinatorDecisionSchema,
  dealPropertiesSchema,
  estimatorResultSchema,
  parseEstimatorOutput,
} from './aiSchemas.js';

const DEFAULT_AGENT_SLUGS = ['coordinator', 'legal', 'architect', 'estimator', 'copywriter', 'frontend-dev'];
const REQUIRED_SPECIALIST_SLUGS = ['legal', 'architect', 'estimator'];

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
  const conversationText = formatConversation(conversation);
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
      maxTokens: 16384,
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
        maxTokens: 16384,
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
  const priorityInstructions = String(options.priorityInstructions || '').trim();
  const systemPrompt = priorityInstructions
      ? [
        baseSystemPrompt,
        '# DEAL AI NOTES',
        '<deal_ai_notes>',
        priorityInstructions,
        '</deal_ai_notes>',
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
      const response = await client.chat.completions.create(params, options.signal ? { signal: options.signal } : undefined);
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
  signal = null
) {
  throwIfAborted(signal);
  const agent = await loadAgentConfig('coordinator');
  if (!agent) throw new Error('Coordinator agent not found');

  const outputsSummary = formatAgentOutputs(agentOutputs);
  const conversationText = formatConversation(conversation);
  const hasAgentOutputs = agentOutputs && Object.keys(agentOutputs).length > 0;
  const hasRequiredOutputs = REQUIRED_SPECIALIST_SLUGS.every(slug => Boolean(agentOutputs?.[slug]));
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
  const coordinatorContext = existingCoordinatorContext || compactCoordinatorSourceContext(contextBundle);

  const messages = [
    {
      role: 'user',
      content: [
        priorityInstructions ? `## High Priority AI Notes\n${priorityInstructions}` : '',
        coordinatorContext ? '## Coordinator context summary' : '## Deal context',
        coordinatorContext || contextBundle,
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
      maxTokens: 1200,
      signal: timeoutController.signal,
    });
    const validated = parseAgentJson(raw, 'Coordinator', coordinatorDecisionSchema);
    const forcedRouting = shouldForceCoordinatorRouting(validated, contextBundle);
    const normalized = (validated.status === 'routing' || forcedRouting)
      ? { ...validated, status: 'routing', questions: null, plan: REQUIRED_SPECIALIST_SLUGS }
      : { ...validated, plan: null };

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

export function buildSpecialistMessages(context, priorOutputs = {}) {
  const outputsSummary = formatAgentOutputs(priorOutputs);
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
    maxTokens: slug === 'architect' ? 32768 : slug === 'copywriter' ? 16384 : 8192,
    signal,
  });
}

export async function buildEstimatorBrief(context, conversation, agentOutputs, priorityInstructions = '', signal = null) {
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

  return await callAgent('coordinator', messages, {
    taskPromptKey: 'coordinator.estimator-brief',
    priorityInstructions,
    maxTokens: 4096,
    allowPartialOnLength: true,
    partialNote: 'The estimator brief reached the output limit and was capped. Estimator should flag any missing details as assumptions.',
    signal,
  });
}

export async function runEstimator(context, conversation, priorityInstructions = '', signal = null) {
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
  return JSON.stringify(parseAgentJson(raw, 'Estimator', estimatorResultSchema), null, 2);
}

export async function buildRoleBrief(role, sourceContext, conversation, priorityInstructions = '', signal = null) {
  const conversationText = formatConversation(conversation);
  return callAgent('coordinator', [{
    role: 'user',
    content: `## Extracted source context\n${sourceContext}\n\n## Conversation\n${conversationText || 'No conversation yet.'}`,
  }], {
    taskPromptKey: role === 'legal' ? 'coordinator.legal-brief' : 'coordinator.architect-brief',
    priorityInstructions,
    maxTokens: 16384,
    signal,
  });
}

function appendArchitectureDiagramPrompt(report) {
  const prompt = [
    '## Architecture Diagram Prompt',
    'Use the assessment report above as the source of truth and generate client-ready PNG diagrams for the solution architecture.',
    'Use the exact tech stack named in the assessment report. Do not substitute a generic stack, an authority-approved provider, or a different implementation just because it has a nicer icon set.',
    'Produce 1 to 5 diagrams as appropriate: an overview, a component or context view, a workflow or sequence view, an integration or data-flow view, and a deployment or trust-boundary view when relevant.',
    'Each diagram should contain only elements grounded in the report: actors, channels, services, data stores, external systems, environments, and security boundaries.',
    'Use small, tech-stack-native icons where relevant for services, platforms, databases, cloud components, and infrastructure layers.',
    'If a technology does not have a native icon, use a neutral label or simple glyph instead of an unrelated icon.',
    'Keep labels concise, typography legible, spacing balanced, and the overall style professional and presentation-ready.',
    'Export each diagram as a separate PNG file.',
  ].join('\n\n');

  return `${report.trim()}\n\n${prompt}`;
}

function buildArchitectureDiagramImagePrompt(report, variant) {
  const base = [
    'You are generating a polished enterprise architecture diagram as a PNG image.',
    'Use the assessment report below as the source of truth.',
    'Use the exact tech stack named in the report. Do not replace it with a generic platform or provider-approved substitute.',
    'Use native icons for the technologies named in the report wherever possible. If a native icon is unavailable, use a simple neutral glyph instead of an unrelated icon.',
    'Style requirements: white background, dark navy headline, subtle rounded cards, dashed trust boundaries, clean arrows, legible labels, spacious layout, and a presentation-ready finish.',
    variant === 'overview'
      ? 'Create an executive overview architecture diagram that shows the main user, security edge, application layer, data/search layer, AI/integration layer, and operations/support boundaries.'
      : 'Create a supporting architecture diagram that shows the main solution components, external systems, and data flows in more detail while remaining clear and compact.',
    'The output should look like a professional solution architecture slide, not a marketing illustration.',
    'Render the diagram as a single landscape PNG.',
    'Assessment report:',
    report.trim(),
  ];
  return base.join('\n\n');
}

function stripArchitectureDiagramPrompt(report) {
  const marker = '\n\n## Architecture Diagram Prompt';
  const idx = report.indexOf(marker);
  return idx >= 0 ? report.slice(0, idx).trim() : report.trim();
}

export async function generateArchitectureDiagramImages(report, signal = null) {
  throwIfAborted(signal);
  const client = await getOpenAIClient();
  const reportBody = stripArchitectureDiagramPrompt(report);
  const images = [];
  const variants = [
    { key: 'overview', title: 'Architecture Overview' },
    { key: 'detail', title: 'Architecture Detail' },
  ];

  for (const variant of variants) {
    throwIfAborted(signal);
    const response = await client.images.generate({
      model: 'gpt-image-2',
      prompt: buildArchitectureDiagramImagePrompt(reportBody, variant.key),
      size: '1536x1024',
      quality: 'high',
      output_format: 'png',
      background: 'opaque',
      n: 1,
    }, signal ? { signal } : undefined);
    const image = response.data?.[0];
    if (!image?.b64_json) {
      throw createAiError(`Image generation for "${variant.title}" returned no PNG output. Please try again.`);
    }
    images.push({
      title: variant.title,
      format: response.output_format || 'png',
      png: Buffer.from(image.b64_json, 'base64'),
      revisedPrompt: image.revised_prompt || null,
    });
  }

  return images;
}

export function buildReportFromOutputs(dealName, coordinatorContext, agentOutputs) {
  let report;
  if (agentOutputs.copywriter) {
    report = agentOutputs.copywriter.trim();
  } else {
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

    report = parts.join('\n');
  }

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

  const requested = new Set(REQUIRED_SPECIALIST_SLUGS);
  const shouldRun = slug => requested.has(slug);

  const briefResults = await Promise.all(['legal', 'architect'].map(async slug => {
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

  const reportInputsReady = REQUIRED_SPECIALIST_SLUGS.every(slug => Boolean(outputs[slug]));
  if (reportInputsReady && !outputs.copywriter) {
    const copywriterContext = [
      dealName ? `## Deal Name\n${dealName}` : '',
      context,
    ].filter(Boolean).join('\n\n');
    const copywriterOutput = await runTrackedStep(
      'copywriter',
      () => runAgent('copywriter', copywriterContext, conversation, {
        legal: outputs.legal,
        architect: outputs.architect,
        estimator: buildEstimatorReportSummary(outputs.estimator),
      }, priorityInstructions, signal)
    );
    await emitOutput('copywriter', copywriterOutput);
  }

  return outputs;
}

export { DEFAULT_AGENT_SLUGS };
