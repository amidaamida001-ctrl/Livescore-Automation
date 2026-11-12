# AGENTS.md

## Project context

This is the Football Score Prediction Automation project: a self-hosted n8n system for pre-match statistical estimates, not a standalone football website. No prediction workflow or model is implemented yet.

## Technology responsibilities

- n8n orchestrates the two workflows and their API, Data Table, and Telegram steps.
- JavaScript Code nodes handle validation, transformation, aggregation, and statistical calculations.
- API-Football is the planned source of football data.
- n8n Data Tables provide persistent team-strength, league-average, and prediction-history storage.
- Telegram Bot API is the planned notification destination.
- Docker Desktop and Docker Compose manage the existing local n8n environment; VS Code is the development workspace.

## Planned workflows

- **Build Team Strengths** processes completed historical fixtures, calculates league home/away scoring averages and team home/away attack/defence measurements, stores both datasets, and sends a refresh report.
- **Predict Upcoming Matches** processes future fixtures, looks up team strengths by numeric IDs and league averages, calculates expected goals and Poisson scoreline/outcome probabilities, ranks likely scores, deduplicates and sends Telegram predictions, and records them for evaluation.

Keep the workflows separate so historical refreshes can be controlled and reviewed independently from prediction runs.

## Source and data rules

- All important JavaScript scripts must have maintainable source versions under `src/code-nodes`.
- Add comments explaining important data transformations and statistical calculations.
- Inspect API responses and mock fixtures before assuming their structure.
- Test with mock data before spending API requests.
- Use only completed fixtures within the defined historical cutoff; prevent future-match leakage.
- Do not invent statistics for teams with insufficient historical samples. Surface missing or insufficient data explicitly.
- Do not describe probability estimates as guaranteed outcomes.
- Implement and evaluate the Poisson baseline before considering machine learning.

## Security and change control

- Never hardcode API keys, Telegram tokens, or other secrets. Use n8n Credentials.
- Do not commit `.env` or other local secrets.
- Build in small, testable stages and explain important changes in beginner-friendly language.
- Avoid changing existing working files unnecessarily. Preserve the legacy LiveScore references unless a later task explicitly calls for archiving or removal.
- Validate generated n8n workflow JSON before importing it.
- Do not modify Docker configuration, n8n storage, credentials, Data Tables, or existing workflows as part of documentation-only tasks.
