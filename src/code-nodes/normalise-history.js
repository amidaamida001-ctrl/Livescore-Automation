'use strict';

function isEmptyErrors(errors) {
  if (errors == null || errors === '') return true;
  if (Array.isArray(errors)) return errors.length === 0;
  if (typeof errors === 'object') return Object.keys(errors).length === 0;
  return false;
}

function validScore(value) {
  return Number.isInteger(value) && value >= 0;
}

function normaliseHistoryResponse(body, settings) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('API response must be an object.');
  }
  if (!isEmptyErrors(body.errors)) {
    throw new Error('API-Football reported response errors.');
  }
  if (!Array.isArray(body.response)) {
    throw new Error('API response.response must be an array.');
  }
  if (!body.paging || !Number.isInteger(body.paging.current) || !Number.isInteger(body.paging.total)) {
    throw new Error('Pagination metadata is missing or invalid; refusing a partial history refresh.');
  }
  if (body.paging.current < 1 || body.paging.total < 1 || body.paging.current < body.paging.total) {
    throw new Error('Historical response is incomplete; the requested fixture page set must not be partially aggregated.');
  }
  if (Number.isInteger(body.results) && body.results !== body.response.length) {
    throw new Error('API results count does not match response length.');
  }

  const accepted = [];
  const rejected = [];
  const seenFixtureIds = new Set();
  const cutoffTime = settings.historical_cutoff_date
    ? Date.parse(settings.historical_cutoff_date)
    : Number.POSITIVE_INFINITY;
  if (Number.isNaN(cutoffTime)) throw new Error('historical_cutoff_date is invalid.');

  for (const raw of body.response) {
    const fixtureId = raw?.fixture?.id;
    if (!Number.isInteger(fixtureId) || fixtureId <= 0) {
      rejected.push({ fixture_id: fixtureId ?? null, reason: 'invalid_fixture_id' });
      continue;
    }
    if (seenFixtureIds.has(fixtureId)) {
      rejected.push({ fixture_id: fixtureId, reason: 'duplicate_fixture_id' });
      continue;
    }
    seenFixtureIds.add(fixtureId);

    const status = raw?.fixture?.status?.short;
    if (status !== 'FT') {
      rejected.push({ fixture_id: fixtureId, reason: `ineligible_status:${status ?? 'missing'}` });
      continue;
    }

    const leagueId = raw?.league?.id;
    const season = raw?.league?.season;
    const home = raw?.teams?.home;
    const away = raw?.teams?.away;
    const matchDate = raw?.fixture?.date;
    const dateTime = Date.parse(matchDate);
    const homeGoals = raw?.score?.fulltime?.home;
    const awayGoals = raw?.score?.fulltime?.away;
    if (!Number.isInteger(leagueId) || leagueId !== settings.league_id || season !== settings.season) {
      rejected.push({ fixture_id: fixtureId, reason: 'league_or_season_mismatch' });
      continue;
    }
    if (!Number.isInteger(home?.id) || !Number.isInteger(away?.id) || home.id <= 0 || away.id <= 0) {
      rejected.push({ fixture_id: fixtureId, reason: 'missing_or_invalid_team_id' });
      continue;
    }
    if (!home?.name || !away?.name || !Number.isFinite(dateTime) || dateTime > cutoffTime) {
      rejected.push({ fixture_id: fixtureId, reason: 'missing_or_out_of_cutoff_fixture_data' });
      continue;
    }
    if (!validScore(homeGoals) || !validScore(awayGoals)) {
      rejected.push({ fixture_id: fixtureId, reason: 'missing_or_invalid_fulltime_score' });
      continue;
    }
    if ((raw.goals?.home != null && raw.goals.home !== homeGoals) ||
        (raw.goals?.away != null && raw.goals.away !== awayGoals)) {
      rejected.push({ fixture_id: fixtureId, reason: 'goals_and_fulltime_score_disagree' });
      continue;
    }

    accepted.push({
      fixture_id: fixtureId,
      league_id: leagueId,
      season,
      home_team_id: home.id,
      away_team_id: away.id,
      home_team: home.name,
      away_team: away.name,
      home_goals: homeGoals,
      away_goals: awayGoals,
      match_date: new Date(dateTime).toISOString(),
      match_status: status,
    });
  }

  return {
    fixtures: accepted,
    accepted_count: accepted.length,
    rejected_count: rejected.length,
    rejected,
    paging: { ...body.paging },
  };
}

module.exports = { normaliseHistoryResponse };
