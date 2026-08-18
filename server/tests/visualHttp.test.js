import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../app.js';
import { MemoryIdempotencyStore } from '../visuals/infrastructure/idempotencyStores.js';

function fakePlanResult() {
  return {
    plan: {
      version: '2',
      proposalProfile: {
        audiences: ['executive'],
        themes: [],
        goals: [],
        availableFactClasses: [],
        inferredFields: [],
      },
      candidates: [],
      requestSummary: 'No useful visual was selected.',
      artifacts: [],
      warnings: [],
    },
    policy: { renderable: false, selectedTypes: [], decisions: [] },
    sourceDigest: 'a'.repeat(64),
    versions: {
      schema: '1',
      prompt: 'endpoint-visual-planner-v1',
      model: 'fake',
      rendererPolicy: 'endpoint-renderer-policy-v4',
    },
    planToken: null,
    expiresAt: null,
    usage: { prompt_tokens: 1, completion_tokens: 1 },
    estimates: {
      plannerCalls: 1,
      imageCalls: 0,
      deterministicRenders: 0,
      latencyBand: 'medium',
      costBand: 'low',
    },
  };
}

async function withServer(visualModule, callback, visualRouterOptions = {}) {
  const server = createApp({ visualModule, visualRouterOptions }).listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    const address = server.address();
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('public visual plan endpoint succeeds without authentication', async () => {
  const visualModule = {
    async planVisuals() {
      return fakePlanResult();
    },
    async renderVisuals() {
      throw new Error('not used');
    },
    idempotencyStore: new MemoryIdempotencyStore(),
  };

  await withServer(visualModule, async baseUrl => {
    const response = await fetch(`${baseUrl}/v1/visuals/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public: true }),
    });
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('x-request-id'));
    const body = await response.json();
    assert.equal(body.plan.renderable, false);
    assert.equal(body.plan.prompt_version, 'endpoint-visual-planner-v1');
  });
});

test('visual parser returns its uppercase error envelope while legacy JSON remains unchanged', async () => {
  const visualModule = {
    async planVisuals() {
      return fakePlanResult();
    },
    async renderVisuals() {
      return {};
    },
    idempotencyStore: new MemoryIdempotencyStore(),
  };

  await withServer(visualModule, async baseUrl => {
    const visualResponse = await fetch(`${baseUrl}/v1/visuals/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid',
    });
    assert.equal(visualResponse.status, 400);
    assert.equal((await visualResponse.json()).error.code, 'INVALID_REQUEST');

    const legacyResponse = await fetch(`${baseUrl}/v1/diagrams/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid',
    });
    assert.equal(legacyResponse.status, 400);
    assert.equal((await legacyResponse.json()).error, 'bad_request');
  });
});

test('render requires idempotency and replays a completed public request once', async () => {
  let calls = 0;
  const visualModule = {
    async planVisuals() {
      return fakePlanResult();
    },
    async renderVisuals(input, { requestId }) {
      calls += 1;
      return { request_id: requestId, status: 'complete', artifacts: [], input };
    },
    idempotencyStore: new MemoryIdempotencyStore(),
  };

  await withServer(visualModule, async baseUrl => {
    const missingKey = await fetch(`${baseUrl}/v1/visuals/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'plan_token', plan_token: 'x'.repeat(32) }),
    });
    assert.equal(missingKey.status, 400);
    assert.equal((await missingKey.json()).error.code, 'IDEMPOTENCY_KEY_REQUIRED');

    const request = () => fetch(`${baseUrl}/v1/visuals/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'render-same-request',
      },
      body: JSON.stringify({ mode: 'plan_token', plan_token: 'x'.repeat(32) }),
    });
    const first = await request();
    const second = await request();
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(calls, 1);
    assert.deepEqual(await second.json(), await first.json());
  });
});

test('visual timeout and unexpected failures keep the uppercase endpoint envelope', async () => {
  const timeoutModule = {
    async planVisuals(input, { signal }) {
      await new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    },
    async renderVisuals() {
      return {};
    },
    idempotencyStore: new MemoryIdempotencyStore(),
  };
  await withServer(timeoutModule, async baseUrl => {
    const response = await fetch(`${baseUrl}/v1/visuals/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(response.status, 504);
    assert.equal((await response.json()).error.code, 'REQUEST_TIMEOUT');
  }, { timeoutMs: 20 });

  const failureModule = {
    async planVisuals() {
      throw new Error('Sensitive implementation detail');
    },
    async renderVisuals() {
      return {};
    },
    idempotencyStore: new MemoryIdempotencyStore(),
  };
  await withServer(failureModule, async baseUrl => {
    const originalError = console.error;
    console.error = () => {};
    try {
      const response = await fetch(`${baseUrl}/v1/visuals/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      assert.equal(response.status, 500);
      const body = await response.json();
      assert.equal(body.error.code, 'INTERNAL_ERROR');
      assert.doesNotMatch(body.error.message, /Sensitive/);
    } finally {
      console.error = originalError;
    }
  });
});
