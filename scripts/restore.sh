#!/usr/bin/env bash
# ==============================================================================
# Enterprise Facility Management ERP — Automated PostgreSQL Restore Script
# ==============================================================================
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path_to_backup_file.sql.gz|path_to_backup_file.sql>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "❌ Error: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "⚠️  [WARNING] Restoring will overwrite existing schema and data in the target database."
echo "Target DB: ${DATABASE_URL:-${POSTGRES_DB:-erp_facility}}"
echo "Source: ${BACKUP_FILE}"

if [ -n "${DATABASE_URL:-}" ]; then
  if [[ "${BACKUP_FILE}" == *.gz ]]; then
    gzip -dc "${BACKUP_FILE}" | psql "${DATABASE_URL}"
  else
    psql "${DATABASE_URL}" -f "${BACKUP_FILE}"
  fi
else
  export PGHOST="${POSTGRES_HOST:-localhost}"
  export PGPORT="${POSTGRES_PORT:-5432}"
  export PGDATABASE="${POSTGRES_DB:-erp_facility}"
  export PGUSER="${POSTGRES_USER:-erp_admin}"
  export PGPASSWORD="${POSTGRES_PASSWORD:-postgres}"

  if [[ "${BACKUP_FILE}" == *.gz ]]; then
    gzip -dc "${BACKUP_FILE}" | psql
  else
    psql -f "${BACKUP_FILE}"
  fi
fi

echo "✅ Database restore completed successfully from ${BACKUP_FILE}."
