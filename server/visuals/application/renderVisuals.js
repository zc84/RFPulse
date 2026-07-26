import {
  assertVisualPlanComplexity,
  visualArtifactPlanSchema,
  visualRenderRequestSchema,
} from '../domain/index.js';
import { visualError } from '../domain/errors.js';
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
    warnings: [],
    validation: { status: 'passed' },
  };
}

export function createRenderVisualsUseCase({
  planVisuals,
  planStore,
  overviewRenderer,
  budgetGate = { reserve: async () => {} },
  maxOutputBytes = Number(process.env.ENDPOINT_VISUAL_MAX_OUTPUT_BYTES || 3 * 1024 * 1024),
}) {
  async function renderArtifact(artifact, { signal }) {
    if (artifact.type === 'architecture-overview') {
      await budgetGate.reserve({ plannerCalls: 0, imageCalls: 1 });
      return overviewRenderer.render(artifact, { signal });
    }
    return renderDeterministicVisual(artifact, {
      width: 1800,
      height: artifact.type === 'gantt' ? 720 : 1000,
    });
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
        usage: { planner_calls: request.mode === 'source' ? 1 : 0, image_generation_calls: 0, qa_calls: 0 },
      };
    }

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
          code: 'RENDER_FAILED',
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
        image_generation_calls: plan.artifacts.filter(artifact => artifact.type === 'architecture-overview').length,
        qa_calls: 0,
      },
    };
  };
}
