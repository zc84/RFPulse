import { cleanTimelineInline } from './timelineSource.js';

export function buildTimelineDiagramImagePrompt({
  title = 'Delivery Timeline',
  phases = [],
}) {
  const normalizedTitle = cleanTimelineInline(title) || 'Delivery Timeline';
  const phaseLines = phases.map((phase, index) => {
    const label = cleanTimelineInline(phase.name || `Phase ${index + 1}`);
    const duration = cleanTimelineInline(phase.durationLabel || `${phase.weeks || 1} weeks`);
    return `${index + 1}. ${label} - ${duration}`;
  });

  return [
    'You are generating a polished project timeline as a single PNG image.',
    'Use the proposal details below as the source of truth.',
    'Render a clean, readable delivery timeline with sequential phases and approximate durations.',
    'Use a landscape layout, clear bars or milestones, concise labels, and a professional presentation style.',
    'Do not render Mermaid code, Gantt syntax, tables, or calendar strips.',
    'Do not add unrelated architecture elements, icons, or decorative poster styling.',
    `Title: ${normalizedTitle}`,
    'Phases:',
    ...phaseLines,
  ].join('\n');
}
