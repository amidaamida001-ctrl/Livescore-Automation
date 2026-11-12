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
const {
  makePredictionKey,
  decidePrediction,
  createPendingPrediction,
  markSent,
  markFailed,
  keepPendingForReconciliation,
} = require('../src/code-nodes/manage-prediction-state');
const { schemas } = require('../src/code-nodes/data-table-schemas');

const mockHistorical = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../test-data/mock-historical-fixtures.json'), 'utf8')
);
const mockUpcoming = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../test-data/mock-upcoming-fixtures.json'), 'utf8')
);
const mockStored = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../test-data/mock-team-strengths.json'), 'utf8')
);

// SCENARIO A: Valid historical fixture response
test('Scenario A: Valid historical fixture response', () => {
  const settings = {
    league_id: 39,
    season: 2025,
    historical_cutoff_date: '2025-12-31T23:59:59Z',
    minimum_home_matches: 8,
    minimum_away_matches: 8,
  };
  const result = normaliseHistoryResponse(mockHistorical, settings);
  assert.equal(result.accepted_count, 16);
  assert.equal(result.fixtures.length, 16);
  assert.equal(result.fixtures[0].match_status, 'FT');
  assert.equal(result.fixtures[0].league_id, 39);
  assert.equal(result.fixtures[0].season, 2025);
});

// SCENARIO B: Empty historical response
test('Scenario B: Empty historical response', () => {
  const emptyBody = {
    get: 'fixtures',
    parameters: { league: '39', season: '2025', status: 'FT' },
    errors: [],
    results: 0,
    paging: { current: 1, total: 1 },
    response: [],
  };
  const settings = { league_id: 39, season: 2025 };
  const result = normaliseHistoryResponse(emptyBody, settings);
  assert.equal(result.accepted_count, 0);
  assert.equal(result.fixtures.length, 0);
});

// SCENARIO C: API error
test('Scenario C: API error handling', () => {
  const errorBody = {
    get: 'fixtures',
    parameters: {},
    errors: { token: 'Invalid API key or quota exceeded' },
    results: 0,
    paging: { current: 1, total: 1 },
    response: [],
  };
  assert.throws(
    () => normaliseHistoryResponse(errorBody, { league_id: 39, season: 2025 }),
    /response errors/
  );
});

// SCENARIO D: Exclusion of AET and PEN
test('Scenario D: Exclusion of AET and PEN fixtures', () => {
  const settings = { league_id: 39, season: 2025 };
  const result = normaliseHistoryResponse(mockHistorical, settings);
  const aetRejection = result.rejected.find((r) => r.reason === 'ineligible_status:AET');
  const penRejection = result.rejected.find((r) => r.reason === 'ineligible_status:PEN');
  assert.ok(aetRejection, 'AET fixture must be rejected');
  assert.ok(penRejection, 'PEN fixture must be rejected');
  assert.ok(!result.fixtures.some((f) => f.match_status === 'AET' || f.match_status === 'PEN'));
});

// SCENARIO E: Duplicate fixture handling
test('Scenario E: Duplicate fixture handling', () => {
  const settings = { league_id: 39, season: 2025 };
  const result = normaliseHistoryResponse(mockHistorical, settings);
  const dupRejection = result.rejected.find((r) => r.reason === 'duplicate_fixture_id');
  assert.ok(dupRejection, 'Duplicate fixture ID must be rejected');
  const uniqueIds = new Set(result.fixtures.map((f) => f.fixture_id));
  assert.equal(uniqueIds.size, result.fixtures.length);
});

// SCENARIO F: Correct league averages
test('Scenario F: Correct league averages calculation', () => {
  const settings = {
    league_id: 39,
    season: 2025,
    minimum_home_matches: 8,
    minimum_away_matches: 8,
  };
  const normalized = normaliseHistoryResponse(mockHistorical, settings);
  const aggregates = calculateTeamStrengths(normalized.fixtures, settings);
  assert.equal(aggregates.valid_fixture_count, 16);
  assert.equal(aggregates.leagueRow.league_home_avg, 27 / 16);
  assert.equal(aggregates.leagueRow.league_away_avg, 20 / 16);
  assert.equal(aggregates.leagueRow.league_key, '39|2025');
});

