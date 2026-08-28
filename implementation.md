# File Upload Implementation Architecture & Storage Trace

This document details the end-to-end implementation of file uploads across the codebase, covering API entry points, compression pipelines, Google Cloud Storage & Google Drive integrations, database schemas, retrieval mechanisms, error handling, and migration considerations.

---

## 1. Upload Entry Points

All file uploads enter through Express routes with `multer` memory storage, magic-byte validation, and Zod schema normalization.

| Route / Endpoint | HTTP Method | Auth / RBAC | Request Format | Validation & Constraints | Controller / Service Handler |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/documents/upload` | `POST` | `requireAuth` | `multipart/form-data` (`file` field + metadata) | **Max:** 10MB.<br>**MIME:** `image/jpeg`, `image/png`, `application/pdf`, `image/webp`.<br>**Magic bytes:** Verified via `validateFileMagicBytes`. | [`uploadDocument`](file:///d:/Ambe%20Erm/backend/src/controllers/documentController.ts#L15) in `documentController.ts` |
| `/api/documents/company-invoice` | `POST` | `requireAuth`, `requireAdmin` | `multipart/form-data` (`file` field + metadata) | **Max:** 10MB.<br>**MIME:** `image/jpeg`, `image/png`, `application/pdf`, `image/webp`.<br>**Magic bytes:** Verified. | [`uploadCompanyInvoiceDocument`](file:///d:/Ambe%20Erm/backend/src/controllers/documentController.ts#L113) in `documentController.ts` |
| `/api/documents/invoice-direct`<br>*(also mounted as `/api/invoices/upload`)* | `POST` | `requireAuth`, `requireAdmin` | `multipart/form-data` (`file` field + metadata) | **Max:** 10MB.<br>**MIME:** `image/jpeg`, `image/png`, `application/pdf`, `image/webp`.<br>**Magic bytes:** Verified. | [`uploadInvoiceDirect`](file:///d:/Ambe%20Erm/backend/src/controllers/documentController.ts#L186) in `documentController.ts` |
| `/api/documents/upload-site`<br>*(also `/api/documents/site-document`)* | `POST` | `requireAuth`, `requireAdmin` | `multipart/form-data` (`file` field + metadata) | **Max:** 10MB.<br>**MIME:** `image/jpeg`, `image/png`, `application/pdf`, `image/webp`.<br>**Magic bytes:** Verified. | [`uploadSiteDocumentGlobal`](file:///d:/Ambe%20Erm/backend/src/controllers/documentController.ts#L343) -> `SiteService.uploadSiteDocument` |
| `/api/sites/:siteId/documents` | `POST` | `requireAuth`, `requireAdmin` | `multipart/form-data` (`file` field + metadata) | **Max:** 10MB.<br>**MIME:** `image/jpeg`, `image/png`, `application/pdf`, `image/webp`.<br>**Magic bytes:** Verified. | [`SiteController.uploadDocument`](file:///d:/Ambe%20Erm/backend/src/controllers/siteController.ts) -> `SiteService.uploadSiteDocument` |

### Validation Logic
1. **Multer File Filter & Limits** ([documentRoutes.ts#L17-29](file:///d:/Ambe%20Erm/backend/src/routes/documentRoutes.ts#L17-L29)):
   ```typescript
   const upload = multer({
     storage: multer.memoryStorage(),
     limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
     fileFilter: (_req, file, cb) => {
       if (ALLOWED_MIME_TYPES.includes(file.mimetype)) cb(null, true);
       else cb(new Error(`File type ${file.mimetype} not allowed.`));
     },
   });
   ```
2. **Magic Byte Signature Inspection** ([fileValidator.ts#L12-65](file:///d:/Ambe%20Erm/backend/src/middlewares/fileValidator.ts#L12-L65)):
   Inspects the initial buffer bytes before controller execution:
   - JPEG: `FF D8 FF`
   - PNG: `89 50 4E 47`
   - PDF: `25 50 44 46` (`%PDF`)
   - WEBP: `52 49 46 46` (`RIFF`) + offset 8 `WEBP`

---

## 2. Upload Flow (Step by Step)

```
[Client UI] 
   │ (multipart/form-data with Bearer token)
   ▼
