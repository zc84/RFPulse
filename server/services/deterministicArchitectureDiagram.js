import { Resvg } from '@resvg/resvg-js';

const PALETTE = {
  ink: '#111827',
  navy: '#102A56',
  muted: '#526174',
  quiet: '#8A96A8',
  line: '#24364B',
  border: '#B9C4D2',
  panel: '#F8FAFC',
  white: '#FFFFFF',
  yellow: '#FFDB00',
  paleYellow: '#FFF8D6',
  blue: '#1473E6',
  paleBlue: '#EEF6FF',
  purple: '#7557D5',
  palePurple: '#F4F0FF',
  green: '#17805C',
  paleGreen: '#EDFAF4',
  red: '#C43D3D',
  paleRed: '#FFF1F1',
};

const GROUP_THEMES = {
  navy: { accent: PALETTE.navy, fill: '#F5F7FB' },
  blue: { accent: PALETTE.blue, fill: PALETTE.paleBlue },
  purple: { accent: PALETTE.purple, fill: PALETTE.palePurple },
  green: { accent: PALETTE.green, fill: PALETTE.paleGreen },
  yellow: { accent: '#C99F00', fill: PALETTE.paleYellow },
  red: { accent: PALETTE.red, fill: PALETTE.paleRed },
  grey: { accent: '#607086', fill: PALETTE.panel },
};

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function wrapText(value, maxChars = 30, maxLines = 3) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  const consumed = lines.join(' ').split(/\s+/).filter(Boolean).length;
  if (consumed < words.length && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:]?$/, '')}…`;
  }
  return lines;
}

function textLines(lines, x, y, {
  size = 18,
  weight = 400,
  fill = PALETTE.ink,
  lineHeight = size * 1.25,
  anchor = 'start',
  italic = false,
} = {}) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}"${italic ? ' font-style="italic"' : ''}>${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join('')}</text>`;
}

