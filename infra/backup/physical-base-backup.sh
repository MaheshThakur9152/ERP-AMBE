#!/usr/bin/env bash
set -Eeuo pipefail

# Physical Base Backup Job - ERP-AMBE
# Takes raw pg_basebackup with streamed WAL, packages, encrypts, uploads, and verifies read-back.

if [[ -f "/usr/local/bin/backup-config.sh" ]]; then
  # shellcheck source=/dev/null
  source "/usr/local/bin/backup-config.sh"
elif [[ -f "/etc/backup-config.sh" ]]; then
  # shellcheck source=/dev/null
  source "/etc/backup-config.sh"
fi

TIMESTAMP="$(date -u +'%Y%m%d_%H%M%SZ')"
ARCHIVE_NAME="erp_base_${TIMESTAMP}.tar.gz.gpg"

WORK_DIR="$(mktemp -d /tmp/physical_base_XXXXXX)"
VERIFY_DIR="$(mktemp -d /tmp/physical_verify_XXXXXX)"
trap 'rm -rf "${WORK_DIR}" "${VERIFY_DIR}"' EXIT

RAW_DIR="${WORK_DIR}/raw"
mkdir -p "${RAW_DIR}"

echo "INFO: [physical-base-backup] Starting base backup ${ARCHIVE_NAME}..."

GPG_PASSPHRASE_FILE="${GPG_PASSPHRASE_FILE:-/run/secrets/backup_gpg_passphrase}"
PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-erp_facility}"
PGUSER="${PGUSER:-erp_admin}"
REPLICATION_USER="${REPLICATION_USER:-erp_replication}"
DR_S3_BUCKET="${DR_S3_BUCKET:-erp-backups}"
S3_ENDPOINT_URL="${S3_ENDPOINT_URL:-http://minio:9000}"

# Verify passphrase file
if [[ ! -f "${GPG_PASSPHRASE_FILE}" ]]; then
  if [[ -n "${GPG_PASSPHRASE:-}" ]]; then
    mkdir -p "$(dirname "${GPG_PASSPHRASE_FILE}")"
    echo -n "${GPG_PASSPHRASE}" > "${GPG_PASSPHRASE_FILE}"
    chmod 0400 "${GPG_PASSPHRASE_FILE}"
  else
    echo "ERROR: [physical-base-backup] Missing GPG passphrase file at ${GPG_PASSPHRASE_FILE}" >&2
    exit 1
  fi
fi

# Preflight: Check for user-defined tablespaces
echo "INFO: [physical-base-backup] Checking for user-defined tablespaces..."
TABLESPACES_COUNT=$(psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -t -A -c \
  "SELECT count(*) FROM pg_tablespace WHERE spcname NOT IN ('pg_default', 'pg_global');" 2>/dev/null || echo "0")

if [[ "${TABLESPACES_COUNT}" -gt 0 ]]; then
  echo "FATAL: [physical-base-backup] User-defined tablespaces detected (${TABLESPACES_COUNT}). Aborting." >&2
  exit 1
fi

# Execute pg_basebackup in plain format with streamed WAL
echo "INFO: [physical-base-backup] Executing pg_basebackup -Fp -X stream..."
pg_basebackup -h "${PGHOST}" -p "${PGPORT}" -U "${REPLICATION_USER}" \
  -D "${RAW_DIR}" -Fp -X stream --checkpoint=fast

# Validate that backup_label and backup_manifest were created
if [[ ! -f "${RAW_DIR}/backup_label" || ! -f "${RAW_DIR}/backup_manifest" ]]; then
  echo "FATAL: [physical-base-backup] Missing backup_label or backup_manifest in base backup output" >&2
  exit 1
fi

# Package and encrypt with GPG
echo "INFO: [physical-base-backup] Packaging and encrypting to ${ARCHIVE_NAME}..."
tar -czf - -C "${RAW_DIR}" . \
  | gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase-file "${GPG_PASSPHRASE_FILE}" \
  -o "${WORK_DIR}/${ARCHIVE_NAME}"

# Portable SHA-256 sidecar
(cd "${WORK_DIR}" && sha256sum "${ARCHIVE_NAME}") > "${WORK_DIR}/${ARCHIVE_NAME}.sha256"

# Upload to S3
echo "INFO: [physical-base-backup] Uploading to s3://${DR_S3_BUCKET}/base_backups/..."
aws --endpoint-url="${S3_ENDPOINT_URL}" s3 cp "${WORK_DIR}/${ARCHIVE_NAME}" "s3://${DR_S3_BUCKET}/base_backups/${ARCHIVE_NAME}" --only-show-errors
aws --endpoint-url="${S3_ENDPOINT_URL}" s3 cp "${WORK_DIR}/${ARCHIVE_NAME}.sha256" "s3://${DR_S3_BUCKET}/base_backups/${ARCHIVE_NAME}.sha256" --only-show-errors

# Read-back verification
echo "INFO: [physical-base-backup] Downloading remote copies for integrity verification..."
aws --endpoint-url="${S3_ENDPOINT_URL}" s3 cp "s3://${DR_S3_BUCKET}/base_backups/${ARCHIVE_NAME}" "${VERIFY_DIR}/${ARCHIVE_NAME}" --only-show-errors
aws --endpoint-url="${S3_ENDPOINT_URL}" s3 cp "s3://${DR_S3_BUCKET}/base_backups/${ARCHIVE_NAME}.sha256" "${VERIFY_DIR}/${ARCHIVE_NAME}.sha256" --only-show-errors

echo "INFO: [physical-base-backup] Verifying SHA-256 checksum..."
(cd "${VERIFY_DIR}" && sha256sum -c "${ARCHIVE_NAME}.sha256")

echo "INFO: [physical-base-backup] Testing full decrypt and tar stream..."
gpg --batch --yes --decrypt --passphrase-file "${GPG_PASSPHRASE_FILE}" "${VERIFY_DIR}/${ARCHIVE_NAME}" | tar -tzf - >/dev/null

echo "INFO: [physical-base-backup] Base backup ${ARCHIVE_NAME} successfully verified and certified."
exit 0
