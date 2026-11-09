# Infrastructure Hardening Report

Server: `ambebackend`, Ubuntu 24.04.5, Oracle ARM. Work performed 2026-11-09 (UTC). Branch: `infra/production-hardening`.

**Status:** implemented and verified on the server. Backups are **not yet encrypted** (owner must supply a public key). Off-site backup is **NOT CONFIGURED**, so full disaster recovery is not claimed.

## 1. Changes implemented

| Area | Change |
|---|---|
| Backups | New `erp_backup.py`: nightly `pg_dump` and object snapshot, verification, promotion, retention, status |
| Restore | New `restore-drill.sh`; weekly in-container drill moved to the new format |
| Ports | Frontend, backend, PostgreSQL bound to `127.0.0.1`; Redis host port removed; MinIO binding committed |
| Nginx | Unknown hostnames rejected; `app` and `erp` routing removed; `api` port 80 block moved to its own vhost |
| Health | `erp-frontend` healthcheck uses `127.0.0.1`; `erp-backup` gained a backup-age healthcheck |
| Services | `ambeservice.service`, `rpcbind` disabled; native `minio.service` autostart disabled |
| Deployment | `deploy.yml` validates before updating, never runs `git reset --hard`, rebuilds only affected services |
| Encryption | Public-key encryption implemented; activates when the owner installs a public key |
| WAL | Archiving disabled going forward; existing segments retained |
| Monitoring | Structured logs, container health, optional failure webhook |

Not changed: `.env` files, all credential values, bucket policies, the hourly `stress` cron (see section 15).

Deviation from the request: the frontend mapping is `127.0.0.1:${FRONTEND_PORT:-3000}:80`, not `127.0.0.1:3000:3000`, because the container's nginx listens on port 80.

## 2. Files changed

- `.github/workflows/deploy.yml`
- `docker-compose.yml`
- `infra/backup/Dockerfile`, `entrypoint.sh`, `run-monitored-job.sh`, `weekly-logical-restore-test.sh`
- New: `infra/backup/erp_backup.py`, `test_erp_backup.py`, `test_encrypted_flow.py`, `restore-drill.sh`, `offsite-sync.sh`, `infra/deploy/test_deploy.py`
- New: `infra/nginx/sites-available/*` (copies of the live vhosts; no secrets)
- Removed: `infra/backup/logical-backup-job.sh` (replaced), `infra/nginx/nginx-host-proxy.conf` (stale, unreferenced)
- On the host: `/etc/nginx/sites-available/default`, `/etc/nginx/sites-available/api.ambeservice.com`

## 3. Backup architecture

The existing `erp-backup` container runs everything, using its existing environment and `http://minio:9000`.

```
erp-backups/
  postgresql/{daily,weekly,monthly}/YYYY/MM/DD/<run-id>/{database.dump,globals.sql,manifest.json}
  minio-objects/{daily,weekly,monthly}/YYYY/MM/DD/<run-id>/{manifest.json,ambeuploads/...}
  logs/backup-history/YYYY/MM/<run-id>.json
  wal/   (written by PostgreSQL archiving, not managed by this system)
```

`<run-id>` is inside the date path so that several runs on one day never overwrite each other. Promotion to weekly happens on Sundays and to monthly on the 1st, by Asia/Kolkata date.

## 4. Schedule

| Job | Container cron (UTC) | Local time |
|---|---|---|
| `nightly` | `30 20 * * *` | 02:00 Asia/Kolkata |
| `weekly_logical_drill` | `0 22 * * 0` | Monday 03:30 Asia/Kolkata |

Calendar checked with `systemd-analyze calendar '*-*-* 20:30:00 UTC'`. A real `crond` execution was tested at 16:09 UTC using a temporary entry, since removed. Retention: 14 daily, 8 weekly, 12 monthly. A dry-run ran first and planned no deletions.

## 5-6. First successful backup, sizes, checksums

