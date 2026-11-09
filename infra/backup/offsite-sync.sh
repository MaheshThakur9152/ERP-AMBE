#!/usr/bin/env bash
# Off-site copy of erp-backups to an independent S3-compatible store. NOT CONFIGURED until
# OFFSITE_S3_BUCKET, OFFSITE_S3_ENDPOINT, OFFSITE_AWS_ACCESS_KEY_ID and
# OFFSITE_AWS_SECRET_ACCESS_KEY exist in the erp-backup environment. Never deletes remotely.
# Enable server-side encryption on the destination bucket: dumps contain personal data.
set -Eeuo pipefail

source /usr/local/bin/backup-config.sh

for var in OFFSITE_S3_BUCKET OFFSITE_S3_ENDPOINT OFFSITE_AWS_ACCESS_KEY_ID OFFSITE_AWS_SECRET_ACCESS_KEY; do
  if [[ -z "${!var:-}" ]]; then
    echo "OFF-SITE BACKUP NOT CONFIGURED: ${var} is not set" >&2
    exit 78
  fi
done

WORK_DIR="$(mktemp -d /tmp/offsite_XXXXXX)"
trap 'rm -rf "${WORK_DIR}"' EXIT

aws --endpoint-url="${S3_ENDPOINT_URL}" s3 sync "s3://${DR_S3_BUCKET}/postgresql" "${WORK_DIR}/postgresql" --only-show-errors
aws --endpoint-url="${S3_ENDPOINT_URL}" s3 sync "s3://${DR_S3_BUCKET}/minio-objects" "${WORK_DIR}/minio-objects" --only-show-errors

AWS_ACCESS_KEY_ID="${OFFSITE_AWS_ACCESS_KEY_ID}" AWS_SECRET_ACCESS_KEY="${OFFSITE_AWS_SECRET_ACCESS_KEY}" \
  aws --endpoint-url="${OFFSITE_S3_ENDPOINT}" s3 sync "${WORK_DIR}" "s3://${OFFSITE_S3_BUCKET}/erp-backups" --only-show-errors
echo "Off-site sync finished: s3://${OFFSITE_S3_BUCKET}/erp-backups"
