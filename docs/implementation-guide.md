# Operator and Beginner Implementation Guide

**Project:** Football Score Prediction Automation V1
**Architecture:** Self-hosted n8n + API-Football + n8n Data Tables + Telegram Bot API
**Environment:** Windows 11 + Docker Desktop + Docker Compose

---

## 1. Quickstart: Managing the n8n Container

The n8n automation engine runs inside Docker Desktop.

### Starting n8n
Open PowerShell or your command terminal in the project directory:
```powershell
cd "C:\Users\HomePC\Documents\Self hosted automation\Livescore automation"
docker compose up -d
```

### Checking Status and Health
Verify that the container is running and healthy:
```powershell
docker compose ps
curl.exe http://localhost:5678/healthz
```
Expected output:
```json
{"status":"ok"}
```

Access the n8n visual editor at: `http://localhost:5678`

### Stopping n8n
```powershell
docker compose down
```
*(All data tables, workflows, and configurations persist in the `livescore_n8n_data` Docker volume.)*

---

## 2. Workflows Overview

The repository contains four workflow exports. On 2026-11-14 the n8n dashboard displayed a total of four workflows, but the workflow views stalled during inspection. Consequently, installed IDs, node counts, activation state, execution history, and credential assignments have not been verified. IDs below are historical references only, not current runtime evidence.

| Workflow Name | Historical ID (unverified) | Purpose | Trigger |
|---|---|---|---|
| **SETUP - Create Prediction Data Tables** | `oHkt8a5sIiohn5jr` | Creates the 3 Data Tables with exact 12, 7, and 47 column schemas. | Manual |
| **Football Prediction — Build Team Strengths** | `wqUPBW36wz5ZN5MV` | Calculates 2025/2026 team attack/defence strengths and league averages. | Manual |
| **Football Prediction — Upcoming Match Predictions** | `JQuFaW0d0D4PEiPe` | Computes Poisson probabilities and dispatches pre-match Telegram predictions for 2026/2027. | Manual |
| **Football Prediction — Verify API Access** | `66zBiUKMW1c4MYyo` | Checks API-Football connection, account plan, and remaining daily request quota. | Manual |

Exports are stored under `workflows/exports/` for Git versioning and backups.

---

Runtime inspection confirmed the container image/version and `/healthz`, but logs reported SQLite write-lock timeouts and database ping failures. No workflow was executed, no Data Table was inspected or initialized, and no API request or Telegram message was sent.

## 3. Operational Step-by-Step Runbook

> **Do not execute the setup or mock workflows yet.** The current runtime reports database-lock errors, and the mock branches are not isolated: Workflow A writes mock records to the production strength tables and reaches Telegram; Workflow B reads/writes production tables and reaches Telegram. First restore database access, inspect existing production data, create exact-schema test tables and workflow copies, and disable Telegram delivery in those copies.

### Step 1: Database setup (wait for runtime recovery)
1. Wait until the editor and Data Tables screens load normally and database errors have stopped.
2. Inspect existing table names, schemas, and row counts; preserve all existing data.
3. If tables are missing and no schema conflict exists, run **SETUP - Create Prediction Data Tables**.
4. Verify actual custom columns and types for all three tables in the Data Tables UI.

### Step 2: Configure API-Football Credential (for Live Mode)
1. Navigate to **Credentials** -> **Add Credential** -> **Header Auth**.
2. Name: `API-Football Header Auth`
3. Header Name: `x-apisports-key`
4. Value: `<Your API-Sports Key>`
5. Click **Save**.

### Step 3: API diagnostics (not run in this phase)
1. Open **Football Prediction — Verify API Access**.
2. Only run this after verifying the named credential; it makes a live API status request.
3. Inspect output to confirm subscription plan and request quota.

### Step 4: Workflow A (requires isolated test tables)
1. Open **Football Prediction — Build Team Strengths**.
2. Notice the node **Data Settings**:
   - `data_mode`: Set to `"mock"` (default) for verified offline execution, or change to `"live"` to pull real fixtures from API-Football.
   - `season`: `2025`
   - `league_id`: `39`
3. Do not execute the production workflow in mock mode; its mock records are written to the production Data Tables.
4. In an isolated test copy, verify completed FT fixture filtering and the calculated aggregates against the source-level expected values in [testing-report.md](testing-report.md).
5. Confirm the test copy writes only to test tables and does not invoke Telegram.

### Step 5: Configure Telegram Bot (for Prediction Delivery)
1. In Telegram, search for `@BotFather` and create a bot (or use your existing bot token).
2. Start a direct conversation with your bot in Telegram and send `/start`.
3. Obtain your numeric Chat ID: Search for `@userinfobot` or `@raw_data_bot` in Telegram and send a message; note the numeric `Id` (e.g. `123456789`).
4. In n8n, go to **Credentials** -> **Add Credential** -> **Telegram API**.
5. Name: `Raskibot Telegram`
6. Access Token: Paste your bot token and save.
7. In **Football Prediction — Upcoming Match Predictions**, edit the node **Format Telegram Message** to set `chat_id: '<Your Numeric Chat ID>'`.

### Step 6: Workflow B (requires isolated test tables)
1. Open **Football Prediction — Upcoming Match Predictions**.
2. Review **Prediction Settings**:
   - `fixture_season`: `2026`
   - `strength_season`: `2025`
   - `data_mode`: `"mock"` (or `"live"`)
   - `date_from` and `date_to`: Upcoming match window.
3. Do not execute the production workflow in mock mode; it reads/writes production Data Tables and has a Telegram send path.
4. In an isolated test copy, confirm Workflow B reads the rows written by the test copy of Workflow A, writes only to `prediction_log_test`, and leaves new predictions pending. Do not dispatch Telegram or create a message ID for mock data.

---

## 4. Understanding the Mathematical Output

Every Telegram message displays:
```text
⚽ FOOTBALL SCORE PREDICTION

Premier League
Arsenal vs Manchester City
Kick-off: 21 Nov 2026, 17:30 (Africa/Lagos)

MOST LIKELY SCORELINES
1. 2-1 — 9.87%
2. 1-1 — 9.54%
3. 1-0 — 7.32%

EXPECTED GOALS
Arsenal: 1.92
Manchester City: 0.98

MATCH OUTCOME PROBABILITIES (captured grid mass)
Home win: 58.42%
Draw: 22.15%
Away win: 19.43%
Probability coverage: 100.00%
Residual probability: 0.00%

Model: poisson-v1
Historical basis: Premier League 2025/2026
IMPORTANT: Statistical estimates only. Football outcomes are uncertain. These predictions are not guaranteed results.
```

- **Probability Coverage:** Indicates the exact joint probability captured by the evaluated grid (e.g. $99.9999\%$).
- **Residual Probability:** Uncaptured extreme probability tail ($1 - \text{grid\_mass}$).
- **Disclaimer:** Prominently alerts the reader that probabilities are statistical models, never guaranteed results.
