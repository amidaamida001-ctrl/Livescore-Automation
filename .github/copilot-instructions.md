# GitHub Copilot instructions for Football Score Prediction Automation

This repository is an n8n-based pre-match football prediction automation, not a football website. The project is currently in a documentation/design transition; do not assume prediction code, workflows, Data Tables, or credentials exist.

## System responsibilities

- n8n orchestrates two connected workflows: **Build Team Strengths** and **Predict Upcoming Matches**.
- JavaScript Code nodes perform response validation, data transformation, historical aggregation, and the baseline statistical calculations.
- API-Football is the planned source for completed historical results and upcoming fixtures; Telegram is the planned prediction and refresh-report destination.
- n8n Data Tables are the planned persistent memory for team strengths, league averages, and prediction history.
- Docker Desktop and Docker Compose manage the existing self-hosted n8n runtime; VS Code is the workspace.

## Data and modelling rules

- Keep maintainable source versions of important Code node scripts under `src/code-nodes`.
- Comment important transformations and calculations so a beginner can follow the data path and math.
- Inspect API response samples before relying on their fields or shape.
- Use mock fixtures for tests before making live requests or spending API quota.
- Historical calculations must use completed fixtures and an explicit as-of cutoff; never leak future results into historical inputs.
- Do not fabricate team data when a team has too few observations. Mark the data as insufficient and follow a reviewed policy.
- Treat Poisson results as uncertain probability estimates, not guaranteed predictions.
- Do not introduce machine learning until the Poisson baseline is implemented and evaluated.
- Keep assignment requirements distinct from proposed improvements; do not silently decide unresolved model or data policies.

## Safe development

- Never put API keys, Telegram tokens, or other secrets in code, workflow exports, or committed files. Use n8n Credentials.
- Build one small, testable stage at a time and explain important changes in beginner-friendly language.
- Preserve existing files and infrastructure unless the task specifically requires a change.
- Validate generated workflow JSON before importing it into n8n.
- Do not create or activate workflows, Data Tables, credentials, or schedules during documentation-only work.
