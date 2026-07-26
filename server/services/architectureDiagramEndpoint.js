import { generateOpenAIImageArtifact } from './aiOrchestrator.js';
import { renderDeterministicArchitectureDiagram } from './deterministicArchitectureDiagram.js';

const DIRECTIONS = new Set(['LR', 'TB']);
const DENSITIES = new Set(['compact', 'balanced', 'spacious']);
const FORMATS = new Set(['png']);
const BACKGROUNDS = new Set(['transparent', 'white', 'brand']);

const BRAND_RULES = [
  'Use the Andersen proposal visual language.',
  'Use white as the primary background, black #111111 for primary text, dark grey #3D3D3D for secondary text and outlines, grey #9E9E9E for quiet separators, brand yellow #FFDB00 for accents and key highlights, and pale yellow #FFF6C8 for subtle highlighted areas.',
  'Use clean editorial composition, restrained rounded cards, generous whitespace, clear hierarchy, and crisp connectors.',
  'The result must look like a professional solution-architecture visual embedded in a proposal, never like a poster, marketing illustration, or photorealistic scene.',
  'Do not add a logo, decorative illustration, title page, unrelated technology, node, edge, label, or relationship.',
].join(' ');

function fail(status, code, detail) {
  const error = new Error(detail);
  error.status = status;
  error.expose = true;
  error.body = { error: code, detail };
  return error;
}

function asObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw fail(400, 'bad_request', `${label} must be an object`);
  }
  return value;
}

function asNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw fail(422, 'invalid_graph', `${label} must be a non-empty string`);
  }
  return value.trim();
}

function validateDiagram(diagram) {
  asObject(diagram, 'diagram');
  const nodes = Array.isArray(diagram.nodes) ? diagram.nodes : [];
  const groups = diagram.groups === undefined ? [] : diagram.groups;
  const edges = diagram.edges === undefined ? [] : diagram.edges;

  if (nodes.length === 0) throw fail(422, 'invalid_graph', 'diagram.nodes must contain at least one node');
  if (!Array.isArray(groups)) throw fail(422, 'invalid_graph', 'diagram.groups must be an array');
  if (!Array.isArray(edges)) throw fail(422, 'invalid_graph', 'diagram.edges must be an array');

  const nodeIds = new Set();
  for (const node of nodes) {
    asObject(node, 'diagram.nodes[]');
    const id = asNonEmptyString(node.id, 'diagram.nodes[].id');
    asNonEmptyString(node.label, `node '${id}'.label`);
    if (nodeIds.has(id)) throw fail(422, 'invalid_graph', `duplicate node id '${id}'`);
    nodeIds.add(id);
    if (node.details !== undefined && (!Array.isArray(node.details) || node.details.some(detail => typeof detail !== 'string'))) {
      throw fail(422, 'invalid_graph', `node '${id}'.details must be an array of strings`);
    }
  }

  const groupedNodeIds = new Set();
  const groupIds = new Set();
  for (const group of groups) {
    asObject(group, 'diagram.groups[]');
    const groupId = asNonEmptyString(group.id, 'diagram.groups[].id');
    asNonEmptyString(group.label, `group '${groupId}'.label`);
    if (groupIds.has(groupId)) throw fail(422, 'invalid_graph', `duplicate group id '${groupId}'`);
    groupIds.add(groupId);
    if (!Array.isArray(group.nodes)) throw fail(422, 'invalid_graph', `group '${groupId}'.nodes must be an array`);
    for (const nodeId of group.nodes) {
      if (!nodeIds.has(nodeId)) throw fail(422, 'invalid_graph', `group '${groupId}' references unknown node '${nodeId}'`);
      if (groupedNodeIds.has(nodeId)) throw fail(422, 'invalid_graph', `node '${nodeId}' belongs to more than one group`);
      groupedNodeIds.add(nodeId);
    }
  }

  for (const edge of edges) {
    asObject(edge, 'diagram.edges[]');
    const from = asNonEmptyString(edge.from, 'diagram.edges[].from');
    const to = asNonEmptyString(edge.to, 'diagram.edges[].to');
    if (!nodeIds.has(from)) throw fail(422, 'invalid_graph', `edge references unknown node '${from}'`);
    if (!nodeIds.has(to)) throw fail(422, 'invalid_graph', `edge references unknown node '${to}'`);
    if (edge.style !== undefined && !['solid', 'dashed'].includes(edge.style)) {
      throw fail(422, 'invalid_graph', "edge.style must be 'solid' or 'dashed'");
    }
  }

  return { ...diagram, nodes, groups, edges };
}

