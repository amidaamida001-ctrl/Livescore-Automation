# System architecture

## Components and responsibilities

- **n8n Community Edition** orchestrates the two workflows.
- **JavaScript Code nodes** validate, normalise, aggregate, and calculate the baseline model.
- **API-Football** is the planned source for completed historical results and upcoming fixtures.
- **n8n Data Tables** persist team strengths, league averages, and prediction history.
- **Telegram Bot API** receives refresh reports and match predictions.
- **Docker Desktop and Docker Compose** run the existing local n8n installation.
- **VS Code** contains the maintainable project source and documentation.

## Proposed V1 execution scope

The recommended V1 runs one `league_id` and `season` per execution. Both workflows use Manual Trigger during development; no schedule is enabled. This bounds API use, makes refreshes reviewable, and lets the prediction workflow read one league-season snapshot. These are recommendations awaiting owner approval, not deployed settings. The Docker and n8n environment was recovered and verified on 2026-11-12; see [environment-setup.md](environment-setup.md).

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

The expected-goal factor formulas are specified by the assignment and are listed in the [workflow blueprint](n8n-workflow-blueprint.md). The recommendation to use no smoothing, the relevant-venue sample threshold, grid tail tolerance, and evaluation policy are proposals awaiting approval; no calculations have been implemented.

## Proposed three-table data architecture

The following are proposed V1 contracts, not created tables. The exact extended `prediction_log` requires owner approval before any table is created. n8n Data Table columns use String/Number types as shown; timestamps are stored as ISO-8601 UTC strings for consistent interchange. Composite keys are logical lookup keys, not database-enforced unique constraints.

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

Intended matching key: `prediction_key = String(fixture_id) + "|" + model_version`, equivalent to the required `fixture_id + model_version` pair. Retain the component columns for transparent queries. Upsert matching conditions do not enforce uniqueness under concurrency.

| Column | Type | Purpose |
| --- | --- | --- |
| `prediction_key` | String | Derived `fixture_id|model_version` lookup key; not a unique constraint |
| `fixture_id` | String | Source fixture ID normalized to string |
| `model_version` | String | Immutable Poisson formula/policy version |
| `league_id` | Number | Numeric competition identity |
| `season` | Number | Season identity |
| `league_name` | String | Competition label captured at prediction time |
| `match_date` | String | Fixture kickoff timestamp in UTC |
| `home_team_id` | Number | Numeric API identity for the home team |
| `away_team_id` | Number | Numeric API identity for the away team |
| `home_team` | String | Display name captured at prediction time |
| `away_team` | String | Display name captured at prediction time |
| `lambda_home` | Number | Home expected goals |
| `lambda_away` | Number | Away expected goals |
| `top_score` | String | Highest-ranked score, e.g. `1-0`; retained from original schema |
| `top_scores_json` | String | JSON array of top three `{home_goals, away_goals, probability}` entries |
| `home_win_prob` | Number | Unconditional probability fraction in [0,1] |
| `draw_prob` | Number | Unconditional probability fraction in [0,1] |
| `away_win_prob` | Number | Unconditional probability fraction in [0,1] |
| `goal_max_home` | Number | Highest home-goal count included in the adaptive grid |
| `goal_max_away` | Number | Highest away-goal count included in the adaptive grid |
| `grid_mass` | Number | Total probability captured by the finite joint score grid |
| `residual_prob` | Number | `1 - grid_mass`; omitted tail mass, never silently renormalized |
| `home_team_strengths_updated_at` | String | Strength row timestamp used for the home team |
| `away_team_strengths_updated_at` | String | Strength row timestamp used for the away team |
| `league_strengths_updated_at` | String | League row timestamp used for the prediction |
| `status` | String | `pending`, `sent`, or `failed` |
| `predicted_at` | String | Prediction creation time (ISO-8601 UTC) |
| `last_attempt_at` | String | Most recent Telegram attempt time |
| `sent_at` | String | Telegram-confirmed delivery time; blank until sent |
| `attempt_count` | Number | Number of Telegram attempts |
| `telegram_message_id` | String | Telegram message ID when confirmed |
| `error_message` | String | Sanitized delivery/reconciliation error; never credentials or headers |
| `actual_home_goals` | Number | Final regulation-time home goals, blank until evaluation |
| `actual_away_goals` | Number | Final regulation-time away goals, blank until evaluation |
| `actual_match_status` | String | Actual fixture status used to accept or exclude its result |
| `actual_outcome` | String | `home`, `draw`, or `away`, derived from accepted actual goals |
| `actual_score_probability` | Number | Model probability assigned to the actual scoreline |
| `brier_1x2` | Number | Candidate multiclass Brier score; leave blank until the finite-grid evaluation policy is approved |
| `top3_hit` | Boolean | Whether the actual scoreline appears in `top_scores_json` |
| `evaluated_at` | String | Evaluation timestamp (ISO-8601 UTC) |

`fixture_id` and `model_version` remain the deduplication components; `prediction_key` is a convenient derived lookup. Query both components with **All Conditions** or query the derived key. A Data Table Upsert does not guarantee atomic uniqueness. Keep prediction executions manual and non-overlapping in V1; after a Telegram timeout, preserve `pending` with a sanitized error and reconcile manually rather than automatically resending.

The original requested `top_score` field is retained, while `top_scores_json` satisfies the top-three message requirement. Evaluation columns are reserved in this proposal but remain blank until the later evaluation stage. Confirm that the installed n8n Data Table version accepts blank/nullable Number and String fields before creating the table; do not encode fake numeric values as placeholders.

## Proposed V1 data and model policies

- **History selection:** proposed `FT` only with regulation-time goals. `AET` and `PEN` are excluded pending official field verification and explicit approval.
- **Sample sufficiency:** proposed minimum 8 home appearances for the home team's home rates and 8 away appearances for the away team's away rates. Counts below those thresholds route to insufficient data without imputation.
- **Smoothing:** proposed none. Zero appearances or a zero league average invalidates the relevant rate/league prediction; no fallback is invented. An observed zero goals numerator is valid and may produce a zero rate/expected-goal component.
- **Probability grid:** keep 0-5 as the assignment baseline. Proposed adaptive grid increases independent home/away bounds until the joint `grid_mass >= 0.999999`; store `residual_prob = 1 - grid_mass` and do not silently renormalize.
- **Delivery:** proposed `pending` before Telegram; update to `sent` after confirmation, `failed` after explicit failure. Ambiguous timeout remains `pending` for manual reconciliation. This improves the original send-then-save order and requires approval.
- **Evaluation:** defer a third evaluation workflow. Keep actual-result/evaluation columns in the proposed prediction log contract for later use; only evaluate records created before kickoff and use the exact approved score target.

These are recommendations, not approved assignment changes. The options, effects, and owner-approval checklist are in [design-decisions.md](design-decisions.md).

## Data safety and model principles

- Use only completed historical matches within an explicit as-of cutoff; prevent future-result leakage.
- Preserve numeric IDs as identity keys; names are labels only.
- Do not fabricate team strengths for insufficient samples.
- Treat scores as uncertain probability estimates.
- Keep the Poisson baseline as the first model and evaluate it before considering machine learning.
- Keep mock and live API testing separate, and never expose credentials in source or exports.

Open choices are listed in [design-decisions.md](design-decisions.md). Recommendations are labelled separately from assignment requirements there.
