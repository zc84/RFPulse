import { renderGantt } from './ganttRenderer.js';
import { renderStructuredArchitecture } from './structuredArchitectureRenderer.js';

const deterministicRenderers = new Map([
  ['architecture-details', renderStructuredArchitecture],
  ['cloud-architecture', renderStructuredArchitecture],
  ['architecture-c4', renderStructuredArchitecture],
  ['gantt', renderGantt],
]);

export function getDeterministicRenderer(type) {
  return deterministicRenderers.get(type) || null;
}

export function listDeterministicRendererTypes() {
  return [...deterministicRenderers.keys()];
}

export function renderDeterministicVisual(plan, options = {}) {
  const renderer = getDeterministicRenderer(plan?.type);
  if (!renderer) throw new Error(`No deterministic renderer is registered for '${plan?.type || 'unknown'}'`);
  return renderer(plan, options);
}

