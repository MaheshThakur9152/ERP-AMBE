#!/usr/bin/env bash
set -Eeuo pipefail

# Weekly Isolated Logical Restore Drill - ERP-AMBE
# Downloads latest logical dump, restores into an ephemeral PostgreSQL instance, and asserts schema & data integrity.

if [[ -f "/usr/local/bin/backup-config.sh" ]]; then
  # shellcheck source=/dev/null
  source "/usr/local/bin/backup-config.sh"
elif [[ -f "/etc/backup-config.sh" ]]; then
  # shellcheck source=/dev/null
  source "/etc/backup-config.sh"
fi

echo "INFO: [weekly-logical-drill] Starting weekly logical restore drill..."

SCRATCH_DIR="$(mktemp -d /tmp/drill_logical_XXXXXX)"
trap 'cleanup' EXIT

PG_UID="$(id -u postgres 2>/dev/null || echo 70)"
PG_GID="$(id -g postgres 2>/dev/null || echo 70)"

DATA_DIR="${SCRATCH_DIR}/data"
SOCKET_DIR="${SCRATCH_DIR}/socket"
mkdir -p "${DATA_DIR}" "${SOCKET_DIR}"
chown -R "${PG_UID}:${PG_GID}" "${SCRATCH_DIR}"
chmod 700 "${DATA_DIR}" "${SOCKET_DIR}"

TEST_PORT=5434

cleanup() {
  echo "INFO: [weekly-logical-drill] Cleaning up temporary test cluster..."
  if [[ -f "${DATA_DIR}/postmaster.pid" ]]; then
    su-exec postgres pg_ctl -D "${DATA_DIR}" stop -m immediate >/dev/null 2>&1 || true
  fi
  rm -rf "${SCRATCH_DIR}"
}

# 1. Identify latest remote logical backup
LATEST_ARCHIVE=$(aws --endpoint-url="${S3_ENDPOINT_URL}" s3 ls "s3://${DR_S3_BUCKET}/logical/" \
  | grep -E 'erp_facility_[0-9_Z]+\.sql\.gz\.gpg$' \
  | sort -k4 | tail -n 1 | awk '{print $4}')

if [[ -z "${LATEST_ARCHIVE}" ]]; then
  echo "FATAL: [weekly-logical-drill] No logical backup archives found in s3://${DR_S3_BUCKET}/logical/" >&2
  exit 1
fi

echo "INFO: [weekly-logical-drill] Testing latest archive: ${LATEST_ARCHIVE}"

# 2. Download archive and checksum
aws --endpoint-url="${S3_ENDPOINT_URL}" s3 cp "s3://${DR_S3_BUCKET}/logical/${LATEST_ARCHIVE}" "${SCRATCH_DIR}/${LATEST_ARCHIVE}" --only-show-errors
aws --endpoint-url="${S3_ENDPOINT_URL}" s3 cp "s3://${DR_S3_BUCKET}/logical/${LATEST_ARCHIVE}.sha256" "${SCRATCH_DIR}/${LATEST_ARCHIVE}.sha256" --only-show-errors

echo "INFO: [weekly-logical-drill] Verifying SHA-256 sidecar..."
(cd "${SCRATCH_DIR}" && sha256sum -c "${LATEST_ARCHIVE}.sha256")

# 3. Decrypt and decompress dump
echo "INFO: [weekly-logical-drill] Decrypting dump..."
gpg --batch --yes --decrypt --passphrase-file "${GPG_PASSPHRASE_FILE}" "${SCRATCH_DIR}/${LATEST_ARCHIVE}" \
  | gunzip -c > "${SCRATCH_DIR}/restore.sql"

# 4. Initialize ephemeral cluster
echo "INFO: [weekly-logical-drill] Initializing ephemeral PostgreSQL cluster..."
su-exec postgres initdb -D "${DATA_DIR}" -U "${PGUSER}" -A trust >/dev/null

# Start on private socket only (listen_addresses = '')
su-exec postgres pg_ctl -D "${DATA_DIR}" -o "-k ${SOCKET_DIR} -h '' -p ${TEST_PORT} -c archive_mode=off" start >/dev/null

# 5. Create target database and execute restore
echo "INFO: [weekly-logical-drill] Restoring dump into ephemeral database..."
su-exec postgres createdb -h "${SOCKET_DIR}" -p "${TEST_PORT}" -U "${PGUSER}" "${PGDATABASE}"

su-exec postgres psql -h "${SOCKET_DIR}" -p "${TEST_PORT}" -U "${PGUSER}" -d "${PGDATABASE}" \
  --set ON_ERROR_STOP=1 -q -f "${SCRATCH_DIR}/restore.sql"

# 6. Assertion verification suite
echo "INFO: [weekly-logical-drill] Executing database assertion suite..."

# Table presence checks
REQUIRED_TABLES=("companies" "sites" "staff" "invoices" "attendance_records" "payroll_records")
for tbl in "${REQUIRED_TABLES[@]}"; do
  EXISTS=$(su-exec postgres psql -h "${SOCKET_DIR}" -p "${TEST_PORT}" -U "${PGUSER}" -d "${PGDATABASE}" -t -A -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='${tbl}';")
  if [[ "${EXISTS}" -ne 1 ]]; then
    echo "FATAL: [weekly-logical-drill] Assertion failed: Table ${tbl} missing from restore!" >&2
    exit 1
  fi
done

# Invariant: Invoice subtotal variance = 0 (accounting for optional management fee)
VARIANCE_COUNT=$(su-exec postgres psql -h "${SOCKET_DIR}" -p "${TEST_PORT}" -U "${PGUSER}" -d "${PGDATABASE}" --set ON_ERROR_STOP=1 -t -A -c \
  "SELECT count(*) FROM (
     SELECT i.id, i.sub_total
     FROM public.invoices i
     LEFT JOIN public.invoice_items ii ON ii.invoice_id = i.id
     GROUP BY i.id, i.sub_total, i.management_fee_percent, i.mgmt_percent
     HAVING ROUND(ABS(i.sub_total - COALESCE(SUM(ii.amount), 0)), 2) > 1.00
        AND ROUND(ABS(i.sub_total - (COALESCE(SUM(ii.amount), 0) * (1 + COALESCE(i.management_fee_percent, i.mgmt_percent, 0) / 100.0))), 2) > 1.00
   ) v;")

if [[ "${VARIANCE_COUNT}" -gt 0 ]]; then
  echo "FATAL: [weekly-logical-drill] Subtotal variance violation detected in restored invoices: ${VARIANCE_COUNT} rows!" >&2
  exit 1
fi

echo "INFO: [weekly-logical-drill] Logical restore drill PASSED with 0 integrity violations."
exit 0
