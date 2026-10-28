#!/usr/bin/env bash
# Start everything needed for a local demo and print the links.
#
#   ./scripts/dev-up.sh          # start what is not already running
#   ./scripts/dev-down.sh        # stop the web app and the API
#
# Logs: .local-run/api.log and .local-run/web.log
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
mkdir -p .local-run

DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://ata:ata-local-dev@127.0.0.1:5432/ata}"
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"

is_up() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1; }

start_api() {
  if is_up "$API_PORT"; then
    echo "  API      already running on :$API_PORT"
    return
  fi
  echo "  API      starting on :$API_PORT"
  (
    cd services/api
    env ALLOW_INSECURE_DEV_AUTH=true ENVIRONMENT=local \
      DATABASE_URL="$DATABASE_URL" \
      AI_PROVIDER="${AI_PROVIDER:-ollama}" \
      OLLAMA_MODEL="${OLLAMA_MODEL:-qwen2.5:7b}" \
      .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port "$API_PORT" \
      --log-level warning
  ) > .local-run/api.log 2>&1 &
  echo $! > .local-run/api.pid
}

start_web() {
  if is_up "$WEB_PORT"; then
    echo "  Web      already running on :$WEB_PORT"
    return
  fi
  # Production build when present, dev server otherwise.
  if [ -d .next ]; then
    echo "  Web      starting (production build) on :$WEB_PORT"
    npm run start > .local-run/web.log 2>&1 &
  else
    echo "  Web      starting (dev) on :$WEB_PORT"
    npm run dev > .local-run/web.log 2>&1 &
  fi
  echo $! > .local-run/web.pid
}

start_api
start_web

printf '  waiting'
for _ in $(seq 1 30); do
  api_ok=0; web_ok=0
  curl -sf -o /dev/null "http://127.0.0.1:$API_PORT/health" && api_ok=1
  curl -sf -o /dev/null "http://localhost:$WEB_PORT/" && web_ok=1
  [ "$api_ok" = 1 ] && [ "$web_ok" = 1 ] && break
  printf '.'
  sleep 2
done
echo

echo
echo "  Web app        http://localhost:$WEB_PORT/login"
echo "  Teacher docs   http://localhost:$WEB_PORT/teacherportal/documents"
echo "  Student docs   http://localhost:$WEB_PORT/studentportal/documents"
echo "  Documentation  http://localhost:$WEB_PORT/docs"
echo "  API reference  http://127.0.0.1:$API_PORT/docs"
echo
echo "  Accounts: anan.suwan@mfu.ac.th / teacher1234"
echo "            kanya.wong@mfu.ac.th / student1234"
echo "            admin@mfu.ac.th      / admin1234"
echo
echo "  Logs: .local-run/api.log .local-run/web.log"
