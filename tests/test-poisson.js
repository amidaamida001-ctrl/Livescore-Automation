'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculatePrediction } = require('../src/code-nodes/calculate-poisson');

function sampleJoined() {
  return {
    fixture_id: 9001,
    league_id: 39,
    league_name: 'Mock Premier League',
    fixture_season: 2026,
    match_date: '2026-11-21T17:30:00.000Z',
    home_team_id: 10,
    home_team_name: 'Home Test',
    away_team_id: 20,
    away_team_name: 'Away Test',
    data_quality: { sufficient: true, reasons: [] },
    home_strength: { team_id: 10, home_played: 10, home_goals_for: 18, home_goals_against: 9, updated_at: '2026-11-12T00:00:00.000Z' },
    away_strength: { team_id: 20, away_played: 10, away_goals_for: 12, away_goals_against: 16, updated_at: '2026-11-12T00:00:00.000Z' },
    league_strength: { league_home_avg: 1.5, league_away_avg: 1.1, matches_used: 100, updated_at: '2026-11-12T00:00:00.000Z' },
  };
}

test('approved formulas reproduce the hand-check lambdas and adaptive grid target', () => {
  const prediction = calculatePrediction(sampleJoined(), {
    strength_season: 2025,
    model_version: 'poisson-v1',
    baseline_max_goals: 5,
    max_score_goal_limit: 50,
    required_grid_mass: 0.999999,
  });
  assert.ok(Math.abs(prediction.lambda_home - 1.92) < 1e-12);
  assert.ok(Math.abs(prediction.lambda_away - 0.9818181818181818) < 1e-12);
  assert.ok(prediction.grid_max_goals >= 5 && prediction.grid_max_goals <= 50);
  assert.ok(prediction.grid_mass >= 0.999999);
  assert.ok(Math.abs(prediction.residual_prob - (1 - prediction.grid_mass)) < 1e-14);
  assert.equal(prediction.top_scores.length, 3);
  assert.deepEqual([...prediction.top_scores].sort((a, b) => b.probability - a.probability), prediction.top_scores);
  assert.ok(Math.abs(prediction.home_win_prob + prediction.draw_prob + prediction.away_win_prob - prediction.grid_mass) < 1e-12);
  assert.equal(prediction.prediction_key, '9001|poisson-v1');
});

test('calculation rejects zero denominators, nonpositive expected goals, and an unreachable grid target', () => {
  const joined = sampleJoined();
  assert.throws(() => calculatePrediction({ ...joined, home_strength: { ...joined.home_strength, home_played: 0 } }, {}), /denominator is zero/);
  assert.throws(() => calculatePrediction({ ...joined, home_strength: { ...joined.home_strength, home_goals_for: 0 } }, {}), /must be positive/);
  assert.throws(() => calculatePrediction(joined, { baseline_max_goals: 5, max_score_goal_limit: 5, required_grid_mass: 0.999999 }), /mass target not reached/);
});
