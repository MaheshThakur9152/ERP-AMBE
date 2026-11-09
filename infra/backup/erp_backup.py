#!/usr/bin/python3
"""ERP-AMBE backups: PostgreSQL logical dump, MinIO object snapshot, retention.

Usage: erp_backup.py nightly [--dry-run-retention] | retention [--apply] |
       restore-check | latest-pg | health
Credentials come only from the container environment and are never logged.
"""
import datetime as dt
import hashlib
import json
import os
import re
import secrets
import subprocess
import sys
import tempfile
import urllib.request
from zoneinfo import ZoneInfo

JOB_VERSION = "2.0.0"
BUCKET = os.environ.get("DR_S3_BUCKET", "erp-backups")
SOURCE_BUCKET = "ambeuploads"
ENDPOINT = os.environ.get("S3_ENDPOINT_URL", "http://minio:9000")
STATUS_FILE = "/backups/last-status.json"
RETENTION = {"daily": 14, "weekly": 8, "monthly": 12}
KINDS = ("postgresql", "minio-objects")
MAX_STATUS_AGE_HOURS = 26
MANAGED_KEY = re.compile(r"^(postgresql|minio-objects)/(daily|weekly|monthly)/\d{4}/\d{2}/\d{2}/[^/]+/")

if BUCKET == SOURCE_BUCKET:
    sys.exit("FATAL: backup bucket must differ from the production bucket")

_client = None


def s3():
    global _client
    if _client is None:
        import boto3
        from botocore.config import Config

        _client = boto3.client(
            "s3",
            endpoint_url=ENDPOINT,
            region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}, retries={"max_attempts": 5}),
        )
    return _client


def now():
    return dt.datetime.now(dt.timezone.utc)


def iso(t):
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


def log(msg):
    print(f"{iso(now())} [erp-backup] {msg}", flush=True)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"{cmd[0]} exited {r.returncode}: {r.stderr.strip()[-500:]}")
    return r.stdout


def pg_args():
    return ["-h", os.environ.get("PGHOST", "postgres"), "-p", os.environ.get("PGPORT", "5432"),
            "-U", os.environ.get("PGUSER", "erp_admin")]


def pg_db():
    return os.environ.get("PGDATABASE", "erp_facility")


def sql(query):
    return run(["psql", *pg_args(), "-d", pg_db(), "-At", "-v", "ON_ERROR_STOP=1", "-c", query]).strip()


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_object(bucket, key):
    h = hashlib.sha256()
    n = 0
    for chunk in s3().get_object(Bucket=bucket, Key=key)["Body"].iter_chunks(1024 * 1024):
        h.update(chunk)
        n += len(chunk)
    return h.hexdigest(), n


def list_objects(bucket, prefix=""):
    found = {}
    for page in s3().get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
        for o in page.get("Contents", []):
            found[o["Key"]] = {"size": o["Size"], "etag": o["ETag"].strip('"')}
    return found


def run_prefix(kind, tier, stamp, run_id):
    return f"{kind}/{tier}/{stamp:%Y/%m/%d}/{run_id}/"


def require_new_prefix(prefix):
    if list_objects(BUCKET, prefix):
        raise RuntimeError(f"refusing to overwrite existing backup at {prefix}")


def put_manifest(prefix, manifest):
    s3().put_object(Bucket=BUCKET, Key=prefix + "manifest.json", ContentType="application/json",
                    Body=json.dumps(manifest, indent=2, sort_keys=True).encode())


