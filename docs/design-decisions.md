# V1 Design Decision Register

**Status:** Recommendations for owner review; none of these V1 choices is approved or implemented yet. This register separates assignment requirements from proposed operational choices. Do not create tables, workflows, credentials, schedules, or prediction code until the owner approves the required decisions.

## A. Initial project scope

**Decision:** Bound each execution to one league and one season; keep both workflows manual during development.

| Item | Details |
| --- | --- |
| Options | One league-season per run; multiple league-seasons in one run; one all-in-one workflow; scheduled versus manual triggers. |
| Recommended V1 | Keep the two separate workflows. Require `league_id` and `season` in each run. Use Manual Trigger for both. Do not activate schedules. |
| Why | Limits API and table scope, makes refresh reports auditable, simplifies missing-data diagnosis, and keeps Workflow A independently reviewable. |
| Workflow/data effect | Settings contain one league and season; keys are scoped to that pair. Multi-league batching and schedules remain future changes. |
| Approval | **Yes**, before implementation. |

## B. API-Football verification and account checks

**Decision:** Verify the API contract and subscription access from the official reference and account dashboard before the first live request.

### Research status

The intended endpoint in the assignment is `GET https://v3.football.api-sports.io/fixtures`. Official API-Football v3 documentation and pricing pages were attempted on 2026-11-12, but the documentation fetch returned HTTP 403 or could not extract the JavaScript-rendered reference. No API key was available or requested, and no live API request was made. Consequently the following details are **not verified against the current official reference or this account**:

- Fixture query parameters and whether `timezone` is supported for this endpoint.
- Pagination contract and whether metadata is exactly `paging.current` / `paging.total`.
- The complete response envelope and the precise location of fixture, league, team, date, and score values.
- Whether `FT`, `AET`, and `PEN` can be combined in one `status` parameter or must be fetched separately.
- Whether `goals.home/away` or `score.fulltime.home/away` is the correct regulation-time score field for each completed status.
- Which historical seasons and fixture endpoints are enabled by the account subscription.
- The current request quota, burst/rate limits, and retry policy for the account.

The existing blueprint lists the expected v3 response shape and candidate parameters as **planning expectations only**, not verified facts. Official sources to check:

