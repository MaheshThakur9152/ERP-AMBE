#!/usr/bin/env bash
set -Eeuo pipefail

# Synthetic Target-Time PITR Test - ERP-AMBE (GATE-06)
if [[ -f "/usr/local/bin/backup-config.sh" ]]; then
  # shellcheck source=/dev/null
  source "/usr/local/bin/backup-config.sh"
elif [[ -f "/etc/backup-config.sh" ]]; then
  # shellcheck source=/dev/null
  source "/etc/backup-config.sh"
fi

echo "INFO: [pitr-drill] Initializing synthetic Point-In-Time Recovery drill..."

# Step 1: Create canary table in primary PostgreSQL
su-exec postgres psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -c "
  DROP TABLE IF EXISTS public.pitr_canary;
  CREATE TABLE public.pitr_canary (
    id int PRIMARY KEY,
    marker text NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT now()
  );
  INSERT INTO public.pitr_canary (id, marker) VALUES (1, 'CANARY_BEFORE_BACKUP');
"

# Step 2: Trigger physical base backup
echo "INFO: [pitr-drill] Creating physical base backup..."
/usr/local/bin/physical-base-backup.sh

# Step 3: Insert target row and capture target timestamp
sleep 2
echo "INFO: [pitr-drill] Inserting recoverable target record..."
su-exec postgres psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -c "
  INSERT INTO public.pitr_canary (id, marker) VALUES (2, 'CANARY_RECOVER_ME');
"
sleep 1
TARGET_TIME=$(su-exec postgres psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -t -A -c "SELECT clock_timestamp();")
echo "INFO: [pitr-drill] Target timestamp for recovery: ${TARGET_TIME}"

# Step 4: Insert row that should NOT be restored (post-target event)
sleep 2
echo "INFO: [pitr-drill] Inserting post-target event (CANARY_POST_DISASTER)..."
su-exec postgres psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -c "
  INSERT INTO public.pitr_canary (id, marker) VALUES (3, 'CANARY_POST_DISASTER');
  SELECT pg_switch_wal();
"
sleep 2

# Step 5: Prepare isolated recovery cluster
SCRATCH_DIR="$(mktemp -d /tmp/pitr_drill_XXXXXX)"
trap 'cleanup' EXIT

PG_UID="$(id -u postgres 2>/dev/null || echo 70)"
PG_GID="$(id -g postgres 2>/dev/null || echo 70)"
DATA_DIR="${SCRATCH_DIR}/data"
SOCKET_DIR="${SCRATCH_DIR}/socket"
mkdir -p "${DATA_DIR}" "${SOCKET_DIR}"
chown -R "${PG_UID}:${PG_GID}" "${SCRATCH_DIR}"
chmod 700 "${DATA_DIR}" "${SOCKET_DIR}"

TEST_PORT=5436

cleanup() {
  echo "INFO: [pitr-drill] Cleaning up temporary recovery cluster..."
  if [[ -f "${DATA_DIR}/postmaster.pid" ]]; then
    su-exec postgres pg_ctl -D "${DATA_DIR}" stop -m immediate >/dev/null 2>&1 || true
  fi
  rm -rf "${SCRATCH_DIR}"
  su-exec postgres psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -c "
    DROP TABLE IF EXISTS public.pitr_canary;
  " >/dev/null 2>&1 || true
}

# Identify latest base backup
LATEST_ARCHIVE=$(aws --endpoint-url="${S3_ENDPOINT_URL}" s3 ls "s3://${DR_S3_BUCKET}/base_backups/" \
  | grep -E 'erp_base_[0-9_Z]+\.tar\.gz\.gpg$' \
  | sort -k4 | tail -n 1 | awk '{print $4}')

echo "INFO: [pitr-drill] Restoring base backup: ${LATEST_ARCHIVE}"
aws --endpoint-url="${S3_ENDPOINT_URL}" s3 cp "s3://${DR_S3_BUCKET}/base_backups/${LATEST_ARCHIVE}" "${SCRATCH_DIR}/${LATEST_ARCHIVE}" --only-show-errors
aws --endpoint-url="${S3_ENDPOINT_URL}" s3 cp "s3://${DR_S3_BUCKET}/base_backups/${LATEST_ARCHIVE}.sha256" "${SCRATCH_DIR}/${LATEST_ARCHIVE}.sha256" --only-show-errors