def backup_postgres(run_id, stamp):
    prefix = run_prefix("postgresql", "daily", stamp, run_id)
    m = {"type": "postgresql", "run_id": run_id, "job_version": JOB_VERSION, "timestamp_utc": iso(stamp),
         "prefix": prefix, "database": pg_db(), "status": "FAILED", "validation": {}, "errors": []}
    v = m["validation"]
    try:
        require_new_prefix(prefix)
        with tempfile.TemporaryDirectory() as work:
            dump, globs = f"{work}/database.dump", f"{work}/globals.sql"
            log("postgresql: pg_dump starting")
            run(["pg_dump", *pg_args(), "-d", pg_db(), "-Fc", "-f", dump])
            v["dump_exit_zero"] = True
            run(["pg_dumpall", *pg_args(), "-l", pg_db(), "--globals-only", "--no-role-passwords", "-f", globs])
            v["globals_exit_zero"] = True
            size = os.path.getsize(dump)
            if size == 0:
                raise RuntimeError("database.dump is empty")
            v["archive_exists"] = True
            m["dump_sha256"], m["dump_size_bytes"] = sha256_file(dump), size
            m["globals_sha256"], m["globals_size_bytes"] = sha256_file(globs), os.path.getsize(globs)

            toc = run(["pg_restore", "--list", dump])
            v["pg_restore_list"] = True
            tables = [t for t in sql(
                "select format('%I.%I',n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace "
                "where c.relkind='r' and n.nspname not in ('pg_catalog','information_schema') "
                "and n.nspname !~ '^pg_toast' order by 1").splitlines() if t]
            toc_tables = len(re.findall(r" TABLE DATA ", toc))
            m["table_count"], m["toc_table_data_entries"] = len(tables), toc_tables
            if toc_tables != len(tables):
                raise RuntimeError(f"dump has {toc_tables} TABLE DATA entries, database has {len(tables)} tables")
            v["all_tables_in_archive"] = True

            m["server_version"] = sql("show server_version")
            m["pg_dump_version"] = run(["pg_dump", "--version"]).strip()
            m["database_size_bytes"] = int(sql("select pg_database_size(current_database())"))
            m["extensions"] = [dict(zip(("name", "version"), l.split("|")))
                               for l in sql("select extname,extversion from pg_extension order by 1").splitlines()]
            m["row_counts"] = {t: int(sql(f"select count(*) from {t}")) for t in tables}

            for name, local in (("database.dump", dump), ("globals.sql", globs)):
                s3().upload_file(local, BUCKET, prefix + name)
            v["uploaded"] = True
            for name, local in (("database.dump", dump), ("globals.sql", globs)):
                check = f"{work}/verify-{name}"
                s3().download_file(BUCKET, prefix + name, check)
                if sha256_file(check) != sha256_file(local):
                    raise RuntimeError(f"SHA-256 mismatch after download of {name}")
            v["download_sha256_match"] = True
        m["status"] = "SUCCESS"
    except Exception as e:
        m["errors"].append(str(e))
        log(f"postgresql: ERROR {e}")
    try:
        put_manifest(prefix, m)
    except Exception as e:
        m["status"] = "FAILED"
        m["errors"].append(f"manifest upload failed: {e}")
    return m


def snapshot_minio(run_id, stamp):
    prefix = run_prefix("minio-objects", "daily", stamp, run_id)
    dest_root = prefix + SOURCE_BUCKET + "/"
    m = {"type": "minio-objects", "run_id": run_id, "job_version": JOB_VERSION, "timestamp_utc": iso(stamp),
         "prefix": prefix, "source_bucket": SOURCE_BUCKET, "status": "FAILED", "discrepancies": [], "errors": []}
    bad = m["discrepancies"]
    try:
        require_new_prefix(prefix)
        source = list_objects(SOURCE_BUCKET)
        log(f"minio: copying {len(source)} objects")
        for key in source:
            # shortcut: CopyObject caps at 5 GiB per object, add multipart copy if uploads ever reach that.
            s3().copy_object(Bucket=BUCKET, Key=dest_root + key, MetadataDirective="COPY",
                             CopySource={"Bucket": SOURCE_BUCKET, "Key": key})
        dest = {k[len(dest_root):]: v for k, v in list_objects(BUCKET, dest_root).items()}
        m["source_object_count"], m["dest_object_count"] = len(source), len(dest)
        m["source_total_bytes"] = sum(o["size"] for o in source.values())
        m["dest_total_bytes"] = sum(o["size"] for o in dest.values())
        for k in sorted(set(source) ^ set(dest)):
            bad.append({"key": k, "problem": "missing from " + ("destination" if k in source else "source")})

        objects, etags_compared = [], 0
        # shortcut: hashes every object on both sides, cap to a sample once the bucket grows past a few GiB.
        for key in sorted(set(source) & set(dest)):
            s, d = source[key], dest[key]
            sh = s3().head_object(Bucket=SOURCE_BUCKET, Key=key)
            dh = s3().head_object(Bucket=BUCKET, Key=dest_root + key)
            src_sha, _ = sha256_object(SOURCE_BUCKET, key)
            dst_sha, _ = sha256_object(BUCKET, dest_root + key)
            problems = []
            if s["size"] != d["size"]:
                problems.append("size")
            if src_sha != dst_sha:
                problems.append("sha256")
            if sh.get("ContentType") != dh.get("ContentType"):
                problems.append("content_type")
            if sh.get("Metadata") != dh.get("Metadata"):
                problems.append("metadata")
            # Multipart ETags are not content MD5s, so only single-part ETags are comparable.
            if "-" not in s["etag"] and "-" not in d["etag"]:
                etags_compared += 1
                if s["etag"] != d["etag"]:
                    problems.append("etag")
            if problems:
                bad.append({"key": key, "problem": ",".join(problems)})
            objects.append({"key": key, "size": s["size"], "etag": s["etag"], "sha256": src_sha,
                            "content_type": sh.get("ContentType"), "metadata": sh.get("Metadata")})
        m["objects"] = objects
        m["etags_compared"] = etags_compared
        m["verification"] = "full: size, sha256, content-type, metadata on every object"
        if not bad and m["source_total_bytes"] == m["dest_total_bytes"]:
            m["status"] = "SUCCESS"
        else:
            m["errors"].append(f"{len(bad)} discrepancies")
    except Exception as e:
        m["errors"].append(str(e))
        log(f"minio: ERROR {e}")
    try:
        put_manifest(prefix, m)
    except Exception as e:
        m["status"] = "FAILED"
        m["errors"].append(f"manifest upload failed: {e}")
    return m


