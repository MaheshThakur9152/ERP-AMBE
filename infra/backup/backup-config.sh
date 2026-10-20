#!/usr/bin/env bash
# Non-secret environment configuration for ERP-AMBE Backup and Archiving

export S3_ENDPOINT_URL="${S3_ENDPOINT_URL:-http://minio:9000}"
export DR_S3_BUCKET="${DR_S3_BUCKET:-erp-backups}"
export DR_S3_PREFIX="${DR_S3_PREFIX:-wal}"
export PGHOST="${PGHOST:-postgres}"
export PGPORT="${PGPORT:-5432}"
export PGDATABASE="${PGDATABASE:-erp_facility}"
export PGUSER="${PGUSER:-erp_admin}"
export REPLICATION_USER="${REPLICATION_USER:-erp_replication}"
export GPG_PASSPHRASE_FILE="${GPG_PASSPHRASE_FILE:-/run/secrets/backup_gpg_passphrase}"
export BACKUP_CONFIRM_INDEPENDENT_DR="${BACKUP_CONFIRM_INDEPENDENT_DR:-false}"
export AWS_SHARED_CREDENTIALS_FILE="${AWS_SHARED_CREDENTIALS_FILE:-/var/lib/postgresql/.aws/credentials}"
