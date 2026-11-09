#!/usr/bin/env python3
"""Self-check for retention planning. Run: python3 infra/backup/test_erp_backup.py"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from erp_backup import MANAGED_KEY, plan_retention  # noqa: E402

runs = [(f"r{i:02d}", True) for i in range(1, 21)]

# Keeps the newest 14 of 20, deletes only the 6 oldest.
assert plan_retention(runs, 14) == [f"r{i:02d}" for i in range(1, 7)]
# Too few successes: nothing is deleted.
assert plan_retention(runs[:14], 14) == []
# Failed runs never count towards the kept set.
mixed = [("r01", True), ("r02", False), ("r03", True), ("r04", False), ("r05", False)]
assert plan_retention(mixed, 1) == ["r01", "r02"]
assert plan_retention(mixed, 2) == []
# Failures newer than the cutoff stay for inspection, and the latest success always survives.
assert "r03" not in plan_retention(mixed, 1)
try:
    plan_retention(runs, 0)
    raise AssertionError("keep=0 must be rejected")
except ValueError:
    pass

# Retention can only ever match managed run prefixes.
assert MANAGED_KEY.match("postgresql/daily/2026/11/09/run/database.dump")
assert MANAGED_KEY.match("minio-objects/monthly/2026/11/09/run/ambeuploads/a.pdf")
for other in ("ambeuploads/a.pdf", "wal/0001.gpg", "logs/backup-history/2026/11/r.json", "postgresql/daily/x.dump"):
    assert not MANAGED_KEY.match(other), other

print("ok")
