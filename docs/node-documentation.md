# n8n Node and JavaScript Code Modules Documentation

**Project:** Football Score Prediction Automation V1
**Directory:** `src/code-nodes/`
**Execution Context:** n8n 2.46.7 Code Nodes (`typeVersion: 2`)

---

## 1. JavaScript Code Modules Overview

All business logic, data sanitization, transformations, statistical calculations, and state machines are maintained as standalone, testable Node.js modules in `src/code-nodes/`. The exact verified logic is embedded into n8n Code nodes.

| Source File | Function Name | Purpose |
|---|---|---|
| `normalise-history.js` | `normaliseHistoryResponse(body, settings)` | Validates historical API response, excludes AET/PEN, duplicates, and out-of-cutoff fixtures. |
| `calculate-team-strengths.js` | `calculateTeamStrengths(fixtures, settings)` | Calculates competition scoring averages and team home/away goals for/against. |
| `normalise-fixtures.js` | `normaliseUpcomingFixtures(body, settings)` | Validates upcoming unstarted fixtures within the configured date range. |
| `join-team-strengths.js` | `joinTeamStrengths(fixtures, teams, leagues, settings)` | Joins fixtures with historical strengths by numeric ID; checks $\ge 8$ match adequacy. |
| `calculate-poisson.js` | `calculatePrediction(joined, settings)` | Computes expected goals, Poisson score probabilities, and adaptive grid ($5$ to $50$ goals). |
| `format-prediction.js` | `formatPrediction(prediction, timezone)` | Formats user-facing Telegram message with scorelines, xG, probabilities, and disclaimer. |
| `manage-prediction-state.js` | `decidePrediction`, `markSent`, `markFailed`, etc. | Implements sequential deduplication and delivery lifecycle transitions. |
| `data-table-schemas.js` | `schemas`, `getSchema(name)` | Contract definitions for `team_strengths`, `league_strengths`, and `prediction_log`. |

---

## 2. Node Specifications by Workflow

### Workflow 1: Football Prediction — Build Team Strengths
- **Start Data Refresh (`manualTrigger`, v1):** Operator manual execution trigger.
- **Data Settings (`set`, v3.4):** Sets league ID (`39`), season (`2025`), timezone (`Africa/Lagos`), threshold (`8`), and execution mode (`mock` or `live`).
- **Check Data Mode (`if`, v2):** Routes to mock payload or live API call based on `data_mode`.
- **Get Completed Fixtures (`httpRequest`, v4.2):** Calls API-Football `/fixtures` with status `FT` using `API-Football Header Auth`.
- **API Response OK? (`if`, v2):** Validates HTTP 200, empty errors object, and complete pagination.
- **Validate & Normalise History (`code`, v2):** Runs `normalise-history.js` logic; outputs validated match list.
- **Calculate League & Team Rates (`code`, v2):** Computes `league_home_avg`, `league_away_avg`, and team venue counts.
- **Split Record Type (`if`, v2):** Routes `record_type: 'team'` to team table and `record_type: 'league'` to league table.
- **Save Team Strengths (`dataTable`, v1.1):** Upserts team rows matching on `team_key`.
- **Save League Strengths (`dataTable`, v1.1):** Upserts league summary matching on `league_key`.
- **Wait for Both Saves (`merge`, v3):** Barrier merge ensuring both tables finish writing before reporting.
- **Build One Refresh Report (`code`, v2):** Generates single execution summary.
- **Data Refresh Report (`telegram`, v1.2):** Sends refresh summary to operator Telegram.

---

### Workflow 2: Football Prediction — Upcoming Match Predictions
- **Start Prediction Run (`manualTrigger`, v1):** Operator manual execution trigger.
- **Prediction Settings (`set`, v3.4):** Sets upcoming season (`2026`), historical strength season (`2025`), date window, and model parameters.
- **Check Data Mode (`if`, v2):** Routes to mock upcoming fixtures or live API call.
- **Get Upcoming Fixtures (`httpRequest`, v4.2):** Queries upcoming `NS` fixtures for season 2026.
- **Validate API Response (`if`, v2):** Confirms valid API response structure.
- **Normalise Upcoming Fixtures (`code`, v2):** Runs `normalise-fixtures.js` logic.
- **Read Team Strengths (`dataTable`, v1.1):** Fetches team strengths for league 39, season 2025.
- **Read League Strengths (`dataTable`, v1.1):** Fetches league averages for league 39, season 2025.
- **Join Fixture & Team Strengths (`code`, v2):** Links fixtures to strengths using numeric IDs.
- **Check Historical Data Sufficiency (`if`, v2):** Checks $\ge 8$ appearances; routes insufficient data to audit log.
- **Calculate Score Probabilities (`code`, v2):** Evaluates expected goals and adaptive Poisson grid up to 50 goals.
- **Read Prediction Log (`dataTable`, v1.1):** Queries `prediction_log` by `prediction_key`.
- **Decide Duplicate Prevention (`code`, v2):** Prevents resending already dispatched predictions.
- **Filter New Predictions (`if`, v2):** Filters out duplicate or reconciled rows.
- **Save Pending Prediction (`dataTable`, v1.1):** Writes prediction row with `status: 'pending'`, `attempt_count: 0`.
- **Format Telegram Message (`code`, v2):** Produces formatted notification with mandatory disclaimer.
- **Send Prediction (`telegram`, v1.2):** Transmits notification to Telegram bot chat.
- **Update Prediction Log (Sent) (`dataTable`, v1.1):** Updates row to `status: 'sent'`, records `sent_at` and `telegram_message_id`.

---

### Workflow 3: Football Prediction — Verify API Access
- **Start Diagnostics (`manualTrigger`, v1):** Manual trigger.
- **Check API Status & Quota (`httpRequest`, v4.2):** Calls `/status` endpoint without consuming quota.
- **Format Diagnostics Report (`code`, v2):** Parses account email, subscription plan, requests used, and requests remaining.