function techAbbreviation(node) {
  if (node.icon_label) return String(node.icon_label).slice(0, 5);
  const tech = String(node.tech || '').toLowerCase();
  const known = {
    user: 'USER',
    nextjs: 'N',
    react: 'RE',
    wordpress: 'WP',
    cloudfront: 'CF',
    aws: 'AWS',
    ecs: 'ECS',
    rds: 'RDS',
    mysql: 'SQL',
    s3: 'S3',
    api: 'API',
    hubspot: 'HS',
    googleanalytics: 'GA4',
    privacy: 'GDPR',
    security: 'SEC',
    approval: '✓',
    search: '⌕',
    monitoring: 'MON',
    backup: 'BKP',
    repository: 'GIT',
    accessibility: 'AA',
    test: 'QA',
    delivery: 'CD',
  };
  return known[tech] || String(node.tech || node.label || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
}

function normalizeLayout(diagram, width, height) {
  const groups = diagram.groups.map((group, index) => {
    if (group.position) {
      return {
        ...group,
        x: finite(group.position.x, 40),
        y: finite(group.position.y, 125),
        width: finite(group.position.width, 320),
        height: finite(group.position.height, 720),
      };
    }
    const available = width - 80;
    const gap = 18;
    const groupWidth = (available - gap * Math.max(0, diagram.groups.length - 1)) / Math.max(1, diagram.groups.length);
    return {
      ...group,
      x: 40 + index * (groupWidth + gap),
      y: 125,
      width: groupWidth,
      height: height - 195,
    };
  });

  const groupByNode = new Map();
  for (const group of groups) {
    for (const nodeId of group.nodes) groupByNode.set(nodeId, group);
  }

  const nodes = diagram.nodes.map(node => {
    if (node.position) {
      return {
        ...node,
        x: finite(node.position.x, 80),
        y: finite(node.position.y, 200),
        width: finite(node.position.width, 240),
        height: finite(node.position.height, 120),
      };
    }
    const group = groupByNode.get(node.id);
    const siblings = diagram.nodes.filter(candidate => groupByNode.get(candidate.id)?.id === group?.id);
    const index = siblings.findIndex(candidate => candidate.id === node.id);
    const cardWidth = Math.max(150, (group?.width || 280) - 34);
    const availableHeight = Math.max(120, (group?.height || 600) - 92);
    const cardHeight = Math.min(150, (availableHeight - 18 * Math.max(0, siblings.length - 1)) / Math.max(1, siblings.length));
    return {
      ...node,
      x: (group?.x || 40) + 17,
      y: (group?.y || 125) + 67 + index * (cardHeight + 18),
      width: cardWidth,
      height: cardHeight,
    };
  });
  return { groups, nodes };
}

function renderGroup(group) {
  const theme = GROUP_THEMES[group.theme] || GROUP_THEMES.grey;
  const dash = group.boundary === 'trust' || group.boundary === 'external' ? ' stroke-dasharray="8 6"' : '';
  const subtitle = group.subtitle
    ? textLines(wrapText(group.subtitle, Math.max(18, Math.floor(group.width / 9)), 2), group.x + group.width / 2, group.y + 49, {
      size: 13,
      fill: PALETTE.muted,
      anchor: 'middle',
      italic: true,
      lineHeight: 15,
    })
    : '';
  return [
    `<rect x="${group.x}" y="${group.y}" width="${group.width}" height="${group.height}" rx="16" fill="${theme.fill}" fill-opacity="0.62" stroke="${theme.accent}" stroke-width="1.5"${dash}/>`,
    `<rect x="${group.x}" y="${group.y}" width="${group.width}" height="8" rx="4" fill="${theme.accent}"/>`,
    textLines([group.label], group.x + group.width / 2, group.y + 31, { size: 18, weight: 700, fill: PALETTE.navy, anchor: 'middle' }),
    subtitle,
  ].join('');
}

function renderNode(node) {
  const theme = GROUP_THEMES[node.theme] || GROUP_THEMES.blue;
  const iconSize = Math.min(50, Math.max(36, node.height - 46));
  const iconX = node.x + 14;
  const iconY = node.y + (node.height - iconSize) / 2;
  const textX = iconX + iconSize + 13;
  const textWidth = node.width - (textX - node.x) - 12;
  const titleSize = node.width < 260 ? 15 : 17;
  const titleLines = wrapText(node.label, Math.max(13, Math.floor(textWidth / 7.2)), 2);
  const subtitleLines = node.subtitle ? wrapText(node.subtitle, Math.max(15, Math.floor(textWidth / 6.8)), 2) : [];
  const details = Array.isArray(node.details) ? node.details.slice(0, 5) : [];
  let cursor = node.y + 31;
  const parts = [
    `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="12" fill="${PALETTE.white}" stroke="${theme.accent}" stroke-width="1.35"/>`,
    `<rect x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="12" fill="${theme.fill}" stroke="${theme.accent}" stroke-width="1.2"/>`,
    textLines([techAbbreviation(node)], iconX + iconSize / 2, iconY + iconSize / 2 + 6, {
      size: techAbbreviation(node).length > 3 ? 13 : 20,
      weight: 800,
      fill: theme.accent,
      anchor: 'middle',
    }),
    textLines(titleLines, textX, cursor, { size: titleSize, weight: 700, fill: PALETTE.ink, lineHeight: 19 }),
  ];
  cursor += titleLines.length * 19 + 3;
  if (subtitleLines.length) {
    parts.push(textLines(subtitleLines, textX, cursor, { size: 13, fill: PALETTE.muted, lineHeight: 16 }));
    cursor += subtitleLines.length * 16 + 5;
  }
  for (const detail of details) {
    if (cursor > node.y + node.height - 12) break;
    const lines = wrapText(detail, Math.max(15, Math.floor(textWidth / 6.5)), 2);
    parts.push(`<circle cx="${textX + 2}" cy="${cursor - 4}" r="2.2" fill="${theme.accent}"/>`);
    parts.push(textLines(lines, textX + 10, cursor, { size: 12, fill: PALETTE.muted, lineHeight: 14 }));
    cursor += lines.length * 14 + 4;
  }
  return parts.join('');
}

function nodeAnchor(node, side) {
  if (side === 'left') return { x: node.x, y: node.y + node.height / 2 };
  if (side === 'right') return { x: node.x + node.width, y: node.y + node.height / 2 };
  if (side === 'top') return { x: node.x + node.width / 2, y: node.y };
  return { x: node.x + node.width / 2, y: node.y + node.height };
}

function edgePath(edge, from, to) {
  const points = Array.isArray(edge.points) && edge.points.length >= 2
    ? edge.points.map(point => ({ x: finite(point.x, 0), y: finite(point.y, 0) }))
    : [
      nodeAnchor(from, edge.from_side || 'right'),
      nodeAnchor(to, edge.to_side || 'left'),
    ];
  return {
    points,
    d: points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' '),
  };
}

