# Comprehensive Testing & Verification Report

**Project:** Football Score Prediction Automation V1
**Test Framework:** Node.js Native Test Runner (`node:test`, `node:assert/strict`)
**Date:** 2026-11-14
**Overall Status:** PASS for local JavaScript/export checks; BLOCKED for n8n runtime end-to-end validation

---

## 1. Executive Summary

All nine local Node.js test files passed (35/35 tests). Workflow JSON and source/export schema contracts also passed static validation. This does not establish that workflows were imported with the exported content, that Data Tables exist, or that either workflow executed in n8n.

### Runtime evidence and validation boundary

| Validation layer | Result |
|---|---|
| Docker container/version | `livescore-n8n` was running `docker.n8n.io/n8nio/n8n:2.46.7`. |
| Health endpoint | `http://localhost:5678/healthz` returned HTTP 200 (`{"status":"ok"}`) on 2026-11-14. |
| n8n UI | Dashboard displayed four workflows and 0 production executions / 0 failed production executions at inspection. Workflow and Data Tables views stalled. |
| Database stability | **Blocked:** recent logs reported SQLite write-mutex timeouts and database ping failures. |
| Installed workflows | Exact IDs, node counts, active state, credentials, and execution history were not verified. Export node counts are 8/15/20/3; all exports are inactive. |
| Data Tables | **Not verified or initialized.** Existence, actual schemas, and row counts are unknown. |
| Workflow A/B in n8n | **Not executed.** No n8n node outputs or stored test rows were produced in this phase. |
| API-Football | No diagnostics or fixture requests were sent; credential presence, plan, quota, and data availability remain unverified. |
| Telegram | No message was sent; credential presence and delivery are unverified. |

The existing mock paths are unsafe for production execution: Workflow A writes mock strengths to `team_strengths`/`league_strengths` and reaches a Telegram node; Workflow B reads and writes production table names and reaches a Telegram node. Isolated test tables/workflow copies and a no-send notification path are prerequisites to n8n mock execution.

| Test Suite File | Tests | Pass | Fail | Scope Covered |
|---|---|---|---|---|
| `tests/test-scenarios-a-to-t.js` | 20 | 20 | 0 | All 20 mandatory V1 scenarios (A through T) |
| `tests/test-normalisation.js` | 4 | 4 | 0 | Historical and upcoming fixture validation, AET/PEN exclusions |
| `tests/test-team-strengths.js` | 2 | 2 | 0 | Goal totals, appearance counts, venue averages |
| `tests/test-poisson.js` | 2 | 2 | 0 | Expected goals, adaptive Poisson grid, edge cases |
| `tests/test-deduplication.js` | 3 | 3 | 0 | Duplicate prevention, sequential state transitions |
| `tests/test-workflow-scenarios.js` | 1 | 1 | 0 | Source-level A calculations and B join using stored mock strengths |
| `tests/test-api-budget.js` | 1 | 1 | 0 | Request budget and quota protection calculations |
| `tests/test-table-schemas.js` | 1 | 1 | 0 | Schema contract verification for all 3 Data Tables |
| `tests/test-workflow-exports.js` | 1 | 1 | 0 | Structural integrity of exported n8n workflow JSONs |
| **Total** | **35** | **35** | **0** | **Local regression test coverage** |

---

## 2. Mandatory Test Scenarios (A through T)

| ID | Scenario Description | Tested Behavior | Outcome |
|---|---|---|---|
| **A** | Valid historical fixture response | Accepts FT fixtures matching league and season; validates structure | **PASS** |
| **B** | Empty historical response | Returns zero accepted fixtures without crashing or treating as API error | **PASS** |
| **C** | API error handling | Throws informative exception on API error envelope, stopping execution | **PASS** |
| **D** | Exclusion of AET and PEN | Filters out matches decided by Extra Time or Penalty Shootouts | **PASS** |
| **E** | Duplicate fixture handling | Discards duplicate fixture IDs to prevent double counting in aggregates | **PASS** |
| **F** | Correct league averages | Computes exact average home and away goals per match | **PASS** |
| **G** | Correct team statistics | Accurately calculates home/away played, goals for, and goals against | **PASS** |
| **H** | Minimum sample validation | Rejects teams with $< 8$ venue appearances from prediction | **PASS** |
| **I** | Missing team strength | Promoted/new teams without historical strengths routed to insufficient data | **PASS** |
| **J** | Expected goals calculation | Computes $\lambda_{\text{home}}$ and $\lambda_{\text{away}}$ using approved venue ratios | **PASS** |
| **K** | Poisson scoreline ranking | Ranks top 3 most probable scorelines in descending probability order | **PASS** |
| **L** | Probability mass and residual | Ensures grid mass $\ge 0.999999$ and outcome total matches grid mass | **PASS** |
| **M** | Grid limit handling | Expands score grid dynamically up to 50 goals per side; fails closed if unreachable | **PASS** |
| **N** | Duplicate prediction prevention | Skips already sent fixtures; flags pending/failed fixtures for review | **PASS** |
| **O** | Pending Telegram status | New predictions recorded as `status: 'pending'` before delivery | **PASS** |
| **P** | Successful delivery state | Confirmed delivery updates status to `sent` with Telegram message ID | **PASS** |
| **Q** | Explicit delivery failure | Explicit failure updates status to `failed` with sanitized error | **PASS** |
| **R** | Ambiguous timeout | Network/gateway timeout keeps status `pending` for manual review | **PASS** |
| **S** | No upcoming fixtures | Gracefully handles empty upcoming schedule without errors | **PASS** |
| **T** | Multiple upcoming fixtures | Evaluates multiple fixtures independently, isolating valid and missing data | **PASS** |

