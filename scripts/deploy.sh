#!/usr/bin/env bash
# Deploy the web tier to the VPS.
#
#   ./scripts/deploy.sh          # build + restart
#   ./scripts/deploy.sh --pull   # git pull first
#
# Run from /var/www/ata/app on the server.
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

if [ ! -f .env.production ]; then
  echo "error: .env.production is missing. Copy .env.production.example and fill it in." >&2
  exit 1
fi

# A missing key fails at build time in a confusing way, so check up front.
for key in ENVIRONMENT NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
  value=$(grep -E "^${key}=" .env.production | head -1 | cut -d= -f2- || true)
  if [ -z "$value" ]; then
    echo "error: ${key} is empty in .env.production" >&2
    exit 1
  fi
done

# /api/health only applies its strict checks when ENVIRONMENT=production, so a
# wrong value here would quietly downgrade the deploy's own health criteria.
if ! grep -qE '^ENVIRONMENT=production$' .env.production; then
  echo "error: ENVIRONMENT must be exactly 'production' in .env.production" >&2
  exit 1
fi

if grep -qE '^ALLOW_INSECURE_DEV_AUTH=true' .env.production; then
  echo "error: ALLOW_INSECURE_DEV_AUTH=true is an authentication bypass. Remove it." >&2
  exit 1
fi

if [ "${1:-}" = "--pull" ]; then
  echo "==> git pull"
  git pull --ff-only
fi

echo "==> building"
$COMPOSE build

echo "==> starting"
$COMPOSE up -d --remove-orphans

echo "==> waiting for health"
for i in $(seq 1 40); do
  status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
    http://127.0.0.1:3000/api/health || echo 000)
  if [ "$status" = "200" ]; then
    echo "    healthy after ${i}s"
    break
  fi
  if [ "$i" = "40" ]; then
    echo "error: health check never returned 200 (last: $status)" >&2
    echo "--- web logs ---" >&2
    $COMPOSE logs --tail 40 web >&2
    exit 1
  fi
  sleep 1
done

# Old images accumulate on a small disk; keep the last two builds.
docker image prune -f --filter "until=168h" >/dev/null 2>&1 || true

echo
echo "deployed: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown revision')"
$COMPOSE ps