Run `20261109T160443Z-591e7aa7`:

| Item | Size | SHA-256 |
|---|---|---|
| `database.dump` | 276,273 bytes | `ce0763a86f44c62d9577535031d8339c4d9d0e552ce8a23890702ca7b3366d7d` |
| `globals.sql` | not recorded here | `bce02d8c54faa7c653225c89d01e0551f0dce03e06b50360ce24111154754293` |
| Object snapshot | 153 objects, 13,393,801 bytes | per-object SHA-256 in `manifest.json` |

Run duration 6.9 s. Object verification had 0 discrepancies across size, SHA-256, content type, metadata and ETag. Later successful runs include `20261109T162147Z-3b65ae3e`.

## 7. PostgreSQL restore test

Isolated container, `--network none`, disposable volume, compared against production with read-only sessions.

| Check | Production | Restored |
|---|---|---|
| Tables | 24 | 24 |
| Total rows | 3,175 | 3,175 |
| Constraints | 66 | 66 |
| Indexes | 53 | 53 |
| Extensions | 3 | 3 |

Per-table row counts and full content MD5 hashes matched on run `20261109T162147Z-3b65ae3e`. Restore took 2 s with no errors. The drill container and volume were removed.

One intermediate drill reported a difference of one `refresh_tokens` row. That drill used a backup about 10 minutes old on a live system, and a user login explains it. The two drills run directly after a backup both passed.

The weekly drill also reports a data finding: **14 invoices have a subtotal that does not match their line items.** The same 14 exist in production, so this is not a backup fault. It previously failed the drill; it is now a warning. It needs business review.

## 8. MinIO restoration test

`restore-check` restores **every** object of the newest snapshot to a temporary directory. Result on run `20261109T171455Z-661f0119`: 153 objects, 13,393,801 bytes, 0 failures. Each object was checked for key inventory, size, SHA-256, downloaded content, content served through a presigned URL, content type and metadata. Production objects are never written.

## 9. Network exposure

| Port | Before | After |
|---|---|---|
| 22, 80, 443 | Public | Public |
| 5000 backend | **Public** | 127.0.0.1 |
| 3000 frontend | 0.0.0.0, cloud-filtered | 127.0.0.1 |
| 5432 PostgreSQL | 0.0.0.0, cloud-filtered | 127.0.0.1 |
| 6379 Redis | 0.0.0.0, cloud-filtered | Not published |
| 9000/9001 MinIO | Public until 2026-11-09 | 127.0.0.1 |
| 111 rpcbind | 0.0.0.0, cloud-filtered | Disabled |
| 19000/19001 native MinIO | 127.0.0.1 | 127.0.0.1 (process still running) |

Externally reachable after the change: 22, 80 and 443 only, tested through the public IP. PostgreSQL stays on loopback for SSH-tunnel administration. No client of port 5000 was identified before closing it; infrequent external clients cannot be ruled out, because no history of sources existed.

## 10. Nginx hostnames

| Hostname | Destination |
|---|---|
| `admin.ambeservice.com` | 127.0.0.1:3000 |
| `api.ambeservice.com` | 127.0.0.1:5000 |
| `storage.ambeservice.com` | 127.0.0.1:9000 (S3) |
| `console.ambeservice.com` | 127.0.0.1:9001 |
| `mail.build553.com` | 127.0.0.1:3001 |
| Anything else, including `app`, `erp`, bare IP | Port 80 drops the connection (444); port 443 rejects the TLS handshake |

`ambeservice.com` and `www` remain on Vercel and both return 200.

**Manual DNS action:** a random `*.ambeservice.com` name resolves, so a wildcard record exists. `app` and `erp` may be covered by it, or may also have explicit records; Cloudflare could not be inspected. If explicit records for `app` and `erp` exist, remove them in the dashboard. Do not remove the wildcard unless you intend to.

## 11. Certificate renewal

