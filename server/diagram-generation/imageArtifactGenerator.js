import {
  DiagramGenerationError,
  diagramGenerationError,
  isAbortError,
} from './errors.js';

export function readPngDimensions(buffer) {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (
    !Buffer.isBuffer(buffer)
    || buffer.length < 24
    || !buffer.subarray(0, 8).equals(pngSignature)
    || buffer.readUInt32BE(8) !== 13
    || buffer.toString('ascii', 12, 16) !== 'IHDR'
  ) {
    return { width: null, height: null };
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

export function normalizeImageRetryCount(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(2, Math.floor(parsed)));
}

function providerError(error, title, usage) {
  if (isAbortError(error)) return error;
  if (error instanceof DiagramGenerationError) return error;
  const status = Number(error?.status || error?.statusCode) || 502;
  const safeStatus = status >= 400 && status < 600 ? status : 502;
  const transient = safeStatus === 429 || safeStatus >= 500;
  return diagramGenerationError(
    transient ? 'IMAGE_PROVIDER_UNAVAILABLE' : 'IMAGE_PROVIDER_REJECTED',
    transient
      ? `Image generation for "${title || 'diagram'}" is temporarily unavailable.`
      : `Image generation for "${title || 'diagram'}" was rejected by the provider.`,
    transient ? 503 : 422,
    { usage }
  );
}

function isTransientProviderError(error) {
  const status = Number(error?.status || error?.statusCode);
  return status === 429 || status >= 500;
}

function retryDelayMs(error, attempt) {
  const retryAfter = Number(
    error?.headers?.['retry-after']
      || error?.headers?.get?.('retry-after')
      || error?.retryAfter
  );
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(10_000, retryAfter * 1_000);
  }
  return Math.min(5_000, 250 * (2 ** attempt) + Math.floor(Math.random() * 150));
}

async function abortableDelay(milliseconds, signal) {
  if (!signal) {
    await new Promise(resolve => setTimeout(resolve, milliseconds));
    return;
  }
  await new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', abort);
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, milliseconds);
    const abort = () => {
      clearTimeout(timeout);
      cleanup();
      reject(signal.reason || diagramGenerationError(
        'IMAGE_GENERATION_CANCELLED',
        'Image generation was cancelled.',
        499
      ));
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}

export async function generateOpenAIImageArtifact({
  client = null,
  getClient = null,
  prompt,
  title,
  description,
  signal = null,
  model = process.env.AI_IMAGE_MODEL || 'gpt-image-2',
  size = '1536x1024',
  quality = 'high',
  background = 'opaque',
  n = 1,
  maxRetries = 0,
}) {
  if (signal?.aborted) throw signal.reason || diagramGenerationError(
    'IMAGE_GENERATION_CANCELLED',
    'Image generation was cancelled.',
    499
  );
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw diagramGenerationError('IMAGE_PROMPT_INVALID', 'Image generation requires a non-empty prompt.', 500);
  }

  const imageClient = client || (getClient ? await getClient() : null);
  if (!imageClient?.images?.generate) {
    throw diagramGenerationError('IMAGE_PROVIDER_UNAVAILABLE', 'Image provider is not configured.', 503);
  }

  const retryLimit = normalizeImageRetryCount(maxRetries);
  let response;
  let attempt = 0;
  while (attempt <= retryLimit) {
    if (signal?.aborted) throw signal.reason;
    try {
      response = await imageClient.images.generate({
        model,
        prompt,
        size,
        quality,
        output_format: 'png',
        background,
        n,
      }, signal ? { signal } : undefined);
      break;
    } catch (error) {
      const usage = {
        imageCalls: attempt + 1,
        retryCalls: attempt,
      };
      if (!isTransientProviderError(error) || attempt >= retryLimit) {
        throw providerError(error, title, usage);
      }
      await abortableDelay(retryDelayMs(error, attempt), signal);
      attempt += 1;
    }
  }

  const image = response.data?.[0];
  if (!image?.b64_json) {
    throw diagramGenerationError(
      'IMAGE_OUTPUT_MISSING',
      `Image generation for "${title || 'diagram'}" returned no PNG output.`,
      502,
      { usage: { imageCalls: attempt + 1, retryCalls: attempt } }
    );
  }

  const png = Buffer.from(image.b64_json, 'base64');
  const dimensions = readPngDimensions(png);
  if (!dimensions.width || !dimensions.height) {
    throw diagramGenerationError(
      'IMAGE_OUTPUT_INVALID',
      `Image generation for "${title || 'diagram'}" returned invalid PNG output.`,
      502,
      { usage: { imageCalls: attempt + 1, retryCalls: attempt } }
    );
  }

  return {
    title,
    description: description || '',
    format: response.output_format || 'png',
    png,
    width: dimensions.width,
    height: dimensions.height,
    revisedPrompt: image.revised_prompt || null,
    model,
    imageCalls: attempt + 1,
    retryCalls: attempt,
  };
}
