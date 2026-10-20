#!/usr/bin/env bash
set -Eeuo pipefail

# Canonical WAL Archive Script - ERP-AMBE
# Receives %p (source path) and %f (filename)

if [[ $# -ne 2 ]]; then
  echo "ERROR: [pg-archive-wal] Usage: $0 <source_path> <wal_filename>" >&2
  exit 1
fi

SOURCE_PATH="$1"
WAL_FILE="$2"

if [[ -f "/etc/backup-config.sh" ]]; then
  # shellcheck source=/dev/null
  source "/etc/backup-config.sh"
fi

if [[ "${ENABLE_WAL_ARCHIVING:-true}" != "true" ]]; then
  # Local test / dev mode with archiving explicitly disabled
  exit 0
fi

S3_ENDPOINT_URL="${S3_ENDPOINT_URL:-http://minio:9000}"
DR_S3_BUCKET="${DR_S3_BUCKET:-erp-backups}"
DR_S3_PREFIX="${DR_S3_PREFIX:-wal}"
CRED_FILE="${AWS_SHARED_CREDENTIALS_FILE:-/var/lib/postgresql/.aws/credentials}"

if [[ ! -r "${CRED_FILE}" && -z "${AWS_ACCESS_KEY_ID:-}" ]]; then
  echo "ERROR: [pg-archive-wal] Credential file ${CRED_FILE} is not readable by $(id -un) and no AWS env vars set" >&2
  exit 1
fi

export AWS_SHARED_CREDENTIALS_FILE="${CRED_FILE}"

TARGET_URI="s3://${DR_S3_BUCKET}/${DR_S3_PREFIX}/${WAL_FILE}"

aws --endpoint-url="${S3_ENDPOINT_URL}" s3 cp "${SOURCE_PATH}" "${TARGET_URI}" --only-show-errors

EXIT_CODE=$?
if [[ ${EXIT_CODE} -ne 0 ]]; then
  echo "ERROR: [pg-archive-wal] Failed to archive ${WAL_FILE} to ${TARGET_URI} (exit code: ${EXIT_CODE})" >&2
  exit ${EXIT_CODE}
fi

exit 0
