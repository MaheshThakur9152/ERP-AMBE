# Supabase Database Backup & Restore Guide

This document describes how to download, decrypt, and restore a database backup created by the automated GitHub Action.

---

## Prerequisites

- [GitHub CLI (`gh`)](https://cli.github.com/) authenticated with repo access (`gh auth login`).
- [GnuPG (`gpg`)](https://gnupg.org/).
- `tar` utility.
- [PostgreSQL client (`psql`)](https://www.postgresql.org/download/).

---

## 1. Download Backup Asset

List available backup releases:
```bash
gh release list
```

Download the encrypted asset for a specific date (replace `YYYY-MM-DD` with actual date):
```bash
TAG="backup-YYYY-MM-DD"
gh release download "$TAG" --pattern "*.tar.gz.gpg"
```

---

## 2. Decrypt Archive

Decrypt the `.tar.gz.gpg` archive using your `BACKUP_ENCRYPTION_KEY`:

```bash
gpg --batch --decrypt --passphrase "YOUR_BACKUP_ENCRYPTION_KEY" \
  --output "backup-YYYY-MM-DD.tar.gz" "backup-YYYY-MM-DD.tar.gz.gpg"
```

---

## 3. Extract Archive

Extract the unencrypted tarball:

```bash
tar -xzf "backup-YYYY-MM-DD.tar.gz"
cd "backup-YYYY-MM-DD"
```

The directory contains three SQL dump files:
- `roles.sql` - Database user roles and permissions.
- `schema.sql` - Table definitions, constraints, triggers, indexes, and extensions.
- `data.sql` - Table data records (`COPY` format).

---

## 4. Restore to Postgres

> [!CAUTION]
> Restoring will overwrite or modify existing schema and records. Ensure you target the correct database connection string.

Execute the dumps in strict sequential order:

```bash
TARGET_DB_URL="postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres?sslmode=require"

# Step 1: Roles
psql "$TARGET_DB_URL" -f roles.sql

# Step 2: Schema
psql "$TARGET_DB_URL" -f schema.sql

# Step 3: Data
psql "$TARGET_DB_URL" -f data.sql
```

---

## 5. Post-Restore Cleanup

Remove decrypted sensitive SQL files and tarball from your local environment:

```bash
cd ..
rm -rf "backup-YYYY-MM-DD" "backup-YYYY-MM-DD.tar.gz"
```
