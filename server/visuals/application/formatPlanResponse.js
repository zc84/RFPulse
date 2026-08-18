export function formatPlanResponse(result, { requestId, includePlan = true } = {}) {
  return {
    request_id: requestId,
    status: 'complete',
    plan: {
      plan_token: result.planToken,
      version: result.plan.version,
      prompt_version: result.versions.prompt,
      model: result.versions.model,
      renderer_policy_version: result.versions.rendererPolicy,
      source_digest: result.sourceDigest,
      renderable: result.policy.renderable,
      expires_at: result.expiresAt,
      summary: result.plan.requestSummary,
      selected_types: result.policy.selectedTypes,
      decisions: result.plan.candidates,
      warnings: result.plan.warnings,
      estimates: {
        planner_calls: result.estimates.plannerCalls,
        image_calls: result.estimates.imageCalls,
        max_image_calls: result.estimates.maxImageCalls ?? result.estimates.imageCalls,
        qa_calls: result.estimates.qaCalls ?? 0,
        deterministic_renders: result.estimates.deterministicRenders,
        latency_band: result.estimates.latencyBand,
        cost_band: result.estimates.costBand,
      },
      ...(includePlan ? { artifact_plan: result.plan } : {}),
    },
    usage: {
      planner: result.usage,
    },
  };
}
