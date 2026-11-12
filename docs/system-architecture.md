# System architecture

## Components and responsibilities

- **n8n Community Edition** orchestrates the two workflows.
- **JavaScript Code nodes** validate, normalise, aggregate, and calculate the baseline model.
- **API-Football** is the planned source for completed historical results and upcoming fixtures.
- **n8n Data Tables** persist team strengths, league averages, and prediction history.
- **Telegram Bot API** receives refresh reports and match predictions.
- **Docker Desktop and Docker Compose** run the existing local n8n installation.
- **VS Code** contains the maintainable project source and documentation.

## Workflow A: Build Team Strengths

1. Trigger a controlled refresh.
2. Request completed fixtures for selected leagues/seasons, including all required pages.
3. Inspect and validate API responses; stop or report incomplete/error responses rather than silently accepting them.
4. Normalise fixture ID, league/season, numeric team IDs, team labels, venue, completion status, and full-time goals.
5. Exclude fixtures outside the approved historical window and aggregate only completed, valid results.
6. Calculate league home/away goal averages and each team's home/away played and goals-for/goals-against totals.
7. Calculate reviewed team attack/defence strength factors and upsert team and league rows.
8. Send a Telegram report with refresh scope and outcome.

## Workflow B: Predict Upcoming Matches

1. Trigger a fixture batch and retrieve upcoming fixtures.
2. Validate and normalise upcoming fixture data.
3. Read the matching league/season averages and home/away team-strength rows.
4. Join teams by numeric IDs, not display names. If a team or league has no valid row or insufficient history, apply a reviewed policy rather than inventing values.
5. Calculate `lambda_home` and `lambda_away` from league baselines and reviewed venue-specific team factors.
6. Calculate the Poisson probability for candidate home and away goal counts and combine them into scoreline probabilities.
7. Rank three scorelines and derive home-win, draw, and away-win probabilities from the scoreline distribution.
8. Build the Telegram message, check `fixture_id + model_version` for a duplicate, send, and record prediction plus delivery status.
9. Later retrieve the actual result and evaluate the stored prediction.

The exact expected-goal factors, scoreline grid, omitted probability mass treatment, and evaluation fields remain unresolved. The mathematical baseline is documented for planning only; no calculations have been implemented.

## Proposed three-table data architecture

### `team_strengths`

One row per composite key `league_id|season|team_id`.

| Field | Purpose |
| --- | --- |
| `team_key` | Composite key string |
| `league_id` | Numeric competition identifier |
| `season` | Competition season |
| `team_id` | Numeric team identifier |
| `team_name` | Human-readable label for reports |
| `home_played` | Valid completed home fixtures counted |
| `home_goals_for` | Goals scored at home in those fixtures |
| `home_goals_against` | Goals conceded at home |
| `away_played` | Valid completed away fixtures counted |
| `away_goals_for` | Goals scored away in those fixtures |
| `away_goals_against` | Goals conceded away |
| `updated_at` | Refresh timestamp |

### `league_strengths`

One row per composite key `league_id|season`. This third table is proposed because Workflow B requires league scoring averages and those values should be explicitly retrievable rather than hidden in team records.

| Field | Purpose |
| --- | --- |
| `league_key` | Composite key string |
| `league_id` | Numeric competition identifier |
| `season` | Competition season |
| `league_home_avg` | Average home goals per included fixture |
| `league_away_avg` | Average away goals per included fixture |
| `matches_used` | Number of valid fixtures in the average |
| `updated_at` | Refresh timestamp |

### `prediction_log`

Intended matching key: `fixture_id + model_version`.

| Field | Purpose |
| --- | --- |
| `fixture_id` | Numeric/source fixture identifier |
| `model_version` | Identifies the calculation version |
| `home_team` | Display label |
| `away_team` | Display label |
| `lambda_home` | Estimated home expected goals |
| `lambda_away` | Estimated away expected goals |
| `top_score` | Highest-ranked scoreline (representation to define) |
| `home_win_prob` | Estimated home-win probability |
| `draw_prob` | Estimated draw probability |
| `away_win_prob` | Estimated away-win probability |
| `status` | Prediction/delivery lifecycle status; values to define |
| `predicted_at` | Prediction creation time |

Prediction history enables a later join to actual outcomes. Actual goals/result fields and evaluation metrics are not included in the initial requested schema and must be designed before evaluation is built.

## Data safety and model principles

- Use only completed historical matches within an explicit as-of cutoff; prevent future-result leakage.
- Preserve numeric IDs as identity keys; names are labels only.
- Do not fabricate team strengths for insufficient samples.
- Treat scores as uncertain probability estimates.
- Keep the Poisson baseline as the first model and evaluate it before considering machine learning.
- Keep mock and live API testing separate, and never expose credentials in source or exports.

Open choices are listed in [design-decisions.md](design-decisions.md). Recommendations are labelled separately from assignment requirements there.
