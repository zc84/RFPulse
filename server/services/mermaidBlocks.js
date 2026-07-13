import { renderMermaidToPng } from './mermaidRenderer.js';

const MERMAID_FENCE_REGEX = /```mermaid\s*\n([\s\S]*?)```/gi;
const MERMAID_SENTINEL = '@@RFPULSE-MERMAID@@';

function detectDiagramLabel(source, index) {
  const firstDirective = String(source || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line && !line.startsWith('%%'));

  if (!firstDirective) return `Mermaid Diagram ${index}`;
  if (/^(flowchart|graph)\b/i.test(firstDirective)) return `WBS Diagram ${index}`;
  if (/^gantt\b/i.test(firstDirective)) return `Gantt Diagram ${index}`;
  if (/^sequenceDiagram\b/i.test(firstDirective)) return `Sequence Diagram ${index}`;
  if (/^erDiagram\b/i.test(firstDirective)) return `ER Diagram ${index}`;
  return `Mermaid Diagram ${index}`;
}

export async function renderMermaidBlocksInMarkdown(markdown) {
  const source = String(markdown || '');
  const matches = [...source.matchAll(MERMAID_FENCE_REGEX)];
  if (matches.length === 0) {
    return {
      markdown: source,
      diagrams: [],
    };
  }

  const diagrams = [];
  let index = 0;
  const transformed = source.replace(MERMAID_FENCE_REGEX, (_, mermaidSource) => {
    index += 1;
    const key = `mermaid-${index}`;
    diagrams.push({
      key,
      source: String(mermaidSource || '').trim(),
      title: detectDiagramLabel(mermaidSource, index),
      description: 'Rendered from Mermaid source embedded in the proposal draft.',
    });
    return `${MERMAID_SENTINEL}${key}`;
  });

  const rendered = [];
  for (const diagram of diagrams) {
    const { png } = await renderMermaidToPng(diagram.source);
    rendered.push({
      placeholder: `${MERMAID_SENTINEL}${diagram.key}`,
      title: diagram.title,
      description: diagram.description,
      png,
    });
  }

  return {
    markdown: transformed,
    diagrams: rendered,
  };
}
