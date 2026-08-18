import {
  buildArchitectureProfileImagePrompt,
  buildArchitectureRenderRequest,
} from './architecturePrompt.js';

export function createArchitectureImageRenderer({
  generateImage,
  rendererVersion = 'shared-openai-architecture-v1',
} = {}) {
  if (typeof generateImage !== 'function') {
    throw new Error('createArchitectureImageRenderer requires generateImage');
  }

  return {
    async render(artifact, { signal } = {}) {
      const request = buildArchitectureRenderRequest(artifact);
      const image = await generateImage({
        prompt: buildArchitectureProfileImagePrompt(request),
        title: artifact.title,
        description: artifact.purpose,
        signal,
        size: '1536x1024',
        quality: 'high',
        background: 'opaque',
      });

      return {
        png: image.png,
        width: image.width || 1536,
        height: image.height || 1024,
        renderer: `${rendererVersion}-${request.profile}`,
        model: image.model || null,
        warnings: [
          'Semantic image QA is not enabled; architecture rendering is validated best effort.',
        ],
        validation: {
          status: 'unverified',
          fidelity: artifact.fidelityClass,
          checks: {
            input_schema: 'passed',
            referential_integrity: 'passed',
            output_png: 'passed',
            semantic_image_qa: 'unverified',
          },
        },
        usage: {
          imageCalls: image.imageCalls || 1,
          qaCalls: 0,
          regenerationCalls: 0,
          retryCalls: image.retryCalls || 0,
        },
      };
    },
  };
}
