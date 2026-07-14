import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveRequestedSpecialists } from '../services/aiOrchestrator.js';

test('framework-inspired AI engine routing keeps estimator dependency on architect', () => {
  const plan = [...resolveRequestedSpecialists(['estimator'])];
  assert.deepEqual(plan, ['architect', 'estimator']);
});

test('framework-inspired AI engine routing preserves canonical specialist order', () => {
  const plan = [...resolveRequestedSpecialists(['estimator', 'legal'])];
  assert.deepEqual(plan, ['legal', 'architect', 'estimator']);
});