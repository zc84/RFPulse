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

const coordinatorDecisionSchema = coordinatorSchema.omit({ context: true });

const dealPropertiesSchema = z.object({
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  budget: z.number().optional().nullable(),
  clientName: z.string().optional().nullable(),
  description: z.string().max(1200).optional().nullable(),
});

const DEFAULT_AGENT_SLUGS = ['coordinator', 'legal', 'architect', 'estimator', 'copywriter', 'frontend-dev'];

function createAiError(message, status = 502) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  return error;
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

function compactText(text, maxChars) {
  if (!text || text.length <= maxChars) return text || '';
  const headChars = Math.floor(maxChars * 0.7);
  const tailChars = maxChars - headChars;
  return [
    text.slice(0, headChars).trim(),
    `\n[... ${text.length - maxChars} characters omitted from the middle ...]\n`,
    text.slice(-tailChars).trim(),
  ].join('\n');
}

function buildFallbackCoordinatorContext(contextBundle) {
  const maxChars = 50000;
  return [
    '## Coordinator Context',
    '',
    'The AI-generated coordinator summary reached the response limit, so this bounded source context was used instead.',
    'Specialist agents should use the available facts below and explicitly flag any missing details as assumptions.',
    '',
    compactText(contextBundle, maxChars),
  ].join('\n').trim();
}

const COORDINATOR_CONTEXT_PROMPT = `You are the Coordinator, preparing the specialist-agent context for an RFP/Tender assessment.

Create a structured, factual Markdown summary that Legal, Architect, and Estimator agents can use as their sole source of information.

Include these sections when facts are available:
- Opportunity overview
- Client and stakeholders
- Scope and deliverables
- Functional requirements
- Technical and integration requirements
- Security, compliance, legal, and procurement requirements
- Timeline, submission deadline, milestones, and decision criteria
- Budget, commercial terms, assumptions, constraints, and risks
- Explicit submission requirements
- Open questions or missing information

Rules:
- Use only facts from the supplied deal context and conversation.
- Preserve specific dates, numbers, named systems, mandatory requirements, and evaluation criteria.
- Keep the summary concise but complete. Prefer bullets over prose.
- Keep the entire response under 1,800 words. Do not repeat document text verbatim.
- Do not output JSON.`;

const COORDINATOR_DECISION_PROMPT = `You are the Coordinator, an expert RFP/Tender response strategist.

Your job in this step is only to decide the next workflow action.

Output a small JSON object with this exact schema:
{
  "status": "clarifying" | "routing" | "ready_to_write",
  "questions": ["..."],
  "plan": ["legal", "architect", "estimator"],
  "reasoning": "..."
}

Rules:
- Use "clarifying" only when critical information is missing and agents cannot produce a useful assessment.
- Use "routing" when there is enough information to call specialist agents. Include only the plan array.
- Use "ready_to_write" when specialist agent outputs are already present and the final report can be generated.
- Do not include specialist context, report text, Markdown sections, or any long-form content.
- Do not include a "context" field.`;

export async function buildCoordinatorContext(contextBundle, conversation) {
  const conversationText = formatConversation(conversation);
  const messages = [
    {
      role: 'user',
      content: [
        '## Deal context',
        contextBundle,
        '## Conversation so far',
        conversationText || 'No conversation yet.',
      ].filter(Boolean).join('\n\n'),
    },
  ];

  let context;
  try {
    context = await callAgent('coordinator', messages, {
      systemPrompt: COORDINATOR_CONTEXT_PROMPT,
      maxTokens: 8192,
      allowPartialOnLength: true,
      partialNote: 'The coordinator context reached the response limit, so this summary was capped. Continue using the facts above and flag any missing details as assumptions.',
    });
  } catch (err) {
    if (err.message?.includes('response was truncated')) {
      console.warn('Coordinator context generation truncated with no usable content; using bounded source context fallback.');
      context = buildFallbackCoordinatorContext(contextBundle);
    } else {
      throw err;
    }
  }
  if (!context.trim()) {
    throw createAiError('Coordinator returned an empty specialist context. Please try again.');
  }
  return context.trim();
}

