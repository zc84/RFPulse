import {
  PALETTE,
  escapeXml,
  indexById,
  rasterizeSvg,
  renderSvgDocument,
  renderTextLines,
  wrapText,
} from './svgPrimitives.js';
import { renderTechnologyIcon } from './technologyIconRegistry.js';
import { createOrthogonalRouter } from './orthogonalRouter.js';

const ZONE_STYLES = Object.freeze({
  actors: { stroke: '#3B7D3A', fill: '#F6FBF5', accent: '#2F7134' },
  edge: { stroke: '#1769C2', fill: '#F5F9FF', accent: '#1769C2' },
  application: { stroke: '#2E7D32', fill: '#F6FBF6', accent: '#2E7D32' },
  data: { stroke: '#C55A11', fill: '#FFF9F3', accent: '#B64E0B' },
  operations: { stroke: '#1E5BC6', fill: '#F5F8FF', accent: '#1E5BC6' },
});

const FLOW_STYLES = Object.freeze({
  DATA_REQUEST: { label: 'Data / Request Flow', color: '#123F8C', dash: '' },
  AUTH_IDENTITY: { label: 'Auth / Identity Flow', color: '#6B7280', dash: '8 6' },
  INTEGRATION_EXCHANGE: { label: 'Integration / Data Exchange', color: '#20252B', dash: '' },
  DELIVERY_OPERATIONS: { label: 'Delivery / Operations Flow', color: '#1769D2', dash: '8 6' },
});

function validateDetails(content) {
  const nodes = content.components || [];
  const boundaries = content.boundaries || [];
  const edges = content.relationships || [];
  const nodeIndex = indexById(nodes, 'component');
  const boundaryIndex = indexById(boundaries, 'boundary');
  for (const node of nodes) {
    if (node.boundaryId && !boundaryIndex.has(node.boundaryId)) {
      throw new Error(`Component '${node.id}' references unknown boundary '${node.boundaryId}'`);
    }
  }
  for (const edge of edges) {
    if (!nodeIndex.has(edge.from)) throw new Error(`Relationship references unknown source '${edge.from}'`);
    if (!nodeIndex.has(edge.to)) throw new Error(`Relationship references unknown target '${edge.to}'`);
  }
  return { nodes, boundaries, edges, nodeIndex };
}

function zoneKind(boundary) {
  const value = `${boundary.id} ${boundary.label}`.toLowerCase();
  if (/user|actor|content operation/.test(value)) return 'actors';
  if (/edge|experience|channel|frontend/.test(value)) return 'edge';
  if (/delivery|operation|environment|devops|support/.test(value)) return 'operations';
  if (/data|identity|integration|platform service/.test(value)) return 'data';
  return 'application';
}

function buildZones(data, width, height) {
  const outerMargin = 18;
  const gap = 20;
  const usableWidth = width - outerMargin * 2 - gap * 3;
  const actorsWidth = usableWidth * 0.17;
  const edgeWidth = usableWidth * 0.19;
  const applicationWidth = usableWidth * 0.36;
  const dataWidth = usableWidth - actorsWidth - edgeWidth - applicationWidth;
  const edgeX = outerMargin + actorsWidth + gap;
  const applicationX = edgeX + edgeWidth + gap;
  const dataX = applicationX + applicationWidth + gap;
  const definitions = {
    actors: { x: outerMargin, y: 92, width: actorsWidth, height: 770 },
    edge: { x: edgeX, y: 92, width: edgeWidth, height: 770 },
    application: { x: applicationX, y: 92, width: applicationWidth, height: 770 },
    data: { x: dataX, y: 92, width: dataWidth, height: 770 },
    operations: { x: 318, y: 886, width: width - 336, height: height - 904 },
  };
  const zones = new Map(Object.entries(definitions).map(([kind, geometry]) => [
    kind,
    {
      kind,
      ...geometry,
      style: ZONE_STYLES[kind],
      label: '',
      nodes: [],
    },
  ]));
  for (const boundary of data.boundaries) {
    const kind = zoneKind(boundary);
    const zone = zones.get(kind);
    zone.label = zone.label || boundary.label;
    zone.nodes.push(...data.nodes.filter(node => node.boundaryId === boundary.id));
  }
  const assigned = new Set([...zones.values()].flatMap(zone => zone.nodes.map(node => node.id)));
  zones.get('application').nodes.push(...data.nodes.filter(node => !assigned.has(node.id)));
  const defaultLabels = {
    actors: 'Users and content operations',
    edge: 'Edge and digital experience',
    application: 'Application and content services',
    data: 'Data, identity, and integrations',
    operations: 'Delivery, environments, and operations',
  };
  for (const zone of zones.values()) zone.label ||= defaultLabels[zone.kind];
  return zones;
}