- [API-Football v3 reference](https://www.api-football.com/documentation-v3#tag/Fixtures/operation/get-fixtures)
- [API-Football plans](https://www.api-football.com/pricing)
- [API-Football FAQ](https://www.api-football.com/news/post/api-football-faq)

### Options and recommendation

| Item | Details |
| --- | --- |
| Options | Use the expected v3 contract from the blueprint; inspect the official reference and account first; make an authenticated sample call now. |
| Recommended V1 | Do not call the live API yet. Before API node implementation, verify the fixtures endpoint, accepted query parameters, `page` behavior, `paging` fields, full response envelope, status definitions, regulation score fields, league/season coverage, and account quota from the official docs/dashboard. Then inspect a sanitized response sample in an explicitly authorized test. |
| Why | A guessed field or assumed account plan can silently omit pages, use extra-time scores, or exceed quota. |
| Workflow/data effect | Until verified, A3/B3 query/status configuration and normalization paths remain provisional. Every page and retry counts against the eventual budget. |
| Approval | **Owner action required:** confirm subscribed plan, available request quota/rate limits, historical seasons, supported leagues, and permission for a later sample request. Never send an API key in chat or commit it. |

Expected v3 conventions to verify, not treat as confirmed: `league`, `season`, `status`, `page`, possibly `from`/`to` and `timezone`; a response with `errors`, `results`, `paging`, and `response[]`; fixture fields under `fixture`, `league`, `teams`, `goals`, and `score`. The common API-Football authentication header is believed to be `x-apisports-key`; verify hostname/header requirements for the account before configuring n8n Credentials.

## C. Historical match selection

**Decision:** Which finished fixtures are eligible for historical averages and team totals, and which score field is the target?

| Option | Effect |
| --- | --- |
| `FT` only | Uses regulation full-time matches. Narrowest and least ambiguous initial dataset. |
| `FT`, `AET`, and `PEN` | Includes matches that completed after extra time or reached a penalty shootout. Requires strict use of the 90-minute full-time score for a regulation-time prediction model; using final `goals` may mix score definitions. |

**Recommended V1:** `FT` only; use the verified regulation full-time score fields. Exclude `AET` and `PEN` until their official field semantics and desired score target are reviewed. Candidate meanings are `FT` = full-time, `AET` = after extra time, `PEN` = penalties, but these codes/field semantics were not confirmed from the official page because it returned 403.

**Effect:** Workflow A filters by completed status and the historical cutoff. The league averages and team totals share one deduplicated set of eligible fixture IDs. A later policy change requires a model/data version review and full strength refresh.

**Approval:** **Yes**, because status inclusion defines the model's target data.

## D. Minimum historical sample

**Decision:** Separate minimum appearances by venue, rather than one combined games-played count.

| Option | Pros/cons |
| --- | --- |
| 5 home / 5 away | More teams eligible and more predictions; venue rates have high sampling variance. |
| 8 home / 8 away | Lower coverage but a more defensible V1 minimum for separate venue rates. Still not a guarantee of statistical stability. |
| Require an arbitrary combined total | Can hide a team with zero observations in the specific venue used by the formula. |

**Recommended V1:** `minimum_home_matches = 8` and `minimum_away_matches = 8`. For a given fixture, require the home team to have at least 8 home appearances and the away team to have at least 8 away appearances. Apply the relevant threshold to the denominator for each calculated rate; do not require irrelevant venue rows for the current λ calculation unless the workflow later uses them. Store raw counts, not fabricated strengths. Report each missing/insufficient fixture with an explicit reason.

League averages require a complete paginated query and `matches_used > 0`; this register does not invent a separate numeric league minimum. Confirm requested season completeness and league coverage before treating the average as representative.

**Effect:** Workflow B routes insufficient fixture inputs to a visible branch and does not create/send a prediction. Workflow A still stores actual counts, including counts below the threshold.

**Approval:** **Yes**, especially the proposed 8-per-relevant-venue threshold.

## E. Team and league rate calculations

**Required formulas (preserved exactly):**

- `home_attack = (home_goals_for / home_played) / league_home_avg`
- `home_defence_weakness = (home_goals_against / home_played) / league_away_avg`
- `away_attack = (away_goals_for / away_played) / league_away_avg`
- `away_defence_weakness = (away_goals_against / away_played) / league_home_avg`
- `lambda_home = league_home_avg * home_team_home_attack * away_team_away_defence_weakness`
- `lambda_away = league_away_avg * away_team_away_attack * home_team_home_defence_weakness`

**Decision:** Whether to add smoothing/fallbacks and where to derive the ratios.

| Item | Details |
| --- | --- |
| Options | Add smoothing/fallbacks; or use the assignment formula directly and reject invalid denominators/samples. |
| Recommended V1 | No smoothing and no fallback values. Store integer counts/goals in `team_strengths`; calculate rates only when relevant appearance counts meet the approved threshold and league averages are valid. |
| Zero appearances | Mark that venue rate insufficient; never divide and never substitute league averages. |
| Zero league average | The corresponding strength ratio has a zero denominator. Mark the league-season invalid for prediction and report it; do not replace the mean with a constant. |
| Observed zero goals | A valid measured zero numerator produces rate 0. This is observed data, not an imputed fallback. `lambda = 0` is mathematically valid and Poisson is degenerate at zero goals. |
| Other invalid values | Reject missing, non-finite, negative counts/averages, or inconsistent data before calculating λ. |
| Workflow/data effect | Raw counts remain the source of truth; sufficiency and rates are recomputed by the prediction calculation from one selected snapshot. |
| Approval | The formulas are assignment requirements and are not changed. **Approval required** for the no-smoothing policy and zero-denominator failure behavior. |

## F. V1 Data Table contracts

The full proposed contracts are in [system-architecture.md](system-architecture.md), and the workflow blueprint must be kept consistent with them. No table is created in this phase.

### `team_strengths`

One row per `team_key = league_id|season|team_id`. Keep the requested 12 columns: `team_key` String; `league_id`, `season`, `team_id`, `home_played`, `home_goals_for`, `home_goals_against`, `away_played`, `away_goals_for`, `away_goals_against` Number; `team_name`, `updated_at` String. Counts and goals are non-negative integers represented by Number. `team_name` is display-only, not an identity key.

### `league_strengths`

One row per `league_key = league_id|season`. Keep the requested 7 columns: `league_key` String; `league_id`, `season`, `league_home_avg`, `league_away_avg`, `matches_used` Number; `updated_at` String. A single `matches_used` count must refer to the same fully validated, deduplicated fixture set used for both means.

### `prediction_log` proposed V1 extension

Options are to keep only the original 12 columns, or add delivery, top-three, provenance, and evaluation fields. **Recommend the expanded contract** in `system-architecture.md`: keep the original fields and add a derived `prediction_key = String(fixture_id) + '|' + model_version`, fixture/team/league context, `top_scores_json`, grid bounds/mass/tail, snapshot timestamps, delivery attempt fields, and nullable actual-result/evaluation fields. This supports deduplication and later evaluation without creating a fourth table for V1.

`fixture_id + model_version` remains the logical identity. Data Table Upsert with both equality conditions and **Must Match: All Conditions** is appropriate but is not an atomic unique constraint. `prediction_key` is a convenient single condition, not a database uniqueness guarantee. Keep API IDs stable and use numeric `team_id` for joins.

**Effect:** Larger rows but reproducible predictions, transparent delivery state, and a place to record actual outcomes. n8n Data Table null/optional-value behavior and allowed field types must be verified in the restored UI before table creation.

**Approval:** **Yes** before creating tables. Confirm the full expanded `prediction_log` schema and logical key.

## G. Probability grid and reporting

**Decision:** Keep the requested 0-5 assignment grid but determine how to report outcome probabilities without hiding its tail.

| Option | Effect |
| --- | --- |
| 0-5 only | Direct assignment comparison, but truncated scoreline mass may be non-trivial. |
| Silently renormalize 0-5 to 100% | Misrepresents truncated mass as the full distribution; not recommended. |
| Adaptive bounds | Retains 0-5 baseline for comparison and grows each marginal range until captured joint mass meets a documented tolerance. |

**Recommended V1:** Calculate the assignment 0-5 grid and an expanded grid. Increase each team's upper goal bound until `grid_mass = CDF_home(Kh) * CDF_away(Ka) >= 0.999999` (residual `1-grid_mass <= 1e-6`). If the computation exceeds a reviewed safety cap, fail the prediction rather than silently truncate. Sum home/draw/away cells on the expanded grid as unconditional masses; their sum equals `grid_mass`, with `residual_prob` reported separately. Do not rescale to 100%.

Rank the top three scorelines by their unconditional joint probability over that grid. Display each as an individual scoreline probability (fraction stored, percentage rendered) and label that each is not the probability of the match outcome. Also display home/draw/away probabilities and residual mass; explain minor rounding differences. Keep the 0-5 mass separately for assignment comparison or recompute offline.

**Effect:** Add `goal_max_home`, `goal_max_away`, `grid_mass`, and `residual_prob` to `prediction_log`. Evaluation uses the same fixed grid policy per `model_version`.

**Approval:** **Yes** for the `1e-6` residual tolerance, any safety cap, and exact message presentation. This is a recommended improvement, not a change to the original 0-5 baseline.

## H. Prediction deduplication and Telegram state

**Decision:** Prevent repeated delivery using fixture/model identity while accounting for Data Table and network limitations.

**Recommended V1:**

1. Construct `prediction_key = String(fixture_id) + '|' + model_version`.
2. Before sending, read the log with exact key equality (or both fixture/model conditions with **All Conditions**). Existing `sent` and `pending` keys do not send again.
3. Upsert the full record as `pending` before calling Telegram.
4. On Telegram confirmation, update to `sent`, set `sent_at` and Telegram `message_id` if available.
5. On an explicit send failure, update to `failed` and store a sanitized error category/message.
6. On timeout/connection loss where Telegram may have accepted the message, keep `pending`, record the attempt/error, and require manual reconciliation. Never automatically resend an ambiguous delivery.
7. Treat `pending` older than 15 minutes as stale for alert/review only; do not automatically clear or resend it. This duration is a proposal, not an approved timeout.
8. Keep both workflows manual and operationally permit only one prediction execution at a time. Do not rely on Data Table Upsert to lock concurrent runs.

Data Table condition-based Upsert does not offer a documented unique constraint or compare-and-set. Sequential precheck + pending reduces duplicates but cannot guarantee exactly-once Telegram delivery under overlapping runs or uncertain network results. Strict exactly-once would require transactional locking/idempotency outside this V1 scope.

**Effect:** Use only `pending`, `sent`, `failed` as stored states; ambiguous outcomes remain pending with safe error metadata. Add `last_attempt_at`, `sent_at`, `attempt_count`, `telegram_message_id`, and `error_message` fields. A manual retry of `failed` requires checking whether delivery could have occurred.

**Approval:** **Yes** for pending-before-send ordering, stale threshold, retry rules, manual serialization, and expanded delivery fields. Pending-before-send deliberately improves on the original send-then-save sequence.

## I. API request budget and scheduling

**Decision:** How to control quota before the account plan is known.

**Recommended V1:** Keep Workflow A and Workflow B on Manual Trigger; no schedule. Count every page, separate verification call, and retry. If `P(l,s)` is the API-reported page count for league-season `l,s`, then:

- `requests_A = sum(P(l,s)) + retries_A + any explicit metadata calls`
- `requests_B = sum(P(l,s,date_window)) + retries_B`
- `requests_period = refresh_runs * requests_A + prediction_runs * requests_B + approved result/evaluation calls`

Use the returned pagination metadata, bounded retries/backoff, and a safety reserve only after the account's quota is known. Do not put an assumed daily allowance in the design.

**Owner dashboard check required:** Plan name, daily/monthly quota, per-minute limit, historical seasons permitted, endpoint access, and any concurrency/rate restrictions. No API key is requested or needed for this check.

**Effect:** API page counts and retries must be recorded in reports; neither workflow schedules itself in V1.

**Approval:** **Yes** before enabling schedules; account plan verification is required before live requests.

## J. Model evaluation

**Decision:** Include evaluation in the current two workflows or defer it.

**Recommended V1:** Keep evaluation as a later phase and do not add a third active workflow now. Preserve sufficient prediction-time provenance so a future `Evaluate Predictions` workflow can retrieve final regulation-time scores after kickoff, join by fixture ID, and calculate metrics without leakage.

The proposed log stores `actual_home_goals`, `actual_away_goals`, `actual_outcome`, `actual_score_probability`, `brier_1x2`, `top3_hit`, and `evaluated_at` as empty until evaluation. `actual_score_probability` is recomputed from the stored lambdas and immutable model version. Since the stored finite-grid 1X2 masses sum to `grid_mass` rather than 1, a standard Brier score must not be calculated directly from them. One candidate is to normalize the three outcome masses by `grid_mass` only inside the metric calculation after the residual target is met, while leaving stored/displayed raw masses and residual unchanged; alternatively approve a tail-correction method. Leave `brier_1x2` blank until this metric policy is approved. Actuals must use the approved score/status policy. Evaluation includes only predictions recorded before kickoff, on a time-ordered holdout or prospective set. Define treatment of void/postponed matches and metric reporting before building that phase.

**Effect:** Evaluation fields are reserved in the proposed `prediction_log` schema but remain blank until a later authorized stage. No evaluation workflow is created.

**Approval:** **Yes** before finalizing evaluation columns/metrics or adding a third workflow.

## Approval checklist before implementation

1. Approve one league-season per manual execution and no schedules in V1.
2. Confirm account plan/history/quota in the private dashboard; verify official API field/status/pagination contract before live requests.
3. Approve `FT`-only regulation-time history selection and the score field.
4. Approve 8 home/away appearances per relevant venue cell, no smoothing, and fail-closed zero denominators.
5. Approve the exact three schemas, especially the expanded prediction log.
6. Approve adaptive grid residual `<= 1e-6`, bounds cap, and probability display policy.
7. Approve pending-before-send, stale-pending handling, retries, and manual single-run discipline.
8. Defer evaluation as a later stage or approve a separate future evaluation workflow.

No tables, workflows, credentials, API requests, model code, or schedules were created by this decision-register update.
