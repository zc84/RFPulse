import {
  assertVisualPlanComplexity,
  visualArtifactPlanSchema,
  visualRenderRequestSchema,
} from '../domain/index.js';
import { visualError } from '../domain/errors.js';
import {
  normalizeImageRetryCount,
  readPngDimensions,
} from '../../diagram-generation/imageArtifactGenerator.js';
import { renderDeterministicVisual } from '../renderers/rendererRegistry.js';
import {
  ENDPOINT_RENDERER_POLICY_VERSION,
  ENDPOINT_VISUAL_SCHEMA_VERSION,
} from './planVisuals.js';
import { ENDPOINT_VISUAL_PLANNER_PROMPT_VERSION } from '../infrastructure/endpointVisualPlannerPrompt.js';

function planInputFromRenderRequest(request) {
  return {
    mode: 'source',
    source: request.source,
    context: request.context,
    selection: request.selection,
    request: request.request,
  };
}

const ARCHITECTURE_TYPES = new Set([
  'architecture-overview',
  'architecture-details',
  'cloud-architecture',
  'architecture-c4',
]);

function defaultValidation(artifact, rendered) {
  if (rendered.validation) return rendered.validation;
  if (artifact.type === 'gantt' || rendered.renderer?.startsWith('deterministic-')) {
    return {
      status: 'passed',
      fidelity: artifact.fidelityClass,
      checks: {
        input_schema: 'passed',
        referential_integrity: 'passed',
        output_png: 'passed',
      },
    };
  }
  return {
    status: 'unverified',
    fidelity: artifact.fidelityClass,
    checks: {
      input_schema: 'passed',
      referential_integrity: 'passed',
      output_png: 'passed',
      semantic_image_qa: 'unverified',
    },
  };
}

function validateRenderedOutput(rendered, {
  maxArtifactBytes,
  maxPixelArea,
}) {
  if (!Buffer.isBuffer(rendered?.png)) {
    throw visualError('RENDER_OUTPUT_INVALID', 'Renderer returned no PNG buffer.', 502);
  }
  if (rendered.png.length > maxArtifactBytes) {
    throw visualError(
      'ARTIFACT_TOO_LARGE',
      'A rendered artifact exceeds the endpoint artifact-size limit.',
      413,
      { artifactBytes: rendered.png.length, maxArtifactBytes }
    );
  }
  const dimensions = readPngDimensions(rendered.png);
  if (!dimensions.width || !dimensions.height) {
    throw visualError('RENDER_OUTPUT_INVALID', 'Renderer returned invalid PNG output.', 502);
  }
  if (dimensions.width * dimensions.height > maxPixelArea) {
    throw visualError(
      'ARTIFACT_PIXEL_LIMIT_EXCEEDED',
      'A rendered artifact exceeds the endpoint pixel-area limit.',
      413,
      { width: dimensions.width, height: dimensions.height, maxPixelArea }
    );
  }
  return {
    ...rendered,
    width: dimensions.width,
    height: dimensions.height,
  };
}

function serializeArtifact(artifact, rendered) {
  return {
    id: artifact.id,
    type: artifact.type,
    status: 'complete',
    mime_type: 'image/png',
    encoding: 'base64',
    image_base64: rendered.png.toString('base64'),
    width: rendered.width,
    height: rendered.height,
    renderer: rendered.renderer,
    warnings: rendered.warnings || [],
    validation: defaultValidation(artifact, rendered),
  };
}

