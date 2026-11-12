# Football Score Prediction Automation

A local, self-hosted n8n project for estimating pre-match football scoreline probabilities from historical results and sending clearly qualified predictions to Telegram. It is an automation and statistical modelling project, not a football website. Probabilities are estimates, never guarantees.

## How it will work

The system has two connected but independently operated workflows:

1. **Build Team Strengths** retrieves completed historical fixtures, validates and normalises them, calculates league scoring averages and team home/away attack and defence measurements, stores the resulting data, and sends a refresh report.
2. **Predict Upcoming Matches** retrieves upcoming fixtures, validates and normalises them, looks up team strengths by numeric team IDs and league averages, estimates expected goals, calculates and ranks scoreline probabilities, derives home/draw/away probabilities, prevents duplicate delivery, sends Telegram predictions, and records them for later evaluation.

Keeping refresh and prediction separate lets historical data be rebuilt and checked independently from fixture prediction. The prediction workflow reads a saved snapshot rather than recalculating the historical dataset for every fixture batch.

## Proposed data tables

The proposed architecture has three n8n Data Tables:

- `team_strengths`: one row per `league_id|season|team_id`, containing team identity, home/away matches played, goals for/against, and update time.
- `league_strengths`: one row per `league_id|season`, containing league home/away goal averages, matches used, and update time. This dedicated table resolves the need for Workflow B to retrieve competition baselines.
- `prediction_log`: prediction inputs, top scoreline, outcome probabilities, delivery status, model version, and prediction time. Its intended matching key is `fixture_id + model_version`.

The exact fields are documented in [docs/system-architecture.md](docs/system-architecture.md). These tables have not been created.

## Expected goals and Poisson baseline

The planned baseline uses historical home/away scoring averages and team attack/defence factors to estimate expected goals (`lambda_home`, `lambda_away`). For an expected goal rate `lambda`, the Poisson probability of scoring `k` goals is `P(k) = exp(-lambda) * lambda^k / k!`. Under a still-to-be-confirmed independent-scores assumption, a scoreline probability is the home-goal probability multiplied by the away-goal probability. Outcome probabilities are sums over scorelines. The exact factor definitions, score grid, and handling of probability mass outside that grid remain design decisions; no model has been implemented.

## Repository layout

### Existing files

- `.vscode/` - editor settings, extension recommendations, and Docker tasks
- `.github/` - GitHub Copilot project instructions
- `docs/` - project, architecture, environment, testing, and troubleshooting documentation
- `src/code-nodes/` - existing JavaScript source files; currently retained as legacy LiveScore references, not prediction code
- `test-data/mock-live-fixtures.json` - legacy live-fixture-shaped sample, not a historical or prediction fixture
- `workflows/exports/` - location reserved for reviewed n8n exports
- `compose.yaml` - existing local n8n Docker Compose configuration
- `.env.example` - non-secret environment template
- `.env` - local environment file; ignored by Git and not included in this repository report
- `.gitignore` - local secrets and generated-file exclusions

### Proposed structure for later implementation

This is a plan, not a set of created workflows or code directories. Existing files are not moved or deleted.

```text
.
|-- .github/copilot-instructions.md
|-- .vscode/
|-- docs/
|   |-- design-decisions.md
|   |-- legacy-livescore-reference.md
|   |-- model-evaluation.md                 # proposed
|-- src/code-nodes/
|   |-- historical/                         # proposed: validate, normalise, aggregate
|   |-- prediction/                         # proposed: expected goals, Poisson, message
|   |-- shared/                             # proposed: common validation and utilities
|-- test-data/
|   |-- historical-fixtures/                # proposed mocks
|   |-- upcoming-fixtures/                  # proposed mocks
|-- tests/                                  # proposed local logic tests
|-- workflows/exports/                     # reviewed Workflow A and B exports later
|-- compose.yaml                            # existing; left unchanged
|-- .env.example                            # existing; left unchanged
|-- AGENTS.md
|-- README.md
```

The old source files and mock are catalogued in [docs/legacy-livescore-reference.md](docs/legacy-livescore-reference.md) and remain in their current paths for traceability.

## Development and safety

- Use mock API-shaped data before any live API request.
- Inspect actual API responses before relying on their shape.
- Keep maintainable JavaScript source versions under `src/code-nodes`; comment important transformations and calculations.
- Prevent future-match data from entering historical calculation windows.
- Do not invent statistics for teams with insufficient historical data.
- Keep API-Football and Telegram credentials in n8n Credentials, never in source files or committed environment files.
- Build and validate in small stages. Validate exported workflow JSON before importing it.
- Implement and evaluate the Poisson baseline before considering machine learning.

## Current transition status

This change updates project context and documentation only. No n8n workflows, Data Tables, credentials, API calls, prediction code, or scheduled jobs have been created. The existing Docker configuration and n8n storage were not changed. See [docs/environment-setup.md](docs/environment-setup.md) for the infrastructure details and verification caveat.