// SCENARIO G: Correct team home and away statistics
test('Scenario G: Correct team home and away statistics', () => {
  const settings = {
    league_id: 39,
    season: 2025,
    minimum_home_matches: 8,
    minimum_away_matches: 8,
  };
  const normalized = normaliseHistoryResponse(mockHistorical, settings);
  const aggregates = calculateTeamStrengths(normalized.fixtures, settings);
  const homeTeam = aggregates.teamRows.find((t) => t.team_id === 42);
  const awayTeam = aggregates.teamRows.find((t) => t.team_id === 49);

  assert.equal(homeTeam.home_played, 8);
  assert.equal(homeTeam.home_goals_for, 18);
  assert.equal(homeTeam.home_goals_against, 9);
  assert.equal(homeTeam.away_played, 8);
  assert.equal(homeTeam.away_goals_for, 11);
  assert.equal(homeTeam.away_goals_against, 9);
  assert.equal(homeTeam.team_key, '39|2025|42');

  assert.equal(awayTeam.home_played, 8);
  assert.equal(awayTeam.home_goals_for, 9);
  assert.equal(awayTeam.home_goals_against, 11);
  assert.equal(awayTeam.away_played, 8);
  assert.equal(awayTeam.away_goals_for, 9);
  assert.equal(awayTeam.away_goals_against, 18);
  assert.equal(awayTeam.team_key, '39|2025|49');
});

// SCENARIO H: Minimum sample validation
test('Scenario H: Minimum sample validation', () => {
  const settings = {
    league_id: 39,
    strength_season: 2025,
    minimum_home_matches: 8,
    minimum_away_matches: 8,
  };
  const lowSampleTeams = [
    {
      team_key: '39|2025|42',
      league_id: 39,
      season: 2025,
      team_id: 42,
      team_name: 'Low Home',
      home_played: 7, // < 8
      home_goals_for: 10,
      home_goals_against: 5,
      away_played: 8,
      away_goals_for: 8,
      away_goals_against: 8,
    },
    {
      team_key: '39|2025|49',
      league_id: 39,
      season: 2025,
      team_id: 49,
      team_name: 'Valid Away',
      home_played: 8,
      home_goals_for: 10,
      home_goals_against: 5,
      away_played: 8,
      away_goals_for: 8,
      away_goals_against: 8,
    },
  ];
  const fixtures = [
    {
      fixture_id: 5001,
      home_team_id: 42,
      away_team_id: 49,
      fixture_season: 2026,
    },
  ];
  const joined = joinTeamStrengths(fixtures, lowSampleTeams, mockStored.league_strengths, settings);
  assert.equal(joined[0].data_quality.sufficient, false);
  assert.ok(joined[0].data_quality.reasons.includes('insufficient_home_appearances'));
});

// SCENARIO I: Missing team strength
test('Scenario I: Missing team strength routing', () => {
  const settings = {
    league_id: 39,
    strength_season: 2025,
    minimum_home_matches: 8,
    minimum_away_matches: 8,
  };
  const fixtures = [
    {
      fixture_id: 5002,
      home_team_id: 42,
      away_team_id: 999, // Unseen/promoted team
      fixture_season: 2026,
    },
  ];
  const joined = joinTeamStrengths(fixtures, mockStored.team_strengths, mockStored.league_strengths, settings);
  assert.equal(joined[0].data_quality.sufficient, false);
  assert.ok(joined[0].data_quality.reasons.includes('missing_away_team_strength'));
  assert.throws(
    () => calculatePrediction(joined[0], { strength_season: 2025, model_version: 'poisson-v1' }),
    /Insufficient historical data/
  );
});

