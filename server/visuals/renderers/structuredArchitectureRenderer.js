import {
  PALETTE,
  escapeXml,
  indexById,
  rasterizeSvg,
  renderSvgDocument,
  renderTextLines,
  wrapText,
} from './svgPrimitives.js';

const HEADER_HEIGHT = 122;
const OUTER_PADDING = 36;
const COLUMN_GAP = 54;
const NODE_GAP = 20;
const NODE_HEIGHT = 112;

function normalizeArchitecturePlan(plan) {
  const { type, content = {} } = plan;
  if (type === 'architecture-details') {
    return {
      nodes: content.components || [],
      boundaries: content.boundaries || [],
      edges: content.relationships || [],
      provider: null,
      level: null,
    };
  }
  if (type === 'cloud-architecture') {
    return {
      nodes: content.resources || [],
      boundaries: content.boundaries || [],
      edges: content.relationships || [],
      provider: content.provider || 'Cloud',
      level: null,
    };
  }
  if (type === 'architecture-c4') {
    return {
      nodes: content.elements || [],
      boundaries: content.boundaries || [],
      edges: content.relationships || [],
      provider: null,
      level: content.level || 'context',
    };
  }
  throw new Error(`Unsupported structured architecture type '${type}'`);
}

function validateReferences({ nodes, boundaries, edges }) {
  const nodeIndex = indexById(nodes, 'node');
  const boundaryIndex = indexById(boundaries, 'boundary');
  for (const boundary of boundaries) {
    if (boundary.parentId && !boundaryIndex.has(boundary.parentId)) {
      throw new Error(`Boundary '${boundary.id}' references unknown parent '${boundary.parentId}'`);
    }
  }
  for (const node of nodes) {
    if (node.boundaryId && !boundaryIndex.has(node.boundaryId)) {
      throw new Error(`Node '${node.id}' references unknown boundary '${node.boundaryId}'`);
    }
  }
  for (const edge of edges) {
    if (!nodeIndex.has(edge.from)) throw new Error(`Relationship references unknown source '${edge.from}'`);
    if (!nodeIndex.has(edge.to)) throw new Error(`Relationship references unknown target '${edge.to}'`);
  }
  return { nodeIndex, boundaryIndex };
}

function buildColumns(data) {
  const boundaryById = new Map(data.boundaries.map(boundary => [boundary.id, boundary]));
  const boundaryLabel = boundary => {
    const parent = boundary.parentId ? boundaryById.get(boundary.parentId) : null;
    return parent ? `${parent.label} › ${boundary.label}` : boundary.label;
  };
  const columns = data.boundaries.map(boundary => ({
    id: boundary.id,
    label: boundaryLabel(boundary),
    kind: boundary.kind || '',
    nodes: data.nodes.filter(node => node.boundaryId === boundary.id),
  }));

  const assigned = new Set(columns.flatMap(column => column.nodes.map(node => node.id)));
  const unassigned = data.nodes.filter(node => !assigned.has(node.id));
  if (unassigned.length > 0 || columns.length === 0) {
    columns.unshift({
      id: '__unassigned__',
      label: data.provider ? `${data.provider} actors and external services` : 'Actors and external systems',
      kind: 'external',
      nodes: unassigned.length > 0 ? unassigned : data.nodes,
    });
  }
  return columns.filter(column => column.nodes.length > 0);
}

