# JavaScript Code Node Documentation

Important n8n Code node scripts must have maintainable source versions under `src/code-nodes`. Keep each responsibility small, inspect input shape, handle invalid or insufficient data explicitly, and comment non-obvious transformations and calculations.

## Planned prediction modules

These are responsibilities for a later implementation phase, not existing scripts:

- historical response validation and normalisation
- completed-fixture filtering with an explicit historical cutoff
- league home/away average and team venue-statistic aggregation
- reviewed home/away attack and defence factor calculation
- upcoming-fixture validation and normalisation
- team-strength lookup by numeric team IDs and league/season key
- expected-goal calculations
- Poisson goal and scoreline probability calculations
- ranking, outcome-probability aggregation, and Telegram message formatting
- duplicate-key and delivery-status handling
- actual-result matching and prediction evaluation

Do not silently impute missing team strength or treat a display name as a key. Keep model parameters and sample-adequacy rules explicit and reviewed.

## Legacy files

`src/code-nodes/filter-normalise.js` and `src/code-nodes/compare-scores.js` are retained legacy LiveScore examples. They perform only basic fixture shaping and score comparison; they are not prediction modules and are not validated as production code. See [legacy-livescore-reference.md](legacy-livescore-reference.md).

## Local checks

Use representative JSON fixtures, including malformed and incomplete cases. Check transformations and numeric edge cases locally before integrating Code nodes into n8n or making live API calls. Do not copy a script into a workflow until its inputs, outputs, and assumptions are documented and tested.
