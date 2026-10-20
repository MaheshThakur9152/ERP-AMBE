#!/usr/bin/env bash
# ==============================================================================
# Enterprise Facility Management ERP — Automated PostgreSQL Backup Script
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/erp_facility_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "📦 [$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting ERP PostgreSQL backup..."

# Extract parameters from DATABASE_URL if present, else use individual env vars
if [ -n "${DATABASE_URL:-}" ]; then
  pg_dump "${DATABASE_URL}" --clean --if-exists --no-owner --no-privileges | gzip > "${BACKUP_FILE}"
else
  export PGHOST="${POSTGRES_HOST:-localhost}"
  export PGPORT="${POSTGRES_PORT:-5432}"
  export PGDATABASE="${POSTGRES_DB:-erp_facility}"
  export PGUSER="${POSTGRES_USER:-erp_admin}"
  export PGPASSWORD="${POSTGRES_PASSWORD:-postgres}"

  pg_dump --clean --if-exists --no-owner --no-privileges | gzip > "${BACKUP_FILE}"
fi

FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "✅ Backup successfully created: ${BACKUP_FILE} (${FILE_SIZE})"

# Prune archives older than RETENTION_DAYS
echo "🧹 Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "erp_facility_backup_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -print -delete || true

echo "🏁 Backup cycle finished."
