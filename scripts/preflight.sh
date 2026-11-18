#!/usr/bin/env bash
# Validate .env.production against the real services before deploying.
#
#   ./scripts/preflight.sh
#
# `deploy.sh` checks that values are present, which catches typos in variable
# names but not a wrong key: a Supabase anon key pasted into the service-role
# slot, a Gemini key from the wrong Google project, or a project ref that no
# longer exists all look fine until the app is live and every request fails.
#
# This script talks to each service and reports per-check results. It exits
# non-zero if any *required* check fails, so it can gate a deploy.
#
# A missing Gemini key is reported as a warning rather than a failure, because
# the web tier can run on a local model instead. Pass --require-ai to treat it
# as required.
set -uo pipefail

cd "$(dirname "$0")/.." || {
  echo "error: cannot change to the repository root" >&2
  exit 1
}

ENV_FILE=".env.production"
REQUIRE_AI=false
[ "${1:-}" = "--require-ai" ] && REQUIRE_AI=true

failures=0
warnings=0

if [ ! -f "$ENV_FILE" ]; then
  echo "error: $ENV_FILE not found. Copy $ENV_FILE.example and fill it in." >&2
  exit 1
fi

# Read a value from the env file without exporting unrelated lines. Values may
# contain '=' (base64 keys often end in '='), so cut only on the first one.
get() {
  grep -E "^${1}=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true
}

pass() { printf '  \033[32mok\033[0m   %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; failures=$((failures + 1)); }
warn() { printf '  \033[33mwarn\033[0m %s\n' "$1"; warnings=$((warnings + 1)); }

echo "preflight: $ENV_FILE"
echo

# ── Format checks ──────────────────────────────────────────────────────────
echo "configuration"

if [ "$(get ENVIRONMENT)" = "production" ]; then
  pass "ENVIRONMENT=production"
else
  fail "ENVIRONMENT must be exactly 'production' (got '$(get ENVIRONMENT)')"
fi

if [ "$(get ALLOW_INSECURE_DEV_AUTH)" = "true" ]; then
  fail "ALLOW_INSECURE_DEV_AUTH=true is an authentication bypass — remove it"
else
  pass "ALLOW_INSECURE_DEV_AUTH is not enabled"
fi

SUPABASE_URL=$(get NEXT_PUBLIC_SUPABASE_URL)
case "$SUPABASE_URL" in
  https://*.supabase.co) pass "NEXT_PUBLIC_SUPABASE_URL looks like a hosted project" ;;
  http://localhost*|http://127.0.0.1*)
    fail "NEXT_PUBLIC_SUPABASE_URL is loopback ($SUPABASE_URL) — a deployed container cannot reach it" ;;
  "") fail "NEXT_PUBLIC_SUPABASE_URL is empty" ;;
  *) warn "NEXT_PUBLIC_SUPABASE_URL is not *.supabase.co ($SUPABASE_URL) — fine for self-hosted, verify it is reachable" ;;
esac

SITE_ADDRESS=$(get SITE_ADDRESS)
case "$SITE_ADDRESS" in
  "") fail "SITE_ADDRESS is empty — Caddy needs a hostname to obtain a certificate" ;;
  :*) warn "SITE_ADDRESS=$SITE_ADDRESS serves plain HTTP (no TLS) — acceptable only while testing" ;;
  *) pass "SITE_ADDRESS=$SITE_ADDRESS" ;;
esac

CRON_SECRET=$(get CRON_SECRET)
if [ ${#CRON_SECRET} -lt 32 ]; then
  warn "CRON_SECRET is shorter than 32 chars — generate one with: openssl rand -hex 32"
else
  pass "CRON_SECRET looks sufficiently long"
fi

echo
echo "supabase"

ANON_KEY=$(get NEXT_PUBLIC_SUPABASE_ANON_KEY)
SERVICE_KEY=$(get SUPABASE_SERVICE_ROLE_KEY)

if [ -n "$SUPABASE_URL" ] && [ -n "$ANON_KEY" ]; then
  # /auth/v1/health is unauthenticated and confirms DNS, TLS, and that the
  # project is not paused. `curl -w` already writes 000 on connection failure,
  # so no `|| echo` fallback: that would append a second 000 ("000000") and the
  # case patterns below would silently miss it.
  auth_status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
    -H "apikey: $ANON_KEY" "${SUPABASE_URL%/}/auth/v1/health")
  case "$auth_status" in
    200) pass "project reachable and auth service healthy" ;;
    401|403) fail "anon key rejected by $SUPABASE_URL (HTTP $auth_status) — wrong key or wrong project" ;;
    000) fail "cannot reach $SUPABASE_URL — check the ref, DNS, and that the project is not paused" ;;
    *) fail "auth health returned HTTP $auth_status" ;;
  esac