function computeLayout(data, requestedWidth, requestedHeight) {
  const columns = buildColumns(data);
  const width = Math.max(1200, Math.min(2400, Number(requestedWidth) || 1800));
  const legendRows = Math.ceil(data.edges.length / 2);
  const legendHeight = Math.max(54, 34 + legendRows * 24);
  const minColumnWidth = 245;
  const contentWidth = width - OUTER_PADDING * 2;
  const columnWidth = Math.max(
    minColumnWidth,
    (contentWidth - COLUMN_GAP * Math.max(0, columns.length - 1)) / Math.max(1, columns.length)
  );
  const requiredHeight = HEADER_HEIGHT + legendHeight + 58
    + Math.max(...columns.map(column => column.nodes.length), 1) * (NODE_HEIGHT + NODE_GAP);
  if (requiredHeight > 2600) {
    throw new Error('Structured architecture exceeds the maximum safe layout height.');
  }
  const height = Math.max(760, Math.min(2600, Math.max(Number(requestedHeight) || 0, requiredHeight)));

  const nodePositions = new Map();
  columns.forEach((column, columnIndex) => {
    const x = OUTER_PADDING + columnIndex * (columnWidth + COLUMN_GAP);
    column.x = x;
    column.y = HEADER_HEIGHT;
    column.width = columnWidth;
    column.height = height - HEADER_HEIGHT - legendHeight;
    const availableHeight = column.height - 58;
    const distributedGap = Math.max(
      NODE_GAP,
      (availableHeight - column.nodes.length * NODE_HEIGHT) / (column.nodes.length + 1)
    );
    column.nodes.forEach((node, nodeIndex) => {
      nodePositions.set(node.id, {
        x: x + 16,
        y: HEADER_HEIGHT + 42 + distributedGap + nodeIndex * (NODE_HEIGHT + distributedGap),
        width: columnWidth - 32,
        height: NODE_HEIGHT,
      });
    });
  });
  return { width, height, columns, nodePositions, legendHeight };
}

function renderHeader(plan, data, width) {
  const title = plan.title || 'Solution architecture';
  const subtitle = [
    plan.purpose,
    data.provider ? `${data.provider} cloud architecture` : '',
    data.level ? `C4 ${data.level} view` : '',
  ].filter(Boolean).join(' · ');
  return [
    `<rect x="0" y="0" width="${width}" height="${HEADER_HEIGHT}" fill="${PALETTE.ink}"/>`,
    `<rect x="${OUTER_PADDING}" y="29" width="54" height="9" rx="4.5" fill="${PALETTE.yellow}"/>`,
    renderTextLines(wrapText(title, 100, 1), OUTER_PADDING, 73, { size: 30, weight: 700, fill: PALETTE.white }),
    renderTextLines(wrapText(subtitle, 110, 1), OUTER_PADDING, 102, { size: 14, fill: '#D5D5D5' }),
  ].join('');
}

function renderColumn(column) {
  return [
    `<rect x="${column.x}" y="${column.y}" width="${column.width}" height="${column.height}" rx="18" fill="${PALETTE.panel}" stroke="${PALETTE.border}" stroke-width="1.5"/>`,
    `<rect x="${column.x}" y="${column.y}" width="${column.width}" height="42" rx="18" fill="${PALETTE.paleYellow}"/>`,
    `<rect x="${column.x}" y="${column.y + 24}" width="${column.width}" height="18" fill="${PALETTE.paleYellow}"/>`,
    renderTextLines(wrapText(column.label, Math.max(18, Math.floor(column.width / 10)), 1), column.x + 16, column.y + 27, {
      size: 14,
      weight: 700,
    }),
  ].join('');
}

function renderNode(node, position, type) {
  const detail = node.technology || node.service || node.resourceType || node.kind || '';
  const description = node.description || '';
  const accent = type === 'cloud-architecture' ? PALETTE.yellow : PALETTE.ink;
  return [
    `<rect x="${position.x}" y="${position.y}" width="${position.width}" height="${position.height}" rx="13" fill="${PALETTE.white}" stroke="${PALETTE.border}" stroke-width="1.5" filter="url(#shadow)"/>`,
    `<rect x="${position.x}" y="${position.y}" width="8" height="${position.height}" rx="4" fill="${accent}"/>`,
    renderTextLines(wrapText(node.label, Math.max(17, Math.floor(position.width / 9)), 2), position.x + 22, position.y + 32, {
      size: 16,
      weight: 700,
      lineHeight: 20,
    }),
    detail
      ? `<rect x="${position.x + 22}" y="${position.y + 62}" width="${Math.min(position.width - 38, Math.max(70, detail.length * 7 + 18))}" height="23" rx="11.5" fill="${PALETTE.paleYellow}"/>`
        + renderTextLines(wrapText(detail, 30, 1), position.x + 32, position.y + 78, { size: 11, weight: 600 })
      : '',
    description
      ? renderTextLines(wrapText(description, Math.max(22, Math.floor(position.width / 8)), 1), position.x + 22, position.y + 101, {
        size: 11,
        fill: PALETTE.muted,
      })
      : '',
    `<text x="${position.x + position.width - 12}" y="${position.y + 19}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="9" fill="${PALETTE.muted}">${escapeXml(node.id)}</text>`,
  ].join('');
}

