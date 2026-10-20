#!/usr/bin/env bash
set -Eeuo pipefail

# Logical Backup Job - ERP-AMBE
# Dumps PostgreSQL database, compresses, encrypts with GPG, uploads, and verifies read-back.

if [[ -f "/usr/local/bin/backup-config.sh" ]]; then
  # shellcheck source=/dev/null
  source "/usr/local/bin/backup-config.sh"
elif [[ -f "/etc/backup-config.sh" ]]; then
  # shellcheck source=/dev/null
  source "/etc/backup-config.sh"
fi

TIMESTAMP="$(date -u +'%Y%m%d_%H%M%SZ')"
ARCHIVE_NAME="erp_facility_${TIMESTAMP}.sql.gz.gpg"

WORK_DIR="$(mktemp -d /tmp/logical_backup_XXXXXX)"
VERIFY_DIR="$(mktemp -d /tmp/logical_verify_XXXXXX)"
trap 'rm -rf "${WORK_DIR}" "${VERIFY_DIR}"' EXIT

echo "INFO: [logical-backup] Starting logical backup ${ARCHIVE_NAME}..."

GPG_PASSPHRASE_FILE="${GPG_PASSPHRASE_FILE:-/run/secrets/backup_gpg_passphrase}"
PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-erp_facility}"
PGUSER="${PGUSER:-erp_admin}"
DR_S3_BUCKET="${DR_S3_BUCKET:-erp-backups}"
S3_ENDPOINT_URL="${S3_ENDPOINT_URL:-http://minio:9000}"

# Verify passphrase file
if [[ ! -f "${GPG_PASSPHRASE_FILE}" ]]; then
  if [[ -n "${GPG_PASSPHRASE:-}" ]]; then
    mkdir -p "$(dirname "${GPG_PASSPHRASE_FILE}")"
    echo -n "${GPG_PASSPHRASE}" > "${GPG_PASSPHRASE_FILE}"
    chmod 0400 "${GPG_PASSPHRASE_FILE}"
  else
    echo "ERROR: [logical-backup] Missing GPG passphrase file at ${GPG_PASSPHRASE_FILE}" >&2
    exit 1
  fi
fi

# Pre-backup operational record (schema version & table row counts)
echo "INFO: [logical-backup] Recording operational table counts..."
psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -t -A -c \
  "SELECT schemaname || '.' || relname || '=' || n_live_tup FROM pg_stat_user_tables ORDER BY relname;" \
  > "${WORK_DIR}/pre_backup_counts.txt" 2>/dev/null || echo "NOTICE: Could not fetch row counts"

# Perform pg_dump -> gzip -> gpg encryption
echo "INFO: [logical-backup] Executing pg_dump, gzip, and GPG symmetric encryption..."
pg_dump -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" \
  --clean --if-exists --no-owner --no-privileges \
  | gzip -c \
  | gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase-file "${GPG_PASSPHRASE_FILE}" \
  -o "${WORK_DIR}/${ARCHIVE_NAME}"

# Generate portable SHA-256 sidecar (basename only)
(cd "${WORK_DIR}" && sha256sum "${ARCHIVE_NAME}") > "${WORK_DIR}/${ARCHIVE_NAME}.sha256"

# Upload to remote S3 destination
echo "INFO: [logical-backup] Uploading archive and SHA-256 sidecar to s3://${DR_S3_BUCKET}/logical/..."
aws --endpoint-url="${S3_ENDPOINT_URL}" s3 cp "${WORK_DIR}/${ARCHIVE_NAME}" "s3://${DR_S3_BUCKET}/logical/${ARCHIVE_NAME}" --only-show-errors
aws --endpoint-url="${S3_ENDPOINT_URL}" s3 cp "${WORK_DIR}/${ARCHIVE_NAME}.sha256" "s3://${DR_S3_BUCKET}/logical/${ARCHIVE_NAME}.sha256" --only-show-errors

# Read-back verification
echo "INFO: [logical-backup] Downloading remote copies for integrity verification..."
aws --endpoint-url="${S3_ENDPOINT_URL}" s3 cp "s3://${DR_S3_BUCKET}/logical/${ARCHIVE_NAME}" "${VERIFY_DIR}/${ARCHIVE_NAME}" --only-show-errors
aws --endpoint-url="${S3_ENDPOINT_URL}" s3 cp "s3://${DR_S3_BUCKET}/logical/${ARCHIVE_NAME}.sha256" "${VERIFY_DIR}/${ARCHIVE_NAME}.sha256" --only-show-errors

echo "INFO: [logical-backup] Verifying SHA-256 checksum..."
(cd "${VERIFY_DIR}" && sha256sum -c "${ARCHIVE_NAME}.sha256")

echo "INFO: [logical-backup] Testing full decrypt and gunzip stream..."
gpg --batch --yes --decrypt --passphrase-file "${GPG_PASSPHRASE_FILE}" "${VERIFY_DIR}/${ARCHIVE_NAME}" | gunzip -t >/dev/null

echo "INFO: [logical-backup] Verification complete. Backup ${ARCHIVE_NAME} is certified."
exit 0
