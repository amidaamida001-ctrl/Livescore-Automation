'use strict';

function compositeKey(leagueId, season, teamId) {
  return `${Number(leagueId)}|${Number(season)}|${Number(teamId)}`;
}

function joinTeamStrengths(fixtures, teamRows, leagueRows, settings) {
  if (!Array.isArray(fixtures) || !Array.isArray(teamRows) || !Array.isArray(leagueRows)) {
    throw new Error('fixtures, teamRows, and leagueRows must be arrays.');
  }
  const teamMap = new Map();
  const duplicateTeamKeys = new Set();
  for (const row of teamRows) {
    if (row?.league_id !== settings.league_id || row?.season !== settings.strength_season ||
        !Number.isInteger(row?.team_id)) continue;
    const key = compositeKey(row.league_id, row.season, row.team_id);
    if (teamMap.has(key)) duplicateTeamKeys.add(key);
    else teamMap.set(key, row);
  }
  const matchingLeagues = leagueRows.filter((row) => row?.league_id === settings.league_id && row?.season === settings.strength_season);
  const leagueRow = matchingLeagues.length === 1 ? matchingLeagues[0] : null;

  return fixtures.map((fixture) => {
    const homeKey = compositeKey(settings.league_id, settings.strength_season, fixture.home_team_id);
    const awayKey = compositeKey(settings.league_id, settings.strength_season, fixture.away_team_id);
    const homeStrength = teamMap.get(homeKey) || null;
    const awayStrength = teamMap.get(awayKey) || null;
    const reasons = [];
    if (matchingLeagues.length === 0) reasons.push('missing_league_strengths');
    if (matchingLeagues.length > 1) reasons.push('duplicate_league_strengths');
    if (!homeStrength) reasons.push('missing_home_team_strength');
    if (!awayStrength) reasons.push('missing_away_team_strength');
    if (duplicateTeamKeys.has(homeKey)) reasons.push('duplicate_home_team_strength');
    if (duplicateTeamKeys.has(awayKey)) reasons.push('duplicate_away_team_strength');
    if (homeStrength && homeStrength.home_played < settings.minimum_home_matches) reasons.push('insufficient_home_appearances');
    if (awayStrength && awayStrength.away_played < settings.minimum_away_matches) reasons.push('insufficient_away_appearances');
    if (leagueRow && (!Number.isFinite(leagueRow.league_home_avg) || leagueRow.league_home_avg <= 0 ||
        !Number.isFinite(leagueRow.league_away_avg) || leagueRow.league_away_avg <= 0 || leagueRow.matches_used <= 0)) {
      reasons.push('invalid_league_average');
    }
    return {
      ...fixture,
      home_strength: homeStrength,
      away_strength: awayStrength,
      league_strength: leagueRow,
      data_quality: { sufficient: reasons.length === 0, reasons },
    };
  });
}

module.exports = { compositeKey, joinTeamStrengths };
