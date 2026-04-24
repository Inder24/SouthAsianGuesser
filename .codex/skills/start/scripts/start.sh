#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-5177}"
HOST="${HOST:-127.0.0.1}"
URL="http://localhost:${PORT}/?v=game-v7"
RUN_DIR=".codex/run"
LOG_FILE="${RUN_DIR}/server-${PORT}.log"
PID_FILE="${RUN_DIR}/server-${PORT}.pid"

if [[ ! -f "config.local.js" ]]; then
  if [[ -n "${GRABMAPS_API_KEY:-}" ]]; then
    printf 'window.GRABMAPS_API_KEY = "%s";\n' "$GRABMAPS_API_KEY" > config.local.js
    chmod 600 config.local.js
  else
    echo "Missing config.local.js."
    echo "Create it from config.example.js and add a GrabMaps browser key before starting fully."
    echo "You can also run with GRABMAPS_API_KEY set in the environment."
    exit 1
  fi
fi

if ! grep -q 'GRABMAPS_API_KEY = "bm_' config.local.js; then
  echo "config.local.js exists, but it does not look like it contains a GrabMaps bm_ key."
  echo "Update config.local.js before starting fully."
  exit 1
fi

mkdir -p "$RUN_DIR"

if lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "SEA Street Guess server already listening on port ${PORT}."
  echo "$URL"
  exit 0
fi

python3 -m http.server "$PORT" --bind "$HOST" > "$LOG_FILE" 2>&1 &
SERVER_PID="$!"
echo "$SERVER_PID" > "$PID_FILE"

for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:${PORT}/" >/dev/null 2>&1; then
    echo "SEA Street Guess started on port ${PORT}."
    echo "$URL"
    echo "Log: ${LOG_FILE}"
    exit 0
  fi
  sleep 0.2
done

echo "Server did not become ready on port ${PORT}."
echo "Check ${LOG_FILE}."
exit 1