export async function callAgent(slug, messages, options = {}) {
  const agent = await loadAgentConfig(slug);
  if (!agent) throw new Error(`Agent ${slug} not found`);
  if (!agent.is_enabled) throw new Error(`Agent ${slug} is disabled`);

  const systemPrompt = options.systemPrompt || agent.system_prompt;

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
    response_format: options.json ? { type: 'json_object' } : undefined,
  };

  const MAX_RETRIES = 6;
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const client = await getOpenAIClient();
      const response = await client.chat.completions.create(params);
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
      if (err.expose) {
        throw err;
      }
      const isStreamError =
        err.message?.includes('stream error') ||
        err.message?.includes('INTERNAL_ERROR') ||
        err.code === 'ERR_HTTP2_STREAM_ERROR';
      const isTransientServerError = isServerError(err);
      if ((isStreamError || isTransientServerError) && attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
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

export async function coordinatorStep(contextBundle, conversation, agentOutputs = {}, existingCoordinatorContext = null) {
  const agent = await loadAgentConfig('coordinator');
  if (!agent) throw new Error('Coordinator agent not found');

  const outputsSummary = formatAgentOutputs(agentOutputs);
  const conversationText = formatConversation(conversation);
  const hasAgentOutputs = agentOutputs && Object.keys(agentOutputs).length > 0;
  const coordinatorContext = existingCoordinatorContext || (!hasAgentOutputs
    ? await buildCoordinatorContext(contextBundle, conversation)
    : null);

  const messages = [
    {
      role: 'user',
      content: [
        coordinatorContext ? '## Coordinator context summary' : '## Deal context',
        coordinatorContext || contextBundle,
        outputsSummary,
        '## Conversation so far',
        conversationText || 'No conversation yet.',
      ].filter(Boolean).join('\n\n'),
    },
  ];

  const raw = await callAgent('coordinator', messages, {
    systemPrompt: COORDINATOR_DECISION_PROMPT,
    json: true,
    maxTokens: 1200,
  });
  const validated = parseAgentJson(raw, 'Coordinator', coordinatorDecisionSchema);

  return {
    ...validated,
    context: coordinatorContext || undefined,
    raw,
  };
}

export async function runAgent(slug, context, conversation, priorOutputs = {}) {
  const outputsSummary = formatAgentOutputs(priorOutputs);
  const conversationText = formatConversation(conversation);
  const outputConstraint = slug === 'copywriter'
    ? 'Keep the report concise and submission-ready. Prioritize a cohesive final assessment under 2,500 words. Preserve key estimates, risks, assumptions, and deliverables; do not paste specialist outputs verbatim.'
    : 'Keep your response under 1,800 words. Prioritize decision-critical findings, tables, estimates, risks, and assumptions. Do not repeat the source context verbatim.';

  const messages = [
    {
      role: 'user',
      content: [
        '## Coordinator context summary',
        context,
        outputsSummary,
        '## Conversation so far',
        conversationText || 'No conversation yet.',
        '## Output constraint',
        outputConstraint,
      ].filter(Boolean).join('\n\n'),
    },
  ];

  try {
    return await callAgent(slug, messages, {
      maxTokens: 8192,
      allowPartialOnLength: true,
      partialNote: `The ${slug} agent response reached the output limit and was capped. Treat missing details as assumptions or manual review items.`,
    });
  } catch (err) {
    if (err.message?.includes('response was truncated')) {
      return [
        `## ${slug} Output Unavailable`,
        '',
        `The ${slug} agent reached the response limit before returning usable content.`,
        'Proceed with the available coordinator context and other specialist outputs, and treat this area as requiring manual review.',
      ].join('\n');
    }
    throw err;
  }
}

const ESTIMATOR_BRIEF_PROMPT = `You are the Coordinator preparing an estimation brief.

You receive the original coordinator context plus Legal and Architect outputs. Create a focused Markdown brief for the Estimator.

Include:
- Final scope to estimate
- Architecture-driven work packages
- Legal/compliance-driven work packages
- Assumptions and exclusions
- Dependencies and sequencing
- Delivery phases and milestone constraints
- Risks that should affect contingency
- Open questions that could change the estimate

Rules:
- Use only the provided context and specialist outputs.
- Be specific enough for a granular WBS and team estimate.
- Keep the brief under 1,500 words.
- Do not output JSON.`;

export async function buildEstimatorBrief(context, conversation, agentOutputs) {
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
    systemPrompt: ESTIMATOR_BRIEF_PROMPT,
    maxTokens: 4096,
    allowPartialOnLength: true,
    partialNote: 'The estimator brief reached the output limit and was capped. Estimator should flag any missing details as assumptions.',
  });
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
  if (agentOutputs.copywriter) {
    return agentOutputs.copywriter.trim();
  }

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

  let reviewSection;
  try {
    reviewSection = await callAgent('coordinator', messages, {
      systemPrompt: REPORT_REVIEW_PROMPT,
      maxTokens: 4096,
      allowPartialOnLength: true,
      partialNote: 'The coordinator review reached the output limit and was capped. Review any missing submission requirements manually.',
    });
  } catch (err) {
    console.error('Coordinator review failed; saving report with fallback review:', err);
    reviewSection = [
      '## Coordinator Review',
      '',
      '**Confidence Win Score:** Not available',
      '',
      '**Score Explanation:** The assessment report was generated, but the automated Coordinator review could not complete because the AI review request failed. Review the report manually against the original RFP before submission.',
      '',
      '### Findings & Gaps',
      '- Automated review unavailable. Manually verify submission requirements, assumptions, compliance gaps, and estimate completeness.',
      '',
      '### Submission Requirements',
      'Automated extraction unavailable. Review the original RFP/Tender documents for explicit submission requirements.',
    ].join('\n');
  }

  // Inject the review section after the first heading line, before the rest of the report.
  const titleLineEnd = draftReport.indexOf('\n');
  if (titleLineEnd === -1) return reviewSection + '\n\n' + draftReport;
  const titleLine = draftReport.slice(0, titleLineEnd);
  const reportBody = draftReport.slice(titleLineEnd);
  return titleLine + '\n\n' + reviewSection.trim() + '\n' + reportBody;
}

