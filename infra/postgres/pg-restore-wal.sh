#!/usr/bin/env bash
set -Eeuo pipefail

# Canonical WAL Restore Script - ERP-AMBE
# Receives %f (filename) and %p (destination path)

if [[ $# -ne 2 ]]; then
  echo "ERROR: [pg-restore-wal] Usage: $0 <wal_filename> <destination_path>" >&2
  exit 1
fi

WAL_FILE="$1"
DEST_PATH="$2"

if [[ -f "/usr/local/bin/backup-config.sh" ]]; then
  # shellcheck source=/dev/null
  source "/usr/local/bin/backup-config.sh"
elif [[ -f "/etc/backup-config.sh" ]]; then
  # shellcheck source=/dev/null
  source "/etc/backup-config.sh"
fi

S3_ENDPOINT_URL="${S3_ENDPOINT_URL:-http://minio:9000}"
DR_S3_BUCKET="${DR_S3_BUCKET:-erp-backups}"
DR_S3_PREFIX="${DR_S3_PREFIX:-wal}"
CRED_FILE="${AWS_SHARED_CREDENTIALS_FILE:-/var/lib/postgresql/.aws/credentials}"

if [[ -r "${CRED_FILE}" ]]; then
  export AWS_SHARED_CREDENTIALS_FILE="${CRED_FILE}"
fi

SOURCE_URI="s3://${DR_S3_BUCKET}/${DR_S3_PREFIX}/${WAL_FILE}"

# Download WAL segment or history file from remote storage
# Must return non-zero if file does not exist so PostgreSQL detects end of WAL
if ! aws --endpoint-url="${S3_ENDPOINT_URL}" s3 cp "${SOURCE_URI}" "${DEST_PATH}" --only-show-errors 2>/dev/null; then
  # Nonzero exit indicates file not found or fetch error
  exit 1
fi

exit 0
