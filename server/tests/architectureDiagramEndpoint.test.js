import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildArchitectureDiagramEndpointPrompt,
  renderArchitectureDiagramRequest,
  validateArchitectureDiagramRequest,
} from '../services/architectureDiagramEndpoint.js';

const SAMPLE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO1L5J0AAAAASUVORK5CYII=',
  'base64'
);

function fakeImageClient(calls = []) {
  return {
    images: {
      async generate(options) {
        calls.push(options);
        return { data: [{ b64_json: SAMPLE_PNG.toString('base64') }], output_format: 'png' };
      },
    },
  };
}

function validRequest() {
  return {
    diagram: {
      title: 'Solution architecture',
      direction: 'LR',
      groups: [{ id: 'backend', label: 'Backend', nodes: ['api', 'db'] }],
      nodes: [
        { id: 'web', label: 'Web app', tech: 'react', icon: 'auto' },
        { id: 'api', label: 'API gateway', tech: 'nginx' },
        { id: 'db', label: 'PostgreSQL', tech: 'postgresql' },
      ],
      edges: [
        { from: 'web', to: 'api', label: 'HTTPS', style: 'solid' },
        { from: 'api', to: 'db', label: 'SQL', style: 'dashed' },
      ],
    },
    style: { brand: 'something-else', fidelity: 'high', density: 'balanced' },
    render: { format: 'png', width: 1920, height: 1080, background: 'white' },
  };
}

test('public diagram request validates graph references and forces Andersen PNG rendering', () => {
  const normalized = validateArchitectureDiagramRequest(validRequest());
  assert.equal(normalized.style.brand, 'andersen');
  assert.equal(normalized.style.fidelity, 'high');
  assert.equal(normalized.render.format, 'png');
  assert.equal(normalized.diagram.nodes.length, 3);
  assert.throws(
    () => validateArchitectureDiagramRequest({ ...validRequest(), diagram: { ...validRequest().diagram, edges: [{ from: 'web', to: 'missing' }] } }),
    /unknown node 'missing'/
  );
});

test('diagram endpoint calls the existing image generation method and returns base64 PNG metadata', async () => {
  const calls = [];
  const response = await renderArchitectureDiagramRequest(validRequest(), { client: fakeImageClient(calls) });
  assert.match(response.id, /^diag_/);
  assert.equal(response.format, 'png');
  assert.equal(response.encoding, 'base64');
  assert.equal(response.image, SAMPLE_PNG.toString('base64'));
  assert.deepEqual(response.meta.nodes, 3);
  assert.deepEqual(response.meta.edges, 2);
  assert.deepEqual(response.warnings, []);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].output_format, 'png');
  assert.match(calls[0].prompt, /#FFDB00/);
  assert.match(calls[0].prompt, /PostgreSQL/);
  assert.match(calls[0].prompt, /Never invent or infer an additional component/);
});

test('strict request reports that the current sandbox still uses high image fidelity', async () => {
  const request = validRequest();
  request.style.fidelity = 'strict';
  const response = await renderArchitectureDiagramRequest(request, { client: fakeImageClient() });
  assert.equal(response.meta.fidelity_applied, 'high');
  assert.equal(response.warnings.length, 1);
});

test('endpoint prompt is structured around the source graph and Andersen rules', () => {
  const prompt = buildArchitectureDiagramEndpointPrompt(validateArchitectureDiagramRequest(validRequest()));
  assert.match(prompt, /white as the primary background/);
  assert.match(prompt, /"from": "web"/);
  assert.match(prompt, /Preserve labels exactly as supplied/);
});
