import { Resvg } from '@resvg/resvg-js';

export const PALETTE = Object.freeze({
  background: '#FFFFFF',
  ink: '#111111',
  secondary: '#3D3D3D',
  muted: '#777777',
  line: '#9E9E9E',
  border: '#D8D8D8',
  panel: '#F7F7F5',
  yellow: '#FFDB00',
  paleYellow: '#FFF6C8',
  white: '#FFFFFF',
});

export function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function wrapText(value, maxCharacters = 28, maxLines = 3) {
  const words = String(value ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharacters || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  const consumed = lines.join(' ').split(/\s+/).length;
  if (consumed < words.length && lines.length > 0) {
    const last = lines.length - 1;
    lines[last] = `${lines[last].replace(/[.…]+$/, '')}…`;
  }
  return lines;
}

export function renderTextLines(lines, x, y, {
  size = 16,
  weight = 500,
  fill = PALETTE.ink,
  lineHeight = Math.round(size * 1.25),
  anchor = 'start',
} = {}) {
  return lines.map((line, index) => (
    `<text x="${x}" y="${y + index * lineHeight}" text-anchor="${anchor}" `
    + `font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">`
    + `${escapeXml(line)}</text>`
  )).join('');
}

export function renderSvgDocument({ width, height, title, body, background = PALETTE.background }) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<title>${escapeXml(title)}</title>`,
    '<defs>',
    '<filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">',
    '<feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#111111" flood-opacity="0.10"/>',
    '</filter>',
    '<marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">',
    `<path d="M0,0 L10,5 L0,10 Z" fill="${PALETTE.secondary}"/>`,
    '</marker>',
    '</defs>',
    `<rect width="100%" height="100%" fill="${background}"/>`,
    body,
    '</svg>',
  ].join('');
}

export function rasterizeSvg(svg, width, height) {
  const renderer = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: PALETTE.background,
  });
  const png = renderer.render().asPng();
  return { png, svg, width, height };
}

export function assertSafeId(value, label) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`${label} must be a non-empty string`);
  return normalized;
}

export function indexById(items, label) {
  const index = new Map();
  for (const item of items) {
    const id = assertSafeId(item?.id, `${label}.id`);
    if (index.has(id)) throw new Error(`Duplicate ${label} id '${id}'`);
    index.set(id, item);
  }
  return index;
}

