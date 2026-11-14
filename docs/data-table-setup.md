# Data Table Setup and Schema Documentation

**Project:** Football Score Prediction Automation V1
**Target Environment:** n8n 2.46.7 (Community Edition)
**Storage Engine:** n8n Data Tables (Native SQLite persistence)

---

## 1. Overview

The Football Score Prediction Automation system uses three persistent n8n Data Tables:
1. `team_strengths`: Stores venue-specific attacking and defensive metrics for each club calculated from completed historical fixtures.
2. `league_strengths`: Stores the benchmark home and away average goal rates for the competition.
3. `prediction_log`: Full audit and delivery ledger tracking 47 fields covering fixture identity, mathematical calculations, delivery states, and post-match evaluation.

---

## 2. Table Schemas

### Table A: `team_strengths`

Stores team-level historical aggregates for a specific league and season.

| Column Name | Type | Description |
|---|---|---|
| `team_key` | String | Composite logical key: `<league_id>\|<season>\|<team_id>` |
| `league_id` | Number | API-Football league identifier (e.g. `39` for EPL) |
| `season` | Number | Historical training season (e.g. `2025` for 2025/2026) |
| `team_id` | Number | Numeric team ID |
| `team_name` | String | Official club name |
| `home_played` | Number | Total completed home matches played |
| `home_goals_for` | Number | Total goals scored at home |
| `home_goals_against`| Number | Total goals conceded at home |
| `away_played` | Number | Total completed away matches played |
| `away_goals_for` | Number | Total goals scored away |
| `away_goals_against`| Number | Total goals conceded away |
| `updated_at` | Date | Timestamp of last recalculation (ISO 8601) |

- **Logical Key:** `league_id|season|team_id`
- **Total Columns:** 12

---

### Table B: `league_strengths`

Stores competition baseline scoring rates used as denominators for attack and defence factor calculations.

| Column Name | Type | Description |
|---|---|---|
| `league_key` | String | Composite logical key: `<league_id>\|<season>` |
| `league_id` | Number | API-Football league identifier (e.g. `39`) |
| `season` | Number | Historical training season (e.g. `2025`) |
| `league_home_avg` | Number | Average home goals per match: `sum(home_goals) / matches_used` |
| `league_away_avg` | Number | Average away goals per match: `sum(away_goals) / matches_used` |
| `matches_used` | Number | Count of valid completed FT matches aggregated |
| `updated_at` | Date | Timestamp of last recalculation (ISO 8601) |

- **Logical Key:** `league_id|season`
- **Total Columns:** 7

---

### Table C: `prediction_log`

Complete immutable prediction log and state-tracking table with 47 custom columns across 4 functional domains.

#### Domain 1: Match Identity (12 Columns)
| Column Name | Type | Description |
|---|---|---|
| `prediction_key` | String | Composite key: `<fixture_id>\|<model_version>` |
| `fixture_id` | Number | API-Football unique fixture identifier |
| `model_version` | String | Active model identifier (e.g. `poisson-v1`) |
| `league_id` | Number | League identifier (`39`) |
| `league_name` | String | League name (`Premier League`) |
| `fixture_season` | Number | Match season (`2026` for 2026/2027) |
| `strength_season` | Number | Historical strength season (`2025` for 2025/2026) |
| `match_date` | Date | Kickoff timestamp in UTC (ISO 8601) |
| `home_team_id` | Number | Home team numeric identifier |
| `home_team_name` | String | Home club name |
| `away_team_id` | Number | Away team numeric identifier |
| `away_team_name` | String | Away club name |

