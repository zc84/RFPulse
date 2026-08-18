import {
  DEFAULT_CAPABILITIES,
  DEFAULT_MAX_VISUALS,
  VISUAL_TYPES,
} from './catalog.js';

const BLOCK_REASON_BY_TYPE = Object.freeze({
  'architecture-overview': 'ARCHITECTURE_CONTEXT_REQUIRED',
  'architecture-details': 'STRUCTURED_ARCHITECTURE_REQUIRED',
  'cloud-architecture': 'STRUCTURED_CLOUD_ARCHITECTURE_REQUIRED',
  'architecture-c4': 'STRUCTURED_C4_REQUIRED',
  gantt: 'STRUCTURED_TIMELINE_REQUIRED',
});

function hasTextSource(source) {
  return Boolean(source?.proposal_markdown || source?.architecture_markdown);
}

function hasValidRelationshipSet(components, relationships) {
  if (!Array.isArray(components) || components.length < 2 || !Array.isArray(relationships) || relationships.length < 1) {
    return false;
  }
  const ids = new Set(components.map(component => component.id));
  return relationships.every(edge => ids.has(edge.from) && ids.has(edge.to));
}

function isEligible(type, source) {
  const data = source?.structured_data;
  switch (type) {
    case 'architecture-overview':
      return hasTextSource(source)
        || (data?.architecture?.components?.length ?? 0) >= 2
        || (data?.cloudArchitecture?.resources?.length ?? 0) >= 2
        || (data?.c4?.elements?.length ?? 0) >= 2;
    case 'architecture-details':
      return hasValidRelationshipSet(
        data?.architecture?.components,
        data?.architecture?.relationships
      );
    case 'cloud-architecture':
      return Boolean(
        data?.cloudArchitecture?.provider
          && data.cloudArchitecture.resources?.length
          && (
            data.cloudArchitecture.boundaries?.length
            || data.cloudArchitecture.resources.some(resource => resource.boundaryId)
          )
      );
    case 'architecture-c4':
      if (!data?.c4?.level || !hasValidRelationshipSet(data.c4.elements, data.c4.relationships)) {
        return false;
      }
      if (data.c4.level === 'context') {
        return data.c4.elements.every(element => ['person', 'software-system'].includes(element.kind));
      }
      if (data.c4.level === 'container') {
        return data.c4.elements.some(element => element.kind === 'container')
          && data.c4.elements.every(element => element.kind !== 'component')
          && data.c4.elements.some(element => element.boundaryId);
      }
      return data.c4.elements.some(element => element.kind === 'component')
        && data.c4.elements.some(element => element.boundaryId);
    case 'gantt': {
      const tasks = data?.timeline;
      if (!Array.isArray(tasks) || tasks.length === 0) return false;
      const ids = new Set(tasks.map(task => task.id));
      return tasks.every(task => (
        task.start
        && task.end
        && task.start <= task.end
        && (task.dependencies ?? []).every(dependencyId => ids.has(dependencyId))
      ));
    }
    default:
      return false;
  }
}

function addReason(decision, reason) {
  return decision.reasonCodes.includes(reason)
    ? decision
    : { ...decision, reasonCodes: [...decision.reasonCodes, reason] };
}

function normalizeCandidate(candidate, type) {
  return candidate
    ? {
      ...candidate,
      type,
      // Reserve capacity for server-owned eligibility, exclusion, and budget
      // decisions added after the planner response.
      reasonCodes: [...new Set(candidate.reasonCodes ?? [])].slice(0, 15),
    }
    : {
      type,
      decision: 'omitted',
      relevance: 0,
      evidenceCoverage: 0,
      audienceFit: [],
      reasonCodes: ['NOT_RECOMMENDED_BY_PLANNER'],
    };
}

function scoreCandidate(candidate, preferredTypes) {
  const preferenceBoost = preferredTypes.includes(candidate.type) ? 0.15 : 0;
  return (candidate.relevance * 0.6) + (candidate.evidenceCoverage * 0.4) + preferenceBoost;
}

function createsRedundancy(type, selected, source) {
  return type === 'architecture-c4'
    && source?.structured_data?.c4?.level === 'context'
    && selected.some(candidate => candidate.type === 'architecture-overview');
}

export function applyVisualSelectionPolicy({
  source,
  selection,
  candidates,
  capabilities = DEFAULT_CAPABILITIES,
}) {
  const candidateByType = new Map((candidates ?? []).map(candidate => [candidate.type, candidate]));
  const excluded = new Set(selection.excluded_types ?? []);
  const preferred = selection.preferred_types ?? [];
  const explicit = selection.mode === 'explicit' ? selection.types : null;
  const consideredTypes = explicit ?? VISUAL_TYPES;
  const maxVisuals = Math.min(selection.max_visuals ?? DEFAULT_MAX_VISUALS, DEFAULT_MAX_VISUALS);
  const decisions = [];

  for (const type of VISUAL_TYPES) {
    let decision = normalizeCandidate(candidateByType.get(type), type);

    if (!consideredTypes.includes(type)) {
      decision = addReason({ ...decision, decision: 'omitted' }, 'NOT_REQUESTED');
    } else if (excluded.has(type)) {
      decision = addReason({ ...decision, decision: 'omitted' }, 'EXCLUDED_BY_REQUEST');
    } else if (!capabilities[type]) {
      decision = addReason({ ...decision, decision: 'blocked' }, 'RENDERER_UNAVAILABLE');
    } else if (!isEligible(type, source)) {
      decision = addReason(
        { ...decision, decision: 'blocked' },
        BLOCK_REASON_BY_TYPE[type]
      );
    } else if (selection.mode === 'explicit') {
      decision = addReason({ ...decision, decision: 'selected' }, 'EXPLICITLY_REQUESTED');
    } else if (decision.decision === 'selected') {
      decision = { ...decision, decision: 'selected' };
    } else {
      decision = { ...decision, decision: 'omitted' };
    }
    decisions.push(decision);
  }

  const selectable = decisions
    .filter(decision => decision.decision === 'selected')
    .sort((left, right) => {
      if (explicit) return explicit.indexOf(left.type) - explicit.indexOf(right.type);
      return scoreCandidate(right, preferred) - scoreCandidate(left, preferred);
    });

  const selected = [];
  for (const candidate of selectable) {
    const originalIndex = decisions.findIndex(decision => decision.type === candidate.type);
    if (selected.length >= maxVisuals) {
      decisions[originalIndex] = addReason(
        { ...candidate, decision: 'omitted' },
        'MAX_VISUALS_REACHED'
      );
    } else if (selection.mode !== 'explicit' && createsRedundancy(candidate.type, selected, source)) {
      decisions[originalIndex] = addReason(
        { ...candidate, decision: 'omitted' },
        'REDUNDANT_WITH_ARCHITECTURE_OVERVIEW'
      );
    } else {
      selected.push(candidate);
    }
  }

  return {
    mode: selection.mode,
    renderable: selection.mode !== 'recommend' && selected.length > 0,
    selectedTypes: selected.map(candidate => candidate.type),
    decisions,
  };
}

export { isEligible as isVisualTypeEligible };
