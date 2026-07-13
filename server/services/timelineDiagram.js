import { renderMermaidToPng } from './mermaidRenderer.js';

const TIMELINE_SECTION_PATTERN = /^\s*#{1,6}\s+.*\b(timeline|implementation plan|delivery plan|roadmap|project schedule|schedule)\b.*$/i;
const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;
const PHASE_LINE_PATTERN = /\bphase\s+([ivx]+|\d+)\b/i;
const DURATION_PATTERN = /(\d+(?:\.\d+)?)\s*(day|days|week|weeks|month|months)\b/gi;
const MERMAID_INIT = "%%{init: {'theme':'base','themeVariables':{'primaryColor':'#FFDB00','primaryBorderColor':'#EAB308','primaryTextColor':'#0F172A','lineColor':'#64748B','fontFamily':'Inter, Arial, sans-serif','sectionBkgColor':'#F8FAFC','altSectionBkgColor':'#FFFFFF','gridColor':'#CBD5E1','taskTextColor':'#0F172A','taskBorderColor':'#EAB308','taskBkgColor':'#FFDB00','todayLineColor':'#1D4ED8'}}}%%";
const TIMELINE_START_DATE = '2026-01-05';

function cleanInline(text = '') {
  return String(text)
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[`*_>#~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'phase';
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

export function buildTimelineMermaidScript({ title = 'Delivery Timeline', phases = [] }) {
  const normalizedPhases = phases
    .map((phase, index) => ({
      id: `${slugify(phase.name)}-${index + 1}`,
      name: cleanInline(phase.name || 'Phase'),
      durationLabel: cleanInline(phase.durationLabel || ''),
      weeks: Math.max(1, Math.ceil(Number(phase.weeks) || 1)),
    }))
    .filter(phase => phase.name);

  if (normalizedPhases.length < 2) {
    throw new Error('At least two timeline phases are required to build a Mermaid timeline.');
  }

  const lines = [
    MERMAID_INIT,
    'gantt',
    `  title ${cleanInline(title) || 'Delivery Timeline'}`,
    '  dateFormat YYYY-MM-DD',
    '  axisFormat %b %d',
    '  tickInterval 1week',
    '  excludes weekends',
    '  section Delivery Plan',
  ];

  normalizedPhases.forEach((phase, index) => {
    const taskLabel = cleanInline(`${phase.name} (${phase.durationLabel})`);
    if (index === 0) {
      lines.push(`  ${taskLabel} :${phase.id}, ${TIMELINE_START_DATE}, ${phase.weeks}w`);
    } else {
      lines.push(`  ${taskLabel} :${phase.id}, after ${normalizedPhases[index - 1].id}, ${phase.weeks}w`);
    }
  });

  return lines.join('\n');
}

export async function buildTimelineDiagramFromMarkdown(markdown) {
  const extracted = extractTimelinePhasesFromMarkdown(markdown);
  if (!extracted) return null;

  const mermaid = buildTimelineMermaidScript(extracted);
  const { png, svg } = await renderMermaidToPng(mermaid);

  return {
    title: extracted.title || 'Delivery Timeline',
    description: 'Separate delivery timeline image rendered from a Mermaid script.',
    format: 'png',
    mermaid,
    svg,
    png,
  };
}