`certbot renew --dry-run` succeeded for all 5 certificates: admin, api, console, mail.build553.com, storage.

## 12. Docker health

All containers report healthy with restart count 0, except `erp-pgadmin`, which has no healthcheck. No restart loops. `nginx -t` passes with 0 warnings.

Application tests passed: admin 200, `/api/health` 200 (PostgreSQL, storage, Redis up), console login page, S3 health 200, S3 anonymous 403 (expected), presigned GET through `storage.ambeservice.com` 200, tampered signature 403, backend reaches Redis and MinIO internally.

Observed container interruptions: Redis, frontend and backend a few seconds each, PostgreSQL 7 s. `erp-backup` was recreated several times.

## 13. Deployment pipeline

- A push to `master` runs only the build-and-verify job. The deploy job is skipped unless the repository variable `AUTO_DEPLOY_ON_PUSH` is `true`.
- A manual run takes a full `commit` SHA. Push events use `github.sha`.
- Order on the server: validate the SHA format, fetch `origin/master`, confirm the commit is on it, inspect the working tree and branch, record the previous commit, confirm the deployment is permitted, and only then update the tree.
- Refuses dirty tracked files, a named branch other than `master`, unpushed server commits, and older commits unless `rollback=true`.
- Rebuilds only `backend`, `frontend` or `backup`, according to changed paths. Never restarts PostgreSQL for `infra/postgres` changes and never removes volumes.
- Health gate after deployment. `/var/www/ambeservice/.deploy-history` records START, OK and FAILED with both commits.
- Manual rollback: run the workflow with the previous commit and `rollback=true`. The server is left at a detached commit until the next forward deployment.
- `infra/deploy/test_deploy.py` runs the real script in a throwaway repository with stubbed Docker and curl: 15 scenarios pass, including push, manual, invalid SHA, dirty tree, backend-only, frontend-only, backup-only and failed health checks.

The workflow has not yet run against production. `environment: production` enforces approval only after required reviewers are added in GitHub settings.

## 14. Native MinIO

Verified: no connections, no nginx or Compose references, all 153 production objects held by Docker MinIO, successful snapshots exist. `minio.service` autostart is disabled. The manually started process still runs, and `/opt/minio/data` (148 objects) is preserved as an inactive safety copy.

## 15. Remaining risks

1. **Backups are unencrypted** until the owner installs a public key. See section 19.
2. **No off-site backup.** See section 17.
3. **Same credential for everything.** The backend and backup jobs use MinIO root credentials.
4. **Redis has no password.** It is reachable only on the Docker network.
5. **Recovery point is up to 24 hours.** See section 20.
6. **`stress` cron retained.** `nice -n 19 stress --cpu 2 --timeout 300s` runs hourly from the `ubuntu` crontab, installed 2026-08-26. No record states its purpose. It may be keeping the instance above Oracle's idle-reclamation threshold, which is unconfirmed, so it was left in place.
7. **No alert is delivered yet.** No email or webhook is configured. Failures show as `erp-backup` unhealthy, a `FAILED` log line and non-zero exit. Set `BACKUP_ALERT_WEBHOOK_URL` to receive them.
8. **Native MinIO's password is visible in `ps`** until that process is stopped.
9. `.github/workflows/supabase-backup.yml` targets Supabase, not this database. Its current state was not checked.

## 16. Credential rotation checklist (owner)

Two secrets were printed in a Claude Code session during the audit and must be treated as exposed: one line of `GCP_PRIVATE_KEY`, and the native MinIO root access key.

