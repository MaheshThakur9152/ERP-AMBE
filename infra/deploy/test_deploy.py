#!/usr/bin/env python3
"""Dry-run tests for the deploy workflow script. Uses a throwaway repo and stubbed docker/curl/sleep.

Run from the repository root: python3 infra/deploy/test_deploy.py
"""
import os
import stat
import subprocess
import tempfile

import yaml

WF = yaml.safe_load(open(".github/workflows/deploy.yml"))
SCRIPT = WF["jobs"]["deploy"]["steps"][0]["with"]["script"]

# Event handling lives in workflow expressions, so assert them directly.
assert WF["env"]["DEPLOY_SHA"] == "${{ github.event_name == 'push' && github.sha || inputs.commit }}"
assert WF["jobs"]["verify"]["steps"][0]["with"]["ref"] == "${{ env.DEPLOY_SHA }}"
assert WF[True]["push"]["branches"] == ["master"], "push trigger"
assert WF[True]["workflow_dispatch"]["inputs"]["commit"]["required"] is True, "manual trigger"
gate = WF["jobs"]["deploy"]["if"]
assert gate == "github.event_name == 'workflow_dispatch' || vars.AUTO_DEPLOY_ON_PUSH == 'true'", "push must not deploy"
assert "reset --hard" not in SCRIPT and "down" not in SCRIPT.split() and "-v" not in SCRIPT.split()
print("ok  push trigger: uses github.sha, deploy job gated off by default")
print("ok  manual trigger: uses inputs.commit")