[Express Router: /api/documents/*]
   │ 1. requireAuth / requireAdmin (JWT Verification)
   │ 2. multer.memoryStorage() (Buffers entire file in RAM as req.file.buffer)
   │ 3. validateFileMagicBytes (Inspects buffer byte signatures)
   │ 4. Zod Schema Validation (Transforms & sanitizes metadata)
   ▼
[Controller / Service]
   │
   ├──▶ [SiteService / CompressionService]
   │       ├── Images: Sharp resize (max 2000px, 80% quality)
   │       └── PDFs: Ghostscript / pdf-lib compression
   │
   ├──▶ [GCPStorageService] (Primary for site documents)
   │       └── Bucket WriteStream -> GCP signed URL (7-day TTL)
   │
   ├──▶ [GoogleDriveService] (Primary for staff & invoice docs, backup for site docs)
   │       ├── getOrCreateDriveFolder (Recursive Drive API folder lookups/creations)
   │       └── drive.files.create({ media: { body: ReadableStream } }) -> webViewLink
   │
   ▼
[Supabase PostgreSQL DB]
   └── supabaseAdmin.from('..._documents').insert({ file_name, gcp_file_url, ... })
   │
   ▼
[Client Response]
   └── JSON { success: true, gcp_file_url, file_name, document: { id, ... } }
```

### Buffering & Streaming Behavior
- Files are **not written to local disk** during uploads. They are held in Node.js memory (`multer.memoryStorage()`).
- In `CompressionService`, PDF compression with Ghostscript creates short-lived temporary files in `os.tmpdir()` (`gs_in_*.pdf`, `gs_out_*.pdf`) cleaned up via `finally` block ([compressionService.ts#L58-91](file:///d:/Ambe%20Erm/backend/src/services/compressionService.ts#L58-L91)).
- Files are streamed from Node.js memory buffers into Google Drive / GCP using `Readable.from(fileBuffer)` or `blob.createWriteStream()`.
- **No chunked or resumable uploads** are implemented (GCP `resumable: false` is hardcoded).

---

## 3. Storage Backend Integration

### Libraries & Versions
From [backend/package.json](file:///d:/Ambe%20Erm/backend/package.json#L12-L26):
- `@google-cloud/storage`: `^7.22.0`
- `googleapis`: `^174.0.1`
- `multer`: `^2.2.0`
- `sharp`: `^0.35.4`
- `pdf-lib`: `^1.17.1`

### Authentication & Secrets Configuration
Loaded from environment variables ([env.ts#L6-24](file:///d:/Ambe%20Erm/backend/src/config/env.ts#L6-L24)):

1. **Google Drive (OAuth2 Refresh Token)**:
   ```typescript
   // googleDriveService.ts:L6-18
   const oauth2Client = new google.auth.OAuth2(
     env.GOOGLE_CLIENT_ID,
     env.GOOGLE_CLIENT_SECRET,
     env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
   );
   oauth2Client.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN });
   const drive = google.drive({ version: 'v3', auth: oauth2Client });
   ```
2. **Google Cloud Storage (Service Account)**:
   Supports inline credentials (`GCP_CLIENT_EMAIL` + `GCP_PRIVATE_KEY`), raw/base64 JSON key string (`GCP_SERVICE_ACCOUNT_KEY`), or key file path ([gcpStorageService.ts#L4-42](file:///d:/Ambe%20Erm/backend/src/services/gcpStorageService.ts#L4-L42)).

### Exact API Calls Made
- **Google Drive API (`googleapis.drive('v3')`)**:
  - `drive.files.list({ q, fields: 'files(id, name)', spaces: 'drive' })`: Search for nested directory folders ([googleDriveService.ts#L27-31](file:///d:/Ambe%20Erm/backend/src/services/googleDriveService.ts#L27-L31)).
  - `drive.files.create({ requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents } })`: Create missing directory folders ([googleDriveService.ts#L38-45](file:///d:/Ambe%20Erm/backend/src/services/googleDriveService.ts#L38-L45)).
  - `drive.files.create({ requestBody: { name, parents }, media: { mimeType, body: stream }, fields: 'id, name, webViewLink' })`: Stream file upload and obtain web viewing link ([googleDriveService.ts#L104-114](file:///d:/Ambe%20Erm/backend/src/services/googleDriveService.ts#L104-L114)).
- **Google Cloud Storage (`@google-cloud/storage`)**:
  - `blob.createWriteStream({ resumable: false, contentType })`: Write buffer directly to bucket object ([gcpStorageService.ts#L61-88](file:///d:/Ambe%20Erm/backend/src/services/gcpStorageService.ts#L61-L88)).
  - `blob.getSignedUrl({ action: 'read', expires })`: Generate signed read URL with 1-hour or 7-day TTL ([gcpStorageService.ts#L73-76](file:///d:/Ambe%20Erm/backend/src/services/gcpStorageService.ts#L73-L76)).

### Drive Directory Layout Built Automatically
- **Employee Documents**: `DRIVE_EMPLOYEE_FOLDER_ID` -> `[Site Name]` -> `[Designation]` -> `[Employee Name]` -> `[File]`
- **Company Documents**: `DRIVE_INVOICE_FOLDER_ID` -> `[Entity (e.g. Ambe)]` -> `[Year]` -> `[Month]` -> `[File]`
- **Site Documents**: `DRIVE_SITE_FOLDER_ID` -> `[Site Name]` -> `[File]`

---

## 4. Data Model

Files and their URLs are stored in Supabase PostgreSQL tables:

### 1. `public.employee_documents`
```sql
CREATE TABLE public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  document_type text NOT NULL, -- e.g. 'Aadhaar Card', 'PAN Card', 'Bank Passbook', 'UAN Card', 'ESIC Card'
  file_name text NOT NULL,
  gcp_file_url text NOT NULL, -- Holds Google Drive webViewLink or GCP URL
  uploaded_at timestamptz DEFAULT now()
);
```

### 2. `public.company_documents`
```sql
CREATE TABLE public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text DEFAULT 'Ambe',
  doc_type text DEFAULT 'Tax Invoice',
  month text NOT NULL,
  year text NOT NULL,
  site_name text,
  file_name text NOT NULL,
  gcp_file_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### 3. `public.site_documents`
```sql
CREATE TABLE public.site_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  document_type text NOT NULL, -- e.g. 'Work Order', 'Agreement', 'License', 'Other'
  document_label text,
  file_name text NOT NULL,
  gcp_file_url text NOT NULL,
  uploaded_at timestamptz DEFAULT now()
);
```

### 4. `public.invoices`
Contains direct attachment URL columns:
- `certified_doc_url` (`text`): Direct Google Drive webViewLink for certified invoices.
- `generated_pdf_url` (`text`): Direct Google Drive webViewLink for system-generated PDFs.
- `certified_attendance_url` (`text`): Direct Google Drive webViewLink for certified attendance sheets.

*Note: There is no soft-delete or built-in file versioning. New uploads create new records or overwrite invoice URL fields.*

---

## 5. Retrieval & Download Flow

- **Direct Web Links**: Files are not proxied through the backend on read. The database stores the Google Drive `webViewLink` (or GCP Signed URL) inside `gcp_file_url`.
- **Frontend Presentation**:
  - In [StaffPage.tsx](file:///d:/Ambe%20Erm/frontend/src/pages/StaffPage.tsx), [EmployeeDocuments.tsx](file:///d:/Ambe%20Erm/frontend/src/pages/EmployeeDocuments.tsx), and [InvoiceVault.tsx](file:///d:/Ambe%20Erm/frontend/src/pages/InvoiceVault.tsx), the UI provides an `<a href={doc.gcp_file_url} target="_blank" rel="noopener noreferrer">View</a>` anchor tag.
  - Clicking this link opens the document directly in Google Drive preview or GCP signed viewer.
- **Backend Stream Method**: `GoogleDriveService.streamFile(fileId)` ([googleDriveService.ts#L268-274](file:///d:/Ambe%20Erm/backend/src/services/googleDriveService.ts#L268-L274)) is implemented with `alt=media`, but no public download router binds to it.
- **Caching**: No HTTP caching or CDN proxy layer exists between the user and Google Drive / GCP URLs.

---

## 6. Error Handling & Edge Cases

1. **Storage Failures**:
   - If Google Drive API errors out (invalid refresh token, 403 quota exceeded), the controller catches the error, logs it to console, and returns HTTP 500 (`{ error: 'Failed to upload' }`).
   - If GCP signed URL generation fails in `GCPStorageService.uploadSiteDocument`, it falls back to raw public URL: `https://storage.googleapis.com/${bucketName}/${destinationPath}` ([gcpStorageService.ts#L130-134](file:///d:/Ambe%20Erm/backend/src/services/gcpStorageService.ts#L130-L134)).
2. **Metadata DB Failure**:
   - If the file is uploaded to Drive/GCP successfully but the Supabase DB insertion fails, the backend logs the DB error and returns HTTP 500 with the storage URL included in the body for debugging ([documentController.ts#L90-96](file:///d:/Ambe%20Erm/backend/src/controllers/documentController.ts#L90-L96)).
3. **No Automatic Rollback / Garbage Collection**:
   - If DB insertion fails after a successful Drive/GCP file upload, the uploaded file remains orphaned in Drive/GCS.

---

## 7. Dependencies on Google/GCP Specifically

If migrating to an alternative storage backend (e.g. MinIO, S3-compatible Oracle Cloud Object Storage, or local disk):

### Files Requiring Modification:
1. **[backend/src/services/googleDriveService.ts](file:///d:/Ambe%20Erm/backend/src/services/googleDriveService.ts)**: Entire service is Google Drive API v3 specific (`drive.files.create`, `getOrCreateDriveFolder`).
2. **[backend/src/services/gcpStorageService.ts](file:///d:/Ambe%20Erm/backend/src/services/gcpStorageService.ts)**: Entire service uses `@google-cloud/storage`.
3. **[backend/src/services/siteService.ts](file:///d:/Ambe%20Erm/backend/src/services/siteService.ts)**: Imports both `GCPStorageService` and `GoogleDriveService` for dual upload.
4. **[backend/src/controllers/documentController.ts](file:///d:/Ambe%20Erm/backend/src/controllers/documentController.ts)**: Directly calls `GoogleDriveService.uploadEmployeeDocument`, `uploadCompanyDocument`, `uploadSingleFolderFile`.
5. **[backend/src/config/env.ts](file:///d:/Ambe%20Erm/backend/src/config/env.ts)**: Contains Google-specific env variables:
   - `GCP_SERVICE_ACCOUNT_KEY`, `GCP_CLIENT_EMAIL`, `GCP_PRIVATE_KEY`, `GCP_BUCKET_NAME`, `GCP_PROJECT_ID`
   - `DRIVE_EMPLOYEE_FOLDER_ID`, `DRIVE_INVOICE_FOLDER_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`

### Specific Google Features to Replicate:
- **Hierarchical Folder Structure**: The current Drive integration organizes files into folders (`Site` -> `Designation` -> `Employee Name`). Object storage backends achieve this using object key prefixes (e.g., `sites/{siteId}/employees/{empName}/{fileName}`).
- **Public / Signed Web View**: Google Drive provides a built-in document previewer via `webViewLink`. Generic object storage will need presigned GET URLs or a direct CDN/Nginx proxy route with content headers.

---

## 8. Current Pain Points & Inefficiencies

1. **Slow Sequential Folder Queries on Every Upload**:
   - `GoogleDriveService.uploadEmployeeDocument` executes up to 6 sequential Drive API calls per single upload (`list` + `create` for Site folder, `list` + `create` for Designation folder, `list` + `create` for Employee folder, and finally `create` for the file).
   - This adds 2–5 seconds of network latency per upload.
2. **Dual Upload in Site Documents**:
   - `SiteService.uploadSiteDocument` uploads first to GCP Cloud Storage, then uploads a second copy to Google Drive as backup, doubling network latency.
3. **OAuth Token Refresh Overhead**:
   - Google OAuth2 refresh tokens can suffer from rate limits, token expiration, or OAuth consent screen revocation.
4. **Unbounded Memory Usage**:
   - Multer buffers entire files into Node.js heap memory before uploading. Concurrent large uploads can spike server memory.
5. **Naming Misnomers**:
   - Column `gcp_file_url` in `employee_documents` actually stores Google Drive `webViewLink` strings, causing naming confusion in the codebase.

---

## 9. Open Questions (Pre-Migration Checklist)

- [ ] **Data Migration**: Are existing legacy files stored in Google Drive or GCP Bucket, and will historical URLs need to be migrated to the new storage backend?
- [ ] **Access Model**: Should file links in the new system be permanently public, protected via time-limited presigned S3 URLs, or proxied behind the ERP backend auth middleware?
- [ ] **File Size Limits**: Is the current 10MB per-file upload limit sufficient, or should the new storage backend support larger attachments?
- [ ] **Backup Policy**: Do site and company documents require multi-region replication or local filesystem backups on the new host?