function renderEdge(edge, nodeMap, showLabels) {
  const from = nodeMap.get(edge.from);
  const to = nodeMap.get(edge.to);
  if (!from || !to) return '';
  const { points, d } = edgePath(edge, from, to);
  const dashed = edge.style === 'dashed' ? ' stroke-dasharray="8 7"' : '';
  const color = edge.color === 'green' ? PALETTE.green
    : edge.color === 'red' ? PALETTE.red
      : edge.color === 'blue' ? PALETTE.blue
        : PALETTE.line;
  const arrow = edge.bidirectional ? ' marker-start="url(#arrow-start)" marker-end="url(#arrow-end)"' : ' marker-end="url(#arrow-end)"';
  const parts = [`<path d="${d}" fill="none" stroke="${color}" stroke-width="${finite(edge.width, 2.1)}"${dashed}${arrow} stroke-linejoin="round" stroke-linecap="round"/>`];
  if (showLabels && edge.label) {
    const mid = points[Math.floor(points.length / 2)];
    const labelX = finite(edge.label_x, mid.x);
    const labelY = finite(edge.label_y, mid.y - 9);
    const labelWidth = Math.max(52, String(edge.label).length * 7.2 + 18);
    parts.push(`<rect x="${labelX - labelWidth / 2}" y="${labelY - 15}" width="${labelWidth}" height="22" rx="6" fill="${PALETTE.white}" fill-opacity="0.94"/>`);
    parts.push(textLines([edge.label], labelX, labelY, { size: 12, weight: 600, fill: color, anchor: 'middle' }));
  }
  return parts.join('');
}

function renderLegend(diagram, width, height) {
  const legend = Array.isArray(diagram.legend) ? diagram.legend : [];
  if (!legend.length) return '';
  const x = finite(diagram.legend_position?.x, width - 365);
  const y = finite(diagram.legend_position?.y, height - 92);
  const w = finite(diagram.legend_position?.width, 325);
  const h = 28 + legend.length * 20;
  const parts = [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${PALETTE.white}" stroke="${PALETTE.border}"/>`,
    textLines(['Legend'], x + 15, y + 21, { size: 13, weight: 700, fill: PALETTE.navy }),
  ];
  legend.forEach((item, index) => {
    const lineY = y + 41 + index * 20;
    const dash = item.style === 'dashed' ? ' stroke-dasharray="6 5"' : '';
    const color = item.color === 'green' ? PALETTE.green : item.color === 'red' ? PALETTE.red : item.color === 'blue' ? PALETTE.blue : PALETTE.line;
    parts.push(`<line x1="${x + 15}" y1="${lineY - 4}" x2="${x + 65}" y2="${lineY - 4}" stroke="${color}" stroke-width="2"${dash} marker-end="url(#arrow-end)"/>`);
    parts.push(textLines([item.label], x + 78, lineY, { size: 12, fill: PALETTE.muted }));
  });
  return parts.join('');
}

export function renderDeterministicArchitectureDiagram({ diagram, style, render }) {
  const width = Math.max(1024, Math.min(2400, Math.round(finite(render.width, 1536))));
  const height = Math.max(720, Math.min(1600, Math.round(finite(render.height, 1024))));
  const { groups, nodes } = normalizeLayout(diagram, width, height);
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const subtitle = diagram.subtitle
    ? textLines(wrapText(diagram.subtitle, Math.floor((width - 90) / 9), 2), 42, 89, { size: 17, fill: PALETTE.muted, lineHeight: 20 })
    : '';
  const footnote = diagram.footnote
    ? textLines(wrapText(diagram.footnote, Math.floor((width - 450) / 7), 2), 42, height - 28, { size: 12, fill: PALETTE.muted, italic: true, lineHeight: 15 })
    : '';
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<defs>',
    `<marker id="arrow-end" markerWidth="10" markerHeight="10" refX="8" refY="3.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,3.5 L0,7 Z" fill="${PALETTE.line}"/></marker>`,
    `<marker id="arrow-start" markerWidth="10" markerHeight="10" refX="1" refY="3.5" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M8,0 L0,3.5 L8,7 Z" fill="${PALETTE.line}"/></marker>`,
    '</defs>',
    `<rect width="${width}" height="${height}" fill="${render.background === 'brand' ? PALETTE.paleYellow : PALETTE.white}"/>`,
    `<rect x="42" y="25" width="94" height="7" rx="3.5" fill="${PALETTE.yellow}"/>`,
    textLines(wrapText(diagram.title || 'Solution architecture', Math.floor((width - 84) / 17), 2), 42, 67, { size: 30, weight: 800, fill: PALETTE.navy, lineHeight: 34 }),
    subtitle,
    groups.map(renderGroup).join(''),
    diagram.edges.map(edge => renderEdge(edge, nodeMap, style.show_edge_labels !== false)).join(''),
    nodes.map(renderNode).join(''),
    renderLegend(diagram, width, height),
    footnote,
    '</svg>',
  ].join('');

  const png = new Resvg(svg, {
    background: render.background === 'transparent' ? 'rgba(255,255,255,0)' : render.background === 'brand' ? PALETTE.paleYellow : PALETTE.white,
    fitTo: { mode: 'original' },
  }).render().asPng();

  return { png: Buffer.from(png), svg, width, height };
}
