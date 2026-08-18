import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PostgresVisualBudgetGate,
} from '../visuals/infrastructure/budgetGates.js';
import {
  MemoryProviderConcurrencyGate,
  PostgresProviderConcurrencyGate,
} from '../visuals/infrastructure/providerConcurrencyGates.js';

test('memory provider gate rejects work above its concurrency limit', async () => {
  const gate = new MemoryProviderConcurrencyGate({ maxConcurrent: 1 });
  let release;
  const first = gate.run(() => new Promise(resolve => {
    release = resolve;
  }));
  await assert.rejects(
    () => gate.run(async () => {}),
    error => error.code === 'PROVIDER_CAPACITY_EXCEEDED'
  );
  release();
  await first;
});

test('PostgreSQL provider gate claims and releases a global lease', async () => {
  const statements = [];
  const query = async (sql, params) => {
    statements.push({ sql, params });
    if (sql.includes('claim_endpoint_visual_provider_lease')) {
      return { rows: [{ claimed: true }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  };
  const gate = new PostgresProviderConcurrencyGate({
    query,
    maxConcurrent: 2,
    leaseTtlSeconds: 330,
  });
  const result = await gate.run(async () => 'complete');
  assert.equal(result, 'complete');
  assert.equal(statements.length, 2);
  assert.match(statements[0].sql, /claim_endpoint_visual_provider_lease/);
  assert.match(statements[1].sql, /DELETE FROM endpoint_visual_provider_leases/);
  assert.equal(statements[0].params[1], 2);
});

test('PostgreSQL budget gate sends all usage classes through one atomic reservation', async () => {
  let captured;
  const query = async (sql, params) => {
    captured = { sql, params };
    return { rows: [{ reserved: true }], rowCount: 1 };
  };
  const gate = new PostgresVisualBudgetGate({ query });
  await gate.reserve({
    plannerCalls: 1,
    imageCalls: 2,
    qaCalls: 1,
    regenerationCalls: 1,
  });
  assert.match(captured.sql, /reserve_endpoint_visual_budget/);
  assert.deepEqual(captured.params.slice(0, 5), [1, 2, 1, 1, 33]);
});

test('PostgreSQL budget gate rejects a denied reservation', async () => {
  const gate = new PostgresVisualBudgetGate({
    query: async () => ({ rows: [{ reserved: false }], rowCount: 1 }),
  });
  await assert.rejects(
    () => gate.reserve({ imageCalls: 1 }),
    error => error.code === 'BUDGET_EXCEEDED'
  );
});
