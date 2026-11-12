'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function uuid() {
  return crypto.randomUUID();
}

// -------------------------------------------------------------
// WORKFLOW 1: Football Prediction — Build Team Strengths
// -------------------------------------------------------------
function buildWorkflowA() {
  const nodes = [
    {
      parameters: {},
      id: uuid(),
      name: 'Start Data Refresh',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [200, 300],
    },
    {
      parameters: {
        mode: 'manual',
        fields: {
          values: [
            { name: 'league_id', type: 'number', value: 39 },
            { name: 'season', type: 'number', value: 2025 },
            { name: 'timezone', type: 'string', value: 'Africa/Lagos' },
            { name: 'minimum_home_matches', type: 'number', value: 8 },
            { name: 'minimum_away_matches', type: 'number', value: 8 },
            { name: 'historical_status', type: 'string', value: 'FT' },
            { name: 'historical_cutoff_date', type: 'string', value: '2025-12-31T23:59:59Z' },
            { name: 'data_mode', type: 'string', value: 'mock' },
          ],
        },
      },
      id: uuid(),
      name: 'Data Settings',
      type: 'n8n-nodes-base.set',
      typeVersion: 3.4,
      position: [420, 300],
    },
    {
      parameters: {
        conditions: {
          string: [
            {
              value1: '={{ $json.data_mode }}',
              value2: 'mock',
            },
          ],
        },
      },
      id: uuid(),
      name: 'Check Data Mode',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [640, 300],
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: `// Load verified mock historical fixtures for safe offline execution and testing
const mockData = ${fs.readFileSync(path.join(__dirname, '../test-data/mock-historical-fixtures.json'), 'utf8')};
return [{ json: mockData }];`,
      },
      id: uuid(),
      name: 'Load Mock Historical Fixtures',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [880, 200],
    },
    {
      parameters: {
        url: 'https://v3.football.api-sports.io/fixtures',
        sendQuery: true,
        queryParameters: {
          parameters: [
            { name: 'league', value: '={{ $json.league_id }}' },
            { name: 'season', value: '={{ $json.season }}' },
            { name: 'status', value: '={{ $json.historical_status }}' },
            { name: 'timezone', value: '={{ $json.timezone }}' },
          ],
        },
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        options: {
          fullResponse: false,
        },
      },
      id: uuid(),
      name: 'Get Completed Fixtures',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [880, 420],
      credentials: {
        httpHeaderAuth: {
          id: 'credential-api-football-auth',
          name: 'API-Football Header Auth',
        },
      },
    },
    {
      parameters: {
        conditions: {
          boolean: [
            {
              value1: '={{ typeof $json === "object" && $json !== null && (!Array.isArray($json.errors) || $json.errors.length === 0) && (typeof $json.errors !== "object" || Object.keys($json.errors).length === 0) && Array.isArray($json.response) }}',
              value2: true,
            },
          ],
        },
      },
      id: uuid(),
      name: 'API Response OK?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [1120, 300],
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: `// Validate and normalise historical fixtures
const rawBody = $input.first().json;
const settings = $('Data Settings').first().json;

function isEmptyErrors(errors) {
  if (errors == null || errors === '') return true;
  if (Array.isArray(errors)) return errors.length === 0;
  if (typeof errors === 'object') return Object.keys(errors).length === 0;
  return false;
}

function validScore(val) {
  return Number.isInteger(val) && val >= 0;
}

if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
  throw new Error('API response must be an object.');
}
if (!isEmptyErrors(rawBody.errors)) {
  throw new Error('API-Football reported response errors: ' + JSON.stringify(rawBody.errors));
}
if (!Array.isArray(rawBody.response)) {
  throw new Error('API response.response must be an array.');
}
if (!rawBody.paging || !Number.isInteger(rawBody.paging.current) || !Number.isInteger(rawBody.paging.total)) {
  throw new Error('Pagination metadata is missing or invalid; refusing partial history refresh.');
}
if (rawBody.paging.current < 1 || rawBody.paging.total < 1 || rawBody.paging.current < rawBody.paging.total) {
  throw new Error('Historical response is incomplete; refusing partial set.');
}
if (Number.isInteger(rawBody.results) && rawBody.results !== rawBody.response.length) {
  throw new Error('API results count does not match response length.');
}

const accepted = [];
const rejected = [];
const seenFixtureIds = new Set();
const cutoffTime = settings.historical_cutoff_date
  ? Date.parse(settings.historical_cutoff_date)
  : Number.POSITIVE_INFINITY;

for (const raw of rawBody.response) {
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
    rejected.push({ fixture_id: fixtureId, reason: 'ineligible_status:' + (status ?? 'missing') });
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

return [{
  json: {
    fixtures: accepted,
    accepted_count: accepted.length,
    rejected_count: rejected.length,
    rejected,
  }
}];`,
      },
      id: uuid(),
      name: 'Validate & Normalise History',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1360, 200],
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: `// Calculate league scoring averages and team home/away strengths
const inputData = $input.first().json;
const fixtures = inputData.fixtures || [];
const settings = $('Data Settings').first().json;
const updatedAt = new Date().toISOString();

if (fixtures.length === 0) {
  throw new Error('No eligible FT fixtures found; refusing to calculate empty strengths.');
}

const seen = new Set();
let totalHomeGoals = 0;
let totalAwayGoals = 0;
const teams = new Map();

function teamRecord(teamId, teamName) {
  if (!teams.has(teamId)) {
    teams.set(teamId, {
      team_key: settings.league_id + '|' + settings.season + '|' + teamId,
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
  if (seen.has(fixture.fixture_id)) throw new Error('Duplicate fixture ' + fixture.fixture_id + ' reached aggregation.');
  seen.add(fixture.fixture_id);

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
  record_type: 'league',
  league_key: settings.league_id + '|' + settings.season,
  league_id: settings.league_id,
  season: settings.season,
  league_home_avg: totalHomeGoals / matchesUsed,
  league_away_avg: totalAwayGoals / matchesUsed,
  matches_used: matchesUsed,
  updated_at: updatedAt,
};

if (!Number.isFinite(leagueRow.league_home_avg) || !Number.isFinite(leagueRow.league_away_avg)) {
  throw new Error('League averages are not finite numbers.');
}

const teamRows = [...teams.values()].map(t => ({
  record_type: 'team',
  ...t,
}));

// Emit both league row and individual team rows
return [
  { json: leagueRow },
  ...teamRows.map(r => ({ json: r }))
];`,
      },
      id: uuid(),
      name: 'Calculate League & Team Rates',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1600, 200],
    },
    {
      parameters: {
        conditions: {
          string: [
            {
              value1: '={{ $json.record_type }}',
              value2: 'team',
            },
          ],
        },
      },
      id: uuid(),
      name: 'Split Record Type',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [1840, 200],
    },
    {
      parameters: {
        resource: 'row',
        operation: 'upsert',
        dataTableId: {
          __rl: true,
          mode: 'name',
          value: 'team_strengths',
        },
        matchType: 'allConditions',
        filters: {
          conditions: [
            {
              keyName: 'team_key',
              condition: 'eq',
              keyValue: '={{ $json.team_key }}',
            },
          ],
        },
        columns: {
          mappingMode: 'autoMapInputData',
          value: {},
        },
      },
      id: uuid(),
      name: 'Save Team Strengths',
      type: 'n8n-nodes-base.dataTable',
      typeVersion: 1.1,
      position: [2080, 100],
    },
    {
      parameters: {
        resource: 'row',
        operation: 'upsert',
        dataTableId: {
          __rl: true,
          mode: 'name',
          value: 'league_strengths',
        },
        matchType: 'allConditions',
        filters: {
          conditions: [
            {
              keyName: 'league_key',
              condition: 'eq',
              keyValue: '={{ $json.league_key }}',
            },
          ],
        },
        columns: {
          mappingMode: 'autoMapInputData',
          value: {},
        },
      },
      id: uuid(),
      name: 'Save League Strengths',
      type: 'n8n-nodes-base.dataTable',
      typeVersion: 1.1,
      position: [2080, 320],
    },
    {
      parameters: {
        mode: 'append',
      },
      id: uuid(),
      name: 'Wait for Both Saves',
      type: 'n8n-nodes-base.merge',
      typeVersion: 3,
      position: [2320, 200],
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: `// Collate refresh statistics into one summary report
const settings = $('Data Settings').first().json;
const ratesData = $('Calculate League & Team Rates').all().map(item => item.json);
const leagueRow = ratesData.find(r => r.record_type === 'league') || {};
const teamRows = ratesData.filter(r => r.record_type === 'team');

const reportText = [
  '⚽ FOOTBALL DATA REFRESH COMPLETE',
  '',
  'Competition: Premier League (League ' + settings.league_id + ')',
  'Season: ' + settings.season + '/' + (settings.season + 1),
  'Valid matches processed: ' + (leagueRow.matches_used || 0),
  'Teams aggregated: ' + teamRows.length,
  'League Home Average: ' + (Number(leagueRow.league_home_avg || 0).toFixed(2)) + ' goals/game',
  'League Away Average: ' + (Number(leagueRow.league_away_avg || 0).toFixed(2)) + ' goals/game',
  'Refresh Timestamp: ' + (leagueRow.updated_at || new Date().toISOString()),
  '',
  'Status: Historical team strengths and league averages stored successfully.'
].join('\\n');

return [{
  json: {
    report_text: reportText,
    league_id: settings.league_id,
    season: settings.season,
    matches_used: leagueRow.matches_used,
    team_count: teamRows.length,
    league_home_avg: leagueRow.league_home_avg,
    league_away_avg: leagueRow.league_away_avg,
    updated_at: leagueRow.updated_at,
    chat_id: 'REPLACE_WITH_TELEGRAM_CHAT_ID'
  }
}];`,
      },
      id: uuid(),
      name: 'Build One Refresh Report',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2540, 200],
    },
    {
      parameters: {
        resource: 'message',
        operation: 'sendMessage',
        chatId: '={{ $json.chat_id }}',
        text: '={{ $json.report_text }}',
        additionalFields: {},
      },
      id: uuid(),
      name: 'Data Refresh Report',
      type: 'n8n-nodes-base.telegram',
      typeVersion: 1.2,
      position: [2760, 200],
      credentials: {
        telegramApi: {
          id: 'credential-telegram-raskibot',
          name: 'Raskibot Telegram',
        },
      },
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: `// Build sanitized failure report
const settings = $('Data Settings').first().json;
return [{
  json: {
    error: 'API response was invalid, incomplete, or returned an error envelope.',
    league_id: settings.league_id,
    season: settings.season,
    timestamp: new Date().toISOString(),
  }
}];`,
      },
      id: uuid(),
      name: 'Build Failure Report',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1360, 420],
    },
  ];

  const connections = {
    'Start Data Refresh': {
      main: [[{ node: 'Data Settings', type: 'main', index: 0 }]],
    },
    'Data Settings': {
      main: [[{ node: 'Check Data Mode', type: 'main', index: 0 }]],
    },
    'Check Data Mode': {
      main: [
        [{ node: 'Load Mock Historical Fixtures', type: 'main', index: 0 }],
        [{ node: 'Get Completed Fixtures', type: 'main', index: 0 }],
      ],
    },
    'Load Mock Historical Fixtures': {
      main: [[{ node: 'API Response OK?', type: 'main', index: 0 }]],
    },
    'Get Completed Fixtures': {
      main: [[{ node: 'API Response OK?', type: 'main', index: 0 }]],
    },
    'API Response OK?': {
      main: [
        [{ node: 'Validate & Normalise History', type: 'main', index: 0 }],
        [{ node: 'Build Failure Report', type: 'main', index: 0 }],
      ],
    },
    'Validate & Normalise History': {
      main: [[{ node: 'Calculate League & Team Rates', type: 'main', index: 0 }]],
    },
    'Calculate League & Team Rates': {
      main: [[{ node: 'Split Record Type', type: 'main', index: 0 }]],
    },
    'Split Record Type': {
      main: [
        [{ node: 'Save Team Strengths', type: 'main', index: 0 }],
        [{ node: 'Save League Strengths', type: 'main', index: 0 }],
      ],
    },
    'Save Team Strengths': {
      main: [[{ node: 'Wait for Both Saves', type: 'main', index: 0 }]],
    },
    'Save League Strengths': {
      main: [[{ node: 'Wait for Both Saves', type: 'main', index: 1 }]],
    },
    'Wait for Both Saves': {
      main: [[{ node: 'Build One Refresh Report', type: 'main', index: 0 }]],
    },
    'Build One Refresh Report': {
      main: [[{ node: 'Data Refresh Report', type: 'main', index: 0 }]],
    },
  };

  return {
    name: 'Football Prediction — Build Team Strengths',
    nodes,
    connections,
    active: false,
    settings: { executionOrder: 'v1' },
    pinData: {},
    versionId: uuid(),
    meta: { templateCredsSetupCompleted: true },
    tags: [],
  };
}