// SCENARIO J: Expected-goals calculation & Hand-check verification
test('Scenario J: Expected-goals calculation & Hand-check verification', () => {
  // Hand check example:
  // league_home_avg = 1.50, league_away_avg = 1.10
  // Home team: home_played = 10, home_goals_for = 18, home_goals_against = 9
  // Away team: away_played = 10, away_goals_for = 12, away_goals_against = 16
  // Expected values: lambda_home = 1.92, lambda_away = 0.98
  const sample = {
    fixture_id: 9001,
    league_id: 39,
    league_name: 'Premier League',
    fixture_season: 2026,
    match_date: '2026-11-21T17:30:00.000Z',
    home_team_id: 10,
    home_team_name: 'Arsenal',
    away_team_id: 20,
    away_team_name: 'Manchester City',
    data_quality: { sufficient: true, reasons: [] },
    home_strength: {
      team_id: 10,
      home_played: 10,
      home_goals_for: 18,
      home_goals_against: 9,
      updated_at: '2026-11-12T00:00:00.000Z',
    },
    away_strength: {
      team_id: 20,
      away_played: 10,
      away_goals_for: 12,
      away_goals_against: 16,
      updated_at: '2026-11-12T00:00:00.000Z',
    },
    league_strength: {
      league_home_avg: 1.5,
      league_away_avg: 1.1,
      matches_used: 100,
      updated_at: '2026-11-12T00:00:00.000Z',
    },
  };

  const prediction = calculatePrediction(sample, {
    strength_season: 2025,
    model_version: 'poisson-v1',
    baseline_max_goals: 5,
    max_score_goal_limit: 50,
    required_grid_mass: 0.999999,
  });

  // Verify lambda_home:
  // home_attack = (18 / 10) / 1.5 = 1.8 / 1.5 = 1.2
  // away_defence_weakness = (16 / 10) / 1.5 = 1.6 / 1.5 = 1.0666666666666667
  // lambda_home = 1.5 * 1.2 * 1.0666666666666667 = 1.92
  assert.ok(Math.abs(prediction.lambda_home - 1.92) < 1e-12, `lambda_home should be 1.92, got ${prediction.lambda_home}`);

  // Verify lambda_away:
  // away_attack = (12 / 10) / 1.1 = 1.2 / 1.1 = 1.0909090909090908
  // home_defence_weakness = (9 / 10) / 1.1 = 0.9 / 1.1 = 0.8181818181818182
  // lambda_away = 1.1 * 1.0909090909090908 * 0.8181818181818182 = 0.9818181818181818 (~0.98)
  assert.ok(Math.abs(prediction.lambda_away - 0.9818181818181818) < 1e-12, `lambda_away should be ~0.98, got ${prediction.lambda_away}`);
});

// SCENARIO K: Poisson scoreline ranking
test('Scenario K: Poisson scoreline ranking', () => {
  const sample = {
    fixture_id: 9001,
    league_id: 39,
    league_name: 'Premier League',
    fixture_season: 2026,
    match_date: '2026-11-21T17:30:00.000Z',
    home_team_id: 10,
    home_team_name: 'Arsenal',
    away_team_id: 20,
    away_team_name: 'Manchester City',
    data_quality: { sufficient: true, reasons: [] },
    home_strength: { team_id: 10, home_played: 10, home_goals_for: 18, home_goals_against: 9, updated_at: '2026-11-12T00:00:00.000Z' },
    away_strength: { team_id: 20, away_played: 10, away_goals_for: 12, away_goals_against: 16, updated_at: '2026-11-12T00:00:00.000Z' },
    league_strength: { league_home_avg: 1.5, league_away_avg: 1.1, matches_used: 100, updated_at: '2026-11-12T00:00:00.000Z' },
  };
  const prediction = calculatePrediction(sample, {
    strength_season: 2025,
    model_version: 'poisson-v1',
  });
  assert.equal(prediction.top_scores.length, 3);
  assert.ok(prediction.top_scores[0].probability >= prediction.top_scores[1].probability);
  assert.ok(prediction.top_scores[1].probability >= prediction.top_scores[2].probability);
  assert.equal(prediction.top_score, `${prediction.top_scores[0].home_goals}-${prediction.top_scores[0].away_goals}`);
});