export function createRenderVisualsUseCase({
  planVisuals,
  planStore,
  architectureRenderer = null,
  overviewRenderer = null,
  budgetGate = { reserve: async () => {} },
  architectureRendererMode = process.env.ENDPOINT_VISUAL_ARCHITECTURE_RENDERER || 'shared',
  maxArtifactBytes = Number(
    process.env.ENDPOINT_VISUAL_MAX_ARTIFACT_BYTES || 3 * 1024 * 1024
  ),
  maxOutputBytes = Number(
    process.env.ENDPOINT_VISUAL_MAX_OUTPUT_BYTES || 6 * 1024 * 1024
  ),
  maxPixelArea = Number(
    process.env.ENDPOINT_VISUAL_MAX_PIXEL_AREA || 3_500_000
  ),
  imageMaxRetries = normalizeImageRetryCount(
    process.env.ENDPOINT_VISUAL_IMAGE_MAX_RETRIES,
    1
  ),
}) {
  const sharedArchitectureRenderer = architectureRenderer || overviewRenderer;
  if (!['shared', 'deterministic'].includes(architectureRendererMode)) {
    throw new Error(`Unsupported architecture renderer mode '${architectureRendererMode}'`);
  }

  async function renderArtifact(artifact, { signal }) {
    if (signal?.aborted) throw signal.reason;
    if (artifact.type === 'gantt') {
      return validateRenderedOutput(renderDeterministicVisual(artifact, {
        width: 1800,
        height: 720,
      }), { maxArtifactBytes, maxPixelArea });
    }
    if (!ARCHITECTURE_TYPES.has(artifact.type)) {
      throw visualError(
        'RENDERER_UNAVAILABLE',
        `No endpoint renderer is available for '${artifact.type}'.`,
        422
      );
    }
    if (
      architectureRendererMode === 'deterministic'
      && artifact.type !== 'architecture-overview'
    ) {
      return validateRenderedOutput(renderDeterministicVisual(artifact, {
        width: 1800,
        height: artifact.type === 'architecture-details' ? 1180 : 1000,
      }), { maxArtifactBytes, maxPixelArea });
    }
    if (!sharedArchitectureRenderer?.render) {
      throw visualError('RENDERER_UNAVAILABLE', 'Shared architecture renderer is unavailable.', 503);
    }
    const rendered = await sharedArchitectureRenderer.render(artifact, { signal });
    return validateRenderedOutput(rendered, { maxArtifactBytes, maxPixelArea });
  }

  return async function renderVisuals(input, { signal, requestId } = {}) {
    const request = visualRenderRequestSchema.parse(input);
    let planResult;
    if (request.mode === 'source') {
      planResult = await planVisuals(planInputFromRenderRequest(request), { signal });
    } else {
      const stored = await planStore.consume(request.plan_token);
      if (
        stored.versions?.schema !== ENDPOINT_VISUAL_SCHEMA_VERSION
        || stored.versions?.prompt !== ENDPOINT_VISUAL_PLANNER_PROMPT_VERSION
        || stored.versions?.rendererPolicy !== ENDPOINT_RENDERER_POLICY_VERSION
      ) {
        throw visualError(
          'PLAN_VERSION_UNSUPPORTED',
          'The plan token was issued for an unsupported schema, prompt, or renderer policy version.',
          409
        );
      }
      planResult = {
        plan: visualArtifactPlanSchema.parse(stored.plan),
        sourceDigest: stored.sourceDigest,
        versions: stored.versions,
        planToken: null,
        expiresAt: stored.expiresAt,
        usage: null,
        estimates: null,
      };
    }

    const plan = planResult.plan;
    assertVisualPlanComplexity(plan);
    if (plan.artifacts.length === 0) {
      return {
        request_id: requestId,
        status: 'complete',
        plan: {
          plan_token: planResult.planToken,
          version: plan.version,
          prompt_version: planResult.versions.prompt,
          source_digest: planResult.sourceDigest,
          renderable: false,
          expires_at: planResult.expiresAt,
          summary: plan.requestSummary,
        },
        artifacts: [],
        errors: [],
        warnings: plan.warnings,
        usage: {
          planner_calls: request.mode === 'source' ? 1 : 0,
          image_generation_calls: 0,
          qa_calls: 0,
          regeneration_calls: 0,
          retry_calls: 0,
        },
      };
    }

    const billableArchitectureArtifacts = architectureRendererMode === 'shared'
      ? plan.artifacts.filter(artifact => ARCHITECTURE_TYPES.has(artifact.type))
      : plan.artifacts.filter(artifact => artifact.type === 'architecture-overview');
    await budgetGate.reserve({
      plannerCalls: 0,
      imageCalls: billableArchitectureArtifacts.length * (
        1 + normalizeImageRetryCount(imageMaxRetries, 1)
      ),
    });

    const settled = await Promise.allSettled(
      plan.artifacts.map(artifact => renderArtifact(artifact, { signal }))
    );
    const artifacts = [];
    const errors = [];
    let outputBytes = 0;
    settled.forEach((result, index) => {
      const artifact = plan.artifacts[index];
      if (result.status === 'fulfilled') {
        outputBytes += result.value.png.length;
        artifacts.push(serializeArtifact(artifact, result.value));
      } else {
        errors.push({
          artifact_id: artifact.id,
          type: artifact.type,
          code: result.reason?.code || 'RENDER_FAILED',
          message: result.reason?.message || 'Artifact rendering failed.',
        });
      }
    });

    if (outputBytes > maxOutputBytes) {
      throw visualError('OUTPUT_TOO_LARGE', 'Rendered artifacts exceed the endpoint output-size limit.', 413, {
        outputBytes,
        maxOutputBytes,
      });
    }
    if (errors.length > 0 && request.render.failure_policy === 'atomic') {
      throw visualError('RENDER_FAILED', 'One or more required artifacts failed to render.', 502, { errors });
    }

    const status = errors.length === 0 ? 'complete' : artifacts.length > 0 ? 'partial' : 'failed';
    const attemptUsage = settled.map(result => (
      result.status === 'fulfilled'
        ? result.value.usage || {}
        : result.reason?.details?.usage || {}
    ));
    return {
      request_id: requestId,
      status,
      plan: {
        plan_token: planResult.planToken,
        version: plan.version,
        prompt_version: planResult.versions.prompt,
        source_digest: planResult.sourceDigest,
        renderable: true,
        expires_at: planResult.expiresAt,
        summary: plan.requestSummary,
        ...(request.include_plan ? { artifact_plan: plan } : {}),
      },
      artifacts,
      errors,
      warnings: plan.warnings,
      usage: {
        planner_calls: request.mode === 'source' ? 1 : 0,
        image_generation_calls: attemptUsage.reduce(
          (sum, usage) => sum + (usage.imageCalls || 0),
          0
        ),
        qa_calls: attemptUsage.reduce((sum, usage) => sum + (usage.qaCalls || 0), 0),
        regeneration_calls: attemptUsage.reduce(
          (sum, usage) => sum + (usage.regenerationCalls || 0),
          0
        ),
        retry_calls: attemptUsage.reduce((sum, usage) => sum + (usage.retryCalls || 0), 0),
      },
    };
  };
}
