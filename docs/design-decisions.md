# Open Design Decisions

This list captures choices that must be reviewed before implementation. The items below are unresolved; this document does not silently select answers or alter the requested baseline.

## Assignment requirements to resolve

1. **Historical API pagination:** determine the API-Football pagination strategy, page limits, completeness checks, retry behavior, and how partial refreshes are reported.
2. **League and season coverage:** select the supported competition IDs and seasons and decide how new seasons enter the refresh scope.
3. **Minimum historical sample sizes:** define separate adequacy rules for league averages and home/away team measurements. Do not invent strengths for teams below the chosen sample size.
4. **League average storage:** retain the proposed dedicated `league_strengths` table, keyed by `league_id|season`, unless a reviewed architecture change replaces it. Confirm how a refresh replaces or updates rows.
5. **Team lookup strategy:** use numeric team IDs with league and season context; define behavior for team ID changes, missing IDs, and promoted/new teams.
6. **Probability mass outside the score grid:** select goal bounds and decide whether to expand the grid, report residual mass, or use another reviewed method when calculating top scores and win/draw/loss probabilities.
7. **Prediction deduplication:** confirm the intended `fixture_id + model_version` key, behavior when a prediction is refreshed before kickoff, and whether failed deliveries may be retried.
8. **Telegram delivery failure handling:** define retry/backoff, rate-limit handling, terminal failure status, and how a message failure relates to the stored prediction.
9. **Prediction evaluation against actual results:** decide how completed fixtures join to the log, how void/postponed matches are handled, which probability metrics and baselines are used, and what evaluation window is reported. The initial `prediction_log` schema does not yet include actual-result fields.
10. **API request budgeting:** estimate requests per league/season and fixture run; define rate-limit response handling and a refresh cadence that stays within the account's quota.

## Model choices requiring review

- Define the venue-specific attack and defence strength formulas and how they combine with league home/away averages to produce `lambda_home` and `lambda_away`.
- Confirm whether home and away goal counts are treated as independent Poisson variables; this is a modelling assumption, not yet an approved requirement.
- Decide how to handle zero league averages, sparse observations, missing values, and any smoothing. Do not add smoothing or fallback values without agreement.
- Define `top_score` representation and probability units (fraction or percentage) consistently across storage and Telegram output.
- Define the `status` values and which timestamp represents prediction creation versus delivery.
- Select a `model_version` naming convention and rules for recalculating a prediction when strengths refresh.

## Recommendations (separate from assignment requirements)

- Make refreshes idempotent and report the exact league-season, fixture count, and rejected-record count.
- Store enough provenance to reproduce predictions, such as the strength refresh timestamp and model version, if the final table design permits it.
- Evaluate calibrated probabilities on predictions timestamped before kickoff, using a time-ordered holdout and at least one simple baseline.
- Record Telegram delivery outcomes distinctly from prediction creation so a notification retry cannot silently create a second prediction.

These are recommendations for later review, not approved scope. No workflows, tables, API requests, credentials, or model code were created while documenting them.
