const BRAND_RULES = [
  'Use a white editorial background and Andersen proposal visual language.',
  'Use #111111 for primary text, #3D3D3D for secondary text, #9E9E9E for quiet separators, #FFDB00 for key accents, and #FFF6C8 for subtle highlighted areas.',
  'Use restrained rounded cards, generous whitespace, crisp connectors, and a clear left-to-right hierarchy.',
  'The result must look like a professional proposal artifact, not a poster, illustration, or photorealistic scene.',
  'Do not add any logo, footer branding, side panel, legend, delivery phase, security claim, deployment claim, or explanatory bullet that is not explicitly present in the validated JSON.',
].join(' ');

export function buildOverviewImagePrompt(plan) {
  const content = plan.content || {};
  return [
    'Generate one polished enterprise architecture overview as a PNG image.',
    BRAND_RULES,
    `Title: ${plan.title || 'Solution architecture overview'}.`,
    `Composition purpose (do not render this sentence): ${plan.purpose || 'Explain the proposed solution at a high level'}.`,
    `Audience: ${plan.audience || 'mixed'}.`,
    'The validated JSON below is the complete semantic source of truth.',
    'Render every supplied group, component, and relationship. Preserve supplied labels.',
    'Do not add or infer a technology, component, actor, boundary, label, or relationship.',
    'Use the full canvas only for the supplied architecture. Do not create informational sidebars or additional sections.',
    'Use neutral labeled shapes when an icon is not unambiguous.',
    'Validated architecture overview plan:',
    JSON.stringify(content, null, 2),
  ].join('\n\n');
}

function readPngDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') {
    return { width: null, height: null };
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

export function createOpenAiOverviewRenderer(provider) {
  return {
    async render(plan, options = {}) {
      const image = await provider.generateImage({
        prompt: buildOverviewImagePrompt(plan),
        signal: options.signal,
        size: '1536x1024',
        background: 'opaque',
      });
      const dimensions = readPngDimensions(image.png);
      return {
        png: image.png,
        width: dimensions.width || 1536,
        height: dimensions.height || 1024,
        renderer: 'openai-architecture-overview-v1',
        model: image.model,
        revisedPrompt: image.revisedPrompt,
      };
    },
  };
}