// SCENARIO L: Probability mass and residual calculations
test('Scenario L: Probability mass and residual calculations', () => {
  const sample = {
    fixture_id: 9001,
    league_id: 39,
    league_name: 'Premier League',
    fixture_season: 2026,
    match_date: '2026-11-21T17:30:00.000Z',
    home_team_id: 10,
    home_team_name: 'Arsenal',
    away_team_id: 20,
    away_team_name: 'Manchester City',
    data_quality: { sufficient: true, reasons: [] },
    home_strength: { team_id: 10, home_played: 10, home_goals_for: 18, home_goals_against: 9, updated_at: '2026-11-12T00:00:00.000Z' },
    away_strength: { team_id: 20, away_played: 10, away_goals_for: 12, away_goals_against: 16, updated_at: '2026-11-12T00:00:00.000Z' },
    league_strength: { league_home_avg: 1.5, league_away_avg: 1.1, matches_used: 100, updated_at: '2026-11-12T00:00:00.000Z' },
  };
  const prediction = calculatePrediction(sample, {
    strength_season: 2025,
    model_version: 'poisson-v1',
    required_grid_mass: 0.999999,
  });
  assert.ok(prediction.grid_mass >= 0.999999, `grid_mass must be >= 0.999999, got ${prediction.grid_mass}`);
  assert.ok(prediction.residual_prob >= 0, `residual must be nonnegative`);
  assert.ok(Math.abs((prediction.grid_mass + prediction.residual_prob) - 1.0) < 1e-12);
  const outcomeTotal = prediction.home_win_prob + prediction.draw_prob + prediction.away_win_prob;
  assert.ok(Math.abs(outcomeTotal - prediction.grid_mass) < 1e-12, '1X2 outcomes must equal grid mass');
});

// SCENARIO M: Grid limit handling
test('Scenario M: Grid limit handling up to 50 goals', () => {
  const sample = {
    fixture_id: 9001,
    league_id: 39,
    league_name: 'Premier League',
    fixture_season: 2026,
    match_date: '2026-11-21T17:30:00.000Z',
    home_team_id: 10,
    home_team_name: 'Arsenal',
    away_team_id: 20,
    away_team_name: 'Manchester City',
    data_quality: { sufficient: true, reasons: [] },
    home_strength: { team_id: 10, home_played: 10, home_goals_for: 18, home_goals_against: 9, updated_at: '2026-11-12T00:00:00.000Z' },
    away_strength: { team_id: 20, away_played: 10, away_goals_for: 12, away_goals_against: 16, updated_at: '2026-11-12T00:00:00.000Z' },
    league_strength: { league_home_avg: 1.5, league_away_avg: 1.1, matches_used: 100, updated_at: '2026-11-12T00:00:00.000Z' },
  };
  const prediction = calculatePrediction(sample, {
    strength_season: 2025,
    model_version: 'poisson-v1',
    max_score_goal_limit: 50,
    required_grid_mass: 0.999999,
  });
  assert.ok(prediction.grid_max_goals <= 50, 'grid_max_goals must never exceed 50');

  // If impossible threshold requested with baseline equal to limit, fail closed
  assert.throws(
    () => calculatePrediction(sample, { baseline_max_goals: 5, max_score_goal_limit: 5, required_grid_mass: 0.999999 }),
    /mass target not reached/
  );
});

// SCENARIO N: Duplicate prediction prevention
test('Scenario N: Duplicate prediction prevention', () => {
  const existingLog = [
    { prediction_key: '3001|poisson-v1', fixture_id: 3001, model_version: 'poisson-v1', status: 'sent' },
    { prediction_key: '3002|poisson-v1', fixture_id: 3002, model_version: 'poisson-v1', status: 'pending' },
    { prediction_key: '3003|poisson-v1', fixture_id: 3003, model_version: 'poisson-v1', status: 'failed' },
  ];
  // Sent fixture: skip
  assert.equal(decidePrediction(existingLog, 3001, 'poisson-v1').action, 'skip');
  // Pending fixture: reconcile
  assert.equal(decidePrediction(existingLog, 3002, 'poisson-v1').action, 'reconcile');
  // Failed fixture: reconcile (do not resend automatically)
  assert.equal(decidePrediction(existingLog, 3003, 'poisson-v1').action, 'reconcile');
  // New fixture: create_pending
  assert.equal(decidePrediction(existingLog, 3004, 'poisson-v1').action, 'create_pending');
});