def promote(kind, run_id, stamp):
    """Server-side copy a successful daily run into the weekly/monthly tiers (Asia/Kolkata calendar)."""
    local = stamp.astimezone(ZoneInfo("Asia/Kolkata"))
    tiers = ([] if local.isoweekday() != 7 else ["weekly"]) + ([] if local.day != 1 else ["monthly"])
    src = run_prefix(kind, "daily", stamp, run_id)
    for tier in tiers:
        dst = run_prefix(kind, tier, stamp, run_id)
        require_new_prefix(dst)
        # Manifest last, so a partial promotion never looks complete.
        for key in sorted(list_objects(BUCKET, src), key=lambda k: k.endswith("/manifest.json")):
            s3().copy_object(Bucket=BUCKET, Key=dst + key[len(src):], MetadataDirective="COPY",
                             CopySource={"Bucket": BUCKET, "Key": key})
        log(f"{kind}: promoted {run_id} to {tier}")
    return tiers


def plan_retention(runs, keep):
    """runs: [(run_id, succeeded)]. Return run_ids to delete, oldest kept = keep-th newest success."""
    if keep < 1:
        raise ValueError("keep must be at least 1")
    good = sorted((r for r, ok in runs if ok), reverse=True)
    if len(good) <= keep:
        return []
    cutoff = good[keep - 1]
    return sorted(r for r, _ in runs if r < cutoff)


def discover_runs(kind, tier):
    runs = {}
    for key in list_objects(BUCKET, f"{kind}/{tier}/"):
        if not MANAGED_KEY.match(key):
            continue
        run_dir = "/".join(key.split("/")[:6]) + "/"
        runs.setdefault(key.split("/")[5], run_dir)
    states = []
    for run_id, run_dir in runs.items():
        try:
            body = s3().get_object(Bucket=BUCKET, Key=run_dir + "manifest.json")["Body"].read()
            ok = json.loads(body).get("status") == "SUCCESS"
        except s3().exceptions.NoSuchKey:
            ok = False
        states.append((run_id, ok))
    return runs, states


def retention(apply):
    report = []
    for kind in KINDS:
        for tier, keep in RETENTION.items():
            runs, states = discover_runs(kind, tier)
            doomed = plan_retention(states, keep)
            log(f"retention {'APPLY' if apply else 'DRY-RUN'} {kind}/{tier}: runs={len(states)} "
                f"successful={sum(ok for _, ok in states)} keep={keep} delete={len(doomed)}")
            for run_id in doomed:
                keys = list(list_objects(BUCKET, runs[run_id]))
                if not all(MANAGED_KEY.match(k) for k in keys):
                    raise RuntimeError(f"refusing to delete unmanaged keys under {runs[run_id]}")
                log(f"  {'deleting' if apply else 'would delete'} {runs[run_id]} ({len(keys)} objects)")
                if apply:
                    for i in range(0, len(keys), 1000):
                        batch = [{"Key": k} for k in keys[i:i + 1000]]
                        r = s3().delete_objects(Bucket=BUCKET, Delete={"Objects": batch, "Quiet": True})
                        if r.get("Errors"):
                            raise RuntimeError(f"delete failed: {r['Errors'][:3]}")
            report.append({"kind": kind, "tier": tier, "runs": len(states), "deleted": doomed if apply else [],
                           "would_delete": doomed if not apply else []})
    return report


def write_status(status):
    tmp = STATUS_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(status, f, indent=2, sort_keys=True)
    os.replace(tmp, STATUS_FILE)