#### Domain 2: Statistical Prediction Data (20 Columns)
| Column Name | Type | Description |
|---|---|---|
| `lambda_home` | Number | Expected goals for home team ($\lambda_{\text{home}}$) |
| `lambda_away` | Number | Expected goals for away team ($\lambda_{\text{away}}$) |
| `top_score` | String | Most probable scoreline (e.g. `2-1`) |
| `top_scores_json` | String | Serialized array of top 3 ranked scorelines with probabilities |
| `home_win_prob` | Number | Cumulative probability of home victory |
| `draw_prob` | Number | Cumulative probability of a draw |
| `away_win_prob` | Number | Cumulative probability of away victory |
| `grid_max_goals` | Number | Maximum score evaluated in adaptive grid (5 to 50) |
| `grid_mass` | Number | Cumulative probability captured by grid ($\ge 0.999999$) |
| `residual_prob` | Number | Probability mass outside grid ($1 - \text{grid\_mass}$) |
| `home_team_home_played`| Number | Historical home matches sample size |
| `away_team_away_played`| Number | Historical away matches sample size |
| `home_attack_strength` | Number | Home attack factor |
| `home_defence_weakness`| Number | Home defence weakness factor |
| `away_attack_strength` | Number | Away attack factor |
| `away_defence_weakness`| Number | Away defence weakness factor |
| `league_home_avg` | Number | Historical league home goals per match |
| `league_away_avg` | Number | Historical league away goals per match |
| `team_strengths_updated_at` | Date | Snapshot timestamp of team strength input |
| `league_strengths_updated_at` | Date | Snapshot timestamp of league strength input |

#### Domain 3: Telegram Delivery Lifecycle (7 Columns)
| Column Name | Type | Description |
|---|---|---|
| `status` | String | Lifecycle state: `pending`, `sent`, `failed` |
| `predicted_at` | Date | Generation timestamp (ISO 8601) |
| `attempt_count` | Number | Delivery attempts made (starts at `0` for pending) |
| `last_attempt_at`| Date | Timestamp of most recent transmission attempt |
| `sent_at` | Date | Confirmed Telegram delivery timestamp |
| `telegram_message_id` | String | Message ID returned by Telegram Bot API |
| `error_message` | String | Sanitized error message on delivery failure |

#### Domain 4: Post-Match Model Evaluation (8 Columns)
| Column Name | Type | Description |
|---|---|---|
| `actual_home_goals` | Number | Official final home goals |
| `actual_away_goals` | Number | Official final away goals |
| `actual_match_status` | String | Final match status (`FT`, `AET`, `PEN`) |
| `actual_outcome` | String | Actual 1X2 result (`HOME_WIN`, `DRAW`, `AWAY_WIN`) |
| `actual_score_probability` | Number | Probability assigned to the actual scoreline prior to kickoff |
| `brier_1x2` | Number | Multi-class Brier accuracy score |
| `top3_hit` | Boolean | True if the actual score was in the top 3 predicted scores |
| `evaluated_at` | Date | Timestamp of evaluation run |

- **Logical Key:** `fixture_id|model_version`
- **Total Columns:** 47

---

## 3. Creating the Tables via n8n

### Setup workflow export

The repository export is `workflows/exports/00-setup-data-tables.json` (8 nodes). The n8n dashboard showed four workflows during the 2026-11-14 inspection, but the setup workflow's installed ID and current state were not verified because the workflow view stalled.

The export lists existing tables, compares custom column names and types with the expected schemas, and stops before creation if an existing table conflicts. It then uses `createIfNotExists` for each expected table. Source schemas match the export exactly: `team_strengths` 12 columns, `league_strengths` 7 columns, and `prediction_log` 47 columns. The canonical prediction fields include `fixture_season`, `strength_season`, `match_date`, and `attempt_count`.

**Runtime result:** No Data Table was inspected or initialized in this phase. n8n logs showed SQLite lock/database timeouts and the Data Tables view did not load. The actual presence, schemas, and row counts of the three tables are unknown. Do not run setup until the runtime is stable and existing tables have been inspected.

### Step-by-Step Operator Instructions
1. Confirm the existing n8n container and database are healthy and the Data Tables screen loads.
2. Inspect all three table names, custom columns, types, and row counts; preserve existing data.
3. If an existing table's schema differs, stop and resolve the discrepancy without deleting it.
4. If tables are missing and the preflight is safe, run **SETUP - Create Prediction Data Tables**.
5. Reopen each table in the Data Tables UI and verify its actual custom columns and types. Do not infer this from a green workflow execution alone.