// SCENARIO O: Pending Telegram status
test('Scenario O: Pending Telegram status before delivery', () => {
  const prediction = { fixture_id: 4001, model_version: 'poisson-v1' };
  const pending = createPendingPrediction(prediction, '2026-11-12T12:00:00Z');
  assert.equal(pending.status, 'pending');
  assert.equal(pending.attempt_count, 0);
  assert.equal(pending.prediction_key, '4001|poisson-v1');
  assert.equal(pending.sent_at, null);
  assert.equal(pending.telegram_message_id, null);
});

// SCENARIO P: Successful Telegram delivery with mock response
test('Scenario P: Successful Telegram delivery state transition', () => {
  const pending = createPendingPrediction({ fixture_id: 4001, model_version: 'poisson-v1' });
  const sent = markSent(pending, '2026-11-12T12:01:00Z', 'tg-msg-999');
  assert.equal(sent.status, 'sent');
  assert.equal(sent.sent_at, '2026-11-12T12:01:00Z');
  assert.equal(sent.telegram_message_id, 'tg-msg-999');
  assert.equal(sent.attempt_count, 1);
});

// SCENARIO Q: Explicit Telegram failure
test('Scenario Q: Explicit Telegram failure state transition', () => {
  const pending = createPendingPrediction({ fixture_id: 4001, model_version: 'poisson-v1' });
  const failed = markFailed(pending, '2026-11-12T12:01:00Z', 'HTTP 403 Forbidden: bot was blocked by user');
  assert.equal(failed.status, 'failed');
  assert.equal(failed.attempt_count, 1);
  assert.ok(failed.error_message.includes('403 Forbidden'));
});

// SCENARIO R: Ambiguous delivery timeout
test('Scenario R: Ambiguous delivery timeout keeps pending for reconciliation', () => {
  const pending = createPendingPrediction({ fixture_id: 4001, model_version: 'poisson-v1' });
  const timeout = keepPendingForReconciliation(pending, '2026-11-12T12:01:00Z', 'Gateway Timeout 504');
  assert.equal(timeout.status, 'pending');
  assert.equal(timeout.attempt_count, 1);
  assert.ok(timeout.error_message.includes('504'));
});

// SCENARIO S: No upcoming fixtures
test('Scenario S: No upcoming fixtures handling', () => {
  const emptyUpcoming = {
    get: 'fixtures',
    parameters: { league: '39', season: '2026', status: 'NS' },
    errors: [],
    results: 0,
    paging: { current: 1, total: 1 },
    response: [],
  };
  const settings = {
    league_id: 39,
    fixture_season: 2026,
    strength_season: 2025,
    date_from: '2026-11-20',
    date_to: '2026-11-30',
  };
  const normalized = normaliseUpcomingFixtures(emptyUpcoming, settings);
  assert.equal(normalized.accepted_count, 0);
  assert.equal(normalized.fixtures.length, 0);
});

// SCENARIO T: Multiple upcoming fixtures
test('Scenario T: Multiple upcoming fixtures processing', () => {
  const settings = {
    league_id: 39,
    fixture_season: 2026,
    strength_season: 2025,
    date_from: '2026-11-20',
    date_to: '2026-11-30',
    minimum_home_matches: 8,
    minimum_away_matches: 8,
  };
  const normalized = normaliseUpcomingFixtures(mockUpcoming, settings);
  assert.equal(normalized.accepted_count, 3);
  const joined = joinTeamStrengths(normalized.fixtures, mockStored.team_strengths, mockStored.league_strengths, settings);
  assert.equal(joined.length, 3);
  // Match 1: sufficient (home 42, away 49)
  assert.equal(joined[0].data_quality.sufficient, true);
  // Match 2: missing away team (team 777)
  assert.equal(joined[1].data_quality.sufficient, false);
  assert.ok(joined[1].data_quality.reasons.includes('missing_away_team_strength'));
  // Match 3: sufficient (home 49, away 42)
  assert.equal(joined[2].data_quality.sufficient, true);
});
