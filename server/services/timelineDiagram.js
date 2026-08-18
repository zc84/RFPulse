import { generateOpenAIImageArtifact } from './aiOrchestrator.js';
import {
  extractTimelinePhasesFromMarkdown,
} from '../diagram-generation/timelineSource.js';
import {
  buildTimelineDiagramImagePrompt,
} from '../diagram-generation/timelinePrompt.js';

export {
  extractTimelinePhasesFromMarkdown,
  buildTimelineDiagramImagePrompt,
};

export async function buildTimelineDiagramFromMarkdown(markdown, signal = null, client = null) {
  const extracted = extractTimelinePhasesFromMarkdown(markdown);
  if (!extracted) return null;

  const prompt = buildTimelineDiagramImagePrompt(extracted);
  const image = await generateOpenAIImageArtifact({
    client,
    prompt,
    title: extracted.title || 'Delivery Timeline',
    description: 'Delivery timeline rendered with OpenAI Images API from proposal timeline content.',
    signal,
  });

  return {
    ...image,
    prompt,
  };
}
