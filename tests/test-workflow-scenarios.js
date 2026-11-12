'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normaliseHistoryResponse } = require('../src/code-nodes/normalise-history');
const { calculateTeamStrengths } = require('../src/code-nodes/calculate-team-strengths');
const { normaliseUpcomingFixtures } = require('../src/code-nodes/normalise-fixtures');
const { joinTeamStrengths } = require('../src/code-nodes/join-team-strengths');
const { calculatePrediction } = require('../src/code-nodes/calculate-poisson');
const { formatPrediction } = require('../src/code-nodes/format-prediction');
const { decidePrediction } = require('../src/code-nodes/manage-prediction-state');
const { schemas } = require('../src/code-nodes/data-table-schemas');

const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(__dirname, relativePath), 'utf8'));

test('mock Workflow A -> B scenario keeps season separation and routes missing strengths', () => {
  const settingsA = { league_id: 39, season: 2025, historical_cutoff_date: '2025-12-31T23:59:59Z', minimum_home_matches: 8, minimum_away_matches: 8 };
  const history = normaliseHistoryResponse(readJson('../test-data/mock-historical-fixtures.json'), settingsA);
  const strengths = calculateTeamStrengths(history.fixtures, settingsA, '2026-11-12T00:00:00.000Z');
  const stored = readJson('../test-data/mock-team-strengths.json');
  const upcoming = normaliseUpcomingFixtures(readJson('../test-data/mock-upcoming-fixtures.json'), {
    league_id: 39, fixture_season: 2026, strength_season: 2025,
    date_from: '2026-11-20', date_to: '2026-11-30',
  });
  const joined = joinTeamStrengths(upcoming.fixtures, stored.team_strengths, stored.league_strengths, {
    league_id: 39, strength_season: 2025, minimum_home_matches: 8, minimum_away_matches: 8,
  });
  assert.equal(strengths.leagueRow.season, 2025);
  assert.equal(joined.length, 3);
  assert.equal(joined[0].fixture_season, 2026);
  assert.equal(joined[0].strength_season, 2025);
  assert.equal(joined[0].data_quality.sufficient, true);
  assert.equal(joined[1].data_quality.sufficient, false);
  assert.ok(joined[1].data_quality.reasons.includes('missing_away_team_strength'));

  const prediction = calculatePrediction(joined[0], { strength_season: 2025, model_version: 'poisson-v1' });
  const message = formatPrediction({ ...prediction, league_name: joined[0].league_name }, 'Africa/Lagos');
  assert.match(message, /Mock Home vs Mock Away/);
  assert.match(message, /Probability coverage/);
  assert.match(message, /not guaranteed results/);
  assert.equal(decidePrediction(readJson('../test-data/mock-prediction-log.json'), 3003, 'poisson-v1').action, 'skip');
  assert.equal(schemas.prediction_log.length, 47);
});