function edgeAnchors(from, to) {
  if (to.x >= from.x + from.width) {
    return {
      start: { x: from.x + from.width, y: from.y + from.height / 2 },
      end: { x: to.x, y: to.y + to.height / 2 },
    };
  }
  if (from.x >= to.x + to.width) {
    return {
      start: { x: from.x, y: from.y + from.height / 2 },
      end: { x: to.x + to.width, y: to.y + to.height / 2 },
    };
  }
  return {
    start: { x: from.x + from.width / 2, y: from.y + from.height },
    end: { x: to.x + to.width / 2, y: to.y },
  };
}

function renderEdge(edge, nodePositions, index) {
  const from = nodePositions.get(edge.from);
  const to = nodePositions.get(edge.to);
  const { start, end } = edgeAnchors(from, to);
  const midX = (start.x + end.x) / 2;
  const path = `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
  const markerX = midX;
  const markerY = (start.y + end.y) / 2;
  return [
    `<path d="${path}" fill="none" stroke="${PALETTE.secondary}" stroke-width="2" marker-end="url(#arrow)"/>`,
    `<circle cx="${markerX}" cy="${markerY}" r="11" fill="${PALETTE.yellow}" stroke="${PALETTE.ink}" stroke-width="1"/>`,
    renderTextLines([String(index + 1)], markerX, markerY + 4, {
      size: 10,
      weight: 700,
      anchor: 'middle',
    }),
  ].join('');
}

function renderRelationshipLegend(data, layout) {
  const labelById = new Map(data.nodes.map(node => [node.id, node.label]));
  const top = layout.height - layout.legendHeight;
  const columnWidth = (layout.width - OUTER_PADDING * 2 - 28) / 2;
  const items = data.edges.map((edge, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = OUTER_PADDING + column * (columnWidth + 28);
    const y = top + 31 + row * 24;
    const detail = [edge.label, edge.protocol, edge.technology].filter(Boolean).join(' · ');
    const text = `${index + 1}. ${labelById.get(edge.from) || edge.from} → ${labelById.get(edge.to) || edge.to}${detail ? ` — ${detail}` : ''}`;
    return renderTextLines(wrapText(text, Math.max(42, Math.floor(columnWidth / 7)), 1), x, y, {
      size: 11,
      fill: PALETTE.secondary,
    });
  });
  return [
    `<rect x="0" y="${top}" width="${layout.width}" height="${layout.legendHeight}" fill="${PALETTE.white}"/>`,
    `<line x1="${OUTER_PADDING}" y1="${top + 8}" x2="${layout.width - OUTER_PADDING}" y2="${top + 8}" stroke="${PALETTE.border}"/>`,
    ...items,
  ].join('');
}

export function renderStructuredArchitecture(plan, options = {}) {
  const data = normalizeArchitecturePlan(plan);
  if (data.nodes.length === 0) throw new Error(`${plan.type} requires at least one element`);
  validateReferences(data);
  const layout = computeLayout(data, options.width, options.height);
  const body = [
    renderHeader(plan, data, layout.width),
    ...layout.columns.map(renderColumn),
    ...data.edges.map((edge, index) => renderEdge(edge, layout.nodePositions, index)),
    ...data.nodes.map(node => renderNode(node, layout.nodePositions.get(node.id), plan.type)),
    renderRelationshipLegend(data, layout),
  ].join('');
  const svg = renderSvgDocument({
    width: layout.width,
    height: layout.height,
    title: plan.title || plan.type,
    body,
  });
  return {
    ...rasterizeSvg(svg, layout.width, layout.height),
    renderer: `deterministic-${plan.type}-v1`,
  };
}
