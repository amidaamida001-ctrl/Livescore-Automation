# Testing Strategy

Develop and validate one small stage at a time. No production prediction logic exists yet.

## Historical data and Workflow A

- Use mock completed fixtures first; verify the API response shape before mapping fields.
- Test valid, incomplete, duplicate, non-completed, and out-of-window fixtures.
- Check that home/away aggregation uses the correct teams and goals and that every aggregate reports its sample count.
- Test league averages against hand-calculated small examples.
- Confirm the as-of cutoff excludes future information and that refreshes do not silently mix seasons.
- Test missing and insufficient team samples without inventing statistics.

## Prediction logic and Workflow B

- Mock upcoming fixtures and stored strengths; test numeric ID matching, missing team rows, and league/season mismatches.
- Test expected goals and Poisson probabilities against independently calculated small reference values.
- Check probability bounds, scoreline ranking, outcome aggregation, and any omitted probability mass from the score grid.
- Test duplicate fixture/model inputs and Telegram success/failure paths without sending real messages.
- Confirm persisted prediction fields are enough to reproduce and later evaluate each prediction.

## Evaluation

After predictions can be joined to completed actual results, evaluate them on held-out historical periods or prospective predictions that were stored before kickoff. Prevent leakage by respecting prediction timestamps. Select and document suitable probability metrics and baselines before judging model quality; the exact metrics and evaluation window remain open decisions.

## Release checks

- Keep realistic mock JSON fixtures separate from live data.
- Exercise malformed, missing, null, and boundary values.
- Validate workflow exports before importing them into n8n.
- Use live API requests and real Telegram delivery only after local checks pass and credentials are configured in n8n.
- Never activate a schedule as a substitute for testing.
