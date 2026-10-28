#!/usr/bin/env bash
# Start, stop, or check the local stack outside the agent job runner so the
# servers keep running between sessions.
set -uo pipefail
cd "$(dirname "$0")/.."

WEB_LOG=/tmp/ata-web.log
API_LOG=/tmp/ata-api.log
WEB_PID=.local-web.pid
API_PID=.local-api.pid

stop_one() {
  local pidfile=$1
  if [ -f "$pidfile" ]; then
    kill "$(cat "$pidfile")" 2>/dev/null
    rm -f "$pidfile"
  fi
}

detach() {
  # macOS has no setsid(1); os.setsid() gives the child its own session so a
  # SIGTERM to the agent's process group does not reach it.
  python3 -c 'import os, sys; os.setsid(); os.execvp(sys.argv[1], sys.argv[1:])' "$@"
}

start_api() {
  ( cd services/api && \
    ALLOW_INSECURE_DEV_AUTH=true ENVIRONMENT=local \
    DATABASE_URL="postgresql+asyncpg://ata:ata-local-dev@127.0.0.1:5432/ata" \
    AI_PROVIDER=ollama OLLAMA_MODEL=qwen2.5:7b \
    nohup bash -c "$(declare -f detach); detach .venv/bin/python -m uvicorn \
      app.main:app --host 127.0.0.1 --port 8000 --log-level warning" >"$API_LOG" 2>&1 &
    echo $! > "../../$API_PID" )
  echo "api  started (log: $API_LOG)"
}

start_web() {
  nohup bash -c "$(declare -f detach); detach $(command -v npm) run dev" >"$WEB_LOG" 2>&1 &
  echo $! > "$WEB_PID"
  echo "web  started (log: $WEB_LOG)"
}

case "${1:-status}" in
  start)
    start_api
    start_web
    sleep 12
    ;;
  stop)
    stop_one "$WEB_PID"; stop_one "$API_PID"
    pkill -f "uvicorn app.main:app" 2>/dev/null
    pkill -f "next dev" 2>/dev/null
    echo "stopped"
    ;;
  restart)
    "$0" stop; sleep 2; "$0" start
    ;;
esac

printf '  api   : '; curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 http://127.0.0.1:8000/health || echo down
printf '  web   : '; curl -s -o /dev/null -w "%{http_code}\n" --max-time 45 http://localhost:3000/login || echo down
