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

## Recovery verified on 2026-11-12

The runtime was diagnosed and recovered without reinstalling/upgrading Docker or WSL, recreating the n8n container, or changing the Compose configuration or storage.

| Component | Confirmed result |
| --- | --- |
| Windows | Windows 11 build `10.0.22621.4317` |
| WSL | WSL `3.0.5.0`; kernel `6.18.58.1-1`; default WSL version 2 |
| Ubuntu | Registered as WSL version 2; currently stopped. A CLI probe found Docker Desktop integration is not enabled for this distro and emitted a systemd user-session warning. |
| Docker Desktop | `4.99.0`; status `running` after recovery |
| Docker Engine | Docker Engine `29.9.3`; server reports Docker Desktop |
| Docker Compose | V2 CLI plugin `v5.7.0`; `docker compose config --quiet` passes |
| Container | Existing `livescore-n8n`, image `docker.n8n.io/n8nio/n8n:2.46.7`, running; it was created on 2026-11-10 and was not recreated |
| Container port | `127.0.0.1:5678 -> 5678/tcp` |
| Persistent volume | Existing `livescoreautomation_livescore_n8n_data` mounted read/write at `/home/node/.n8n` |
| n8n | Version `2.46.7`; current startup log says ready on port 5678 |
| SQLite/config | `database.sqlite` and n8n config exist on the original volume; the encryption-key field is present (value not read or displayed) |
| Local editor | `http://localhost:5678/` returns HTTP 200 |
| Health | `http://localhost:5678/healthz` returns HTTP 200 with `{"status":"ok"}` |

The Compose logical volume key is `livescore_n8n_data`; Docker Compose prefixes it with the project name `livescoreautomation`, so the actual existing volume is `livescoreautomation_livescore_n8n_data`. The container inspection confirmed that exact volume mount. No new or empty volume was created.

### Cause and recovery sequence

The host WSL installation was not missing or outdated. At diagnosis, Docker Desktop `4.99.0` was stuck in `starting`; its backend repeatedly timed out waiting for the engine's internal IPC `/ping`, while the API proxy returned HTTP 500 and requests to its Linux VM timed out. Both WSL distributions were stopped, and there was no active WSL VM workload. The Docker Desktop service was stopped (`Manual` start type), but Desktop UI/backend processes remained hung.

The following safe recovery sequence was used:

1. Read-only checks: `wsl --status`, `wsl --version`, `wsl -l -v`, `docker desktop status`, `docker info`, Docker context, process/service status, and logs.
2. `docker desktop restart` was attempted and failed because stale Desktop processes remained.
3. `wsl --shutdown` was run only after confirming Ubuntu and `docker-desktop` were both stopped. No distributions were unregistered or updated.
4. `docker desktop stop` also hung. After confirming the WSL VM and engine were not running, only the stuck Docker Desktop UI, backend, and build processes were stopped; no Docker data directories or resources were removed.
5. `docker desktop start` relaunched the existing installation. The existing n8n container automatically returned using the same volume.
6. Docker, Compose, container identity/mount, n8n version, SQLite/config presence, startup logs, root URL, and health endpoint were verified.

The Ubuntu distribution is registered as WSL 2, but the Ubuntu shell reported that Docker Desktop WSL integration is not enabled for that distro (`docker info` inside Ubuntu advised enabling integration in Docker Desktop settings). This is non-blocking for the Windows PowerShell/VS Code workspace, where Docker Engine and Compose are working. Docker Desktop WSL integration settings were not changed. The probe also printed a WSL systemd user-session warning; Ubuntu itself is installed and starts as WSL 2.

The n8n logs include an earlier `Last session crashed` notice, historical SQLite mutex timeouts followed by `Database connection recovered`, and an unrelated Python task-runner warning because Python 3 is absent in the container. The present process is ready, the database/config files are present, health returns 200, and there is no current migration failure in the startup log. Do not treat the Python runner warning as a reason to change Compose or upgrade n8n in this recovery phase.

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