function verticalCards(zone, positions) {
  const top = zone.y + 58;
  const available = zone.height - 78;
  // A wider channel lets cross-zone routes pass between stacked cards without
  // taking a distracting detour around the entire zone.
  const gap = 42;
  const count = zone.nodes.length;
  if (count === 0) return;
  const cardHeight = Math.min(245, (available - gap * Math.max(0, count - 1)) / count);
  const used = cardHeight * count + gap * Math.max(0, count - 1);
  const startY = top + Math.max(0, (available - used) / 2);
  for (const [index, node] of zone.nodes.entries()) {
    positions.set(node.id, {
      x: zone.x + 18,
      y: startY + index * (cardHeight + gap),
      width: zone.width - 36,
      height: cardHeight,
      zone,
    });
  }
}

function gridCards(zone, positions) {
  const count = zone.nodes.length;
  if (count === 0) return;
  const columns = count === 1 ? 1 : 2;
  const rows = Math.ceil(count / columns);
  const gapX = 18;
  const gapY = 18;
  const top = zone.y + 58;
  const availableHeight = zone.height - 78;
  const cardWidth = (zone.width - 36 - gapX * (columns - 1)) / columns;
  const cardHeight = Math.min(248, (availableHeight - gapY * (rows - 1)) / rows);
  const usedHeight = cardHeight * rows + gapY * (rows - 1);
  const startY = top + Math.max(0, (availableHeight - usedHeight) / 2);
  zone.nodes.forEach((node, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    positions.set(node.id, {
      x: zone.x + 18 + column * (cardWidth + gapX),
      y: startY + row * (cardHeight + gapY),
      width: cardWidth,
      height: cardHeight,
      zone,
    });
  });
}

function horizontalCards(zone, positions) {
  const count = zone.nodes.length;
  if (count === 0) return;
  const gap = 22;
  const cardWidth = (zone.width - 36 - gap * Math.max(0, count - 1)) / count;
  const cardHeight = Math.min(152, zone.height - 78);
  const y = zone.y + 54 + Math.max(0, (zone.height - 70 - cardHeight) / 2);
  zone.nodes.forEach((node, index) => {
    positions.set(node.id, {
      x: zone.x + 18 + index * (cardWidth + gap),
      y,
      width: cardWidth,
      height: cardHeight,
      zone,
    });
  });
}

function computeLayout(data, requestedWidth, requestedHeight) {
  const width = Math.max(1400, Math.min(2400, Number(requestedWidth) || 1800));
  const height = Math.max(1120, Math.min(1600, Number(requestedHeight) || 1180));
  const zones = buildZones(data, width, height);
  const positions = new Map();
  verticalCards(zones.get('actors'), positions);
  verticalCards(zones.get('edge'), positions);
  gridCards(zones.get('application'), positions);
  verticalCards(zones.get('data'), positions);
  horizontalCards(zones.get('operations'), positions);
  return { width, height, zones, positions };
}

function renderHeader(plan, width) {
  return [
    renderTextLines(wrapText(plan.title || 'Detailed Solution Architecture', 80, 1), width / 2, 48, {
      size: 34,
      weight: 800,
      fill: '#0B1F4B',
      anchor: 'middle',
    }),
    renderTextLines(wrapText(plan.purpose || 'Solution components, responsibilities, and relationships', 180, 1), width / 2, 75, {
      size: 14,
      fill: PALETTE.secondary,
      anchor: 'middle',
    }),
  ].join('');
}

function renderZone(zone) {
  if (zone.nodes.length === 0) return '';
  return [
    `<rect x="${zone.x}" y="${zone.y}" width="${zone.width}" height="${zone.height}" rx="16" fill="${zone.style.fill}" stroke="${zone.style.stroke}" stroke-width="1.6" stroke-dasharray="7 6"/>`,
    `<rect x="${zone.x + 16}" y="${zone.y + 13}" width="${Math.min(zone.width - 32, Math.max(160, zone.label.length * 9 + 26))}" height="31" rx="9" fill="${PALETTE.white}" opacity="0.96"/>`,
    renderTextLines(wrapText(zone.label, Math.max(20, Math.floor((zone.width - 42) / 9)), 2), zone.x + 27, zone.y + 35, {
      size: 16,
      weight: 750,
      lineHeight: 18,
      fill: zone.style.accent,
    }),
  ].join('');
}