- [ ] `GCP_PRIVATE_KEY`: issue a new key, revoke the old one
- [ ] Native MinIO root user and password: stop the manual process or rotate
- [ ] `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`: consider a restricted backend account
- [ ] `POSTGRES_PASSWORD`, `JWT_SECRET`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GPG_PASSPHRASE`, `PGADMIN_DEFAULT_PASSWORD`, `REPLICATION_PASSWORD`
- [ ] Set `REDIS_PASSWORD`
- [ ] `chmod 600 .env backend/.env` (currently 664)
- [ ] Recreate affected containers, then run a backup and confirm `SUCCESS`

## 17. Off-site backup limitations

**Off-site disaster recovery is NOT CONFIGURED.** `erp-backups` lives on the same VPS and volume as production, so it protects against application and database mistakes but not against loss of the server or volume. No independent destination was found. `infra/backup/offsite-sync.sh` is prepared and exits 78 until configured. It has not been tested against a real destination.

## 18. Rollback

Backups of originals are in `/root/infra-backup-20261109/`.

| Change | Rollback |
|---|---|
| Compose ports, healthchecks | `cp /root/infra-backup-20261109/repo/docker-compose.yml.pre-hardening docker-compose.yml`, then `docker compose up -d --no-deps <service>` |
| Nginx default | `sudo cp /root/infra-backup-20261109/default.pre-reject /etc/nginx/sites-available/default`; remove the appended port 80 block from the `api` vhost; `sudo nginx -t && sudo systemctl reload nginx` |
| All nginx | Restore from `/root/infra-backup-20261109/nginx-pre-hardening` |
| Backup job | Restore `infra/backup/*` from `/root/infra-backup-20261109/repo/`, then `docker compose build backup && docker compose up -d --no-deps backup` |
| Services | `sudo systemctl enable minio`; `sudo systemctl enable --now ambeservice`; `sudo systemctl enable --now rpcbind.socket rpcbind.service` |
| Deployment | `git revert` the workflow commit on `master` |

Enabling `minio.service` restores the port conflict with Docker MinIO on reboot. `ambeservice.service` cannot start: it fails on a missing module.

## 19. Backup encryption

Implemented with GnuPG public-key encryption. **Not active: the owner has not supplied a public key.** Backups continue unencrypted until then.

Once `/etc/erp-backup/backup-public.asc` exists, each run uploads only `database.dump.gpg`, `globals.sql.gpg`, `ambeuploads.tar.gpg` and `objects.json.gpg`, and checks ciphertext SHA-256 after download. A file containing private key material, or an invalid key, fails the run rather than falling back to plaintext. Unencrypted runs are protected from retention until the owner completes an encrypted restore and writes the marker object.

Tested with throwaway keys, destroyed afterwards and never used for backups: real dump and 153 real objects decrypted byte-identical; an in-memory S3 flow confirmed only ciphertext is uploaded and the retention guard works. **An actual encrypted run against the bucket and a restore with the owner's key have not happened.** While encrypted, server-side restore drills report SKIPPED because the server cannot decrypt.

## 20. WAL and recovery strategy

**Chosen strategy: nightly logical backups. Recovery point objective is up to 24 hours. Point-in-time recovery is not available.**

- `erp-backups/wal/` holds 341 encrypted segments, about 14.7 MB, contiguous from the first segment of timeline 1.
- No physical base backup has ever succeeded (the job failed on replication access), and none exists in the bucket. WAL can only be replayed on top of a base backup from the same cluster, so these segments cannot currently restore anything.
- Archiving is now disabled by `ENABLE_WAL_ARCHIVING: "false"` in `docker-compose.yml`, so the prefix stops growing and unusable data stops accumulating.
- **No WAL object was deleted and no WAL retention was implemented**, because recovery from them cannot be tested. The owner may remove the prefix once satisfied. The logical backups do not depend on it.

Adopting point-in-time recovery later needs a tested replication role, working base backups, re-enabled archiving, and a recovery test before any segment expires.

## 21. Business data issue: invoice subtotals

14 invoices have a subtotal that does not match their line items, allowing for the management fee, by more than 1.00. They exist identically in production and in restored backups. No invoice was modified. **This requires owner or accounting review.** The query is in `infra/backup/weekly-logical-restore-test.sh`.
