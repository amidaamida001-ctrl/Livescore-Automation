# Project overview

Football Score Prediction Automation is a self-hosted n8n system planned to estimate pre-match football scoreline probabilities from completed match history and send predictions to Telegram. It produces estimates, not promises of a match result.

## Two-workflow design

### Workflow A: Build Team Strengths

Retrieve completed historical fixtures from API-Football, inspect and validate each response, normalise fixture/team/score fields, and aggregate home and away performance. It calculates league home/away scoring averages and team home/away played, goals-for, and goals-against totals. It then writes the team and league datasets to their respective Data Tables and sends a Telegram refresh report.

### Workflow B: Predict Upcoming Matches

Retrieve upcoming fixtures, validate and normalise them, then join each home and away team to stored strengths using numeric team IDs and retrieve the matching league/season averages. Estimate expected goals, calculate scoreline probabilities with the Poisson baseline, rank the top three scorelines, derive home/draw/away probabilities, format a Telegram prediction, check the intended fixture/model duplicate key, send, and record the prediction for later evaluation.

Separate workflows allow historical data refresh and prediction runs to have independent schedules, failure handling, and review. Workflow B consumes saved snapshots and does not rebuild historical strengths for every fixture batch.

## Historical measurements and model outline

For each supported league-season, completed results are grouped by team venue. The stored counts and goals for/against provide inputs for home/away attack and defence factors; the league's average home and away goals provide competition baselines. Exact factor formulas and small-sample handling have not yet been selected.

Expected goals are represented by `lambda_home` and `lambda_away`. For a goal count `k`, a Poisson model assigns `P(k; lambda) = exp(-lambda) * lambda^k / k!`. Under the commonly used but not-yet-approved independent team-score assumption, the probability of a scoreline `(h, a)` is `P(h; lambda_home) * P(a; lambda_away)`. The three highest scoreline probabilities can be ranked, and outcome probabilities can be obtained by summing scoreline probabilities for home wins, draws, and away wins. Grid bounds and probability mass outside the grid need a decision before implementation.

## Proposed storage

Use three Data Tables: `team_strengths` for team/season/league venue statistics, `league_strengths` for league/season goal averages, and `prediction_log` for prediction inputs, outputs, delivery status, and timestamp. Keeping league averages separate makes their lookup by Workflow B explicit. The precise schemas and keys are in [system-architecture.md](system-architecture.md).

## Evaluation

Each prediction should be retained so that, once the corresponding fixture is complete, it can be joined to the actual result and evaluated. The actual-result fields, evaluation metrics, treatment of unscored/cancelled fixtures, and reporting cadence are not defined yet; see [design-decisions.md](design-decisions.md).

## Current scope

This phase updates project context and documentation only. The existing LiveScore scripts and sample are preserved as legacy references. No new workflow, table, credential, API request, schedule, or prediction calculation has been created.