function renderCard(node, position) {
  const { zone } = position;
  const compact = position.height < 150 || position.width < 280;
  const iconSize = compact ? 43 : 50;
  const iconX = position.x + 15;
  const iconY = position.y + 18;
  const textX = iconX + iconSize + 14;
  const textWidth = position.width - (textX - position.x) - 13;
  const labelLines = wrapText(node.label, Math.max(16, Math.floor(textWidth / 7.4)), compact ? 2 : 3);
  const technologyLines = node.technology
    ? wrapText(node.technology, Math.max(16, Math.floor(textWidth / 7)), 2)
    : [];
  const labelY = position.y + 30;
  const technologyY = labelY + labelLines.length * (compact ? 16 : 18) + 2;
  const descriptionY = technologyY + (technologyLines.length * 13) + 5;
  return [
    `<g aria-label="${escapeXml(node.label)}" data-component-label="${escapeXml(node.label)}">`,
    `<rect x="${position.x}" y="${position.y}" width="${position.width}" height="${position.height}" rx="12" fill="${PALETTE.white}" stroke="${zone.style.stroke}" stroke-width="1.35" filter="url(#shadow)"/>`,
    renderTechnologyIcon(node, iconX, iconY, iconSize, zone.style.accent),
    renderTextLines(labelLines, textX, labelY, {
      size: compact ? 13 : 15,
      weight: 750,
      lineHeight: compact ? 16 : 18,
      fill: '#102A43',
    }),
    node.technology
      ? renderTextLines(technologyLines, textX, technologyY, {
        size: compact ? 10 : 11,
        weight: 700,
        lineHeight: 13,
        fill: zone.style.accent,
      })
      : '',
    node.description && descriptionY < position.y + position.height - 12
      ? renderTextLines(wrapText(node.description, Math.max(18, Math.floor(textWidth / 6.8)), compact ? 2 : 3), textX, descriptionY, {
        size: compact ? 9 : 10,
        lineHeight: compact ? 12 : 13,
        fill: PALETTE.secondary,
      })
      : '',
    '</g>',
  ].join('');
}

function classifyFlow(edge, nodeIndex) {
  const source = nodeIndex.get(edge.from);
  const target = nodeIndex.get(edge.to);
  const text = [edge.label, edge.protocol, source?.label, target?.label].filter(Boolean).join(' ').toLowerCase();
  if (/integration|provider|synchron|external|partner/.test(text)) return 'INTEGRATION_EXCHANGE';
  if (/oidc|oauth|identity|authenticate|rbac|access/.test(text)) return 'AUTH_IDENTITY';
  if (/pipeline|deploy|release|environment|monitor|telemetry|logs|metrics/.test(text)) return 'DELIVERY_OPERATIONS';
  return 'DATA_REQUEST';
}

function portPair(from, to) {
  const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  // Keep route endpoints beyond the router's obstacle padding. Otherwise the
  // first grid cell can be free while all of its neighbours remain blocked.
  const offset = 24;
  if (horizontal) {
    const direction = dx >= 0 ? 1 : -1;
    return {
      startPort: { x: fromCenter.x + direction * from.width / 2, y: fromCenter.y },
      start: { x: fromCenter.x + direction * (from.width / 2 + offset), y: fromCenter.y },
      end: { x: toCenter.x - direction * (to.width / 2 + offset), y: toCenter.y },
      endPort: { x: toCenter.x - direction * to.width / 2, y: toCenter.y },
    };
  }
  const direction = dy >= 0 ? 1 : -1;
  return {
    startPort: { x: fromCenter.x, y: fromCenter.y + direction * from.height / 2 },
    start: { x: fromCenter.x, y: fromCenter.y + direction * (from.height / 2 + offset) },
    end: { x: toCenter.x, y: toCenter.y - direction * (to.height / 2 + offset) },
    endPort: { x: toCenter.x, y: toCenter.y - direction * to.height / 2 },
  };
}

function directNeighbourPorts(from, to) {
  const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  const horizontalTolerance = Math.min(from.height, to.height) * 0.16;
  const verticalTolerance = Math.min(from.width, to.width) * 0.16;

  if (Math.abs(fromCenter.y - toCenter.y) <= horizontalTolerance) {
    if (from.x + from.width <= to.x) {
      return [
        { x: from.x + from.width, y: fromCenter.y },
        { x: to.x, y: toCenter.y },
      ];
    }
    if (to.x + to.width <= from.x) {
      return [
        { x: from.x, y: fromCenter.y },
        { x: to.x + to.width, y: toCenter.y },
      ];
    }
  }

  if (Math.abs(fromCenter.x - toCenter.x) <= verticalTolerance) {
    if (from.y + from.height <= to.y) {
      return [
        { x: fromCenter.x, y: from.y + from.height },
        { x: toCenter.x, y: to.y },
      ];
    }
    if (to.y + to.height <= from.y) {
      return [
        { x: fromCenter.x, y: from.y },
        { x: toCenter.x, y: to.y + to.height },
      ];
    }
  }

  return null;
}

