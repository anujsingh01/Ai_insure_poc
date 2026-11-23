#!/usr/bin/env bash
# Daily backup of the Postgres volume and .env. Cron (as the user that owns /opt/ai-insure):
#   0 2 * * * /opt/ai-insure/backup.sh >> /opt/ai-insure/backups/backup.log 2>&1
set -euo pipefail

APP_DIR=/opt/ai-insure
BACKUP_DIR=$APP_DIR/backups
KEEP_DAYS=${KEEP_DAYS:-7}
STAMP=$(date +%Y%m%d-%H%M%S)

umask 077
mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"

docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U app_owner -Fc ai_insure > "$BACKUP_DIR/db-$STAMP.dump"
[ -s "$BACKUP_DIR/db-$STAMP.dump" ] || { echo "empty database dump"; rm -f "$BACKUP_DIR/db-$STAMP.dump"; exit 1; }
cp .env "$BACKUP_DIR/env-$STAMP"
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db-*' -o -name 'env-*' \) -mtime +"$KEEP_DAYS" -delete

echo "$(date -Is) backup ok: db-$STAMP.dump ($(du -h "$BACKUP_DIR/db-$STAMP.dump" | cut -f1))"
