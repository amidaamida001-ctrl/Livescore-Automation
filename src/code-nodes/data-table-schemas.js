'use strict';

const teamStrengthsSchema = [
  ['team_key', 'string'],
  ['league_id', 'number'],
  ['season', 'number'],
  ['team_id', 'number'],
  ['team_name', 'string'],
  ['home_played', 'number'],
  ['home_goals_for', 'number'],
  ['home_goals_against', 'number'],
  ['away_played', 'number'],
  ['away_goals_for', 'number'],
  ['away_goals_against', 'number'],
  ['updated_at', 'date'],
].map(([name, type]) => ({ name, type }));

const leagueStrengthsSchema = [
  ['league_key', 'string'],
  ['league_id', 'number'],
  ['season', 'number'],
  ['league_home_avg', 'number'],
  ['league_away_avg', 'number'],
  ['matches_used', 'number'],
  ['updated_at', 'date'],
].map(([name, type]) => ({ name, type }));

const predictionLogSchema = [
  ['prediction_key', 'string'],
  ['fixture_id', 'number'],
  ['model_version', 'string'],
  ['league_id', 'number'],
  ['league_name', 'string'],
  ['fixture_season', 'number'],
  ['strength_season', 'number'],
  ['match_date', 'date'],
  ['home_team_id', 'number'],
  ['home_team_name', 'string'],
  ['away_team_id', 'number'],
  ['away_team_name', 'string'],
  ['lambda_home', 'number'],
  ['lambda_away', 'number'],
  ['top_score', 'string'],
  ['top_scores_json', 'string'],
  ['home_win_prob', 'number'],
  ['draw_prob', 'number'],
  ['away_win_prob', 'number'],
  ['grid_max_goals', 'number'],
  ['grid_mass', 'number'],
  ['residual_prob', 'number'],
  ['home_team_home_played', 'number'],
  ['away_team_away_played', 'number'],
  ['home_attack_strength', 'number'],
  ['home_defence_weakness', 'number'],
  ['away_attack_strength', 'number'],
  ['away_defence_weakness', 'number'],
  ['league_home_avg', 'number'],
  ['league_away_avg', 'number'],
  ['team_strengths_updated_at', 'date'],
  ['league_strengths_updated_at', 'date'],
  ['status', 'string'],
  ['predicted_at', 'date'],
  ['attempt_count', 'number'],
  ['last_attempt_at', 'date'],
  ['sent_at', 'date'],
  ['telegram_message_id', 'string'],
  ['error_message', 'string'],
  ['actual_home_goals', 'number'],
  ['actual_away_goals', 'number'],
  ['actual_match_status', 'string'],
  ['actual_outcome', 'string'],
  ['actual_score_probability', 'number'],
  ['brier_1x2', 'number'],
  ['top3_hit', 'boolean'],
  ['evaluated_at', 'date'],
].map(([name, type]) => ({ name, type }));

const schemas = {
  team_strengths: teamStrengthsSchema,
  league_strengths: leagueStrengthsSchema,
  prediction_log: predictionLogSchema,
};

function getSchema(name) {
  if (!Object.hasOwn(schemas, name)) {
    throw new Error(`Unknown Data Table: ${name}`);
  }
  return schemas[name].map((column) => ({ ...column }));
}

module.exports = {
  schemas,
  getSchema,
};
