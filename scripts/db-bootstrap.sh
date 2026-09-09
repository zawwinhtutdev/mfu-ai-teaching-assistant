#!/usr/bin/env bash
set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is required. Install: https://supabase.com/docs/guides/cli"
  exit 1
fi

MODE="${1:-local}"

if [[ "$MODE" == "linked" ]]; then
  echo "Resetting linked Supabase database with all migrations..."
  supabase db reset --linked
else
  echo "Resetting local Supabase database with all migrations..."
  supabase db reset
fi

echo "Database bootstrap complete."

