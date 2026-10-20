#!/usr/bin/env bash
set -Eeuo pipefail

# Canonical Backup Entrypoint - ERP-AMBE
echo "INFO: [backup-entrypoint] Initializing ERP-AMBE backup subsystem..."

# 1. Tool verification
for tool in aws gpg pg_dump pg_basebackup psql su-exec crond sha256sum; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "FATAL: [backup-entrypoint] Required tool '$tool' not found in PATH" >&2
    exit 1
  fi
done

# 2. Source configuration
if [[ -f "/usr/local/bin/backup-config.sh" ]]; then
  # shellcheck source=/dev/null
  source "/usr/local/bin/backup-config.sh"
elif [[ -f "/etc/backup-config.sh" ]]; then
  # shellcheck source=/dev/null
  source "/etc/backup-config.sh"
fi

# 3. Dynamic postgres user detection
PG_UID="$(id -u postgres 2>/dev/null || echo 70)"
PG_GID="$(id -g postgres 2>/dev/null || echo 70)"

# 4. AWS Credentials Setup
AWS_DIR="/var/lib/postgresql/.aws"
AWS_CRED_TARGET="${AWS_DIR}/credentials"
SECRET_SOURCE="${AWS_CREDENTIALS_SECRET_PATH:-/run/secrets/aws_dr_credentials}"

mkdir -p "${AWS_DIR}" /root/.aws
chown "${PG_UID}:${PG_GID}" "${AWS_DIR}"
chmod 700 "${AWS_DIR}"

if [[ -f "${SECRET_SOURCE}" ]]; then
  cp "${SECRET_SOURCE}" "${AWS_CRED_TARGET}"
  cp "${SECRET_SOURCE}" /root/.aws/credentials
  chown "${PG_UID}:${PG_GID}" "${AWS_CRED_TARGET}"
  chmod 400 "${AWS_CRED_TARGET}"
  chmod 400 /root/.aws/credentials
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
  cp "${AWS_CRED_TARGET}" /root/.aws/credentials
  chown "${PG_UID}:${PG_GID}" "${AWS_CRED_TARGET}"
  chmod 400 "${AWS_CRED_TARGET}"
  chmod 400 /root/.aws/credentials
  export AWS_SHARED_CREDENTIALS_FILE="${AWS_CRED_TARGET}"
else
  echo "NOTICE: [backup-entrypoint] AWS DR credentials not mounted at ${SECRET_SOURCE}"
fi

# 5. Setup .pgpass for root and postgres
PGPASS_ROOT="/root/.pgpass"
PGPASS_PG="/var/lib/postgresql/.pgpass"

# Truncate on initialization to prevent duplicate or stale credentials
: > "${PGPASS_ROOT}"
: > "${PGPASS_PG}"
chmod 0600 "${PGPASS_ROOT}" "${PGPASS_PG}"

# Add entries if credentials are provided
if [[ -n "${PGPASSWORD:-}" ]]; then
  echo "${PGHOST:-postgres}:${PGPORT:-5432}:${PGDATABASE:-erp_facility}:${PGUSER:-erp_admin}:${PGPASSWORD}" >> "${PGPASS_ROOT}"
  echo "${PGHOST:-postgres}:${PGPORT:-5432}:${PGDATABASE:-erp_facility}:${PGUSER:-erp_admin}:${PGPASSWORD}" >> "${PGPASS_PG}"
fi

if [[ -n "${REPLICATION_PASSWORD:-}" ]]; then
  echo "${PGHOST:-postgres}:${PGPORT:-5432}:replication:${REPLICATION_USER:-erp_replication}:${REPLICATION_PASSWORD}" >> "${PGPASS_ROOT}"
  echo "${PGHOST:-postgres}:${PGPORT:-5432}:replication:${REPLICATION_USER:-erp_replication}:${REPLICATION_PASSWORD}" >> "${PGPASS_PG}"
fi

chown "${PG_UID}:${PG_GID}" "${PGPASS_PG}"

# 6. Install crontab
mkdir -p /etc/crontabs /var/log
cat << 'EOF' > /etc/crontabs/root
# ERP-AMBE Backup and Recovery Drills Schedule (UTC)
0 1 * * * /usr/local/bin/run-monitored-job.sh physical_base /usr/local/bin/physical-base-backup.sh
0 2 * * * /usr/local/bin/run-monitored-job.sh logical_dump /usr/local/bin/logical-backup-job.sh
0 3 * * 0 /usr/local/bin/run-monitored-job.sh weekly_logical_drill /usr/local/bin/weekly-logical-restore-test.sh
0 5 * * 0 /usr/local/bin/run-monitored-job.sh weekly_physical_drill /usr/local/bin/weekly-physical-restore-test.sh
EOF

chmod 0600 /etc/crontabs/root

echo "INFO: [backup-entrypoint] Backup subsystem initialized. Ready."

# 7. Execute custom command or default daemon
if [[ $# -gt 0 ]]; then
  exec "$@"
else
  echo "INFO: [backup-entrypoint] Starting crond in foreground..."
  exec crond -f -l 2
fi
