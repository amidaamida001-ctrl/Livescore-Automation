'use strict';

function calculateTeamStrengths(fixtures, settings, updatedAt = new Date().toISOString()) {
  if (!Array.isArray(fixtures)) throw new Error('fixtures must be an array.');
  if (fixtures.length === 0) throw new Error('No eligible fixtures; refusing to write empty strengths.');
  const seen = new Set();
  let totalHomeGoals = 0;
  let totalAwayGoals = 0;
  const teams = new Map();

  function teamRecord(teamId, teamName) {
    if (!teams.has(teamId)) {
      teams.set(teamId, {
        team_key: `${settings.league_id}|${settings.season}|${teamId}`,
        league_id: settings.league_id,
        season: settings.season,
        team_id: teamId,
        team_name: teamName,
        home_played: 0,
        home_goals_for: 0,
        home_goals_against: 0,
        away_played: 0,
        away_goals_for: 0,
        away_goals_against: 0,
        updated_at: updatedAt,
      });
    }
    const record = teams.get(teamId);
    if (record.team_name !== teamName) record.team_name = teamName;
    return record;
  }

  for (const fixture of fixtures) {
    if (!fixture || fixture.match_status !== 'FT') throw new Error('Only normalized FT fixtures may be aggregated.');
    if (fixture.league_id !== settings.league_id || fixture.season !== settings.season) {
      throw new Error('Fixture league/season does not match the refresh settings.');
    }
    if (seen.has(fixture.fixture_id)) throw new Error(`Duplicate fixture ${fixture.fixture_id} reached aggregation.`);
    seen.add(fixture.fixture_id);
    if (!Number.isInteger(fixture.home_goals) || fixture.home_goals < 0 ||
        !Number.isInteger(fixture.away_goals) || fixture.away_goals < 0) {
      throw new Error(`Fixture ${fixture.fixture_id} has invalid goal values.`);
    }

    totalHomeGoals += fixture.home_goals;
    totalAwayGoals += fixture.away_goals;
    const home = teamRecord(fixture.home_team_id, fixture.home_team);
    const away = teamRecord(fixture.away_team_id, fixture.away_team);
    home.home_played += 1;
    home.home_goals_for += fixture.home_goals;
    home.home_goals_against += fixture.away_goals;
    away.away_played += 1;
    away.away_goals_for += fixture.away_goals;
    away.away_goals_against += fixture.home_goals;
  }

  const matchesUsed = fixtures.length;
  const leagueRow = {
    league_key: `${settings.league_id}|${settings.season}`,
    league_id: settings.league_id,
    season: settings.season,
    league_home_avg: totalHomeGoals / matchesUsed,
    league_away_avg: totalAwayGoals / matchesUsed,
    matches_used: matchesUsed,
    updated_at: updatedAt,
  };
  if (!Number.isFinite(leagueRow.league_home_avg) || !Number.isFinite(leagueRow.league_away_avg)) {
    throw new Error('League scoring averages are not finite.');
  }

  const teamRows = [...teams.values()].sort((a, b) => a.team_id - b.team_id);
  const minHome = settings.minimum_home_matches;
  const minAway = settings.minimum_away_matches;
  return {
    leagueRow,
    teamRows,
    valid_fixture_count: matchesUsed,
    team_count: teamRows.length,
    adequacy: teamRows.map((team) => ({
      team_id: team.team_id,
      home_sufficient: team.home_played >= minHome,
      away_sufficient: team.away_played >= minAway,
    })),
  };
}

module.exports = { calculateTeamStrengths };
