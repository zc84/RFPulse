import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyVisualSelectionPolicy,
  artifactPlanSchema,
  canonicalJson,
  createStructuredFactIndex,
  verifyEvidenceRef,
  visualPlanRequestSchema,
  visualRenderRequestSchema,
} from '../visuals/domain/index.js';

function candidate(type, relevance = 0.9, evidenceCoverage = 0.9) {
  return {
    type,
    decision: 'selected',
    purpose: `Explain ${type}`,
    relevance,
    evidenceCoverage,
    audienceFit: ['technical'],
    reasonCodes: ['PLANNER_RECOMMENDED'],
  };
}

function source() {
  return {
    proposal_markdown: '# Cloud migration proposal',
    structured_data: {
      architecture: {
        components: [
          { id: 'api', label: 'API' },
          { id: 'db', label: 'Database' },
        ],
        relationships: [{ from: 'api', to: 'db' }],
      },
      cloudArchitecture: {
        provider: 'aws',
        boundaries: [{ id: 'region', label: 'eu-central-1', kind: 'region' }],
        resources: [
          { id: 'api', label: 'API', service: 'API Gateway', boundaryId: 'region' },
          { id: 'db', label: 'Database', service: 'RDS', boundaryId: 'region' },
        ],
        relationships: [{ from: 'api', to: 'db' }],
      },
      c4: {
        level: 'context',
        elements: [
          { id: 'person', label: 'Customer', kind: 'person' },
          { id: 'system', label: 'Platform', kind: 'software-system' },
        ],
        relationships: [{ from: 'person', to: 'system' }],
      },
      timeline: [
        {
          id: 'discovery',
          label: 'Discovery',
          start: '2026-08-01',
          end: '2026-08-07',
          dependencies: [],
          milestone: false,
        },
        {
          id: 'launch',
          label: 'Launch',
          start: '2026-08-08',
          end: '2026-08-08',
          dependencies: ['discovery'],
          milestone: true,
        },
      ],
    },
  };
}

test('public request schemas accept source planning and reject recommend rendering', () => {
  const request = {
    mode: 'source',
    source: source(),
    context: { audience: ['executive', 'technical'] },
    selection: { mode: 'auto' },
    request: { intent: 'Select useful proposal diagrams' },
  };

  const parsed = visualPlanRequestSchema.parse(request);
  assert.equal(parsed.selection.max_visuals, 2);
  assert.equal(parsed.request.language, 'en');
  assert.throws(() => visualRenderRequestSchema.parse({
    ...request,
    selection: { mode: 'recommend' },
  }), /recommend selection mode/);
  assert.doesNotThrow(() => visualRenderRequestSchema.parse({
    mode: 'plan_token',
    plan_token: 'a'.repeat(32),
  }));
});

test('canonical structured facts are stable across object key order and evidence is verifiable', () => {
  const left = createStructuredFactIndex({ beta: 2, alpha: { value: 1 } });
  const right = createStructuredFactIndex({ alpha: { value: 1 }, beta: 2 });
  assert.equal(left.sourceDigest, right.sourceDigest);
  assert.equal(canonicalJson({ beta: 2, alpha: 1 }), '{"alpha":1,"beta":2}');

  const fact = left.facts[0];
  assert.equal(verifyEvidenceRef(fact, left), true);
  assert.equal(verifyEvidenceRef({ ...fact, valueDigest: '0'.repeat(64) }, left), false);
});

test('auto policy applies exact-data eligibility, ranking, and the artifact limit', () => {
  const result = applyVisualSelectionPolicy({
    source: source(),
    selection: {
      mode: 'auto',
      preferred_types: ['gantt'],
      excluded_types: [],
      max_visuals: 2,
    },
    candidates: [
      candidate('architecture-overview', 0.91, 0.8),
      candidate('architecture-details', 0.95, 1),
      candidate('gantt', 0.75, 1),
    ],
  });

  assert.deepEqual(result.selectedTypes, ['gantt', 'architecture-details']);
  assert.equal(result.renderable, true);
  assert.equal(
    result.decisions.find(item => item.type === 'architecture-overview').reasonCodes.includes('MAX_VISUALS_REACHED'),
    true
  );
});

test('policy blocks unsupported facts and unavailable renderers without trusting planner decisions', () => {
  const result = applyVisualSelectionPolicy({
    source: { proposal_markdown: 'A proposal without structured dates.' },
    selection: {
      mode: 'explicit',
      types: ['gantt', 'architecture-overview'],
      excluded_types: [],
      max_visuals: 2,
    },
    candidates: [candidate('gantt'), candidate('architecture-overview')],
    capabilities: {
      'architecture-overview': false,
      'architecture-details': true,
      'cloud-architecture': true,
      'architecture-c4': true,
      gantt: true,
    },
  });

  assert.deepEqual(result.selectedTypes, []);
  assert.equal(result.renderable, false);
  assert.equal(
    result.decisions.find(item => item.type === 'gantt').reasonCodes.includes('STRUCTURED_TIMELINE_REQUIRED'),
    true
  );
  assert.equal(
    result.decisions.find(item => item.type === 'architecture-overview').reasonCodes.includes('RENDERER_UNAVAILABLE'),
    true
  );
});

test('explicit mode honors requested types even when automatic selection would consider them redundant', () => {
  const result = applyVisualSelectionPolicy({
    source: source(),
    selection: {
      mode: 'explicit',
      types: ['architecture-overview', 'architecture-c4'],
      excluded_types: [],
      max_visuals: 2,
    },
    candidates: [candidate('architecture-overview'), candidate('architecture-c4')],
  });

  assert.deepEqual(result.selectedTypes, ['architecture-overview', 'architecture-c4']);
});

test('recommend mode returns decisions but is never directly renderable', () => {
  const result = applyVisualSelectionPolicy({
    source: source(),
    selection: {
      mode: 'recommend',
      preferred_types: [],
      excluded_types: [],
      max_visuals: 2,
    },
    candidates: [candidate('architecture-overview')],
  });

  assert.deepEqual(result.selectedTypes, ['architecture-overview']);
  assert.equal(result.renderable, false);
});

test('artifact plans enforce type-specific fidelity classes', () => {
  assert.throws(() => artifactPlanSchema.parse({
    id: 'artifact-1',
    type: 'gantt',
    title: 'Timeline',
    purpose: 'Show delivery',
    audience: 'executive',
    fidelityClass: 'conceptual',
    required: true,
    dependsOn: [],
    presentation: {},
    content: {
      tasks: [{
        id: 'task-1',
        label: 'Discovery',
        start: '2026-08-01',
        end: '2026-08-02',
        dependencies: [],
        milestone: false,
        evidence: [],
      }],
    },
  }));
});
