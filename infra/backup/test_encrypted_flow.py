#!/usr/bin/python3
"""Encrypted snapshot and retention guard against an in-memory S3, with a throwaway key.

Touches no bucket. Run: docker exec -i erp-backup python3 - < infra/backup/test_encrypted_flow.py
"""
import io
import json
import os
import shutil
import sys
import tarfile
import tempfile

sys.path.insert(0, "/usr/local/bin")
import erp_backup as erp  # noqa: E402


class FakeS3:
    class exceptions:
        class NoSuchKey(Exception):
            pass

    def __init__(self):
        self.store = {}

    def get_paginator(self, _):
        fake = self

        class P:
            def paginate(self, Bucket, Prefix=""):
                yield {"Contents": [{"Key": k[1], "Size": len(v), "ETag": '"e"'}
                                    for k, v in sorted(fake.store.items()) if k[0] == Bucket and k[1].startswith(Prefix)]}
        return P()

    def get_object(self, Bucket, Key):
        if (Bucket, Key) not in self.store:
            raise self.exceptions.NoSuchKey()
        return {"Body": io.BytesIO(self.store[(Bucket, Key)]), "ContentType": "application/pdf", "Metadata": {}}

    def put_object(self, Bucket, Key, Body, **_):
        self.store[(Bucket, Key)] = Body

    def upload_file(self, src, Bucket, Key):
        self.store[(Bucket, Key)] = open(src, "rb").read()

    def download_file(self, Bucket, Key, dest):
        open(dest, "wb").write(self.store[(Bucket, Key)])

    def delete_objects(self, Bucket, Delete):
        for o in Delete["Objects"]:
            del self.store[(Bucket, o["Key"])]
        return {}


fake = FakeS3()
erp.s3 = lambda: fake
work = tempfile.mkdtemp()
try:
    home = f"{work}/gnupg"
    os.mkdir(home, 0o700)
    gpg = ["gpg", "--homedir", home, "--batch", "--pinentry-mode", "loopback", "--passphrase", ""]
    erp.run([*gpg, "--quick-generate-key", "flow-test", "default", "default", "never"])
    key = f"{work}/public.asc"
    erp.run([*gpg, "--armor", "--output", key, "--export"])
    erp.PUBLIC_KEY_FILE = key

    bodies = {"employees/a.pdf": b"alpha" * 100, "invoices/b.pdf": b"beta" * 100}
    for k, v in bodies.items():
        fake.store[(erp.SOURCE_BUCKET, k)] = v
    prefix = "minio-objects/daily/2026/11/09/20261109T000000Z-new/"
    m = {"discrepancies": [], "errors": [], "status": "FAILED"}
    erp.encrypted_snapshot(m, prefix, erp.list_objects(erp.SOURCE_BUCKET), (key, "FPR"))
    assert m["status"] == "SUCCESS" and m["dest_object_count"] == 2, m
    assert (erp.BUCKET, prefix + "objects.json.gpg") in fake.store
    assert not any(k[1].endswith(".pdf") and k[0] == erp.BUCKET for k in fake.store), "plaintext object uploaded"
    cipher = f"{work}/t.gpg"
    open(cipher, "wb").write(fake.store[(erp.BUCKET, prefix + "ambeuploads.tar.gpg")])
    assert b"alpha" not in open(cipher, "rb").read()
    erp.run([*gpg, "--output", f"{work}/t", "--decrypt", cipher])
    with tarfile.open(f"{work}/t") as tar:
        assert {k: tar.extractfile(k).read() for k in bodies} == bodies
    print("ok  encrypted snapshot uploads only ciphertext and decrypts to the original")

    # 16 plaintext runs followed by one encrypted run: retention must not expire plaintext yet.
    def add(run_id, mode):
        p = f"postgresql/daily/2026/11/09/{run_id}/"
        fake.store[(erp.BUCKET, p + "manifest.json")] = json.dumps({"status": "SUCCESS", "encryption": {"mode": mode}}).encode()

    for i in range(1, 17):
        add(f"r{i:02d}", "none")
    add("r17", "gpg-public-key")
    count = lambda: len(erp.discover_runs("postgresql", "daily")[0])
    erp.retention(apply=True)
    assert count() == 17, "plaintext run deleted before encrypted restore was proven"
    print("ok  plaintext runs kept until the restore marker exists")
    fake.store[(erp.BUCKET, erp.RESTORE_VERIFIED_MARKER)] = b"verified"
    erp.retention(apply=True)
    assert count() == 14, count()
    print("ok  retention resumes after the marker")
    print("ALL PASSED")
finally:
    shutil.rmtree(work)
