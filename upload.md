# Complete Upload Pipeline Architecture (Invoice Hub, Tracker & Attendance)

## 1. Overview
The ERP system manages documents across three main workflows:
1. **Invoice Hub (`InvoiceHubTable.tsx` / `InvoiceVault.tsx`)**: System-generated PDF invoices & manual uploads.
2. **Invoice Tracker (`InvoiceTracker.tsx`)**: Multi-version lineage tracking with dual inline document attachments (`Certified Bill` + `Certified Attendance`).
3. **Attendance System (`AttendancePage.tsx` & Backend `attendanceRoutes.ts`)**: Monthly site attendance ledger linked to payroll calculations and certified proof attachment.

---

## 2. Document Flow & API Endpoints

```
[ Frontend UI ]
  ├── Invoice Hub Table (Generated / Certified upload)
  ├── Invoice Tracker (+ Bill / + Att buttons)
  └── Staff / Company Vault
         │
         ▼ (multipart/form-data)
[ Express Backend: POST /api/invoices/upload ] (documentController.uploadInvoiceDirect)
         │
         ├─► 1. Multer Memory Storage (buffer in RAM, max 10MB)
         ├─► 2. MIME & Magic Bytes Validation (PDF / PNG / JPEG / WEBP)
         ├─► 3. Compression Service (Lossless optimization)
         ├─► 4. Object Storage (MinIO / Oracle Object Storage / GCP)
         │        └── Generates Pre-Signed Secure Read URL
         └─► 5. Database Sync (Supabase PostgreSQL `invoices` table)
                  └── Updates document storage keys & view URLs
                  └── Automatic rollback/cleanup on DB failure
```

---

## 3. How Upload Works in Invoice Hub

1. **Generation Path (System Generated PDF)**:
   - User clicks `Generate Proforma` / `Generate Tax Invoice`.
   - Frontend generates PDF client-side / via template renderer.
   - Sends payload with `doc_type: 'generated'` or `is_generated: true` to `/api/invoices/upload`.
   - Backend saves file under `invoices/Invoices/{YYYY}/{MM}/Generated-{UUID}.pdf`.
   - Backend updates `invoices.generated_pdf_storage_key`.

2. **Certified Bill Upload Path**:
   - User clicks `Upload Certified Copy`.
   - File is packaged in `FormData`:
     ```ts
     const formData = new FormData();
     formData.append('file', file);
     formData.append('invoiceId', inv.id);
     formData.append('docType', 'bill');
     formData.append('fileName', `${inv.invoiceNo}_Certified_Bill.pdf`);
     ```
   - Sent to `POST /api/invoices/upload`.
   - Backend updates `invoices.certified_doc_storage_key`.
   - UI status updates to show **"Uploaded Copy"** badge with instant PDF preview.

---

## 4. How Upload Works in Invoice Tracker

The **Invoice Tracker** tracks the full billing lifecycle (`Proforma` → `Revision` → `Tax Invoice`):
- Groups records by `Site Name + Billing Month` (e.g., `Minerva___May 2026`).
- Each invoice card in the lineage provides dual upload triggers:

### A. Certified Bill Upload (`+ Bill`)
- Triggered by `handleUploadCertifiedBill(inv, file)`:
  - Form payload: `invoiceId`, `docType: 'bill'`, `file`.
  - Endpoint: `POST /api/invoices/upload`.
  - Backend updates `invoices.certified_doc_storage_key`.
  - Transforms placeholder badge from `"Not uploaded"` to `"Uploaded Copy"`.

### B. Certified Attendance Upload (`+ Att`)
- Triggered by `handleUploadCertifiedAttendance(inv, file)`:
  - Form payload: `invoiceId`, `docType: 'attendance'`, `file`.
  - Endpoint: `POST /api/invoices/upload`.
  - Backend updates `invoices.certified_attendance_storage_key`.
  - Transforms badge to `"Attendance Proof"` with interactive viewer.

---

## 5. How Attendance Works & Connects to Invoices

1. **Daily Attendance Grid (`attendance_sheets` & `attendance_records`)**:
   - Monthly ledger per site tracking employee present days (`PD`), weekly offs (`WO`), extra duty (`HDE`/`WOE`), and half-days (`HD`).
   - Live synchronization with Supabase:
     - `attendance_sheets`: Holds `site_id`, `month`, `year`, `is_locked`, `created_at`.
     - `attendance_records`: Holds daily string status per staff member (`P`, `A`, `WO`, `HD`, etc.).
2. **Payroll & Billing Calculation**:
   - Attendance counts feed `payrollCalculator.ts` to compute payable days, earned salary, EPF, and ESIC.
   - Feed invoice generation (itemized billing rates based on billed attendance count).
3. **Certified Proof Attachment**:
   - Once client signs/stamps the physical muster roll / biometric summary, it is uploaded directly in **Invoice Tracker** via `+ Attendance`.
   - Stored in object storage with key: `invoices/Invoices/{YYYY}/{MM}/Certified_Attendance-{UUID}.pdf`.

---

## 6. Backend Storage & Security Engine

| Stage | Action |
|---|---|
| **Route** | `POST /api/documents/invoice-direct` (aliased as `/api/invoices/upload`) |
| **Auth** | `requireAuth`, `requireAdmin` |
| **Payload** | `multipart/form-data` with `file`, `invoiceId`, `docType` |
| **Compression** | `CompressionService.compressFile(buffer, mimeType)` |
| **Storage Key** | `invoices/{Entity}/{YYYY}/{MM}/{DocType}-{ShortUUID}.{ext}` |
| **Storage Target** | MinIO / Oracle Object Storage / GCP Bucket |
| **URL Resolution** | Pre-signed secure read URL via `OracleStorageService.getSignedReadUrl()` |
| **Atomic Rollback** | If Supabase DB update fails, uploaded file in MinIO is deleted immediately |
| **Viewer** | Built-in `DocumentViewerModal` supporting PDF paging, zoom, image preview |