def sh(*args, cwd):
    return subprocess.run(args, cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def commit(repo, path, msg):
    full = os.path.join(repo, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "a") as f:
        f.write(msg + "\n")
    sh("git", "add", "-A", cwd=repo)
    sh("git", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", msg, cwd=repo)
    sh("git", "push", "-q", "origin", "HEAD:master", cwd=repo)
    return sh("git", "rev-parse", "HEAD", cwd=repo)


def stub(bindir, name, body):
    path = os.path.join(bindir, name)
    with open(path, "w") as f:
        f.write("#!/bin/bash\n" + body)
    os.chmod(path, os.stat(path).st_mode | stat.S_IEXEC)


class Sandbox:
    def __init__(self, root):
        self.root = root
        self.bare, self.repo, self.work, self.bin = (os.path.join(root, d) for d in ("o.git", "srv", "dev", "bin"))
        os.mkdir(self.bin)
        self.calls = os.path.join(root, "calls")
        self.hist = os.path.join(root, "history")
        sh("git", "init", "-q", "--bare", "-b", "master", self.bare, cwd=root)
        sh("git", "clone", "-q", self.bare, self.work, cwd=root)
        sh("git", "checkout", "-q", "-b", "master", cwd=self.work)
        self.base = commit(self.work, "README", "base")
        sh("git", "clone", "-q", self.bare, self.repo, cwd=root)
        open(os.path.join(self.repo, ".env"), "w").close()
        stub(self.bin, "docker",
             f'echo "docker $*" >> {self.calls}\n'
             'if [ "$1" = inspect ]; then echo "${FAKE_HEALTH:-healthy}"; fi\n')
        stub(self.bin, "curl", f'echo "curl $*" >> {self.calls}\nexit ${{FAKE_CURL:-0}}\n')
        stub(self.bin, "sleep", "exit 0\n")

    def deploy(self, sha, rollback="false", **extra):
        open(self.calls, "w").close()
        env = dict(os.environ, PATH=f"{self.bin}:{os.environ['PATH']}", DEPLOY_SHA=sha, DEPLOY_ROLLBACK=rollback,
                   DEPLOY_ROOT=self.repo, DEPLOY_HISTORY=self.hist, **extra)
        return subprocess.run(["bash", "-c", SCRIPT], env=env, capture_output=True, text=True)

    def head(self):
        return sh("git", "rev-parse", "HEAD", cwd=self.repo)

    def built(self):
        return [l for l in open(self.calls).read().splitlines() if "--build" in l]


def scenario(name, fn):
    with tempfile.TemporaryDirectory() as root:
        fn(Sandbox(root))
    print("ok ", name)


def invalid_sha(s):
    before = s.head()
    r = s.deploy("abc123")
    assert r.returncode != 0 and "40-character" in r.stderr and s.head() == before


def unknown_sha(s):
    r = s.deploy("a" * 40)
    assert r.returncode != 0 and "does not exist" in r.stderr


def dirty(s):
    new = commit(s.work, "backend/a", "b1")
    with open(os.path.join(s.repo, "README"), "a") as f:
        f.write("local edit\n")
    before = s.head()
    r = s.deploy(new)
    assert r.returncode != 0 and "uncommitted" in r.stderr and s.head() == before
    assert "local edit" in open(os.path.join(s.repo, "README")).read()
    assert not s.built()


def only(path, service):
    def run(s):
        new = commit(s.work, path, "change")
        r = s.deploy(new)
        assert r.returncode == 0, r.stderr
        assert s.head() == new
        assert s.built() == [f"docker compose up -d --build --no-deps {service}"], s.built()
        assert "OK" in open(s.hist).read()
    return run


def docs_only(s):
    new = commit(s.work, "docs/a", "docs")
    assert s.deploy(new).returncode == 0 and not s.built()


def health_container(s):
    new = commit(s.work, "backend/a", "b1")
    r = s.deploy(new, FAKE_HEALTH="unhealthy")
    assert r.returncode != 0 and "did not become healthy" in r.stderr and f"commit={s.base}" in r.stderr
    assert "FAILED" in open(s.hist).read()
    assert "image prune" not in open(s.calls).read()


def health_http(s):
    new = commit(s.work, "frontend/a", "f1")
    r = s.deploy(new, FAKE_CURL="22")
    assert r.returncode != 0 and "health failed" in r.stderr and "FAILED" in open(s.hist).read()


def older_refused_then_rollback(s):
    new = commit(s.work, "backend/a", "b1")
    assert s.deploy(new).returncode == 0
    r = s.deploy(s.base)
    assert r.returncode != 0 and "rollback=true" in r.stderr and s.head() == new
    r = s.deploy(s.base, rollback="true")
    assert r.returncode == 0, r.stderr
    assert s.head() == s.base
    assert s.deploy(new).returncode == 0 and s.head() == new


def not_on_master(s):
    new = commit(s.work, "backend/a", "b1")
    sh("git", "checkout", "-q", "-b", "local-work", cwd=s.repo)
    r = s.deploy(new)
    assert r.returncode != 0 and "expected master" in r.stderr


def local_only_commit(s):
    new = commit(s.work, "backend/a", "b1")
    with open(os.path.join(s.repo, "local"), "w") as f:
        f.write("x")
    sh("git", "add", "-A", cwd=s.repo)
    sh("git", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "local", cwd=s.repo)
    r = s.deploy(new)
    assert r.returncode != 0 and "not on origin/master" in r.stderr


def same_commit(s):
    r = s.deploy(s.base)
    assert r.returncode == 0 and "nothing to deploy" in r.stdout and not s.built()


for name, fn in [
    ("invalid SHA rejected, tree untouched", invalid_sha),
    ("unknown SHA rejected", unknown_sha),
    ("dirty working tree rejected, edit preserved", dirty),
    ("backend-only rebuilds backend only", only("backend/a", "backend")),
    ("frontend-only rebuilds frontend only", only("frontend/a", "frontend")),
    ("backup-only rebuilds backup only", only("infra/backup/a", "backup")),
    ("docs-only rebuilds nothing", docs_only),
    ("failed container health stops with rollback hint", health_container),
    ("failed HTTP health stops with rollback hint", health_http),
    ("older commit refused, explicit rollback works, forward again", older_refused_then_rollback),
    ("named branch on server rejected", not_on_master),
    ("unpushed server commit rejected", local_only_commit),
    ("already deployed is a no-op", same_commit),
]:
    scenario(name, fn)
print("ALL PASSED")
