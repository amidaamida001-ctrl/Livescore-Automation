/**
 * Placeholder source file for n8n Code node logic.
 * This file is the maintainable version of a script that may later be copied into
 * a JavaScript Code node in n8n.
 */

function filterAndNormaliseFixtures(fixtures) {
  if (!Array.isArray(fixtures)) {
    return [];
  }

  return fixtures
    .filter((fixture) => fixture && fixture.fixture && fixture.teams)
    .map((fixture) => ({
      fixtureId: fixture.fixture?.id ?? null,
      status: fixture.fixture?.status?.short ?? null,
      homeTeam: fixture.teams?.home?.name ?? null,
      awayTeam: fixture.teams?.away?.name ?? null,
      homeScore: fixture.goals?.home ?? null,
      awayScore: fixture.goals?.away ?? null,
    }));
}

module.exports = {
  filterAndNormaliseFixtures,
};
