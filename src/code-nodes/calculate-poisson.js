'use strict';

function poissonMasses(lambda, maxGoals) {
  if (!Number.isFinite(lambda) || lambda <= 0) throw new Error('lambda must be finite and positive for V1 prediction.');
  const masses = new Array(maxGoals + 1);
  masses[0] = Math.exp(-lambda);
  for (let goals = 1; goals <= maxGoals; goals += 1) {
    masses[goals] = masses[goals - 1] * lambda / goals;
  }
  return masses;
}

function calculatePrediction(joined, settings) {
  if (!joined?.data_quality?.sufficient) throw new Error(`Insufficient historical data: ${(joined?.data_quality?.reasons || []).join(', ')}`);
  const home = joined.home_strength;
  const away = joined.away_strength;
  const league = joined.league_strength;
  if (!home?.home_played || !away?.away_played || !league?.matches_used) throw new Error('Required appearance/match denominator is zero.');
  if (league.league_home_avg <= 0 || league.league_away_avg <= 0) throw new Error('League averages must be positive.');

  const homeAttack = (home.home_goals_for / home.home_played) / league.league_home_avg;
  const homeDefenceWeakness = (home.home_goals_against / home.home_played) / league.league_away_avg;
  const awayAttack = (away.away_goals_for / away.away_played) / league.league_away_avg;
  const awayDefenceWeakness = (away.away_goals_against / away.away_played) / league.league_home_avg;
  const lambdaHome = league.league_home_avg * homeAttack * awayDefenceWeakness;
  const lambdaAway = league.league_away_avg * awayAttack * homeDefenceWeakness;
  if (![homeAttack, homeDefenceWeakness, awayAttack, awayDefenceWeakness, lambdaHome, lambdaAway].every(Number.isFinite)) {
    throw new Error('Model factors and expected goals must be finite.');
  }
  if (lambdaHome <= 0 || lambdaAway <= 0) throw new Error('Both expected-goal values must be positive under the V1 acceptance rule.');

  const baselineMax = settings.baseline_max_goals ?? 5;
  const maxGoals = settings.max_score_goal_limit ?? 50;
  const requiredMass = settings.required_grid_mass ?? 0.999999;
  if (!Number.isInteger(baselineMax) || baselineMax < 0 || !Number.isInteger(maxGoals) || maxGoals < baselineMax ||
      !Number.isFinite(requiredMass) || requiredMass <= 0 || requiredMass >= 1) {
    throw new Error('Grid settings are invalid.');
  }

  let gridMax = baselineMax;
  let homeMasses = poissonMasses(lambdaHome, gridMax);
  let awayMasses = poissonMasses(lambdaAway, gridMax);
  let gridMass = homeMasses.reduce((sum, probability) => sum + probability, 0) *
    awayMasses.reduce((sum, probability) => sum + probability, 0);
  while (gridMass < requiredMass && gridMax < maxGoals) {
    gridMax += 1;
    homeMasses = poissonMasses(lambdaHome, gridMax);
    awayMasses = poissonMasses(lambdaAway, gridMax);
    gridMass = homeMasses.reduce((sum, probability) => sum + probability, 0) *
      awayMasses.reduce((sum, probability) => sum + probability, 0);
  }
  if (gridMass + 1e-14 < requiredMass) {
    throw new Error(`Probability mass target not reached by ${maxGoals} goals per side (captured ${gridMass}).`);
  }

  const scorelines = [];
  let homeWinProb = 0;
  let drawProb = 0;
  let awayWinProb = 0;
  for (let homeGoals = 0; homeGoals <= gridMax; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= gridMax; awayGoals += 1) {
      const probability = homeMasses[homeGoals] * awayMasses[awayGoals];
      scorelines.push({ home_goals: homeGoals, away_goals: awayGoals, probability });
      if (homeGoals > awayGoals) homeWinProb += probability;
      else if (homeGoals === awayGoals) drawProb += probability;
      else awayWinProb += probability;
    }
  }
  scorelines.sort((left, right) => right.probability - left.probability ||
    left.home_goals - right.home_goals || left.away_goals - right.away_goals);
  const topScores = scorelines.slice(0, 3);
  const outcomeMass = homeWinProb + drawProb + awayWinProb;
  if (Math.abs(outcomeMass - gridMass) > 1e-12) throw new Error('Outcome probability mass does not equal grid mass.');
  if (!topScores.every((score) => Number.isFinite(score.probability) && score.probability >= 0 && score.probability <= 1)) {
    throw new Error('A scoreline probability is invalid.');
  }

  return {
    prediction_key: `${String(joined.fixture_id)}|${settings.model_version}`,
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
    top_score: `${topScores[0].home_goals}-${topScores[0].away_goals}`,
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
  };
}

module.exports = { poissonMasses, calculatePrediction };
