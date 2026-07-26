export const VISUAL_TYPES = Object.freeze([
  'architecture-overview',
  'architecture-details',
  'cloud-architecture',
  'architecture-c4',
  'gantt',
]);

export const VISUAL_TYPE_SET = new Set(VISUAL_TYPES);

export const DEFAULT_MAX_VISUALS = 2;
export const MAX_VISUALS = 2;

export const DEFAULT_CAPABILITIES = Object.freeze(
  Object.fromEntries(VISUAL_TYPES.map(type => [type, true]))
);

export const FIDELITY_BY_TYPE = Object.freeze({
  'architecture-overview': 'conceptual',
  'architecture-details': 'structural_exact',
  'cloud-architecture': 'structural_exact',
  'architecture-c4': 'structural_exact',
  gantt: 'data_exact',
});

