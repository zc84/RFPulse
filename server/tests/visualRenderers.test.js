import assert from 'node:assert/strict';
import test from 'node:test';
import {
  listDeterministicRendererTypes,
  renderDeterministicVisual,
} from '../visuals/renderers/rendererRegistry.js';
import { assertVisualPlanComplexity } from '../visuals/domain/complexity.js';

const renderOptions = { width: 1400, height: 820 };

const fixtures = [
  {
    type: 'architecture-details',
    title: 'Detailed solution architecture',
    content: {
      boundaries: [
        { id: 'frontend', label: 'Experience layer' },
        { id: 'backend', label: 'Application layer' },
      ],
      components: [
        { id: 'portal', label: 'Customer portal', technology: 'React', boundaryId: 'frontend' },
        { id: 'api', label: 'Proposal API', technology: 'Node.js', boundaryId: 'backend' },
        { id: 'db', label: 'Proposal database', technology: 'PostgreSQL', boundaryId: 'backend' },
      ],
      relationships: [
        { from: 'portal', to: 'api', label: 'Requests', protocol: 'HTTPS' },
        { from: 'api', to: 'db', label: 'Reads and writes', protocol: 'SQL' },
      ],
    },
  },
  {
    type: 'cloud-architecture',
    title: 'AWS target architecture',
    content: {
      provider: 'AWS',
      boundaries: [
        { id: 'public', label: 'Public subnet', kind: 'network' },
        { id: 'private', label: 'Private subnet', kind: 'network' },
      ],
      resources: [
        { id: 'alb', label: 'Application Load Balancer', service: 'Elastic Load Balancing', boundaryId: 'public' },
        { id: 'ecs', label: 'Application service', service: 'Amazon ECS', boundaryId: 'private' },
        { id: 'rds', label: 'Primary database', service: 'Amazon RDS', boundaryId: 'private' },
      ],
      relationships: [
        { from: 'alb', to: 'ecs', label: 'HTTPS' },
        { from: 'ecs', to: 'rds', label: 'PostgreSQL' },
      ],
    },
  },
  {
    type: 'architecture-c4',
    title: 'C4 container view',
    content: {
      level: 'container',
      boundaries: [{ id: 'platform', label: 'Proposal platform' }],
      elements: [
        { id: 'user', label: 'Proposal manager', kind: 'person' },
        { id: 'web', label: 'Web application', kind: 'container', technology: 'React', boundaryId: 'platform' },
        { id: 'service', label: 'API service', kind: 'container', technology: 'Node.js', boundaryId: 'platform' },
      ],
      relationships: [
        { from: 'user', to: 'web', label: 'Uses' },
        { from: 'web', to: 'service', label: 'Calls', technology: 'HTTPS/JSON' },
      ],
    },
  },
  {
    type: 'gantt',
    title: 'Implementation schedule',
    content: {
      tasks: [
        { id: 'discover', label: 'Discovery', start: '2026-08-03', end: '2026-08-14', dependencies: [] },
        { id: 'build', label: 'Implementation', start: '2026-08-17', end: '2026-09-18', dependencies: ['discover'] },
        { id: 'release', label: 'Production release', start: '2026-09-21', end: '2026-09-21', dependencies: ['build'], milestone: true },
      ],
    },
  },
];

test('registry exposes all deterministic endpoint visual types', () => {
  assert.deepEqual(listDeterministicRendererTypes().sort(), [
    'architecture-c4',
    'architecture-details',
    'cloud-architecture',
    'gantt',
  ]);
});

for (const fixture of fixtures) {
  test(`${fixture.type} renders a non-empty PNG with exact source labels in SVG`, () => {
    const result = renderDeterministicVisual(fixture, renderOptions);
    assert.equal(result.width, renderOptions.width);
    assert.ok(result.height >= renderOptions.height);
    assert.ok(result.png.length > 2_000);
    assert.equal(result.png.subarray(1, 4).toString('ascii'), 'PNG');
    assert.match(result.renderer, /^deterministic-/);

    const primaryItems = fixture.content.components
      || fixture.content.resources
      || fixture.content.elements
      || fixture.content.tasks;
    for (const item of primaryItems) {
      assert.match(result.svg, new RegExp(item.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });
}

test('structured architecture rejects relationships to unknown elements', () => {
  const fixture = structuredClone(fixtures[0]);
  fixture.content.relationships.push({ from: 'api', to: 'missing' });
  assert.throws(() => renderDeterministicVisual(fixture, renderOptions), /unknown target 'missing'/);
});

test('Gantt rejects unknown dependencies', () => {
  const fixture = structuredClone(fixtures[3]);
  fixture.content.tasks[1].dependencies = ['missing'];
  assert.throws(() => renderDeterministicVisual(fixture, renderOptions), /unknown dependency 'missing'/);
});

test('complexity guard rejects oversized raster work before rendering', () => {
  const tasks = Array.from({ length: 21 }, (_, index) => ({
    id: `task-${index}`,
    label: `Task ${index}`,
    start: '2026-08-01',
    end: '2026-08-02',
  }));
  assert.throws(
    () => assertVisualPlanComplexity({ artifacts: [{ type: 'gantt', content: { tasks } }] }),
    error => error.code === 'COMPLEXITY_LIMIT_EXCEEDED'
  );
});
