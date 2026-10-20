# 07 — Object Storage Migration & File Integrity Plan

**Objective:** Standardize all file storage onto an S3-compatible API (MinIO / AWS S3 / Cloudflare R2), purge fragmented legacy storage providers (Google Drive, GCP), and ensure 100% of database file metadata references valid, decryptable objects.

---

## 1. Storage Fragmentation Audit

Forensic inspection of `backend/src/services/` and `documentController.ts` reveals storage fragmentation across three distinct providers:
1. **MinIO / Oracle Object Storage (`oracleStorageService.ts`):** Active S3-compatible storage client (`@aws-sdk/client-s3`). This is the primary modern storage path.
2. **Google Cloud Storage (`gcpStorageService.ts`):** Legacy storage connector with service account credentials (`@google-cloud/storage`).
3. **Google Drive (`googleDriveService.ts`):** Legacy Google OAuth connector with client secret and refresh tokens (`googleapis`).

```text
CURRENT FRAGMENTED STATE:
employee_documents ──► storage_provider: 'minio' | 'gcp' | 'drive'
site_documents     ──► storage_provider: 'minio' | 'gcp' | 'drive'
invoices           ──► storage_provider: 'minio' | null

TARGET UNIFIED STATE:
All Document Entities ──► S3-Compatible API (MinIO Local / AWS S3 / Cloudflare R2 Production)
                          • Storage Key: tenant-partitioned
                          • Access: 60-Minute Pre-signed Read URLs
                          • Deletion: S3 DeleteObjectCommand + DB Soft Delete
```

---

## 2. Target S3-Compatible Bucket Hierarchy

All files are structured predictably with tenant and entity namespaces:

```text
ambe-erp-documents/ (Bucket)
│
├── {company_id}/
│   │
│   ├── employees/
│   │   └── {staff_id}/
│   │       ├── aadhar_card_{uuid}.pdf
│   │       ├── pan_card_{uuid}.jpg
│   │       └── bank_passbook_{uuid}.pdf
│   │
│   ├── sites/
│   │   └── {site_id}/
│   │       ├── agreement_{year}_{uuid}.pdf
│   │       └── site_instruction_{uuid}.pdf
│   │
│   ├── invoices/
│   │   └── {year}-{month}/
│   │       ├── TaxInvoice_{invoice_no}.pdf
│   │       ├── CertifiedDoc_{invoice_no}.pdf
│   │       └── CertifiedAttendance_{invoice_no}.pdf
│   │
│   └── company/
│       ├── gstin_certificate.pdf
│       └── logo.png
```

---

## 3. Storage Migration Runbook (File Synchronization)

To migrate all historical objects from Google Drive / GCP to the target S3 bucket:

```bash
# ==============================================================================
# Step 1: Use Rclone or AWS CLI to mirror legacy files to target MinIO / S3
# ==============================================================================

# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure rclone for target MinIO:
cat << 'EOF' >> ~/.config/rclone/rclone.conf
[target-minio]
type = s3
provider = Minio
env_auth = false
access_key_id = minioadmin
secret_access_key = minioadmin123
endpoint = http://localhost:9000
EOF

# Sync legacy files into target bucket:
rclone sync /var/www/ambeservice/legacy-uploads target-minio:ambeuploads/ --progress
```

---

## 4. File Verification & Dead Reference Audit Script

Before cutting over, verify that every storage key in PostgreSQL exists in the object store:

```typescript
// Script: verify_storage_integrity.ts
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { db } from '../db/pool';

async function verifyStorageIntegrity() {
  const s3 = new S3Client({ /* S3 Config */ });
  const bucket = process.env.MINIO_BUCKET || 'ambeuploads';

  const { rows } = await db.query(`
    SELECT 'employee' AS type, id, storage_key FROM employee_documents WHERE storage_key IS NOT NULL
    UNION ALL
    SELECT 'site' AS type, id, storage_key FROM site_documents WHERE storage_key IS NOT NULL
    UNION ALL
    SELECT 'invoice' AS type, id, storage_key FROM invoices WHERE storage_key IS NOT NULL
  `);

  let missingCount = 0;
  for (const row of rows) {
    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: row.storage_key }));
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        console.error(`🚨 [MISSING OBJECT] Table=${row.type} ID=${row.id} Key=${row.storage_key}`);
        missingCount++;
      }
    }
  }

  console.log(`Verification Complete. Total Checked: ${rows.length}, Missing: ${missingCount}`);
}
```
