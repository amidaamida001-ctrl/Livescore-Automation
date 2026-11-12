'use strict';

function percent(probability) {
  return `${(probability * 100).toFixed(2)}%`;
}

function formatPrediction(prediction, timezone = 'Africa/Lagos') {
  if (!prediction || !Array.isArray(prediction.top_scores) || prediction.top_scores.length !== 3) {
    throw new Error('Prediction must contain exactly three ranked scorelines.');
  }
  const kickoff = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(prediction.match_date));
  const scores = prediction.top_scores.map((score, index) =>
    `${index + 1}. ${score.home_goals}-${score.away_goals} — ${percent(score.probability)}`,
  ).join('\n');
  return [
    'FOOTBALL SCORE PREDICTION',
    '',
    `${prediction.league_name}`,
    `${prediction.home_team_name} vs ${prediction.away_team_name}`,
    `Kick-off: ${kickoff} (${timezone})`,
    '',
    'MOST LIKELY SCORELINES',
    scores,
    '',
    'EXPECTED GOALS',
    `${prediction.home_team_name}: ${prediction.lambda_home.toFixed(2)}`,
    `${prediction.away_team_name}: ${prediction.lambda_away.toFixed(2)}`,
    '',
    'MATCH OUTCOME PROBABILITIES (captured grid mass)',
    `Home win: ${percent(prediction.home_win_prob)}`,
    `Draw: ${percent(prediction.draw_prob)}`,
    `Away win: ${percent(prediction.away_win_prob)}`,
    `Probability coverage: ${percent(prediction.grid_mass)}`,
    `Residual probability: ${percent(prediction.residual_prob)}`,
    '',
    `Model: ${prediction.model_version}`,
    'Statistical estimates only. Football outcomes are uncertain. These predictions are not guaranteed results.',
  ].join('\n');
}

module.exports = { formatPrediction };
