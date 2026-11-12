'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normaliseHistoryResponse } = require('../src/code-nodes/normalise-history');
const { calculateTeamStrengths } = require('../src/code-nodes/calculate-team-strengths');

const body = JSON.parse(fs.readFileSync(path.join(__dirname, '../test-data/mock-historical-fixtures.json'), 'utf8'));
const settings = { league_id: 39, season: 2025, historical_cutoff_date: '2025-12-31T23:59:59Z', minimum_home_matches: 8, minimum_away_matches: 8 };

test('league and team aggregates use unique FT fixtures and numeric team IDs', () => {
  const normalized = normaliseHistoryResponse(body, settings);
  const result = calculateTeamStrengths(normalized.fixtures, settings, '2026-11-12T00:00:00.000Z');
  assert.equal(result.valid_fixture_count, 16);
  assert.equal(result.team_count, 2);
  assert.equal(result.leagueRow.league_home_avg, 27 / 16);
  assert.equal(result.leagueRow.league_away_avg, 20 / 16);
  const home = result.teamRows.find((team) => team.team_id === 42);
  assert.equal(home.home_played, 8);
  assert.equal(home.home_goals_for, 18);
  assert.equal(home.home_goals_against, 9);
  assert.equal(home.away_played, 8);
  assert.equal(home.away_goals_for, 11);
  assert.equal(home.away_goals_against, 9);
  assert.equal(home.team_key, '39|2025|42');
  assert.ok(result.adequacy.every((row) => row.home_sufficient && row.away_sufficient));
});

test('aggregation refuses empty, duplicate, or invalid-goal fixture input', () => {
  assert.throws(() => calculateTeamStrengths([], settings), /No eligible fixtures/);
  const normalized = normaliseHistoryResponse(body, settings);
  assert.throws(() => calculateTeamStrengths([...normalized.fixtures, normalized.fixtures[0]], settings), /Duplicate fixture/);
  assert.throws(() => calculateTeamStrengths([{ ...normalized.fixtures[0], home_goals: -1 }], settings), /invalid goal/);
});
