'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normaliseHistoryResponse } = require('../src/code-nodes/normalise-history');
const { normaliseUpcomingFixtures } = require('../src/code-nodes/normalise-fixtures');

const historical = JSON.parse(fs.readFileSync(path.join(__dirname, '../test-data/mock-historical-fixtures.json'), 'utf8'));
const upcoming = JSON.parse(fs.readFileSync(path.join(__dirname, '../test-data/mock-upcoming-fixtures.json'), 'utf8'));

test('history accepts unique valid FT fixtures and rejects duplicates, AET, PEN, and invalid scores', () => {
  const result = normaliseHistoryResponse(historical, {
    league_id: 39,
    season: 2025,
    historical_cutoff_date: '2025-12-31T23:59:59Z',
  });
  assert.equal(result.accepted_count, 16);
  assert.equal(result.rejected_count, 5);
  assert.equal(result.fixtures[0].match_status, 'FT');
  assert.equal(result.fixtures[0].home_goals, 2);
  assert.equal(new Set(result.fixtures.map((fixture) => fixture.fixture_id)).size, 16);
  assert.ok(result.rejected.some((record) => record.reason === 'duplicate_fixture_id'));
  assert.ok(result.rejected.some((record) => record.reason === 'ineligible_status:AET'));
  assert.ok(result.rejected.some((record) => record.reason === 'ineligible_status:PEN'));
});

test('history rejects API errors, inconsistent results, and incomplete pagination', () => {
  assert.throws(() => normaliseHistoryResponse({ ...historical, errors: { token: 'bad' } }, {
    league_id: 39, season: 2025,
  }), /response errors/);
  assert.throws(() => normaliseHistoryResponse({ ...historical, results: 1 }, {
    league_id: 39, season: 2025,
  }), /results count/);
  assert.throws(() => normaliseHistoryResponse({ ...historical, paging: { current: 1, total: 2 } }, {
    league_id: 39, season: 2025,
  }), /incomplete/);
});

test('an empty successful historical response is represented as zero accepted fixtures', () => {
  const result = normaliseHistoryResponse({
    errors: [], results: 0, paging: { current: 1, total: 1 }, response: [],
  }, { league_id: 39, season: 2025 });
  assert.equal(result.accepted_count, 0);
});

test('upcoming normalization enforces fixture season, NS status, date range, and stable IDs', () => {
  const result = normaliseUpcomingFixtures(upcoming, {
    league_id: 39,
    fixture_season: 2026,
    strength_season: 2025,
    date_from: '2026-11-20',
    date_to: '2026-11-30',
  });
  assert.equal(result.accepted_count, 3);
  assert.equal(result.fixtures[0].fixture_season, 2026);
  assert.equal(result.fixtures[0].strength_season, 2025);
  assert.equal(result.fixtures[0].home_team_id, 42);
});