---

## 3. Mathematical Verification (Hand-Check Benchmark)

Using the assignment's explicit test parameters:
- **League Averages:** $\text{League Home Avg} = 1.50$, $\text{League Away Avg} = 1.10$
- **Home Team:** Home Played = 10, Goals For = 18, Goals Against = 9
- **Away Team:** Away Played = 10, Goals For = 12, Goals Against = 16

### Hand Calculations
1. **Home Attack Strength:**
   $$\text{Attack}_{\text{home}} = \frac{18 / 10}{1.50} = \frac{1.80}{1.50} = 1.20$$
2. **Away Defence Weakness:**
   $$\text{Defence}_{\text{away}} = \frac{16 / 10}{1.50} = \frac{1.60}{1.50} \approx 1.0667$$
3. **Expected Home Goals ($\lambda_{\text{home}}$):**
   $$\lambda_{\text{home}} = 1.50 \times 1.20 \times 1.0667 = 1.9200$$

4. **Away Attack Strength:**
   $$\text{Attack}_{\text{away}} = \frac{12 / 10}{1.10} = \frac{1.20}{1.10} \approx 1.0909$$
5. **Home Defence Weakness:**
   $$\text{Defence}_{\text{home}} = \frac{9 / 10}{1.10} = \frac{0.90}{1.10} \approx 0.8182$$
6. **Expected Away Goals ($\lambda_{\text{away}}$):**
   $$\lambda_{\text{away}} = 1.10 \times 1.0909 \times 0.8182 = 0.9818 \approx 0.98$$

### Model Output in Test J:
- Computed $\lambda_{\text{home}} = 1.920000000000$ (Difference from 1.92: $< 10^{-12}$)
- Computed $\lambda_{\text{away}} = 0.981818181818$ (Difference from ~0.98: $< 10^{-12}$)
- Captured Grid Mass: $0.9999990999304164 \ge 0.999999$
- Residual Probability: $0.0000009000695836425265$
- Outcome Mass: $\text{Home Win} + \text{Draw} + \text{Away Win} = \text{Grid Mass}$
- Top 3 Scorelines: `1-0`, `1-1`, `2-0`, ranked by probability.
- The outcome total equals grid mass within floating-point tolerance; the implementation does not renormalize probabilities to 1.
- **Source-code benchmark: VERIFIED.** This is a local JavaScript calculation, not an n8n execution.

## 4. Workflow export and schema checks

- All four export files parsed as JSON; all connection sources and targets resolve to exported node names.
- Export node counts: setup 8, Workflow A 15, Workflow B 20, API diagnostics 3. Each export is inactive by default.
- Source schemas match the setup export exactly: `team_strengths` 12 columns, `league_strengths` 7, `prediction_log` 47, including `fixture_season`, `strength_season`, `match_date`, and `attempt_count`.
- These are repository checks only. Import compatibility in the live n8n editor, installed-workflow equivalence, and actual Data Table schemas remain unverified.

### Mock-history calculation from JavaScript source (not persisted)

- Normalization accepted 16 of 21 mock fixtures and rejected 5 (including AET, PEN, duplicate ID, and invalid score cases).
- Aggregation produced 2 team rows and one league row: `matches_used=16`, `league_home_avg=1.6875`, and `league_away_avg=1.25`.
- Team 42: home 8 matches, 18 scored, 9 conceded; away 8 matches, 11 scored, 9 conceded.
- Team 49: home 8 matches, 9 scored, 11 conceded; away 8 matches, 9 scored, 18 conceded.
- These values are code-level expected results only. Zero rows were written to n8n test or production tables in this phase.

## 5. Required next validation

1. Resolve the n8n database lock/timeouts using supported n8n operations without recreating the container, deleting the volume, or modifying SQLite directly.
2. Verify workflow IDs, node counts, activation state, execution history, credential names, and actual Data Table columns in the UI.
3. Create isolated test tables and test workflow copies; route mock writes only to those tables and suppress Telegram delivery.
4. Execute the complete Workflow A -> test Data Tables -> Workflow B path, inspect node outputs and persisted rows, then update this report with observed results.
