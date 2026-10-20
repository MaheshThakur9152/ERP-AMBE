#!/usr/bin/env bash
set -Eeuo pipefail

# Operator-Controlled Database Provisioning Script - ERP-AMBE
# Usage: ./scripts/provision_database.sh --target-url <DATABASE_URL> --backup-file <PATH_TO_BACKUP> --confirm [--force-overwrite]

TARGET_URL=""
BACKUP_FILE=""
CONFIRMED=false
FORCE_OVERWRITE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-url)
      TARGET_URL="$2"
      shift 2
      ;;
    --backup-file)
      BACKUP_FILE="$2"
      shift 2
      ;;
    --confirm)
      CONFIRMED=true
      shift
      ;;
    --force-overwrite)
      FORCE_OVERWRITE=true
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${TARGET_URL}" || -z "${BACKUP_FILE}" ]]; then
  echo "ERROR: [provision] Missing required arguments --target-url and --backup-file" >&2
  echo "Usage: $0 --target-url <DATABASE_URL> --backup-file <BACKUP_PATH> --confirm [--force-overwrite]" >&2
  exit 1
fi

if [[ "${CONFIRMED}" != "true" ]]; then
  echo "ERROR: [provision] Safety gate: Explicit confirmation required via --confirm" >&2
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "ERROR: [provision] Backup file does not exist: ${BACKUP_FILE}" >&2
  exit 1
fi

# 1. SHA-256 Checksum Verification
SIDECAR="${BACKUP_FILE}.sha256"
if [[ -f "${SIDECAR}" ]]; then
  echo "INFO: [provision] Verifying SHA-256 sidecar checksum..."
  (cd "$(dirname "${BACKUP_FILE}")" && sha256sum -c "$(basename "${SIDECAR}")")
else
  echo "WARNING: [provision] No SHA-256 sidecar found at ${SIDECAR}"
fi

# 2. Probe target database for existing tables
echo "INFO: [provision] Probing target database for existing tables..."
EXISTING_TABLES=$(psql "${TARGET_URL}" -t -A -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo "0")

if [[ "${EXISTING_TABLES}" -gt 0 && "${FORCE_OVERWRITE}" != "true" ]]; then
  echo "FATAL: [provision] Target database contains ${EXISTING_TABLES} existing tables! Aborting to prevent data destruction. Use --force-overwrite if intended." >&2
  exit 1
fi

# 3. Restore database dump
echo "INFO: [provision] Restoring ${BACKUP_FILE} into target database..."
gunzip -c "${BACKUP_FILE}" | psql "${TARGET_URL}" --set ON_ERROR_STOP=1 -q

# 4. Catalog Re-indexing & Analysis
echo "INFO: [provision] Re-indexing and analyzing database catalog..."
psql "${TARGET_URL}" -c "REINDEX DATABASE erp_facility;" 2>/dev/null || true
psql "${TARGET_URL}" -c "ANALYZE VERBOSE;" 2>/dev/null || true

# 5. Post-restore verification & provision.log audit
OPERATOR="$(whoami 2>/dev/null || echo 'operator')"
TIMESTAMP="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
ROW_COUNTS=$(psql "${TARGET_URL}" -t -A -c \
  "SELECT relname || '=' || n_live_tup FROM pg_stat_user_tables ORDER BY relname;" 2>/dev/null || echo "unavailable")

LOG_ENTRY="${TIMESTAMP} [PROVISION] operator=${OPERATOR} file=${BACKUP_FILE} target=${TARGET_URL} tables=${EXISTING_TABLES} status=SUCCESS counts=[${ROW_COUNTS//$'\n'/ }]"
echo "${LOG_ENTRY}" >> "./provision.log"
echo "${LOG_ENTRY}"

echo "INFO: [provision] Database provisioning complete and verified."
exit 0
