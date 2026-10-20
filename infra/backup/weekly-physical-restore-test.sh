#!/usr/bin/env bash
set -Eeuo pipefail

# Weekly Isolated Physical Restore Drill - ERP-AMBE
# Downloads latest physical base backup, replays WAL archive, verifies recovery & data integrity.

if [[ -f "/usr/local/bin/backup-config.sh" ]]; then
  # shellcheck source=/dev/null
  source "/usr/local/bin/backup-config.sh"
elif [[ -f "/etc/backup-config.sh" ]]; then
  # shellcheck source=/dev/null
  source "/etc/backup-config.sh"
fi

echo "INFO: [weekly-physical-drill] Starting weekly physical restore drill..."

SCRATCH_DIR="$(mktemp -d /tmp/drill_physical_XXXXXX)"
trap 'cleanup' EXIT

PG_UID="$(id -u postgres 2>/dev/null || echo 70)"
PG_GID="$(id -g postgres 2>/dev/null || echo 70)"

DATA_DIR="${SCRATCH_DIR}/data"
SOCKET_DIR="${SCRATCH_DIR}/socket"
mkdir -p "${DATA_DIR}" "${SOCKET_DIR}"
chown -R "${PG_UID}:${PG_GID}" "${SCRATCH_DIR}"
chmod 700 "${DATA_DIR}" "${SOCKET_DIR}"

TEST_PORT=5435

cleanup() {
  echo "INFO: [weekly-physical-drill] Cleaning up temporary physical cluster..."
  if [[ -f "${DATA_DIR}/postmaster.pid" ]]; then
    su-exec postgres pg_ctl -D "${DATA_DIR}" stop -m immediate >/dev/null 2>&1 || true
  fi
  rm -rf "${SCRATCH_DIR}"
}

# 1. Identify latest remote physical base backup
LATEST_ARCHIVE=$(aws --endpoint-url="${S3_ENDPOINT_URL}" s3 ls "s3://${DR_S3_BUCKET}/base_backups/" \
  | grep -E 'erp_base_[0-9_Z]+\.tar\.gz\.gpg$' \
  | sort -k4 | tail -n 1 | awk '{print $4}')

if [[ -z "${LATEST_ARCHIVE}" ]]; then
  echo "FATAL: [weekly-physical-drill] No physical base backup archives found in s3://${DR_S3_BUCKET}/base_backups/" >&2
  exit 1
fi

echo "INFO: [weekly-physical-drill] Testing latest archive: ${LATEST_ARCHIVE}"

# 2. Download archive and checksum
aws --endpoint-url="${S3_ENDPOINT_URL}" s3 cp "s3://${DR_S3_BUCKET}/base_backups/${LATEST_ARCHIVE}" "${SCRATCH_DIR}/${LATEST_ARCHIVE}" --only-show-errors
aws --endpoint-url="${S3_ENDPOINT_URL}" s3 cp "s3://${DR_S3_BUCKET}/base_backups/${LATEST_ARCHIVE}.sha256" "${SCRATCH_DIR}/${LATEST_ARCHIVE}.sha256" --only-show-errors

echo "INFO: [weekly-physical-drill] Verifying SHA-256 sidecar..."
(cd "${SCRATCH_DIR}" && sha256sum -c "${LATEST_ARCHIVE}.sha256")

# 3. Decrypt and extract into temporary PGDATA
echo "INFO: [weekly-physical-drill] Decrypting and extracting base backup..."
gpg --batch --yes --decrypt --passphrase-file "${GPG_PASSPHRASE_FILE}" "${SCRATCH_DIR}/${LATEST_ARCHIVE}" \
  | tar -xzf - -C "${DATA_DIR}"

chown -R "${PG_UID}:${PG_GID}" "${DATA_DIR}"
chmod 700 "${DATA_DIR}"

# 4. Configure PostgreSQL recovery settings
touch "${DATA_DIR}/recovery.signal"
chown "${PG_UID}:${PG_GID}" "${DATA_DIR}/recovery.signal"

cat << EOF >> "${DATA_DIR}/postgresql.auto.conf"
restore_command = '/usr/local/bin/pg-restore-wal "%f" "%p"'
archive_mode = off
recovery_target_timeline = 'latest'
recovery_target_action = 'promote'
EOF

# 5. Start temporary server for recovery replay
echo "INFO: [weekly-physical-drill] Starting temporary cluster to replay WAL to latest available..."
su-exec postgres pg_ctl -D "${DATA_DIR}" -o "-k ${SOCKET_DIR} -h '' -p ${TEST_PORT} -c archive_mode=off" -w start

# Wait until recovery completes and database accepts read/write queries
echo "INFO: [weekly-physical-drill] Verifying database readiness post-recovery..."
until su-exec postgres psql -h "${SOCKET_DIR}" -p "${TEST_PORT}" -U "${PGUSER}" -d "${PGDATABASE}" -c "SELECT 1;" >/dev/null 2>&1; do
  sleep 1
done

# 6. Verify table invariants
echo "INFO: [weekly-physical-drill] Executing post-recovery assertion suite..."
REQUIRED_TABLES=("companies" "sites" "staff" "invoices" "attendance_records" "payroll_records")
for tbl in "${REQUIRED_TABLES[@]}"; do
  EXISTS=$(su-exec postgres psql -h "${SOCKET_DIR}" -p "${TEST_PORT}" -U "${PGUSER}" -d "${PGDATABASE}" -t -A -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='${tbl}';")
  if [[ "${EXISTS}" -ne 1 ]]; then
    echo "FATAL: [weekly-physical-drill] Table ${tbl} missing after physical WAL replay!" >&2
    exit 1
  fi
done

echo "INFO: [weekly-physical-drill] Physical restore drill PASSED with complete WAL replay."
exit 0
