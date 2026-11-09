# Backup Operations

Run commands from `/var/www/ambeservice/ERP-AMBE` on the server unless stated otherwise.

## How backups run

`crond` in `erp-backup` runs `erp_backup.py nightly` at 20:30 UTC (02:00 Asia/Kolkata). Each run:

1. Takes a `pg_dump` custom-format archive and `pg_dumpall --globals-only --no-role-passwords`.
2. Validates with `pg_restore --list`, uploads, downloads again and compares SHA-256.
3. Copies every `ambeuploads` object to a new snapshot, then compares keys, sizes, SHA-256, content type and metadata for every object.
4. Writes a `manifest.json` for each backup. The status field decides whether a backup counts as valid.
5. If both backups passed, promotes and applies retention. Retention keeps 14 daily, 8 weekly and 12 monthly successful runs, and only touches `postgresql/` and `minio-objects/`.

A lock prevents overlapping runs. `0 22 * * 0` runs an additional weekly restore drill.

## Where backups are stored

Bucket `erp-backups` on Docker MinIO:

- `postgresql/{daily,weekly,monthly}/YYYY/MM/DD/<run-id>/`
- `minio-objects/{daily,weekly,monthly}/YYYY/MM/DD/<run-id>/`
- `logs/backup-history/YYYY/MM/<run-id>.json`

Run status is also kept in the `erp_backups_volume` volume: `/backups/last-status.json` and `/backups/backup-jobs.log`.

## Encryption status

Encryption activates automatically when `/etc/erp-backup/backup-public.asc` exists. **It is not active yet.**

### Owner setup

Generate the key on a trusted computer that is not this server:

```bash
gpg --quick-generate-key "ERP AMBE Backups" default default never
gpg --armor --export "ERP AMBE Backups" > backup-public.asc
gpg --armor --export-secret-keys "ERP AMBE Backups" > backup-private.asc   # store offline, at least two copies
```

Never copy `backup-private.asc` to the server. Losing it makes encrypted backups permanently unreadable. Then:

```bash
scp backup-public.asc ubuntu@SERVER:/tmp/
sudo install -m 644 /tmp/backup-public.asc /etc/erp-backup/backup-public.asc   # on the server
docker exec erp-backup /usr/local/bin/run-monitored-job.sh nightly /usr/local/bin/erp_backup.py nightly
```

### Restore an encrypted backup

Run on the computer holding the private key, after downloading the run's files:

```bash
gpg --decrypt database.dump.gpg > database.dump
gpg --decrypt ambeuploads.tar.gpg > ambeuploads.tar
gpg --decrypt objects.json.gpg > objects.json
pg_restore --list database.dump
tar -xf ambeuploads.tar -C restored-objects/
```

Compare SHA-256 values with `dump_sha256` in `manifest.json` and with `objects.json`. Restore the dump into a test PostgreSQL 16 instance.

Only after that restore succeeds, allow retention to expire old unencrypted runs:

```bash
docker exec erp-backup sh -c 'aws --endpoint-url "$S3_ENDPOINT_URL" s3api put-object --bucket "$DR_S3_BUCKET" --key config/encrypted-restore-verified'
```

## Trigger a backup manually

```bash
docker exec erp-backup /usr/local/bin/run-monitored-job.sh nightly /usr/local/bin/erp_backup.py nightly
```

Exit code 0 means every step passed.

## Verify a backup

```bash
docker exec erp-backup /usr/local/bin/erp_backup.py health
docker exec erp-backup sh -c 'jq "del(.retention)" /backups/last-status.json'
docker exec erp-backup /usr/local/bin/erp_backup.py restore-check   # verifies every object
infra/backup/restore-drill.sh                                       # isolated PostgreSQL restore
docker exec erp-backup /usr/local/bin/erp_backup.py retention       # dry-run, deletes nothing
```

