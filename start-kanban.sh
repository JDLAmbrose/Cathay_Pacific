#!/usr/bin/env bash
# Start the Plume Light hold-pressure kanban (Vite) at http://localhost:5173/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$ROOT/kanban-app"
PORT="${PORT:-5173}"
HOST="${HOST:-127.0.0.1}"

cd "$APP_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "error: npm not found. Install Node.js first." >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies…"
  npm install
fi

# Free the port if a previous Vite/dev server is still listening.
pids="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "$pids" ]]; then
  echo "Stopping process(es) on port $PORT: $pids"
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null || true
  sleep 0.5
  still="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$still" ]]; then
    # shellcheck disable=SC2086
    kill -9 $still 2>/dev/null || true
  fi
fi

echo "Starting kanban at http://${HOST}:${PORT}/"
echo "Press Ctrl+C to stop."
exec npm run dev -- --host "$HOST" --port "$PORT"