function pathData(points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function renderEdge(edge, data, layout, router) {
  const from = layout.positions.get(edge.from);
  const to = layout.positions.get(edge.to);
  const directPoints = directNeighbourPorts(from, to);
  let points = directPoints;
  if (!points) {
    const ports = portPair(from, to);
    const routed = router.route(ports.start, ports.end);
    points = [ports.startPort, ...routed, ports.endPort];
  }
  const flowType = classifyFlow(edge, data.nodeIndex);
  const style = FLOW_STYLES[flowType];
  const marker = `arrow-${flowType.toLowerCase()}`;
  return [
    `<g aria-label="${escapeXml(`${edge.from} to ${edge.to}: ${edge.label || edge.protocol || 'flow'}`)}">`,
    `<path d="${pathData(points)}" fill="none" stroke="${PALETTE.white}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<path d="${pathData(points)}" fill="none" stroke="${style.color}" stroke-width="2.2" ${style.dash ? `stroke-dasharray="${style.dash}"` : ''} stroke-linecap="round" stroke-linejoin="round" marker-end="url(#${marker})"/>`,
    '</g>',
  ].join('');
}

function renderLegend(x, y) {
  const width = 278;
  const height = 176;
  const rows = Object.entries(FLOW_STYLES).map(([key, style], index) => {
    const rowY = y + 54 + index * 28;
    return [
      `<line x1="${x + 18}" y1="${rowY}" x2="${x + 92}" y2="${rowY}" stroke="${style.color}" stroke-width="2.2" ${style.dash ? `stroke-dasharray="${style.dash}"` : ''} marker-end="url(#arrow-${key.toLowerCase()})"/>`,
      renderTextLines([style.label], x + 108, rowY + 4, { size: 11, fill: '#1F2933' }),
    ].join('');
  });
  return [
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="${PALETTE.white}" stroke="#20252B" stroke-width="1.4" filter="url(#shadow)"/>`,
    renderTextLines(['Legend'], x + 18, y + 31, { size: 16, weight: 800, fill: '#102A43' }),
    ...rows,
  ].join('');
}

function edgeDefinitions() {
  return [
    '<defs>',
    ...Object.entries(FLOW_STYLES).map(([key, style]) => (
      `<marker id="arrow-${key.toLowerCase()}" markerWidth="9" markerHeight="9" refX="8.5" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">`
      + `<path d="M0,0 L9,4.5 L0,9 Z" fill="${style.color}"/>`
      + '</marker>'
    )),
    '</defs>',
  ].join('');
}

export function renderDetailedArchitecture(plan, options = {}) {
  const data = validateDetails(plan.content || {});
  if (data.nodes.length === 0) throw new Error('architecture-details requires at least one component');
  const layout = computeLayout(data, options.width, options.height);
  const obstacles = [
    { x: 0, y: 0, width: layout.width, height: 82 },
    { x: 18, y: 886, width: 278, height: 176 },
    ...[...layout.positions.values()].map(position => ({
      x: position.x,
      y: position.y,
      width: position.width,
      height: position.height,
    })),
  ];
  const router = createOrthogonalRouter({
    width: layout.width,
    height: layout.height,
    obstacles,
    cellSize: 10,
    margin: 6,
  });
  const body = [
    edgeDefinitions(),
    renderHeader(plan, layout.width),
    ...[...layout.zones.values()].map(renderZone),
    ...data.nodes.map(node => renderCard(node, layout.positions.get(node.id))),
    // Connectors are intentionally above cards so arrowheads remain visible at
    // their target ports. Obstacle-aware routing prevents paths crossing cards.
    ...data.edges.map(edge => renderEdge(edge, data, layout, router)),
    renderLegend(18, 918),
  ].join('');
  const svg = renderSvgDocument({
    width: layout.width,
    height: layout.height,
    title: plan.title || 'Detailed Solution Architecture',
    body,
  });
  return {
    ...rasterizeSvg(svg, layout.width, layout.height),
    renderer: 'deterministic-architecture-details-v3',
  };
}