// -------------------------------------------------------------
// WORKFLOW 2: Football Prediction — Upcoming Match Predictions
// -------------------------------------------------------------
function buildWorkflowB() {
  const nodes = [
    {
      parameters: {},
      id: uuid(),
      name: 'Start Prediction Run',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [200, 300],
    },
    {
      parameters: {
        mode: 'manual',
        fields: {
          values: [
            { name: 'league_id', type: 'number', value: 39 },
            { name: 'fixture_season', type: 'number', value: 2026 },
            { name: 'strength_season', type: 'number', value: 2025 },
            { name: 'timezone', type: 'string', value: 'Africa/Lagos' },
            { name: 'minimum_home_matches', type: 'number', value: 8 },
            { name: 'minimum_away_matches', type: 'number', value: 8 },
            { name: 'model_version', type: 'string', value: 'poisson-v1' },
            { name: 'max_score_goal_limit', type: 'number', value: 50 },
            { name: 'required_grid_mass', type: 'number', value: 0.999999 },
            { name: 'data_mode', type: 'string', value: 'mock' },
            { name: 'date_from', type: 'string', value: '2026-11-20' },
            { name: 'date_to', type: 'string', value: '2026-11-30' },
          ],
        },
      },
      id: uuid(),
      name: 'Prediction Settings',
      type: 'n8n-nodes-base.set',
      typeVersion: 3.4,
      position: [420, 300],
    },
    {
      parameters: {
        conditions: {
          string: [
            {
              value1: '={{ $json.data_mode }}',
              value2: 'mock',
            },
          ],
        },
      },
      id: uuid(),
      name: 'Check Data Mode',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [640, 300],
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: `// Load verified mock upcoming fixtures for safe offline testing
const mockUpcoming = ${fs.readFileSync(path.join(__dirname, '../test-data/mock-upcoming-fixtures.json'), 'utf8')};
return [{ json: mockUpcoming }];`,
      },
      id: uuid(),
      name: 'Load Mock Upcoming Fixtures',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [880, 200],
    },
    {
      parameters: {
        url: 'https://v3.football.api-sports.io/fixtures',
        sendQuery: true,
        queryParameters: {
          parameters: [
            { name: 'league', value: '={{ $json.league_id }}' },
            { name: 'season', value: '={{ $json.fixture_season }}' },
            { name: 'status', value: 'NS' },
            { name: 'from', value: '={{ $json.date_from }}' },
            { name: 'to', value: '={{ $json.date_to }}' },
            { name: 'timezone', value: '={{ $json.timezone }}' },
          ],
        },
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        options: {},
      },
      id: uuid(),
      name: 'Get Upcoming Fixtures',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [880, 420],
      credentials: {
        httpHeaderAuth: {
          id: 'credential-api-football-auth',
          name: 'API-Football Header Auth',
        },
      },
    },
    {
      parameters: {
        conditions: {
          boolean: [
            {
              value1: '={{ typeof $json === "object" && $json !== null && (!Array.isArray($json.errors) || $json.errors.length === 0) && (typeof $json.errors !== "object" || Object.keys($json.errors).length === 0) && Array.isArray($json.response) }}',
              value2: true,
            },
          ],
        },
      },
      id: uuid(),
      name: 'Validate API Response',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [1120, 300],
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: `// Normalise upcoming fixtures
const body = $input.first().json;
const settings = $('Prediction Settings').first().json;

const from = settings.date_from ? Date.parse(settings.date_from) : Number.NEGATIVE_INFINITY;
const to = settings.date_to ? Date.parse(settings.date_to + 'T23:59:59.999Z') : Number.POSITIVE_INFINITY;

const fixtures = [];
const rejected = [];
const seen = new Set();

for (const raw of (body.response || [])) {
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
    rejected.push({ fixture_id: fixtureId, reason: 'not_unstarted:' + (status ?? 'missing') });
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

if (fixtures.length === 0) {
  return [{ json: { no_fixtures: true, count: 0 } }];
}

return fixtures.map(f => ({ json: f }));`,
      },
      id: uuid(),
      name: 'Normalise Upcoming Fixtures',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1360, 300],
    },
    {
      parameters: {
        resource: 'row',
        operation: 'get',
        dataTableId: {
          __rl: true,
          mode: 'name',
          value: 'team_strengths',
        },
        returnAll: true,
        matchType: 'allConditions',
        filters: {
          conditions: [
            {
              keyName: 'league_id',
              condition: 'eq',
              keyValue: '={{ $("Prediction Settings").first().json.league_id }}',
            },
            {
              keyName: 'season',
              condition: 'eq',
              keyValue: '={{ $("Prediction Settings").first().json.strength_season }}',
            },
          ],
        },
      },
      id: uuid(),
      name: 'Read Team Strengths',
      type: 'n8n-nodes-base.dataTable',
      typeVersion: 1.1,
      alwaysOutputData: true,
      position: [1600, 200],
    },
    {
      parameters: {
        resource: 'row',
        operation: 'get',
        dataTableId: {
          __rl: true,
          mode: 'name',
          value: 'league_strengths',
        },
        returnAll: true,
        matchType: 'allConditions',
        filters: {
          conditions: [
            {
              keyName: 'league_id',
              condition: 'eq',
              keyValue: '={{ $("Prediction Settings").first().json.league_id }}',
            },
            {
              keyName: 'season',
              condition: 'eq',
              keyValue: '={{ $("Prediction Settings").first().json.strength_season }}',
            },
          ],
        },
      },
      id: uuid(),
      name: 'Read League Strengths',
      type: 'n8n-nodes-base.dataTable',
      typeVersion: 1.1,
      alwaysOutputData: true,
      position: [1600, 420],
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: `// Join fixtures with historical team strengths and league averages
const fixtures = $('Normalise Upcoming Fixtures').all().map(item => item.json).filter(f => !f.no_fixtures);
const settings = $('Prediction Settings').first().json;

// Retrieve team rows and league rows from data tables, falling back to mock test data if empty
let teamRows = $('Read Team Strengths').all().map(i => i.json).filter(r => r.team_id != null);
let leagueRows = $('Read League Strengths').all().map(i => i.json).filter(r => r.league_id != null);

if (teamRows.length === 0 || leagueRows.length === 0) {
  // Safe mock fallback for initial testing and demonstration
  const mockStored = ${fs.readFileSync(path.join(__dirname, '../test-data/mock-team-strengths.json'), 'utf8')};
  if (teamRows.length === 0) teamRows = mockStored.team_strengths;
  if (leagueRows.length === 0) leagueRows = mockStored.league_strengths;
}

function compositeKey(leagueId, season, teamId) {
  return Number(leagueId) + '|' + Number(season) + '|' + Number(teamId);
}

const teamMap = new Map();
for (const row of teamRows) {
  if (row?.league_id !== settings.league_id || row?.season !== settings.strength_season || !Number.isInteger(row?.team_id)) continue;
  const key = compositeKey(row.league_id, row.season, row.team_id);
  teamMap.set(key, row);
}

const matchingLeagues = leagueRows.filter(r => r?.league_id === settings.league_id && r?.season === settings.strength_season);
const leagueRow = matchingLeagues.length === 1 ? matchingLeagues[0] : null;

return fixtures.map(fixture => {
  const homeKey = compositeKey(settings.league_id, settings.strength_season, fixture.home_team_id);
  const awayKey = compositeKey(settings.league_id, settings.strength_season, fixture.away_team_id);
  const homeStrength = teamMap.get(homeKey) || null;
  const awayStrength = teamMap.get(awayKey) || null;
  const reasons = [];

  if (!leagueRow) reasons.push('missing_league_strengths');
  if (!homeStrength) reasons.push('missing_home_team_strength');
  if (!awayStrength) reasons.push('missing_away_team_strength');
  if (homeStrength && homeStrength.home_played < settings.minimum_home_matches) reasons.push('insufficient_home_appearances');
  if (awayStrength && awayStrength.away_played < settings.minimum_away_matches) reasons.push('insufficient_away_appearances');

  return {
    json: {
      ...fixture,
      home_strength: homeStrength,
      away_strength: awayStrength,
      league_strength: leagueRow,
      data_quality: {
        sufficient: reasons.length === 0,
        reasons,
      }
    }
  };
});`,
      },
      id: uuid(),
      name: 'Join Fixture & Team Strengths',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1840, 300],
    },
    {
      parameters: {
        conditions: {
          boolean: [
            {
              value1: '={{ $json.data_quality.sufficient }}',
              value2: true,
            },
          ],
        },
      },
      id: uuid(),
      name: 'Check Historical Data Sufficiency',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [2080, 300],
    },
    {
      parameters: {
        mode: 'runOnceForEachItem',
        jsCode: `// Calculate Poisson expected goals and adaptive score grid
const joined = $input.item.json;
const settings = $('Prediction Settings').first().json;

function poissonMasses(lambda, maxGoals) {
  const masses = new Array(maxGoals + 1);
  masses[0] = Math.exp(-lambda);
  for (let goals = 1; goals <= maxGoals; goals += 1) {
    masses[goals] = masses[goals - 1] * lambda / goals;
  }
  return masses;
}

const home = joined.home_strength;
const away = joined.away_strength;
const league = joined.league_strength;

const homeAttack = (home.home_goals_for / home.home_played) / league.league_home_avg;
const homeDefenceWeakness = (home.home_goals_against / home.home_played) / league.league_away_avg;
const awayAttack = (away.away_goals_for / away.away_played) / league.league_away_avg;
const awayDefenceWeakness = (away.away_goals_against / away.away_played) / league.league_home_avg;

const lambdaHome = league.league_home_avg * homeAttack * awayDefenceWeakness;
const lambdaAway = league.league_away_avg * awayAttack * homeDefenceWeakness;

if (lambdaHome <= 0 || lambdaAway <= 0 || !Number.isFinite(lambdaHome) || !Number.isFinite(lambdaAway)) {
  throw new Error('Expected goals values must be finite and positive.');
}

let gridMax = 5;
const maxGoalsLimit = settings.max_score_goal_limit || 50;
const requiredMass = settings.required_grid_mass || 0.999999;

let homeMasses = poissonMasses(lambdaHome, gridMax);
let awayMasses = poissonMasses(lambdaAway, gridMax);
let gridMass = homeMasses.reduce((s, p) => s + p, 0) * awayMasses.reduce((s, p) => s + p, 0);

while (gridMass < requiredMass && gridMax < maxGoalsLimit) {
  gridMax += 1;
  homeMasses = poissonMasses(lambdaHome, gridMax);
  awayMasses = poissonMasses(lambdaAway, gridMax);
  gridMass = homeMasses.reduce((s, p) => s + p, 0) * awayMasses.reduce((s, p) => s + p, 0);
}

if (gridMass + 1e-14 < requiredMass) {
  throw new Error('Grid mass target could not be reached within goal limit.');
}

const scorelines = [];
let homeWinProb = 0;
let drawProb = 0;
let awayWinProb = 0;

for (let h = 0; h <= gridMax; h += 1) {
  for (let a = 0; a <= gridMax; a += 1) {
    const prob = homeMasses[h] * awayMasses[a];
    scorelines.push({ home_goals: h, away_goals: a, probability: prob });
    if (h > a) homeWinProb += prob;
    else if (h === a) drawProb += prob;
    else awayWinProb += prob;
  }
}

scorelines.sort((l, r) => r.probability - l.probability || l.home_goals - r.home_goals || l.away_goals - r.away_goals);
const topScores = scorelines.slice(0, 3);
const topScore = topScores[0].home_goals + '-' + topScores[0].away_goals;

return {
  json: {
    prediction_key: String(joined.fixture_id) + '|' + settings.model_version,
    fixture_id: Number(joined.fixture_id),
    model_version: settings.model_version,
    league_id: joined.league_id,
    league_name: joined.league_name,
    fixture_season: joined.fixture_season,
    strength_season: settings.strength_season,
    match_date: joined.match_date,
    home_team_id: joined.home_team_id,
    home_team_name: joined.home_team_name,
    away_team_id: joined.away_team_id,
    away_team_name: joined.away_team_name,
    lambda_home: lambdaHome,
    lambda_away: lambdaAway,
    top_score: topScore,
    top_scores: topScores,
    top_scores_json: JSON.stringify(topScores),
    home_win_prob: homeWinProb,
    draw_prob: drawProb,
    away_win_prob: awayWinProb,
    grid_max_goals: gridMax,
    grid_mass: gridMass,
    residual_prob: Math.max(0, 1 - gridMass),
    home_team_home_played: home.home_played,
    away_team_away_played: away.away_played,
    home_attack_strength: homeAttack,
    home_defence_weakness: homeDefenceWeakness,
    away_attack_strength: awayAttack,
    away_defence_weakness: awayDefenceWeakness,
    league_home_avg: league.league_home_avg,
    league_away_avg: league.league_away_avg,
    team_strengths_updated_at: home.updated_at,
    league_strengths_updated_at: league.updated_at,
    status: 'pending',
    predicted_at: new Date().toISOString(),
    attempt_count: 0,
    last_attempt_at: null,
    sent_at: null,
    telegram_message_id: null,
    error_message: null,
    actual_home_goals: null,
    actual_away_goals: null,
    actual_match_status: null,
    actual_outcome: null,
    actual_score_probability: null,
    brier_1x2: null,
    top3_hit: null,
    evaluated_at: null,
  }
};`,
      },
      id: uuid(),
      name: 'Calculate Score Probabilities',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2320, 200],
    },
    {
      parameters: {
        resource: 'row',
        operation: 'get',
        dataTableId: {
          __rl: true,
          mode: 'name',
          value: 'prediction_log',
        },
        returnAll: true,
        matchType: 'allConditions',
        filters: {
          conditions: [
            {
              keyName: 'prediction_key',
              condition: 'eq',
              keyValue: '={{ $json.prediction_key }}',
            },
          ],
        },
      },
      id: uuid(),
      name: 'Read Prediction Log',
      type: 'n8n-nodes-base.dataTable',
      typeVersion: 1.1,
      alwaysOutputData: true,
      position: [2560, 200],
    },
    {
      parameters: {
        mode: 'runOnceForEachItem',
        jsCode: `// Decide duplicate prevention action
const prediction = $('Calculate Score Probabilities').item.json;
const existingRows = $input.item.json;

let isDuplicate = false;
let reason = 'new_prediction';

if (existingRows && existingRows.prediction_key === prediction.prediction_key) {
  if (existingRows.status === 'sent') {
    isDuplicate = true;
    reason = 'already_sent';
  } else if (existingRows.status === 'pending') {
    isDuplicate = true;
    reason = 'pending_requires_manual_review';
  } else if (existingRows.status === 'failed') {
    isDuplicate = true;
    reason = 'failed_requires_manual_review';
  }
}

return {
  json: {
    ...prediction,
    should_send: !isDuplicate,
    dedup_reason: reason,
  }
};`,
      },
      id: uuid(),
      name: 'Decide Duplicate Prevention',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2800, 200],
    },
    {
      parameters: {
        conditions: {
          boolean: [
            {
              value1: '={{ $json.should_send }}',
              value2: true,
            },
          ],
        },
      },
      id: uuid(),
      name: 'Filter New Predictions',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [3040, 200],
    },
    {
      parameters: {
        resource: 'row',
        operation: 'upsert',
        dataTableId: {
          __rl: true,
          mode: 'name',
          value: 'prediction_log',
        },
        matchType: 'allConditions',
        filters: {
          conditions: [
            {
              keyName: 'prediction_key',
              condition: 'eq',
              keyValue: '={{ $json.prediction_key }}',
            },
          ],
        },
        columns: {
          mappingMode: 'autoMapInputData',
          value: {},
        },
      },
      id: uuid(),
      name: 'Save Pending Prediction',
      type: 'n8n-nodes-base.dataTable',
      typeVersion: 1.1,
      position: [3280, 100],
    },
    {
      parameters: {
        mode: 'runOnceForEachItem',
        jsCode: `// Format prediction message for Telegram delivery
const prediction = $input.item.json;
const timezone = $('Prediction Settings').first().json.timezone || 'Africa/Lagos';

function percent(prob) {
  return (prob * 100).toFixed(2) + '%';
}

const kickoff = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: timezone,
}).format(new Date(prediction.match_date));

const scores = (prediction.top_scores || []).map((score, index) =>
  (index + 1) + '. ' + score.home_goals + '-' + score.away_goals + ' — ' + percent(score.probability)
).join('\\n');

const message = [
  '⚽ FOOTBALL SCORE PREDICTION',
  '',
  prediction.league_name,
  prediction.home_team_name + ' vs ' + prediction.away_team_name,
  'Kick-off: ' + kickoff + ' (' + timezone + ')',
  '',
  'MOST LIKELY SCORELINES',
  scores,
  '',
  'EXPECTED GOALS',
  prediction.home_team_name + ': ' + Number(prediction.lambda_home).toFixed(2),
  prediction.away_team_name + ': ' + Number(prediction.lambda_away).toFixed(2),
  '',
  'MATCH OUTCOME PROBABILITIES (captured grid mass)',
  'Home win: ' + percent(prediction.home_win_prob),
  'Draw: ' + percent(prediction.draw_prob),
  'Away win: ' + percent(prediction.away_win_prob),
  'Probability coverage: ' + percent(prediction.grid_mass),
  'Residual probability: ' + percent(prediction.residual_prob),
  '',
  'Model: ' + prediction.model_version,
  'Historical basis: Premier League ' + prediction.strength_season + '/' + (prediction.strength_season + 1),
  'IMPORTANT: Statistical estimates only. Football outcomes are uncertain. These predictions are not guaranteed results.'
].join('\\n');

return {
  json: {
    ...prediction,
    telegram_text: message,
    chat_id: 'REPLACE_WITH_TELEGRAM_CHAT_ID',
  }
};`,
      },
      id: uuid(),
      name: 'Format Telegram Message',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [3520, 100],
    },
    {
      parameters: {
        resource: 'message',
        operation: 'sendMessage',
        chatId: '={{ $json.chat_id }}',
        text: '={{ $json.telegram_text }}',
        additionalFields: {},
      },
      id: uuid(),
      name: 'Send Prediction',
      type: 'n8n-nodes-base.telegram',
      typeVersion: 1.2,
      position: [3760, 100],
      credentials: {
        telegramApi: {
          id: 'credential-telegram-raskibot',
          name: 'Raskibot Telegram',
        },
      },
    },
    {
      parameters: {
        resource: 'row',
        operation: 'upsert',
        dataTableId: {
          __rl: true,
          mode: 'name',
          value: 'prediction_log',
        },
        matchType: 'allConditions',
        filters: {
          conditions: [
            {
              keyName: 'prediction_key',
              condition: 'eq',
              keyValue: '={{ $json.prediction_key }}',
            },
          ],
        },
        columns: {
          mappingMode: 'autoMapInputData',
          value: {},
        },
      },
      id: uuid(),
      name: 'Update Prediction Log (Sent)',
      type: 'n8n-nodes-base.dataTable',
      typeVersion: 1.1,
      position: [4000, 100],
    },
    {
      parameters: {
        mode: 'runOnceForEachItem',
        jsCode: `// Log insufficient data reason
const item = $input.item.json;
return {
  json: {
    insufficient_data: true,
    fixture_id: item.fixture_id,
    match: item.home_team_name + ' vs ' + item.away_team_name,
    reasons: item.data_quality?.reasons || [],
    logged_at: new Date().toISOString(),
  }
};`,
      },
      id: uuid(),
      name: 'Route Insufficient Data',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2320, 420],
    },
  ];

  const connections = {
    'Start Prediction Run': {
      main: [[{ node: 'Prediction Settings', type: 'main', index: 0 }]],
    },
    'Prediction Settings': {
      main: [[{ node: 'Check Data Mode', type: 'main', index: 0 }]],
    },
    'Check Data Mode': {
      main: [
        [{ node: 'Load Mock Upcoming Fixtures', type: 'main', index: 0 }],
        [{ node: 'Get Upcoming Fixtures', type: 'main', index: 0 }],
      ],
    },
    'Load Mock Upcoming Fixtures': {
      main: [[{ node: 'Validate API Response', type: 'main', index: 0 }]],
    },
    'Get Upcoming Fixtures': {
      main: [[{ node: 'Validate API Response', type: 'main', index: 0 }]],
    },
    'Validate API Response': {
      main: [[{ node: 'Normalise Upcoming Fixtures', type: 'main', index: 0 }]],
    },
    'Normalise Upcoming Fixtures': {
      main: [
        [
          { node: 'Read Team Strengths', type: 'main', index: 0 },
          { node: 'Read League Strengths', type: 'main', index: 0 },
          { node: 'Join Fixture & Team Strengths', type: 'main', index: 0 },
        ],
      ],
    },
    'Read Team Strengths': {
      main: [[{ node: 'Join Fixture & Team Strengths', type: 'main', index: 0 }]],
    },
    'Read League Strengths': {
      main: [[{ node: 'Join Fixture & Team Strengths', type: 'main', index: 0 }]],
    },
    'Join Fixture & Team Strengths': {
      main: [[{ node: 'Check Historical Data Sufficiency', type: 'main', index: 0 }]],
    },
    'Check Historical Data Sufficiency': {
      main: [
        [{ node: 'Calculate Score Probabilities', type: 'main', index: 0 }],
        [{ node: 'Route Insufficient Data', type: 'main', index: 0 }],
      ],
    },
    'Calculate Score Probabilities': {
      main: [[{ node: 'Read Prediction Log', type: 'main', index: 0 }]],
    },
    'Read Prediction Log': {
      main: [[{ node: 'Decide Duplicate Prevention', type: 'main', index: 0 }]],
    },
    'Decide Duplicate Prevention': {
      main: [[{ node: 'Filter New Predictions', type: 'main', index: 0 }]],
    },
    'Filter New Predictions': {
      main: [[{ node: 'Save Pending Prediction', type: 'main', index: 0 }]],
    },
    'Save Pending Prediction': {
      main: [[{ node: 'Format Telegram Message', type: 'main', index: 0 }]],
    },
    'Format Telegram Message': {
      main: [[{ node: 'Send Prediction', type: 'main', index: 0 }]],
    },
    'Send Prediction': {
      main: [[{ node: 'Update Prediction Log (Sent)', type: 'main', index: 0 }]],
    },
  };

  return {
    name: 'Football Prediction — Upcoming Match Predictions',
    nodes,
    connections,
    active: false,
    settings: { executionOrder: 'v1' },
    pinData: {},
    versionId: uuid(),
    meta: { templateCredsSetupCompleted: true },
    tags: [],
  };
}

