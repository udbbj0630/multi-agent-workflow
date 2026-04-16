#!/usr/bin/env bash
# SQLite WAL-safe backup script
# Usage: ./scripts/backup-db.sh [backup_dir]
# Recommended cron: 0 */6 * * * /path/to/uli/scripts/backup-db.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DB_PATH="${PROJECT_ROOT}/data/uli.db"
BACKUP_DIR="${1:-${PROJECT_ROOT}/data/backups}"
KEEP_DAYS=7

if [ ! -f "$DB_PATH" ]; then
  echo "[backup] DB not found: $DB_PATH"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/uli_${TIMESTAMP}.db"

# Use SQLite's .backup command for WAL-safe atomic copy
sqlite3 "$DB_PATH" ".backup '${BACKUP_FILE}'"

# Verify backup integrity
INTEGRITY=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" 2>&1)
if [ "$INTEGRITY" != "ok" ]; then
  echo "[backup] INTEGRITY CHECK FAILED: $INTEGRITY"
  rm -f "$BACKUP_FILE"
  exit 1
fi

echo "[backup] OK: ${BACKUP_FILE} ($(du -h "$BACKUP_FILE" | cut -f1))"

# Prune old backups
find "$BACKUP_DIR" -name "uli_*.db" -mtime +${KEEP_DAYS} -delete 2>/dev/null || true
echo "[backup] Pruned backups older than ${KEEP_DAYS} days"
