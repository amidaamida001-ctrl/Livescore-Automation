# Environment setup

This project uses the existing Windows, VS Code, Docker Desktop, Docker Compose, and self-hosted n8n setup. The project transition does not rebuild or reset that environment.

## Previously reported configuration

- Docker Desktop on Windows using the WSL2 backend, with Ubuntu installed
- n8n Community Edition image version `2.46.7`
- Compose service `n8n` and container name `livescore-n8n`
- local editor URL `http://localhost:5678`, bound to `127.0.0.1`
- SQLite default database and a Compose named volume mounted at `/home/node/.n8n`
- `TZ` and `GENERIC_TIMEZONE` set to `Africa/Lagos`
- local Git repository and VS Code workspace configuration

These are the values in the previous environment verification report and project Compose file; they are not a guarantee of current runtime state. On 2026-11-12, a fresh check found the Docker Desktop service stopped, WSL Ubuntu and `docker-desktop` stopped, and the Docker engine pipe unavailable. Compose syntax validation still succeeded, but container, volume, and HTTP health state could not be verified in that check. Start Docker Desktop and verify it before using n8n; do not recreate or remove any resources to troubleshoot this documentation transition.

## Safe runtime checks

From PowerShell in the project directory:

```powershell
wsl --status
wsl -l -v
docker info
docker compose config --quiet
docker compose ps
docker volume ls
Invoke-WebRequest http://localhost:5678/healthz -UseBasicParsing
```

`docker compose config --quiet` checks the Compose file syntax; `docker info`, `docker compose ps`, the volume listing, and the HTTP check require the engine/service to be available. Review volume and container names before any lifecycle operation. Never use `docker compose down -v` or delete a volume to fix a startup issue.

## Project environment files and secrets

`.env.example` documents non-secret local settings. `.env` is local and ignored by Git; do not overwrite it or print its contents. API-Football and Telegram credentials belong in n8n Credentials, not in either environment file or source code. The n8n encryption key and SQLite data live in persistent n8n storage; do not rotate or alter them during ordinary project work.

## VS Code and local development

The existing `.vscode` files provide formatting preferences, extension recommendations, and Docker Compose tasks. Node.js is optional for local JavaScript checks. Keep source versions of important Code node scripts under `src/code-nodes`; validate scripts with mocks before using API quota.

## Routine Docker tasks

From the VS Code task picker, the existing tasks support start, stop, restart, log viewing, status, and Compose validation. The same operations can be run with `docker compose up -d`, `docker compose stop`, `docker compose start`, `docker compose restart`, `docker compose logs -f n8n`, and `docker compose ps`. Do not modify Compose settings or existing persistent data as part of prediction-system documentation work.