function validateRequest(body) {
  const request = asObject(body, 'request');
  const diagram = validateDiagram(request.diagram);
  const style = request.style === undefined ? {} : asObject(request.style, 'style');
  const render = request.render === undefined ? {} : asObject(request.render, 'render');

  const direction = diagram.direction === undefined ? 'LR' : diagram.direction;
  if (!DIRECTIONS.has(direction)) throw fail(422, 'invalid_graph', "diagram.direction must be 'LR' or 'TB'");
  if (style.density !== undefined && !DENSITIES.has(style.density)) throw fail(422, 'bad_request', 'style.density is invalid');
  if (render.format !== undefined && !FORMATS.has(render.format)) throw fail(422, 'bad_request', "render.format must be 'png'");
  if (render.background !== undefined && !BACKGROUNDS.has(render.background)) throw fail(422, 'bad_request', 'render.background is invalid');

  return {
    diagram: { ...diagram, direction },
    style: { ...style, brand: 'andersen', fidelity: style.fidelity === 'strict' ? 'strict' : 'high' },
    render: { ...render, format: 'png', width: render.width || 1536, height: render.height || 1024 },
    strictRequested: style.fidelity === 'strict',
  };
}

function buildPrompt({ diagram, style, render }) {
  return [
    'You are generating a single polished enterprise solution architecture diagram as a PNG image.',
    BRAND_RULES,
    `Layout direction: ${diagram.direction}. Density: ${style.density || 'balanced'}.`,
    `Requested canvas: ${render.width}x${render.height}. Background preference: ${render.background || 'white'}.`,
    'The JSON below is the complete source of truth. Render every supplied node, group, edge, and label faithfully.',
    'Never invent or infer an additional component, technology, label, edge, actor, boundary, or data flow. Preserve labels exactly as supplied.',
    'Use technology icons only when they are unambiguous and available; otherwise use a neutral labelled box.',
    'Structured diagram JSON:',
    JSON.stringify(diagram, null, 2),
  ].join('\n\n');
}

function readPngDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return { width: null, height: null };
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

export async function renderArchitectureDiagramRequest(body, { client = null, signal = null } = {}) {
  const request = validateRequest(body);
  if (request.style.fidelity === 'strict') {
    const rendered = renderDeterministicArchitectureDiagram(request);
    return {
      id: `diag_${Date.now().toString(36)}`,
      format: 'png',
      encoding: 'base64',
      image: rendered.png.toString('base64'),
      width: rendered.width,
      height: rendered.height,
      meta: {
        fidelity_applied: 'strict',
        renderer: 'deterministic-svg',
        nodes: request.diagram.nodes.length,
        edges: request.diagram.edges.length,
        seed: request.render.seed ?? null,
        requested_width: request.render.width,
        requested_height: request.render.height,
      },
      warnings: [],
    };
  }
  const image = await generateOpenAIImageArtifact({
    client,
    prompt: buildPrompt(request),
    title: request.diagram.title || 'Solution architecture',
    description: 'Andersen-style architecture diagram rendered from structured diagram JSON.',
    signal,
    size: request.render.width / request.render.height > 1.2 ? '1536x1024' : '1024x1536',
    background: request.render.background === 'transparent' ? 'transparent' : 'opaque',
  });
  const dimensions = readPngDimensions(image.png);
  const warnings = [];

  return {
    id: `diag_${Date.now().toString(36)}`,
    format: 'png',
    encoding: 'base64',
    image: image.png.toString('base64'),
    width: dimensions.width || request.render.width,
    height: dimensions.height || request.render.height,
    meta: {
      fidelity_applied: 'high',
      nodes: request.diagram.nodes.length,
      edges: request.diagram.edges.length,
      seed: null,
      requested_width: request.render.width,
      requested_height: request.render.height,
    },
    warnings,
  };
}

export { buildPrompt as buildArchitectureDiagramEndpointPrompt, validateRequest as validateArchitectureDiagramRequest };
