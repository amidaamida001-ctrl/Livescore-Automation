'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { decidePrediction, createPendingPrediction, markSent, markFailed, keepPendingForReconciliation } = require('../src/code-nodes/manage-prediction-state');

const prediction = { fixture_id: 1, model_version: 'poisson-v1', status: 'pending', attempt_count: 0 };

test('fixture and model form the duplicate key; sent and pending rows are never resent', () => {
  assert.equal(decidePrediction([], 1, 'poisson-v1').action, 'create_pending');
  assert.equal(decidePrediction([{ ...prediction, status: 'sent' }], 1, 'poisson-v1').reason, 'already_sent');
  assert.equal(decidePrediction([{ ...prediction, status: 'pending' }], 1, 'poisson-v1').reason, 'pending_requires_manual_review');
  assert.equal(decidePrediction([{ ...prediction, fixture_id: 2, status: 'sent' }], 1, 'poisson-v1').action, 'create_pending');
  assert.equal(decidePrediction([{ ...prediction, model_version: 'poisson-v2', status: 'sent' }], 1, 'poisson-v1').action, 'create_pending');
});

test('failed rows and duplicate stored keys require reconciliation, not automatic retry', () => {
  assert.equal(decidePrediction([{ ...prediction, status: 'failed' }], 1, 'poisson-v1').reason, 'failed_requires_manual_review');
  assert.equal(decidePrediction([{ ...prediction }, { ...prediction }], 1, 'poisson-v1').reason, 'duplicate_log_rows');
});

test('delivery state transitions preserve pending on ambiguous outcomes', () => {
  const pending = createPendingPrediction({ fixture_id: 1, model_version: 'poisson-v1' }, '2026-11-12T00:00:00Z');
  assert.equal(pending.status, 'pending');
  assert.equal(markSent(pending, '2026-11-12T00:01:00Z', 123).status, 'sent');
  assert.equal(markFailed(pending, '2026-11-12T00:01:00Z', 'HTTP 429').status, 'failed');
  const ambiguous = keepPendingForReconciliation(pending, '2026-11-12T00:01:00Z', 'timeout');
  assert.equal(ambiguous.status, 'pending');
  assert.equal(ambiguous.attempt_count, 1);
});
