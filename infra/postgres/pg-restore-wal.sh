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

# GPG AES256 symmetric decryption setup
GPG_PASSPHRASE_FILE="${GPG_PASSPHRASE_FILE:-/run/secrets/backup_gpg_passphrase}"
if [[ ! -f "${GPG_PASSPHRASE_FILE}" ]]; then
  if [[ -f "/var/lib/postgresql/.gpg_passphrase" ]]; then
    GPG_PASSPHRASE_FILE="/var/lib/postgresql/.gpg_passphrase"
  elif [[ -n "${GPG_PASSPHRASE:-}" ]]; then
    GPG_PASSPHRASE_FILE="/tmp/.gpg_passphrase.$$"
    echo -n "${GPG_PASSPHRASE}" > "${GPG_PASSPHRASE_FILE}"
    chmod 0400 "${GPG_PASSPHRASE_FILE}"
    trap 'rm -f "${GPG_PASSPHRASE_FILE}"' EXIT
  fi
fi

SOURCE_URI_GPG="s3://${DR_S3_BUCKET}/${DR_S3_PREFIX}/${WAL_FILE}.gpg"
SOURCE_URI_PLAIN="s3://${DR_S3_BUCKET}/${DR_S3_PREFIX}/${WAL_FILE}"

# Download encrypted WAL segment or fallback to plain
TEMP_ENCRYPTED="/tmp/${WAL_FILE}.gpg.$$"

if aws --endpoint-url="${S3_ENDPOINT_URL}" s3 cp "${SOURCE_URI_GPG}" "${TEMP_ENCRYPTED}" --only-show-errors 2>/dev/null; then
  if [[ ! -r "${GPG_PASSPHRASE_FILE}" ]]; then
    echo "ERROR: [pg-restore-wal] Encrypted WAL found at ${SOURCE_URI_GPG} but passphrase is not available" >&2
    rm -f "${TEMP_ENCRYPTED}"
    exit 1
  fi
  gpg --batch --yes --decrypt --passphrase-file "${GPG_PASSPHRASE_FILE}" -o "${DEST_PATH}" "${TEMP_ENCRYPTED}"
  DECRYPT_CODE=$?
  rm -f "${TEMP_ENCRYPTED}"
  if [[ ${DECRYPT_CODE} -ne 0 ]]; then
    echo "ERROR: [pg-restore-wal] Failed to decrypt ${WAL_FILE}.gpg (exit code: ${DECRYPT_CODE})" >&2
    exit 1
  fi
  exit 0
elif aws --endpoint-url="${S3_ENDPOINT_URL}" s3 cp "${SOURCE_URI_PLAIN}" "${DEST_PATH}" --only-show-errors 2>/dev/null; then
  # Download plain WAL segment
  exit 0
else
  # Nonzero exit indicates file not found or fetch error
  exit 1
fi

exit 0
