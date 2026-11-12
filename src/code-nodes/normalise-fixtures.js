'use strict';

function isEmptyErrors(errors) {
  if (errors == null || errors === '') return true;
  if (Array.isArray(errors)) return errors.length === 0;
  if (typeof errors === 'object') return Object.keys(errors).length === 0;
  return false;
}

function normaliseUpcomingFixtures(body, settings) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('API response must be an object.');
  if (!isEmptyErrors(body.errors)) throw new Error('API-Football reported response errors.');
  if (!Array.isArray(body.response)) throw new Error('API response.response must be an array.');
  if (!body.paging || !Number.isInteger(body.paging.current) || !Number.isInteger(body.paging.total)) {
    throw new Error('Upcoming fixture pagination metadata is missing or invalid.');
  }
  if (body.paging.current < 1 || body.paging.current < body.paging.total) {
    throw new Error('Upcoming fixture response is incomplete; refusing to predict from a partial fixture set.');
  }
  if (Number.isInteger(body.results) && body.results !== body.response.length) {
    throw new Error('API results count does not match response length.');
  }
  const from = settings.date_from ? Date.parse(settings.date_from) : Number.NEGATIVE_INFINITY;
  const to = settings.date_to ? Date.parse(`${settings.date_to}T23:59:59.999Z`) : Number.POSITIVE_INFINITY;
  if (Number.isNaN(from) || Number.isNaN(to)) throw new Error('Configured fixture date window is invalid.');

  const fixtures = [];
  const rejected = [];
  const seen = new Set();
  for (const raw of body.response) {
    const fixtureId = raw?.fixture?.id;
    const status = raw?.fixture?.status?.short;
    if (!Number.isInteger(fixtureId) || fixtureId <= 0) {
      rejected.push({ fixture_id: fixtureId ?? null, reason: 'invalid_fixture_id' });
      continue;
    }
    if (seen.has(fixtureId)) {
      rejected.push({ fixture_id: fixtureId, reason: 'duplicate_fixture_id' });
      continue;
    }
    seen.add(fixtureId);
    const home = raw?.teams?.home;
    const away = raw?.teams?.away;
    const matchDate = Date.parse(raw?.fixture?.date);
    if (raw?.league?.id !== settings.league_id || raw?.league?.season !== settings.fixture_season) {
      rejected.push({ fixture_id: fixtureId, reason: 'league_or_fixture_season_mismatch' });
      continue;
    }
    if (status !== 'NS') {
      rejected.push({ fixture_id: fixtureId, reason: `not_unstarted:${status ?? 'missing'}` });
      continue;
    }
    if (!Number.isInteger(home?.id) || !Number.isInteger(away?.id) || home.id <= 0 || away.id <= 0 ||
        !home.name || !away.name || !Number.isFinite(matchDate) || matchDate < from || matchDate > to) {
      rejected.push({ fixture_id: fixtureId, reason: 'invalid_fixture_identity_or_date' });
      continue;
    }
    fixtures.push({
      fixture_id: fixtureId,
      league_id: settings.league_id,
      league_name: raw.league.name,
      fixture_season: raw.league.season,
      strength_season: settings.strength_season,
      match_date: new Date(matchDate).toISOString(),
      home_team_id: home.id,
      home_team_name: home.name,
      away_team_id: away.id,
      away_team_name: away.name,
      status,
    });
  }
  return { fixtures, accepted_count: fixtures.length, rejected_count: rejected.length, rejected, paging: { ...body.paging } };
}

module.exports = { normaliseUpcomingFixtures };