else
  fail "NEXT_PUBLIC_SUPABASE_ANON_KEY is empty"
fi

# The service-role key bypasses RLS. Verify it can actually read a table, since
# a project's anon and service keys are easy to swap.
if [ -n "$SUPABASE_URL" ] && [ -n "$SERVICE_KEY" ]; then
  if [ "$SERVICE_KEY" = "$ANON_KEY" ]; then
    fail "SUPABASE_SERVICE_ROLE_KEY is identical to the anon key — server-side writes will be blocked by RLS"
  else
    read_status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
      -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
      "${SUPABASE_URL%/}/rest/v1/profiles?select=id&limit=1")
    case "$read_status" in
      200) pass "service-role key can read public tables" ;;
      401|403) fail "service-role key rejected (HTTP $read_status) — this is not the service_role key" ;;
      404) fail "public.profiles not found — has the schema been applied? Run 'supabase db push'." ;;
      000) fail "cannot reach ${SUPABASE_URL%/}/rest/v1/ when reading profiles" ;;
      *) fail "service-role read returned HTTP $read_status" ;;
    esac
  fi
else
  fail "SUPABASE_SERVICE_ROLE_KEY is empty"
fi

echo
echo "ai"

AI_KEY=$(get GOOGLE_GENERATIVE_AI_API_KEY)
[ -n "$AI_KEY" ] || AI_KEY=$(get GOOGLE_API_KEY)
PROVIDER=$(get AI_PROVIDER)

if [ "$PROVIDER" = "ollama" ]; then
  warn "AI_PROVIDER=ollama — a 2 GB VPS cannot host a useful local model; see docs/DEPLOY.md"
fi

if [ -z "$AI_KEY" ]; then
  if [ "$REQUIRE_AI" = true ]; then
    fail "no Gemini API key set (required with --require-ai)"
  else
    warn "no Gemini API key set — AI routes will fail unless AI_PROVIDER=ollama"
  fi
else
  # Model listing is a cheap authenticated call that validates the key and the
  # API being enabled on the project.
  ai_status=$(curl -s -o /tmp/preflight-ai.json -w '%{http_code}' --max-time 15 \
    "https://generativelanguage.googleapis.com/v1beta/models?key=${AI_KEY}")
  case "$ai_status" in
    200) pass "Gemini API key accepted" ;;
    400|403) fail "Gemini rejected the key (HTTP $ai_status) — check it is a Generative Language API key and the API is enabled" ;;
    000) warn "could not reach generativelanguage.googleapis.com (offline?) — key not verified" ;;
    *) fail "Gemini models endpoint returned HTTP $ai_status" ;;
  esac

  # A key can be valid for a project where the configured model is unavailable.
  # The API returns entries like {"name": "models/gemini-2.5-flash"}, so match
  # the full name with its trailing quote — a bare substring test would also
  # match a longer id such as "gemini-2.5-flash-lite".
  MODEL=$(get GEMINI_MODEL)
  MODEL=${MODEL:-gemini-2.5-flash}
  if [ "$ai_status" = "200" ] && [ -s /tmp/preflight-ai.json ]; then
    if grep -q "models/${MODEL}\"" /tmp/preflight-ai.json; then
      # Listing is not proof: free-tier keys list models that then answer 503
      # or 429. Actually generate to distinguish "available" from "works".
      gen_status=$(curl -s -o /tmp/preflight-gen.json -w '%{http_code}' --max-time 25 \
        -X POST "https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${AI_KEY}" \
        -H "Content-Type: application/json" \
        -d '{"contents":[{"role":"user","parts":[{"text":"Say OK"}]}],"generationConfig":{"maxOutputTokens":300,"thinkingConfig":{"thinkingBudget":0}}}')
      case "$gen_status" in
        200) pass "model '$MODEL' generated a response" ;;
        503) fail "model '$MODEL' is listed but returns 503 UNAVAILABLE — set GEMINI_MODEL to a working model" ;;
        429) warn "model '$MODEL' is quota-exhausted (429) — chat will fall back to another model" ;;
        *) fail "model '$MODEL' generation returned HTTP $gen_status" ;;
      esac
      rm -f /tmp/preflight-gen.json
    else
      warn "model '$MODEL' was not in this key's model list — set GEMINI_MODEL to one that is"
    fi
  fi
  rm -f /tmp/preflight-ai.json
fi

echo
if [ "$failures" -gt 0 ]; then
  echo "preflight: $failures failed, $warnings warning(s). Fix the failures above before deploying."
  exit 1
fi

if [ "$warnings" -gt 0 ]; then
  echo "preflight: passed with $warnings warning(s). Review them before deploying."
else
  echo "preflight: all checks passed."
fi
