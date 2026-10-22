#!/usr/bin/env bash
# Starts the portal in the background each time the codespace starts.
# Logs: tail -f /tmp/zimcamsec.log
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -n "${CODESPACE_NAME:-}" ]]; then
  export APP_URL="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
fi

if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
  echo "Zimcamsec Hub is already running."
  exit 0
fi

nohup npm run dev >/tmp/zimcamsec.log 2>&1 &
echo "Zimcamsec Hub is starting on port 3000 (logs: /tmp/zimcamsec.log)."
