import { visualError } from './errors.js';

const LIMITS = Object.freeze({
  maxElements: 24,
  maxRelationships: 40,
  maxBoundaries: 5,
  maxBoundaryDepth: 1,
  maxElementsPerBoundary: 6,
  maxGanttTasks: 20,
  maxPixelArea: 3_500_000,
});

function fail(detail) {
  throw visualError('COMPLEXITY_LIMIT_EXCEEDED', detail, 422);
}

function validateBoundaryTree(boundaries) {
  if (boundaries.length > LIMITS.maxBoundaries) {
    fail(`A rendered architecture supports at most ${LIMITS.maxBoundaries} boundaries.`);
  }
  const byId = new Map(boundaries.map(boundary => [boundary.id, boundary]));
  for (const boundary of boundaries) {
    let current = boundary;
    const visited = new Set();
    let depth = 0;
    while (current?.parentId) {
      if (visited.has(current.id)) fail(`Boundary hierarchy contains a cycle at '${current.id}'.`);
      visited.add(current.id);
      current = byId.get(current.parentId);
      if (!current) fail(`Boundary '${boundary.id}' references unknown parent '${boundary.parentId}'.`);
      depth += 1;
      if (depth > LIMITS.maxBoundaryDepth) {
        fail(`Boundary nesting deeper than ${LIMITS.maxBoundaryDepth} level is not supported.`);
      }
    }
  }
}

function validateStructuredArchitecture(artifact) {
  const content = artifact.content;
  const elements = artifact.type === 'architecture-c4'
    ? content.elements
    : artifact.type === 'cloud-architecture'
      ? content.resources
      : content.components;
  if (elements.length > LIMITS.maxElements) {
    fail(`${artifact.type} supports at most ${LIMITS.maxElements} rendered elements.`);
  }
  if (content.relationships.length > LIMITS.maxRelationships) {
    fail(`${artifact.type} supports at most ${LIMITS.maxRelationships} rendered relationships.`);
  }
  validateBoundaryTree(content.boundaries);

  const counts = new Map();
  for (const element of elements) {
    const key = element.boundaryId || '__unassigned__';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const [boundaryId, count] of counts) {
    if (count > LIMITS.maxElementsPerBoundary) {
      fail(`Boundary '${boundaryId}' contains ${count} elements; the rendered limit is ${LIMITS.maxElementsPerBoundary}.`);
    }
  }

  const legendRows = Math.ceil(content.relationships.length / 2);
  const estimatedHeight = 122 + Math.max(54, 34 + legendRows * 24)
    + 58 + Math.max(...counts.values(), 1) * (112 + 20);
  if (1_800 * estimatedHeight > LIMITS.maxPixelArea) {
    fail('The structured architecture would exceed the safe raster pixel-area limit.');
  }
}

export function assertVisualPlanComplexity(plan) {
  for (const artifact of plan.artifacts) {
    if (artifact.type === 'architecture-overview') continue;
    if (artifact.type === 'gantt') {
      if (artifact.content.tasks.length > LIMITS.maxGanttTasks) {
        fail(`Gantt supports at most ${LIMITS.maxGanttTasks} rendered tasks.`);
      }
      const estimatedHeight = Math.max(720, 168 + artifact.content.tasks.length * 64 + 42);
      if (1_800 * estimatedHeight > LIMITS.maxPixelArea) {
        fail('The Gantt chart would exceed the safe raster pixel-area limit.');
      }
      continue;
    }
    validateStructuredArchitecture(artifact);
  }
}

export { LIMITS as VISUAL_COMPLEXITY_LIMITS };
