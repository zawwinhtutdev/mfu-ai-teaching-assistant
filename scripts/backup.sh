#!/usr/bin/env bash
# Nightly data snapshot.
#
#   ./scripts/backup.sh
#
# All application state lives in Supabase Cloud, not on this server — the web
# container is stateless. So there is no pg_dump to run here. Supabase Pro
# provides daily backups with point-in-time recovery; this script is an
# *independent* export so a Supabase-side mistake cannot take the data with it.
#
# Cron (03:15 daily):
#   15 3 * * * /var/www/ata/app/scripts/backup.sh >> /var/www/ata/logs/backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-/var/www/ata/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$BACKUP_DIR/ata-$STAMP.tar.gz"

# shellcheck disable=SC1091
set -a; . ./.env.production; set +a

: "${NEXT_PUBLIC_SUPABASE_URL:?missing NEXT_PUBLIC_SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?missing SUPABASE_SERVICE_ROLE_KEY}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# Tables holding anything a human would miss. Ordered loosely by dependency so
# a reader can reconstruct relationships if they ever restore by hand.
TABLES=(
  profiles courses course_enrollments course_sections course_materials
  course_material_chunks faqs assignments announcements chatbot_settings
  student_queries conversations messages flashcards quizzes material_summaries
  study_plans study_reminders surveys survey_responses consents audit_logs
  system_policies
)

echo "[$(date -u +%FT%TZ)] export starting"

FAILED=0
for table in "${TABLES[@]}"; do
  # Range headers avoid PostgREST's default 1000-row cap.
  if ! curl -fsS --max-time 120 \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Range: 0-99999" \
      "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/$table?select=*" \
      -o "$WORK/$table.json"; then
    echo "  warn: $table failed" >&2
    FAILED=$((FAILED + 1))
    rm -f "$WORK/$table.json"
    continue
  fi
  count=$(grep -o '"id"' "$WORK/$table.json" 2>/dev/null | wc -l | tr -d ' ')
  printf '  %-26s %s rows\n' "$table" "$count"
done

# Config is small and painful to recreate.
cp .env.production "$WORK/env.production"

# Storage objects are not in the REST API; list them so a restore knows what
# files should exist even if the bytes are gone.
for bucket in avatars knowledge; do
  curl -fsS --max-time 60 \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -X POST -H "Content-Type: application/json" \
    -d '{"prefix":"","limit":10000}' \
    "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/list/$bucket" \
    -o "$WORK/storage-$bucket.json" || echo "  warn: bucket $bucket listing failed" >&2
done

tar -czf "$OUT" -C "$WORK" .
chmod 600 "$OUT"

echo "[$(date -u +%FT%TZ)] wrote $OUT ($(du -h "$OUT" | cut -f1))"

find "$BACKUP_DIR" -name 'ata-*.tar.gz' -mtime "+$KEEP_DAYS" -delete 2>/dev/null || true

if [ "$FAILED" -gt 0 ]; then
  echo "warning: $FAILED table(s) failed; snapshot is incomplete" >&2
  exit 1
fi
