# Troubleshooting

## Docker Desktop or engine unavailable

Check `wsl --status`, `wsl --version`, `wsl -l -v`, `docker desktop status`, `docker context ls`, and `docker info`. A successful `docker compose config --quiet` only confirms that the Compose file parses; it does not prove the engine is running.

For the recovery observed on 2026-11-12, Docker Desktop was stuck in `starting` and its logs showed repeated internal engine IPC `/ping` timeouts and API proxy HTTP 500 errors. WSL itself was installed and current, but Ubuntu and `docker-desktop` were stopped. A graceful `docker desktop restart` did not stop the stale Desktop processes. After confirming no WSL distribution or Linux engine was running, `wsl --shutdown` was used, the stuck Docker Desktop UI/backend/build processes were stopped, and `docker desktop start` relaunched the existing installation. The existing n8n container and exact existing volume returned without recreation.

Use the supported `docker desktop restart` first. Only consider stopping Docker Desktop processes if the graceful command hangs and diagnostics confirm there is no running WSL VM/container workload. Never use process termination as a substitute for checking `wsl -l -v` and `docker ps` when the engine is accessible. Do not uninstall/reinstall, reset Docker Desktop, unregister WSL, prune resources, or delete volumes as a startup fix.

If Docker works in Windows but not inside Ubuntu, test from Ubuntu with `docker info`. Docker Desktop's per-distro WSL integration is separate from the host engine; enable it in Docker Desktop Settings > Resources > WSL Integration only if using Docker CLI from Ubuntu is required. The Windows PowerShell/VS Code workflow can work without that distro integration.

## Port 5678 unavailable

Check whether another process is listening before starting n8n:

```powershell
Get-NetTCPConnection -LocalPort 5678 -ErrorAction SilentlyContinue
```

Do not stop another service without identifying it and obtaining approval.

## n8n does not respond

Check `docker compose ps`, `docker compose logs --tail=200 n8n`, and `Invoke-WebRequest http://localhost:5678/healthz -UseBasicParsing`. Allow startup migrations to finish. If Docker itself is unavailable, address the engine first; do not remove or recreate n8n storage.

## Persistence and safe recovery

The Compose file declares a named volume mounted at `/home/node/.n8n`, where n8n keeps SQLite data, configuration, and its generated encryption key. Inspect the actual container and volume names before maintenance. Never run `docker compose down -v`, remove the named volume, replace the encryption key, or overwrite `.env` as a troubleshooting shortcut. Back up persistent data before any planned migration or recovery operation.

## Prediction data issues

Inspect sample API responses and the mock inputs first. Check league, season, fixture status, numeric team IDs, and whether the historical cutoff was applied. Do not fill missing strengths with invented values; route insufficient samples through an explicit policy. Prediction probabilities are estimates and should be evaluated against actual results before model changes are proposed.
