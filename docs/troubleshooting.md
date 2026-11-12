# Troubleshooting

## Docker Desktop or engine unavailable

Check `wsl --status`, `wsl -l -v`, `docker desktop status`, and `docker info`. A successful `docker compose config --quiet` only confirms that the Compose file parses; it does not prove the engine is running. Start the existing Docker Desktop installation from its CLI with `docker desktop start`, then recheck `docker info` and `docker compose ps`.

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
