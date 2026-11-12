'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { schemas } = require('../src/code-nodes/data-table-schemas');

test('Data Table contracts contain the exact V1 column counts and logical keys', () => {
  assert.equal(schemas.team_strengths.length, 12);
  assert.equal(schemas.league_strengths.length, 7);
  assert.equal(schemas.prediction_log.length, 47);
  assert.deepEqual(schemas.team_strengths[0], { name: 'team_key', type: 'string' });
  assert.deepEqual(schemas.league_strengths[0], { name: 'league_key', type: 'string' });
  assert.deepEqual(schemas.prediction_log.slice(0, 3).map((column) => column.name), ['prediction_key', 'fixture_id', 'model_version']);
  assert.deepEqual(schemas.prediction_log.at(-1), { name: 'evaluated_at', type: 'date' });
});
