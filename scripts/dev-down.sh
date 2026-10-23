#!/usr/bin/env bash
# Stop the local web app and API started by scripts/dev-up.sh
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

for name in web api; do
  pidfile=".local-run/$name.pid"
  if [ -f "$pidfile" ]; then
    pid="$(cat "$pidfile")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && echo "  stopped $name (pid $pid)"
    fi
    rm -f "$pidfile"
  fi
done

for port in "${WEB_PORT:-3000}" "${API_PORT:-8000}"; do
  pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null && echo "  freed port $port"
  fi
done