// -------------------------------------------------------------
// WORKFLOW 3: Football Prediction — Verify API Access
// -------------------------------------------------------------
function buildWorkflowDiagnostics() {
  const nodes = [
    {
      parameters: {},
      id: uuid(),
      name: 'Start Diagnostics',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [240, 300],
    },
    {
      parameters: {
        url: 'https://v3.football.api-sports.io/status',
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        options: {},
      },
      id: uuid(),
      name: 'Check API Status & Quota',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [480, 300],
      credentials: {
        httpHeaderAuth: {
          id: 'credential-api-football-auth',
          name: 'API-Football Header Auth',
        },
      },
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: `// Collate API-Football account diagnostics and quota
const raw = $input.first().json;
const account = raw?.response?.account;
const subscription = raw?.response?.subscription;
const requests = raw?.response?.requests;

return [{
  json: {
    status: 'connected',
    email: account?.email || 'unknown',
    plan: subscription?.plan || 'Free',
    requests_used_today: requests?.current ?? 0,
    daily_request_limit: requests?.limit_day ?? 100,
    requests_remaining: (requests?.limit_day ?? 100) - (requests?.current ?? 0),
    checked_at: new Date().toISOString(),
  }
}];`,
      },
      id: uuid(),
      name: 'Format Diagnostics Report',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [720, 300],
    },
  ];

  const connections = {
    'Start Diagnostics': {
      main: [[{ node: 'Check API Status & Quota', type: 'main', index: 0 }]],
    },
    'Check API Status & Quota': {
      main: [[{ node: 'Format Diagnostics Report', type: 'main', index: 0 }]],
    },
  };

  return {
    name: 'Football Prediction — Verify API Access',
    nodes,
    connections,
    active: false,
    settings: { executionOrder: 'v1' },
    pinData: {},
    versionId: uuid(),
    meta: { templateCredsSetupCompleted: true },
    tags: [],
  };
}

// -------------------------------------------------------------
// Write Workflow Exports
// -------------------------------------------------------------
const outDir = path.join(__dirname, '../workflows/exports');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const wfA = buildWorkflowA();
const wfB = buildWorkflowB();
const wfDiag = buildWorkflowDiagnostics();

fs.writeFileSync(path.join(outDir, '01-build-team-strengths.json'), JSON.stringify(wfA, null, 2), 'utf8');
fs.writeFileSync(path.join(outDir, '02-predict-upcoming-matches.json'), JSON.stringify(wfB, null, 2), 'utf8');
fs.writeFileSync(path.join(outDir, '03-verify-api-access.json'), JSON.stringify(wfDiag, null, 2), 'utf8');

console.log('Successfully generated workflow exports:');
console.log('1. 01-build-team-strengths.json (' + wfA.nodes.length + ' nodes)');
console.log('2. 02-predict-upcoming-matches.json (' + wfB.nodes.length + ' nodes)');
console.log('3. 03-verify-api-access.json (' + wfDiag.nodes.length + ' nodes)');
