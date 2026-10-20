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

if [[ -f "/usr/local/bin/backup-config.sh" ]]; then
  # shellcheck source=/dev/null
  source "/usr/local/bin/backup-config.sh"
elif [[ -f "/etc/backup-config.sh" ]]; then
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

if [[ -r "${CRED_FILE}" ]]; then
  export AWS_SHARED_CREDENTIALS_FILE="${CRED_FILE}"
fi

TEMP_PASSPHRASE=""
TEMP_ENCRYPTED=""

cleanup() {
  if [[ -n "${TEMP_PASSPHRASE}" && -f "${TEMP_PASSPHRASE}" ]]; then
    rm -f "${TEMP_PASSPHRASE}"
  fi
  if [[ -n "${TEMP_ENCRYPTED}" && -f "${TEMP_ENCRYPTED}" ]]; then
    rm -f "${TEMP_ENCRYPTED}"
  fi
}
trap cleanup EXIT HUP INT QUIT TERM

# GPG AES256 symmetric encryption setup
GPG_PASSPHRASE_FILE="${GPG_PASSPHRASE_FILE:-/run/secrets/backup_gpg_passphrase}"
if [[ ! -f "${GPG_PASSPHRASE_FILE}" ]]; then
  if [[ -f "/var/lib/postgresql/.gpg_passphrase" ]]; then
    GPG_PASSPHRASE_FILE="/var/lib/postgresql/.gpg_passphrase"
  elif [[ -n "${GPG_PASSPHRASE:-}" ]]; then
    TEMP_PASSPHRASE="/tmp/.gpg_passphrase.$$"
    echo -n "${GPG_PASSPHRASE}" > "${TEMP_PASSPHRASE}"
    chmod 0400 "${TEMP_PASSPHRASE}"
    GPG_PASSPHRASE_FILE="${TEMP_PASSPHRASE}"
  fi
fi

if [[ -n "${GPG_PASSPHRASE_FILE:-}" && -r "${GPG_PASSPHRASE_FILE}" ]]; then
  TEMP_ENCRYPTED="/tmp/${WAL_FILE}.gpg.$$"
  if ! gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase-file "${GPG_PASSPHRASE_FILE}" -o "${TEMP_ENCRYPTED}" "${SOURCE_PATH}"; then
    echo "ERROR: [pg-archive-wal] Failed to encrypt WAL segment ${WAL_FILE}" >&2
    exit 1
  fi
  TARGET_URI="s3://${DR_S3_BUCKET}/${DR_S3_PREFIX}/${WAL_FILE}.gpg"
  if ! aws --endpoint-url="${S3_ENDPOINT_URL}" s3 cp "${TEMP_ENCRYPTED}" "${TARGET_URI}" --only-show-errors; then
    echo "ERROR: [pg-archive-wal] Failed to upload encrypted WAL ${WAL_FILE}.gpg to ${TARGET_URI}" >&2
    exit 1
  fi
elif [[ "${ALLOW_UNENCRYPTED_WAL_DEV_ONLY:-false}" == "true" ]]; then
  echo "WARNING: [pg-archive-wal] Archiving unencrypted WAL segment in dev mode (ALLOW_UNENCRYPTED_WAL_DEV_ONLY=true)" >&2
  TARGET_URI="s3://${DR_S3_BUCKET}/${DR_S3_PREFIX}/${WAL_FILE}"
  if ! aws --endpoint-url="${S3_ENDPOINT_URL}" s3 cp "${SOURCE_PATH}" "${TARGET_URI}" --only-show-errors; then
    echo "ERROR: [pg-archive-wal] Failed to archive unencrypted ${WAL_FILE} to ${TARGET_URI}" >&2
    exit 1
  fi
else
  echo "ERROR: [pg-archive-wal] Encryption passphrase is not available at '${GPG_PASSPHRASE_FILE}'. Refusing unencrypted WAL archive." >&2
  exit 1
fi

exit 0
