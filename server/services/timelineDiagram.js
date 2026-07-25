import { generateOpenAIImageArtifact } from './aiOrchestrator.js';

const TIMELINE_SECTION_PATTERN = /^\s*#{1,6}\s+.*\b(timeline|implementation plan|delivery plan|roadmap|project schedule|schedule)\b.*$/i;
const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;
const PHASE_LINE_PATTERN = /\bphase\s+([ivx]+|\d+)\b/i;
const DURATION_PATTERN = /(\d+(?:\.\d+)?)\s*(day|days|week|weeks|month|months)\b/gi;

function cleanInline(text = '') {
  return String(text)
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[`*_>#~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDurationMatches(line) {
  return [...String(line || '').matchAll(new RegExp(DURATION_PATTERN.source, 'gi'))];
}

function durationToWeeks(durationMatches) {
  let totalWeeks = 0;
  for (const [, value, unit] of durationMatches) {
    const amount = Number(value);
    const normalized = String(unit || '').toLowerCase();
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (normalized.startsWith('day')) totalWeeks += amount / 5;
    else if (normalized.startsWith('week')) totalWeeks += amount;
    else if (normalized.startsWith('month')) totalWeeks += amount * 4;
  }
  return totalWeeks;
}

function extractTimelinePhases(sectionLines) {
  const phases = [];
  const seen = new Set();

  for (const raw of sectionLines) {
    const line = String(raw || '').trim();
    if (!line || line.startsWith('|')) continue;
    const phaseMatch = PHASE_LINE_PATTERN.exec(line);
    const durations = extractDurationMatches(line);
    if (!phaseMatch || durations.length === 0) continue;

    const cleaned = cleanInline(line.replace(/^[-*]\s+/, ''));
    const name = cleaned.includes(':') ? cleaned.split(':', 1)[0].trim() : phaseMatch[0].replace(/\s+/g, ' ');
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const rawWeeks = durationToWeeks(durations);
    if (rawWeeks <= 0) continue;

    phases.push({
      name,
      durationLabel: durations.map(([, value, unit]) => `${value} ${unit}`).join(', '),
      weeks: Math.max(1, Math.ceil(rawWeeks)),
    });
  }

  return phases;
}

export function extractTimelinePhasesFromMarkdown(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const heading = HEADING_PATTERN.exec(lines[i].trim());
    if (!heading || !TIMELINE_SECTION_PATTERN.test(lines[i].trim())) continue;

    const currentLevel = heading[1].length;
    let j = i + 1;
    while (j < lines.length) {
      const nextHeading = HEADING_PATTERN.exec(lines[j].trim());
      if (nextHeading && nextHeading[1].length <= currentLevel) break;
      j += 1;
    }

    const phases = extractTimelinePhases(lines.slice(i + 1, j));
    if (phases.length >= 2) {
      return {
        title: cleanInline(heading[2] || '') || 'Delivery Timeline',
        phases,
      };
    }
  }

  return null;
}

export function buildTimelineDiagramImagePrompt({ title = 'Delivery Timeline', phases = [] }) {
  const normalizedTitle = cleanInline(title) || 'Delivery Timeline';
  const phaseLines = phases.map((phase, index) => {
    const label = cleanInline(phase.name || `Phase ${index + 1}`);
    const duration = cleanInline(phase.durationLabel || `${phase.weeks || 1} weeks`);
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