echo "INFO: [pitr-drill] Verifying SHA-256 sidecar..."
(cd "${SCRATCH_DIR}" && sha256sum -c "${LATEST_ARCHIVE}.sha256")

echo "INFO: [pitr-drill] Decrypting and extracting..."
gpg --batch --yes --decrypt --passphrase-file "${GPG_PASSPHRASE_FILE}" "${SCRATCH_DIR}/${LATEST_ARCHIVE}" \
  | tar -xzf - -C "${DATA_DIR}"

chown -R "${PG_UID}:${PG_GID}" "${DATA_DIR}"
chmod 700 "${DATA_DIR}"

# Step 6: Configure PITR target settings
touch "${DATA_DIR}/recovery.signal"
chown "${PG_UID}:${PG_GID}" "${DATA_DIR}/recovery.signal"

cat << EOF >> "${DATA_DIR}/postgresql.auto.conf"
restore_command = '/usr/local/bin/pg-restore-wal "%f" "%p"'
archive_mode = off
recovery_target_time = '${TARGET_TIME}'
recovery_target_timeline = 'latest'
recovery_target_action = 'promote'
EOF

# Step 7: Start ephemeral recovery cluster and wait for promotion
echo "INFO: [pitr-drill] Starting ephemeral cluster for target-time WAL replay..."
su-exec postgres pg_ctl -D "${DATA_DIR}" -o "-k ${SOCKET_DIR} -h '' -p ${TEST_PORT} -c archive_mode=off" -w start

echo "INFO: [pitr-drill] Waiting for cluster recovery..."
until su-exec postgres psql -h "${SOCKET_DIR}" -p "${TEST_PORT}" -U "${PGUSER}" -d "${PGDATABASE}" -c "SELECT 1;" >/dev/null 2>&1; do
  sleep 1
done

# Step 8: Verify PITR canary records
echo "INFO: [pitr-drill] Verifying restored PITR data assertions..."

HAS_ROW_1=$(su-exec postgres psql -h "${SOCKET_DIR}" -p "${TEST_PORT}" -U "${PGUSER}" -d "${PGDATABASE}" -t -A -c \
  "SELECT count(*) FROM public.pitr_canary WHERE id = 1 AND marker = 'CANARY_BEFORE_BACKUP';")

HAS_ROW_2=$(su-exec postgres psql -h "${SOCKET_DIR}" -p "${TEST_PORT}" -U "${PGUSER}" -d "${PGDATABASE}" -t -A -c \
  "SELECT count(*) FROM public.pitr_canary WHERE id = 2 AND marker = 'CANARY_RECOVER_ME';")

HAS_ROW_3=$(su-exec postgres psql -h "${SOCKET_DIR}" -p "${TEST_PORT}" -U "${PGUSER}" -d "${PGDATABASE}" -t -A -c \
  "SELECT count(*) FROM public.pitr_canary WHERE id = 3;")

echo "INFO: [pitr-drill] Verification results: Row 1 count=${HAS_ROW_1}, Row 2 count=${HAS_ROW_2}, Row 3 count=${HAS_ROW_3}"

if [[ "${HAS_ROW_1}" -ne 1 ]]; then
  echo "FATAL: [pitr-drill] Row 1 (pre-backup) missing from PITR restore!" >&2
  exit 1
fi

if [[ "${HAS_ROW_2}" -ne 1 ]]; then
  echo "FATAL: [pitr-drill] Row 2 (target-recovered WAL replay) missing from PITR restore!" >&2
  exit 1
fi

if [[ "${HAS_ROW_3}" -ne 0 ]]; then
  echo "FATAL: [pitr-drill] Row 3 (post-target disaster) was incorrectly recovered!" >&2
  exit 1
fi

echo "INFO: [pitr-drill] PITR target-time drill PASSED: exact target state recovered without post-target events."
exit 0