const DEAL_PROPERTIES_EXTRACTION_PROMPT = `You are a deal-data extraction assistant. You receive the full extracted context of an RFP/tender (deal description plus text from uploaded documents). Your job is to read the context and extract the following deal properties, if they are explicitly stated or strongly implied.

## Properties to extract
1. **dueDate** — The submission deadline or proposal due date. Format as YYYY-MM-DD. Return null if not found or ambiguous.
2. **budget** — The total budget or contract value in numeric USD (e.g. 850000). Return null if not found or ambiguous.
3. **clientName** — The client/organization name issuing the RFP. Return null if not found.
4. **description** — A concise Markdown summary of the deal. Capture the client's core need, scope, and any critical constraint. Use short paragraphs or bullets where useful, but do not include an H1/title. Return null if not enough information is available.

## Output format
Return a JSON object exactly matching this schema:
{
  "dueDate": "YYYY-MM-DD" | null,
  "budget": number | null,
  "clientName": "string" | null,
  "description": "string" | null
}

## Rules
- Only extract facts that are present in the context. Do not invent values.
- For budget, ignore currency symbols and convert to a plain number.
- If a date is relative (e.g. "30 days from now"), return null unless the document explicitly states a calendar date.
- Return description as Markdown text, not HTML.
- Keep description focused: what the client wants, why, and any major constraint.`;

export async function extractDealProperties(contextBundle) {
  const agent = await loadAgentConfig('coordinator');
  if (!agent) throw new Error('Coordinator agent not found');

  const messages = [
    {
      role: 'user',
      content: ['## Extracted deal context', contextBundle].join('\n\n'),
    },
  ];

  const systemPrompt = `${agent.system_prompt}\n\n${DEAL_PROPERTIES_EXTRACTION_PROMPT}`;
  const raw = await callAgent('coordinator', messages, {
    systemPrompt,
    json: true,
    maxTokens: 1000,
  });
  const validated = parseAgentJson(raw, 'Deal property extractor', dealPropertiesSchema);
  return validated;
}

export async function runAgentPlan(context, conversation, plan, dealName = null, onOutput = null) {
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

  const requested = new Set((plan || []).filter(slug => DEFAULT_AGENT_SLUGS.includes(slug)));
  const shouldRun = slug => requested.size === 0 || requested.has(slug);

  const parallelSpecialists = ['legal', 'architect'].filter(shouldRun);
  const parallelResults = await Promise.all(
    parallelSpecialists
      .filter(slug => !outputs[slug])
      .map(async slug => [slug, await runTrackedStep(slug, () => runAgent(slug, context, conversation))])
  );
  for (const [slug, output] of parallelResults) {
    await emitOutput(slug, output);
  }

  if (shouldRun('estimator')) {
    if (!outputs['estimator-brief']) {
      const estimatorBrief = await runTrackedStep('estimator-brief', () => buildEstimatorBrief(context, conversation, outputs));
      await emitOutput('estimator-brief', estimatorBrief);
    }
    if (!outputs.estimator) {
      const estimatorOutput = await runTrackedStep('estimator', () => runAgent('estimator', outputs['estimator-brief'], conversation, outputs));
      await emitOutput('estimator', estimatorOutput);
    }
  }

  const reportInputsReady = outputs.legal || outputs.architect || outputs.estimator;
  if (reportInputsReady && !outputs.copywriter) {
    const copywriterContext = [
      dealName ? `## Deal Name\n${dealName}` : '',
      context,
    ].filter(Boolean).join('\n\n');
    const copywriterOutput = await runTrackedStep('copywriter', () => runAgent('copywriter', copywriterContext, conversation, outputs));
    await emitOutput('copywriter', copywriterOutput);
  }

  return outputs;
}

export { DEFAULT_AGENT_SLUGS };
