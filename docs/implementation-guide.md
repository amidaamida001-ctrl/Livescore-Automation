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

All four workflows are already imported into your n8n instance:

| Workflow Name | Workflow ID | Purpose | Trigger |
|---|---|---|---|
| **SETUP - Create Prediction Data Tables** | `oHkt8a5sIiohn5jr` | Creates the 3 Data Tables with exact 12, 7, and 47 column schemas. | Manual |
| **Football Prediction — Build Team Strengths** | `wqUPBW36wz5ZN5MV` | Calculates 2025/2026 team attack/defence strengths and league averages. | Manual |
| **Football Prediction — Upcoming Match Predictions** | `JQuFaW0d0D4PEiPe` | Computes Poisson probabilities and dispatches pre-match Telegram predictions for 2026/2027. | Manual |
| **Football Prediction — Verify API Access** | `66zBiUKMW1c4MYyo` | Checks API-Football connection, account plan, and remaining daily request quota. | Manual |

Exports are stored under `workflows/exports/` for Git versioning and backups.

---

## 3. Operational Step-by-Step Runbook

### Step 1: Run the Database Setup Workflow
1. In `http://localhost:5678`, open **SETUP - Create Prediction Data Tables**.
2. Click **Test workflow**.
3. All nodes will execute with green checkmarks.
4. Verify under the **Data Tables** section in n8n that `team_strengths`, `league_strengths`, and `prediction_log` are created.

### Step 2: Configure API-Football Credential (for Live Mode)
*(When running in default `mock` mode, no API credentials or requests are needed).*
1. Navigate to **Credentials** -> **Add Credential** -> **Header Auth**.
2. Name: `API-Football Header Auth`
3. Header Name: `x-apisports-key`
4. Value: `<Your API-Sports Key>`
5. Click **Save**.

### Step 3: Run Workflow Diagnostics
1. Open **Football Prediction — Verify API Access**.
2. Click **Test workflow**.
3. Inspect output to confirm subscription plan and request quota.

### Step 4: Run Workflow A (Build Team Strengths)
1. Open **Football Prediction — Build Team Strengths**.
2. Notice the node **Data Settings**:
   - `data_mode`: Set to `"mock"` (default) for verified offline execution, or change to `"live"` to pull real fixtures from API-Football.
   - `season`: `2025`
   - `league_id`: `39`
3. Click **Test workflow**.
4. The workflow validates completed FT fixtures, calculates league home/away averages and team strengths, and upserts them into `team_strengths` and `league_strengths`.
5. It compiles a single refresh summary report.

### Step 5: Configure Telegram Bot (for Prediction Delivery)
1. In Telegram, search for `@BotFather` and create a bot (or use your existing bot token).
2. Start a direct conversation with your bot in Telegram and send `/start`.
3. Obtain your numeric Chat ID: Search for `@userinfobot` or `@raw_data_bot` in Telegram and send a message; note the numeric `Id` (e.g. `123456789`).
4. In n8n, go to **Credentials** -> **Add Credential** -> **Telegram API**.
5. Name: `Raskibot Telegram`
6. Access Token: Paste your bot token and save.
7. In **Football Prediction — Upcoming Match Predictions**, edit the node **Format Telegram Message** to set `chat_id: '<Your Numeric Chat ID>'`.

### Step 6: Run Workflow B (Predict Upcoming Matches)
1. Open **Football Prediction — Upcoming Match Predictions**.
2. Review **Prediction Settings**:
   - `fixture_season`: `2026`
   - `strength_season`: `2025`
   - `data_mode`: `"mock"` (or `"live"`)
   - `date_from` and `date_to`: Upcoming match window.
3. Click **Test workflow**.
4. The engine will:
   - Normalize upcoming fixtures.
   - Join with historical team strengths by numeric team IDs.
   - Validate that each team has $\ge 8$ appearances. Any team with insufficient samples is routed to the insufficient-data branch without guessing.
   - Compute expected goals ($\lambda_{\text{home}}, \lambda_{\text{away}}$).
   - Compute Poisson probabilities across an adaptive grid (up to 50 goals per side) until $\ge 99.9999\%$ of the probability mass is captured.
   - Check `prediction_log` to ensure no duplicate prediction is ever sent.
   - Save the record as `pending`.
   - Dispatch the prediction to Telegram.
   - Update the record status to `sent` with the Telegram message ID and timestamp.

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
