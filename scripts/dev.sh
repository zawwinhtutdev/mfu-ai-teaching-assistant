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
    kill "$(cat "$pidfile" 2>/dev/null)" 2>/dev/null
    rm -f "$pidfile"
  fi
}

# `npm start` spawns a next-server child that outlives the npm parent, so a pid
# file alone is not enough to stop the web app. The listening port is the one
# authoritative handle on both servers.
kill_port() {
  local port=$1 pids
  pids=$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null)
  # shellcheck disable=SC2086 # deliberate word splitting: kill each pid
  [ -n "$pids" ] && kill $pids 2>/dev/null
  return 0
}

detach() {
  # macOS has no setsid(1); os.setsid() gives the child its own session so a
  # SIGTERM to the agent's process group does not reach it.
  python3 -c 'import os, sys; os.setsid(); os.execvp(sys.argv[1], sys.argv[1:])' "$@"
}

# Record whoever actually listened once the service reported ready, so the pid
# files never point at a short-lived wrapper shell.
record_pid() {
  local port=$1 pidfile=$2 pid
  pid=$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -1)
  [ -n "$pid" ] && echo "$pid" >"$pidfile"
  return 0
}

start_api() {
  # SUPABASE_URL and SUPABASE_ANON_KEY are required for token verification: the
  # service resolves signing keys from the project's JWKS endpoint. Without them
  # every real bearer token fails with "Token signing key could not be resolved",
  # which made /api/rag/* return 401 for signed-in users even though the rest of
  # the app worked.
  local supabase_url="${NEXT_PUBLIC_SUPABASE_URL:-$(sed -n 's/^NEXT_PUBLIC_SUPABASE_URL=//p' .env.local | head -1)}"
  local supabase_anon_key="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-$(sed -n 's/^NEXT_PUBLIC_SUPABASE_ANON_KEY=//p' .env.local | head -1)}"

  ( cd services/api && \
    ALLOW_INSECURE_DEV_AUTH=true ENVIRONMENT=local \
    DATABASE_URL="postgresql+asyncpg://ata:ata-local-dev@127.0.0.1:5432/ata" \
    AI_PROVIDER=ollama OLLAMA_MODEL=qwen2.5:7b \
    SUPABASE_URL="$supabase_url" SUPABASE_ANON_KEY="$supabase_anon_key" \
    nohup bash -c "$(declare -f detach); detach .venv/bin/python -m uvicorn \
      app.main:app --host 127.0.0.1 --port 8000 --log-level warning" >"$API_LOG" 2>&1 & )
  echo "api  started (log: $API_LOG)"
}

start_web() {
  if [ -f .next/BUILD_ID ]; then
    WEB_CMD="run start"; echo "web  using the production build (.next present)"
  else
    WEB_CMD="run dev"
  fi
  nohup bash -c "$(declare -f detach); detach $(command -v npm) $WEB_CMD" >"$WEB_LOG" 2>&1 &
  echo "web  started (log: $WEB_LOG)"
}

# The whole workspace may live in iCloud Drive, where the first import of every
# module can block for tens of seconds while the file is materialised. Poll
# instead of sleeping a fixed amount so a slow cold start is not reported down.
wait_for() {
  local url=$1 label=$2 tries=${3:-90} i=1
  while [ "$i" -le "$tries" ]; do
    if curl -s -o /dev/null --max-time 5 "$url"; then
      echo "  $label ready after ${i}s"
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  echo "  $label not ready after ${tries}s"
  return 1
}

case "${1:-status}" in
  start)
    start_api
    start_web
    wait_for http://127.0.0.1:8000/health api
    wait_for http://localhost:3000/login web
    record_pid 8000 "$API_PID"
    record_pid 3000 "$WEB_PID"
    ;;
  seed)
    ( cd services/api && \
      PYTHONPATH=. DATABASE_URL="postgresql+asyncpg://ata:ata-local-dev@127.0.0.1:5432/ata" \
      AI_PROVIDER=ollama OLLAMA_MODEL=qwen2.5:7b \
      .venv/bin/python scripts/seed_academic.py && \
      PYTHONPATH=. DATABASE_URL="postgresql+asyncpg://ata:ata-local-dev@127.0.0.1:5432/ata" \
      AI_PROVIDER=ollama OLLAMA_MODEL=qwen2.5:7b \
      .venv/bin/python scripts/seed_documents.py )
    # FAQs (with embeddings) and assignments live in Supabase, which is what the
    # web app reads. Deadline reminders are derived from these assignments.
    node scripts/seed-course-content.mjs
    ;;
  stop)
    stop_one "$WEB_PID"; stop_one "$API_PID"
    kill_port 3000; kill_port 8000
    pkill -f "uvicorn app.main:app" 2>/dev/null
    pkill -f "next dev" 2>/dev/null
    pkill -f "next start" 2>/dev/null
    pkill -f "next-server" 2>/dev/null
    echo "stopped"
    ;;
  restart)
    "$0" stop; sleep 2; "$0" start
    ;;
esac

printf '  api   : '; curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 http://127.0.0.1:8000/health || echo down
printf '  web   : '; curl -s -o /dev/null -w "%{http_code}\n" --max-time 45 http://localhost:3000/login || echo down

if [ "${1:-status}" = "start" ] || [ "${1:-status}" = "restart" ]; then
  cat <<'LINKS'

  Web app        http://localhost:3000/login
  Teacher docs   http://localhost:3000/teacherportal/documents
  Student docs   http://localhost:3000/studentportal/documents
  Documentation  http://localhost:3000/docs
  API reference  http://127.0.0.1:8000/docs

  Seeded accounts — password: demo1234
  admin@mfu.ac.th              admin
  anan.suwan@mfu.ac.th         teacher
  malee.chaiyaporn@mfu.ac.th   teacher
  somchai.prasert@mfu.ac.th    teacher
  6631503078@lamduan.mfu.ac.th student (+5 more)
LINKS
fi
