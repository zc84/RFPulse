import { generateOpenAIImageArtifact } from './aiOrchestrator.js';

const DIAGRAM_FENCE_REGEX = /```mermaid\s*\n([\s\S]*?)```/gi;
const DIAGRAM_SENTINEL = '@@RFPULSE-DIAGRAM@@';

function detectDiagramLabel(source, index) {
  const firstDirective = String(source || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line && !line.startsWith('%%'));

  if (!firstDirective) return `Diagram ${index}`;
  if (/^(flowchart|graph)\b/i.test(firstDirective)) return `Workflow Diagram ${index}`;
  if (/^gantt\b/i.test(firstDirective)) return `Timeline Diagram ${index}`;
  if (/^sequenceDiagram\b/i.test(firstDirective)) return `Sequence Diagram ${index}`;
  if (/^erDiagram\b/i.test(firstDirective)) return `ER Diagram ${index}`;
  return `Diagram ${index}`;
}

function buildInlineDiagramPrompt(source, title) {
  return [
    'You are generating a clean enterprise diagram as a single PNG image.',
    'Use the diagram specification below as the source of truth.',
    'Create a readable, presentation-ready visual that reflects the relationships, stages, and entities described in the specification.',
    'Do not render Mermaid code, syntax annotations, or code fences in the image.',
    'Use a white background, concise labels, balanced spacing, and clear arrows or connectors.',
    'Do not add decorative poster styling or unrelated elements.',
    `Title: ${title}`,
    'Specification:',
    source,
  ].join('\n');
}

export async function renderDiagramBlocksInMarkdown(markdown, signal = null, client = null) {
  const source = String(markdown || '');
  const matches = [...source.matchAll(DIAGRAM_FENCE_REGEX)];
  if (matches.length === 0) {
    return {
      markdown: source,
      diagrams: [],
    };
  }

  const blocks = [];
  let index = 0;
  const transformed = source.replace(DIAGRAM_FENCE_REGEX, (_, diagramSource) => {
    index += 1;
    const key = `diagram-${index}`;
    blocks.push({
      key,
      source: String(diagramSource || '').trim(),
      title: detectDiagramLabel(diagramSource, index),
      description: 'Rendered from diagram source embedded in the proposal draft.',
    });
    return `${DIAGRAM_SENTINEL}${key}`;
  });

  const rendered = [];
  for (const block of blocks) {
    const prompt = buildInlineDiagramPrompt(block.source, block.title);
    const image = await generateOpenAIImageArtifact({
      client,
      prompt,
      title: block.title,
      description: block.description,
      signal,
    });
    rendered.push({
      placeholder: `${DIAGRAM_SENTINEL}${block.key}`,
      title: block.title,
      description: block.description,
      png: image.png,
    });
  }

  return {
    markdown: transformed,
    diagrams: rendered,
  };
}

export { DIAGRAM_SENTINEL as LEGACY_DIAGRAM_SENTINEL };