`restore-check`, `restore-drill.sh` and the weekly drill exit 78 (`SKIPPED`) when the newest backup is encrypted, because the server has no private key. Use the encrypted restore procedure instead.

`restore-drill.sh` compares against live production. Run it straight after a backup: writes made since the backup, such as a login adding a `refresh_tokens` row, show as differences.

## Restore PostgreSQL

**This overwrites production data.** Take a fresh backup first and stop the backend so nothing writes during the restore.

```bash
docker exec erp-backup /usr/local/bin/run-monitored-job.sh nightly /usr/local/bin/erp_backup.py nightly
docker exec erp-backup /usr/local/bin/erp_backup.py latest-pg       # or pick a run prefix from the bucket
PREFIX=postgresql/daily/YYYY/MM/DD/RUN-ID/

docker compose stop backend
docker exec erp-backup sh -c "aws --endpoint-url \"\$S3_ENDPOINT_URL\" s3 cp s3://\$DR_S3_BUCKET/${PREFIX}database.dump /tmp/database.dump --only-show-errors"
docker exec erp-backup sh -c 'pg_restore -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" --clean --if-exists --exit-on-error /tmp/database.dump'
docker exec erp-backup rm -f /tmp/database.dump
docker compose start backend
```

Check the SHA-256 in that run's `manifest.json` before restoring. `globals.sql` contains roles without passwords. Apply it only when rebuilding a server, then set role passwords.

## Restore MinIO objects

Restoring copies objects back. Do not use sync with `--delete`. To restore one object, use the snapshot prefix from the bucket:

```bash
SNAP=minio-objects/daily/YYYY/MM/DD/RUN-ID/ambeuploads
docker exec erp-backup sh -c "aws --endpoint-url \"\$S3_ENDPOINT_URL\" s3 cp \"s3://\$DR_S3_BUCKET/$SNAP/path/to/file.pdf\" \"s3://ambeuploads/path/to/file.pdf\""
```

To restore everything, use the same command with `--recursive` on the `$SNAP/` prefix and `s3://ambeuploads/`. This overwrites objects with the same key and leaves newer objects in place.

## Inspect failures

```bash
docker ps --filter name=erp-backup              # shows unhealthy after a failed or stale run
docker exec erp-backup tail -20 /backups/backup-jobs.log
docker exec erp-backup sh -c 'jq ".status,.errors" /backups/last-status.json'
docker logs --tail 100 erp-backup
```

`erp-backup` becomes unhealthy when the last run failed or finished more than 26 hours ago. Each run also logs a JSON line with `"event": "backup_run"`.

### Failure alerts

No alert channel is configured. Set `BACKUP_ALERT_WEBHOOK_URL` in `.env`, then run `docker compose up -d --no-deps backup`. Any failed job sends a JSON POST with `event`, `job`, `exit_code`, `run_id`, `status` and `errors`.

## WAL

Recovery uses nightly logical backups, so the recovery point is up to 24 hours. WAL archiving is disabled in `docker-compose.yml`. The existing `wal/` prefix has no matching base backup, cannot be replayed, and is not used by any restore procedure.

## Configure an off-site destination later

Off-site backup is currently **not configured**. To enable it:

1. Install the public encryption key first. Then create a bucket on an independent provider, separate from this VPS, with write-only or versioned access if available.
2. Add `OFFSITE_S3_BUCKET`, `OFFSITE_S3_ENDPOINT`, `OFFSITE_AWS_ACCESS_KEY_ID` and `OFFSITE_AWS_SECRET_ACCESS_KEY` to `.env`, and pass them through in the `backup` service in `docker-compose.yml`.
3. `docker compose up -d --no-deps backup`.
4. Run `docker exec erp-backup /usr/local/bin/offsite-sync.sh`.
5. Add it to the crontab in `infra/backup/entrypoint.sh` after the nightly job.
6. Restore a backup from the remote copy. Off-site recovery is proven only after that succeeds.
