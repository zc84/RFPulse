import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();
const COLORS = {
  actor: '#E0E7FF', channel: '#DBEAFE', service: '#F8FAFC', data: '#DCFCE7',
  integration: '#FEF3C7', security: '#FCE7F3', operations: '#EDE9FE', step: '#F8FAFC',
};

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
}

function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '-');
}

function iconSvg(key = '') {
  const normalized = key.toLowerCase();
  if (/database|postgres|sql|storage|data/.test(normalized)) return '<ellipse cx="28" cy="23" rx="8" ry="4" fill="none" stroke="white" stroke-width="1.8"/><path d="M20 23v10c0 5 16 5 16 0V23M20 28c0 5 16 5 16 0" fill="none" stroke="white" stroke-width="1.8"/>';
  if (/user|actor|customer/.test(normalized)) return '<circle cx="28" cy="23" r="4" fill="none" stroke="white" stroke-width="1.8"/><path d="M20 35c1-6 15-6 16 0" fill="none" stroke="white" stroke-width="1.8"/>';
  if (/cloud|aws|azure|gcp/.test(normalized)) return '<path d="M20 33h16a5 5 0 0 0 0-10 8 8 0 0 0-15-1 6 6 0 0 0-1 11z" fill="none" stroke="white" stroke-width="1.8"/>';
  if (/security|shield|auth|identity/.test(normalized)) return '<path d="M28 19l8 3v6c0 6-4 9-8 11-4-2-8-5-8-11v-6z" fill="none" stroke="white" stroke-width="1.8"/>';
  if (/queue|event|async|stream/.test(normalized)) return '<path d="M20 22h16M20 28h12M20 34h16" stroke="white" stroke-width="2" stroke-linecap="round"/>';
  return '<path d="M21 21h14v14H21zM24 25h8M24 29h8M24 33h5" fill="none" stroke="white" stroke-width="1.6"/>';
}

export async function renderArchitectureDiagram(diagram) {
  const ids = new Set(diagram.nodes.map(node => node.id));
  if (ids.size !== diagram.nodes.length) throw new Error('Diagram node ids must be unique');
  const groupIds = new Set((diagram.groups || []).map(group => group.id));
  for (const node of diagram.nodes) {
    if (node.groupId && !groupIds.has(node.groupId)) throw new Error(`Diagram node references an unknown group: ${node.groupId}`);
  }
  for (const edge of diagram.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) throw new Error(`Diagram edge references an unknown node: ${edge.source} -> ${edge.target}`);
  }
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': diagram.direction,
      'elk.spacing.nodeNode': '44',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.padding': '[top=70,left=50,bottom=50,right=50]',
    },
    children: diagram.nodes.map(node => ({ id: node.id, width: 220, height: 92, data: node })),
    edges: diagram.edges.map((edge, index) => ({ id: `e${index}`, sources: [edge.source], targets: [edge.target], data: edge })),
  };
  const layout = await elk.layout(graph);
  const width = Math.ceil(layout.width || 1200);
  const height = Math.ceil(layout.height || 700);
  const marker = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748B"/></marker><filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity=".12"/></filter></defs>`;
  const groupRects = (diagram.groups || []).map(group => {
    const members = (layout.children || []).filter(node => node.data.groupId === group.id);
    if (!members.length) return '';
    const minX = Math.min(...members.map(node => node.x)) - 20;
    const minY = Math.min(...members.map(node => node.y)) - 34;
    const maxX = Math.max(...members.map(node => node.x + node.width)) + 20;
    const maxY = Math.max(...members.map(node => node.y + node.height)) + 20;
    return `<g><rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" rx="16" fill="#F8FAFC" fill-opacity=".75" stroke="#CBD5E1" stroke-dasharray="5 4"/><text x="${minX + 14}" y="${minY + 21}" font-size="12" font-weight="700" fill="#475569">${esc(group.label)}</text></g>`;
  }).join('');
  const edges = (layout.edges || []).map(edge => {
    const section = edge.sections?.[0];
    if (!section) return '';
    const points = [section.startPoint, ...(section.bendPoints || []), section.endPoint];
    const d = points.map((point, i) => `${i ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
    const dashed = edge.data.interaction === 'async' || edge.data.interaction === 'event' ? ' stroke-dasharray="8 6"' : '';
    const mid = points[Math.floor(points.length / 2)];
    return `<g><path d="${d}" fill="none" stroke="#64748B" stroke-width="2"${dashed} marker-end="url(#arrow)"/>${edge.data.label ? `<text x="${mid.x}" y="${mid.y - 8}" text-anchor="middle" font-size="12" fill="#475569">${esc(edge.data.label)}</text>` : ''}</g>`;
  }).join('');
  const nodes = (layout.children || []).map(node => {
    const data = node.data;
    const fill = COLORS[data.kind] || COLORS.service;
    return `<g id="${safeId(data.id)}" transform="translate(${node.x},${node.y})" filter="url(#shadow)"><rect width="${node.width}" height="${node.height}" rx="12" fill="${fill}" stroke="#94A3B8"/><circle cx="28" cy="28" r="14" fill="#4F46E5"/>${iconSvg(data.icon || data.kind)}<text x="52" y="25" font-size="15" font-weight="700" fill="#0F172A">${esc(data.label)}</text><text x="52" y="45" font-size="12" fill="#4F46E5">${esc(data.technology)}</text><text x="16" y="70" font-size="11" fill="#475569">${esc(data.purpose).slice(0, 92)}</text></g>`;
  }).join('');
  const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc" viewBox="0 0 ${width} ${height}"><title id="title">${esc(diagram.title)}</title><desc id="desc">${esc(diagram.description)}</desc>${marker}<rect width="100%" height="100%" fill="#FFFFFF"/><text x="36" y="36" font-family="Inter,Arial,sans-serif" font-size="24" font-weight="700" fill="#0F172A">${esc(diagram.title)}</text><g font-family="Inter,Arial,sans-serif">${groupRects}${edges}${nodes}</g><text x="${width - 24}" y="${height - 18}" text-anchor="end" font-family="Inter,Arial,sans-serif" font-size="10" fill="#94A3B8">Solid: synchronous/data · Dashed: asynchronous/event</text></svg>`;
  if (/<script|foreignObject|(?:href|src)=["']https?:/i.test(svg)) throw new Error('Unsafe SVG content generated');
  return svg;
}

export async function renderArchitectureDiagrams(result) {
  return Promise.all(result.diagrams.map(async diagram => ({ ...diagram, svg: await renderArchitectureDiagram(diagram) })));
}
