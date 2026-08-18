import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { query } from '../../db.js';
import {
  generateOpenAIImageArtifact,
  normalizeImageRetryCount,
} from '../../diagram-generation/imageArtifactGenerator.js';

function visualProviderError(message, status = 502, code = 'PROVIDER_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.expose = true;
  return error;
}

async function loadConfiguredApiKey() {
  const result = await query('SELECT value FROM global_settings WHERE key = $1', ['openai_api_key']);
  return result.rows[0]?.value || null;
}

export async function createOpenAiVisualProvider({
  client = null,
  apiKeyLoader = loadConfiguredApiKey,
  plannerModel = process.env.ENDPOINT_VISUAL_PLANNER_MODEL || 'gpt-4.1-mini',
  imageModel = process.env.AI_IMAGE_MODEL || 'gpt-image-2',
} = {}) {
  let resolvedClient = client;
  async function getClient() {
    if (resolvedClient) return resolvedClient;
    const apiKey = await apiKeyLoader();
    if (!apiKey) throw visualProviderError('OpenAI API key is not configured', 503, 'PROVIDER_UNAVAILABLE');
    resolvedClient = new OpenAI({ apiKey });
    return resolvedClient;
  }

  return {
    async completeStructured({ schema, schemaName, systemPrompt, userPrompt, signal }) {
      const openai = await getClient();
      const response = await openai.chat.completions.create({
        model: plannerModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        response_format: zodResponseFormat(schema, schemaName),
      }, signal ? { signal } : undefined);
      const choice = response.choices?.[0];
      const content = choice?.message?.content;
      if (!content) throw visualProviderError('Visual planner returned no structured response');
      try {
        return {
          value: schema.parse(JSON.parse(content)),
          usage: response.usage || null,
          model: response.model || plannerModel,
        };
      } catch (error) {
        throw visualProviderError(`Visual planner returned invalid structured output: ${error.message}`);
      }
    },

    async generateImage(options) {
      const openai = await getClient();
      return generateOpenAIImageArtifact({
        ...options,
        client: openai,
        model: imageModel,
        maxRetries: options.maxRetries ?? normalizeImageRetryCount(
          process.env.ENDPOINT_VISUAL_IMAGE_MAX_RETRIES,
          1
        ),
      });
    },
  };
}
