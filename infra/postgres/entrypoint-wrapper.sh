#!/usr/bin/env bash
set -Eeuo pipefail

# Canonical PostgreSQL 16 Entrypoint Wrapper - ERP-AMBE
PG_UID="$(id -u postgres 2>/dev/null || echo 70)"
PG_GID="$(id -g postgres 2>/dev/null || echo 70)"

AWS_DIR="/var/lib/postgresql/.aws"
AWS_CRED_TARGET="${AWS_DIR}/credentials"
SECRET_SOURCE="${AWS_CREDENTIALS_SECRET_PATH:-/run/secrets/aws_dr_credentials}"

mkdir -p "${AWS_DIR}"
chown "${PG_UID}:${PG_GID}" "${AWS_DIR}"
chmod 700 "${AWS_DIR}"

if [[ -f "${SECRET_SOURCE}" ]]; then
  cp "${SECRET_SOURCE}" "${AWS_CRED_TARGET}"
  chown "${PG_UID}:${PG_GID}" "${AWS_CRED_TARGET}"
  chmod 400 "${AWS_CRED_TARGET}"
  export AWS_SHARED_CREDENTIALS_FILE="${AWS_CRED_TARGET}"
elif [[ -f "${AWS_CRED_TARGET}" ]]; then
  chown "${PG_UID}:${PG_GID}" "${AWS_CRED_TARGET}"
  chmod 400 "${AWS_CRED_TARGET}"
  export AWS_SHARED_CREDENTIALS_FILE="${AWS_CRED_TARGET}"
elif [[ -n "${AWS_ACCESS_KEY_ID:-}" && -n "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
  cat << EOF > "${AWS_CRED_TARGET}"
[default]
aws_access_key_id = ${AWS_ACCESS_KEY_ID}
aws_secret_access_key = ${AWS_SECRET_ACCESS_KEY}
EOF
  chown "${PG_UID}:${PG_GID}" "${AWS_CRED_TARGET}"
  chmod 400 "${AWS_CRED_TARGET}"
  export AWS_SHARED_CREDENTIALS_FILE="${AWS_CRED_TARGET}"
else
  if [[ "${ENVIRONMENT:-}" == "production" || "${ENABLE_WAL_ARCHIVING:-false}" == "true" ]]; then
    echo "FATAL: [entrypoint-wrapper] Missing required AWS DR credentials secret at ${SECRET_SOURCE}" >&2
    exit 1
  else
    echo "NOTICE: [entrypoint-wrapper] AWS DR credentials not mounted. Archiving will fail-closed if triggered." >&2
  fi
fi

exec /usr/local/bin/docker-entrypoint.sh "$@"
