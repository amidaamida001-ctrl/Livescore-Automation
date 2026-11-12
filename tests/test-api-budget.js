'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function estimateRequestBudget({ historicalPages, upcomingPages, historicalRuns = 1, upcomingRuns = 1, retries = 0, metadataCalls = 0, evaluationCalls = 0 }) {
  const finite = [historicalPages, upcomingPages, historicalRuns, upcomingRuns, retries, metadataCalls, evaluationCalls].every((value) => Number.isInteger(value) && value >= 0);
  if (!finite) throw new Error('Request counts must be nonnegative integers.');
  return historicalRuns * historicalPages + upcomingRuns * upcomingPages + retries + metadataCalls + evaluationCalls;
}

test('request-budget estimate counts each page, run, retry, metadata and evaluation call', () => {
  assert.equal(estimateRequestBudget({ historicalPages: 1, upcomingPages: 1, historicalRuns: 2, upcomingRuns: 4, retries: 1, metadataCalls: 2, evaluationCalls: 3 }), 12);
  assert.throws(() => estimateRequestBudget({ historicalPages: -1, upcomingPages: 1 }), /nonnegative integers/);
});
