# Legacy LiveScore Reference

The project has changed purpose from live-score monitoring to pre-match score prediction. The files below are retained in place as historical reference; they were inspected and are not assumed to be complete or production-ready. They have not been moved, deleted, or wired into a workflow.

- `src/code-nodes/filter-normalise.js` contains a small fixture-array filter/normaliser for a live API-shaped object.
- `src/code-nodes/compare-scores.js` contains a basic comparison of two home/away score objects.
- `test-data/mock-live-fixtures.json` contains two in-play/full-time-style fixtures and is not a historical-results or upcoming-prediction fixture set.

These examples do not implement historical statistics, expected goals, Poisson probabilities, prediction delivery, or evaluation. Do not treat them as prediction modules or copy them into the new workflows without separately reviewing and testing them.

They remain in their current locations to preserve the existing workspace during this documentation-only transition. A physical archive/move can be considered later if the user requests source-tree cleanup; it is not required to retain the historical reference now.