def nightly(dry_run_retention):
    start = now()
    run_id = f"{start:%Y%m%dT%H%M%SZ}-{secrets.token_hex(4)}"
    status = {"run_id": run_id, "job_version": JOB_VERSION, "start_utc": iso(start), "status": "FAILED", "errors": []}
    log(f"run {run_id} started")

    pg = backup_postgres(run_id, start)
    mi = snapshot_minio(run_id, start)
    status["postgresql"] = {k: pg.get(k) for k in ("status", "prefix", "dump_size_bytes", "dump_sha256",
                                                    "globals_sha256", "table_count", "validation", "errors")}
    status["minio_objects"] = {k: mi.get(k) for k in ("status", "prefix", "source_object_count", "dest_object_count",
                                                       "source_total_bytes", "dest_total_bytes", "etags_compared",
                                                       "discrepancies", "errors")}
    status["errors"] += pg["errors"] + mi["errors"]
    if pg["status"] == "SUCCESS" and mi["status"] == "SUCCESS":
        try:
            status["promoted"] = {"postgresql": promote("postgresql", run_id, start),
                                  "minio_objects": promote("minio-objects", run_id, start)}
            status["retention"] = retention(apply=not dry_run_retention)
            status["status"] = "SUCCESS"
        except Exception as e:
            status["errors"].append(f"promotion/retention failed: {e}")
    else:
        status["errors"].append("retention skipped because a backup failed")

    end = now()
    status["end_utc"], status["duration_seconds"] = iso(end), round((end - start).total_seconds(), 1)
    try:
        write_status(status)
        s3().put_object(Bucket=BUCKET, Key=f"logs/backup-history/{start:%Y/%m}/{run_id}.json",
                        ContentType="application/json", Body=json.dumps(status, indent=2, sort_keys=True).encode())
    except Exception as e:
        status["status"] = "FAILED"
        status["errors"].append(f"status write failed: {e}")
    log(f"run {run_id} {status['status']} in {status['duration_seconds']}s "
        f"postgresql={pg['status']} minio={mi['status']} errors={len(status['errors'])}")
    for err in status["errors"]:
        log(f"ERROR {err}")
    return 0 if status["status"] == "SUCCESS" else 1


def latest_success(kind):
    runs, states = discover_runs(kind, "daily")
    good = sorted((r for r, ok in states if ok), reverse=True)
    if not good:
        raise SystemExit(f"no successful {kind} backup found")
    return runs[good[0]]


def restore_check():
    """Restore representative objects from the newest snapshot into a temp dir, never over production."""
    prefix = latest_success("minio-objects")
    manifest = json.loads(s3().get_object(Bucket=BUCKET, Key=prefix + "manifest.json")["Body"].read())
    objects = sorted(manifest["objects"], key=lambda o: o["size"])
    by_area = {o["key"].split("/")[0]: o for o in objects}
    sample = {o["key"]: o for o in [objects[0], objects[-1], *by_area.values()]}
    failures = 0
    with tempfile.TemporaryDirectory() as work:
        for i, o in enumerate(sample.values()):
            key = prefix + SOURCE_BUCKET + "/" + o["key"]
            local = f"{work}/{i}"
            s3().download_file(BUCKET, key, local)
            head = s3().head_object(Bucket=BUCKET, Key=key)
            url = s3().generate_presigned_url("get_object", Params={"Bucket": BUCKET, "Key": key}, ExpiresIn=60)
            with urllib.request.urlopen(url, timeout=30) as resp:
                served = resp.read()
                served_type = resp.headers.get("Content-Type")
            ok = (os.path.getsize(local) == o["size"] and sha256_file(local) == o["sha256"]
                  and hashlib.sha256(served).hexdigest() == o["sha256"] and served_type == o["content_type"]
                  and head.get("Metadata") == o["metadata"])
            failures += not ok
            log(f"restore-check {'OK' if ok else 'FAILED'} area={o['key'].split('/')[0]} size={o['size']} type={served_type}")
    log(f"restore-check from {prefix}: {len(sample)} objects, {failures} failures")
    return 1 if failures else 0


def health():
    try:
        with open(STATUS_FILE) as f:
            status = json.load(f)
    except OSError:
        print("no backup status yet")
        return 1
    ended = dt.datetime.strptime(status["end_utc"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc)
    age = (now() - ended).total_seconds() / 3600
    print(f"last run {status['run_id']} {status['status']} {age:.1f}h ago")
    return 0 if status["status"] == "SUCCESS" and age < MAX_STATUS_AGE_HOURS else 1


def main(argv):
    cmd = argv[1] if len(argv) > 1 else ""
    if cmd == "nightly":
        return nightly("--dry-run-retention" in argv)
    if cmd == "retention":
        retention(apply="--apply" in argv)
        return 0
    if cmd == "restore-check":
        return restore_check()
    if cmd == "latest-pg":
        print(latest_success("postgresql"))
        return 0
    if cmd == "health":
        return health()
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
