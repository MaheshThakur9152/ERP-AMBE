# 01 — Forensic Production Current State & Architecture Re-Audit

**Audit Date:** October 2026  
**Auditor:** Lead Software Architect, Senior Backend Engineer, Database Engineer, DevOps & Security Reviewer  
**Target Codebase:** Facility Management ERP (`ERP-AMBE`)  
**Repository Source:** `https://github.com/MaheshThakur9152/ERP-AMBE.git` (branch `main`)

---

## 1. Executive Summary & Forensic Truth

This application is an **active, deployed business ERP** for manpower and facility management operations.
Forensic code analysis reveals a **severe split-brain architecture**:
1. **Frontend Direct Database Mutations:** The React Single Page Application (SPA) directly executes writes (`insert`, `update`, `upsert`, `delete`) against the live Supabase PostgreSQL database using the public anonymous publishable key (`VITE_SUPABASE_ANON_KEY`).
2. **Backend PostgREST Client:** The Express backend does not use a direct PostgreSQL connection (`pg.Pool` or ORM); it queries Supabase through the `@supabase/supabase-js` HTTP client using `SUPABASE_SERVICE_ROLE_KEY`.
3. **Database Transactions Do Not Exist:** Because all operations occur over PostgREST HTTP requests, there are zero multi-statement ACID transactions (`BEGIN ... COMMIT`) anywhere in the application.
4. **Client-Authoritative Financial Logic:** Critical business workflows—most notably monthly payroll calculation and payslip generation—are calculated and persisted in client-side React code (`PayrollHub.tsx`, `PayslipHub.tsx`).
5. **Live Secrets in Work Tree:** Multiple production credentials (GCP service account private keys, Google OAuth secrets, Supabase keys) are committed directly to disk in `.env`.

---

## 2. Inventory of Direct Supabase Call Sites

### Frontend Direct Supabase Calls (52 Call Sites across 13 Files)

The frontend directly accesses the database, completely bypassing the Express gateway:

| File | Line | Supabase Operation | Table / Entity | Business Risk |
|---|---|---|---|---|
| `src/features/auth/api/authApi.ts` | 104 | `.from('profiles').select('*')` | `profiles` | Bypasses backend user profile endpoint |
| `src/features/auth/context/AuthContext.tsx` | 92 | `supabase.auth.getSession()` | `auth.sessions` | Direct client auth dependency |
| `src/features/auth/context/AuthContext.tsx` | 102 | `supabase.auth.signOut()` | `auth.sessions` | Direct client auth dependency |
| `src/features/attendance/components/AttendanceTab.tsx` | 382 | `.from('sites').select('id, site_name...')` | `sites` | Bypasses siteService |
| `src/features/attendance/components/AttendanceTab.tsx` | 449 | `.from('staff').select('*')` | `staff` | Bypasses staffController |
| `src/features/attendance/components/AttendanceTab.tsx` | 468 | `.from('attendance_records').select('*')` | `attendance_records` | Unfiltered client query |
| `src/features/attendance/components/AttendanceTab.tsx` | 496 | `.from('staff').select('*')` | `staff` | Duplicate fetch |
| `src/features/deployments/components/DeploymentsHub.tsx` | 102 | `.from('sites').select('id, site_name...')` | `sites` | Bypasses siteService |
| `src/features/deployments/components/DeploymentsHub.tsx` | 106 | `.from('staff').select('*')` | `staff` | Unpaginated staff dump |
| `src/features/deployments/components/DeploymentsHub.tsx` | 113 | `.from('rate_cards').select('*')` | `rate_cards` | Bypasses backend rate cards |
| `src/features/deployments/components/DeploymentsHub.tsx` | 134 | `.from('site_deployments').select('*')` | `site_deployments` | Bypasses backend |
| `src/features/deployments/components/DeploymentsHub.tsx` | 232 | **`.from('site_deployments').upsert([record])`** | `site_deployments` | **DIRECT DB WRITE: Bypasses backend validation** |
| `src/features/invoice-hub/components/InvoiceHubTable.tsx` | 213 | `.from('invoices').select('id, invoice_no...')` | `invoices` | Redundant direct query |
| `src/features/invoice-hub/components/InvoiceHubTable.tsx` | 240 | `.from('sites').select('id, site_name...')` | `sites` | Bypasses siteService |
| `src/features/invoice-hub/components/InvoiceHubTable.tsx` | 248 | `.from('companies').select('id, name...')` | `companies` | Bypasses companyService |
| `src/features/payroll/components/AdvancesHub.tsx` | 71 | `.from('sites').select('id, site_name...')` | `sites` | Bypasses siteService |
| `src/features/payroll/components/AdvancesHub.tsx` | 84 | `.from('payroll_records').select('*, staff(*)')` | `payroll_records` | Bypasses backend |
| `src/features/payroll/components/AdvancesHub.tsx` | 214 | **`.from('payroll_records').upsert([payload])`** | `payroll_records` | **DIRECT FINANCIAL WRITE: Advances updated in client** |
| `src/features/payroll/components/AdvancesHub.tsx` | 233 | **`.from('payroll_records').upsert([fallbackPayload])`** | `payroll_records` | **DIRECT FINANCIAL WRITE (fallback retry)** |
| `src/features/payroll/components/BonusHub.tsx` | 129 | `.from('sites').select('id, site_name...')` | `sites` | Bypasses siteService |
| `src/features/payroll/components/BonusHub.tsx` | 148 | `.from('staff').select('id, employee_name...')` | `staff` | Direct staff query |
| `src/features/payroll/components/BonusHub.tsx` | 175 | `.from('payroll_records').select(...)` | `payroll_records` | Bypasses backend |
| `src/features/payroll/components/BonusHub.tsx` | 185 | `.from('bonus_disbursements').select('*')` | `bonus_disbursements` | Bypasses bonusController |
| `src/features/payroll/components/PayrollHub.tsx` | 147 | `.from('sites').select('id, site_name...')` | `sites` | Bypasses siteService |
| `src/features/payroll/components/PayrollHub.tsx` | 155 | `.from('rate_cards').select('*')` | `rate_cards` | Bypasses backend |
| `src/features/payroll/components/PayrollHub.tsx` | 163 | `.from('staff').select('*')` | `staff` | Unpaginated staff dump |
| `src/features/payroll/components/PayrollHub.tsx` | 179 | `.from('site_deployments').select('*')` | `site_deployments` | Bypasses backend |
| `src/features/payroll/components/PayrollHub.tsx` | 212 | `.from('payroll_records').select('*')` | `payroll_records` | Bypasses backend |
| `src/features/payroll/components/PayrollHub.tsx` | 518 | **`.from('payroll_records').upsert([recordToSave])`** | `payroll_records` | **CRITICAL: Entire payroll calculation persisted from browser** |
| `src/features/payroll/components/PayrollHub.tsx` | 550 | **`.from('payroll_records').upsert([fallbackRecord])`** | `payroll_records` | **CRITICAL: Retries by stripping missing DB columns** |
| `src/features/payroll/components/PayrollHub.tsx` | 780 | **`.from('payroll_records').upsert(recordsToSave)`** | `payroll_records` | **CRITICAL: Bulk payroll upsert executed in client** |
| `src/features/payroll/components/PayslipHub.tsx` | 396 | `.from('staff').select('id')` | `staff` | Inline staff ID lookup |
| `src/features/payroll/components/PayslipHub.tsx` | 405 | `.from('staff').select('id')` | `staff` | Inline staff name lookup |
| `src/features/payroll/components/PayslipHub.tsx` | 430 | **`.from('staff').insert([newStaffObj])`** | `staff` | **DIRECT DB WRITE: Ad-hoc staff creation in browser** |
| `src/features/payroll/components/PayslipHub.tsx` | 447 | **`.from('payroll_records').upsert([recordToSave])`** | `payroll_records` | **DIRECT DB WRITE: Payslip manual overrides** |
| `src/features/payroll/components/PayslipHub.tsx` | 471 | **`.from('payroll_records').upsert([fallbackRecord])`** | `payroll_records` | **DIRECT DB WRITE (fallback retry)** |
| `src/features/payroll/components/PayslipHub.tsx` | 532 | **`.from('payroll_records').update(...).eq('id', id)`** | `payroll_records` | **DIRECT DB WRITE: Manual PT reset** |
| `src/features/payroll/components/PayslipHub.tsx` | 552 | `.from('sites').select('id, site_name...')` | `sites` | Bypasses siteService |
| `src/features/payroll/components/PayslipHub.tsx` | 566 | `.from('payroll_records').select('*, staff(*)')` | `payroll_records` | Bypasses backend |
| `src/features/sites/components/RateCardManager.tsx` | 165 | `.from('sites').select('*')` | `sites` | Bypasses siteService |
| `src/features/sites/components/RateCardManager.tsx` | 190 | `.from('rate_cards').select('*')` | `rate_cards` | Bypasses backend |
| `src/features/sites/components/RateCardManager.tsx` | 553 | **`.from('rate_cards').insert([payload])`** | `rate_cards` | **DIRECT DB WRITE: Salary rate card created in client** |
| `src/features/sites/components/RateCardManager.tsx` | 603 | **`.from('rate_cards').delete().eq('id', id)`** | `rate_cards` | **DIRECT DB WRITE: Rate card deleted from browser** |
| `src/features/staff/components/StaffFormModal.tsx` | 146 | `.from('rate_cards').select('*')` | `rate_cards` | Bypasses backend |
| `src/features/staff/components/StaffFormModal.tsx` | 185 | `.from('employee_documents').select('*')` | `employee_documents`| Bypasses documentController |
| `src/features/staff/components/StaffFormModal.tsx` | 575 | **`.from('staff').update(payload).eq('id', staffId)`**| `staff` | **DIRECT DB WRITE: Updates staff bypassing lock bouncer** |
| `src/features/staff/components/StaffFormModal.tsx` | 590 | **`.from('staff').insert([payload])`** | `staff` | **DIRECT DB WRITE: Registers staff directly in DB** |
| `src/pages/EmployeeDocuments.tsx` | 80 | `.from('staff').select('id, employee_name...')` | `staff` | Direct staff query |
| `src/pages/EmployeeDocuments.tsx` | 119 | `.from('employee_documents').select('*')` | `employee_documents`| Bypasses documentController |
| `src/pages/InvoiceVault.tsx` | 90 | `.from('company_documents').select('*')` | `company_documents` | Bypasses documentController |
| `src/pages/InvoiceVault.tsx` | 214 | **`.from('company_documents').delete().eq('id', id)`** | `company_documents` | **DIRECT DB WRITE: Document deleted from browser** |
| `src/pages/StaffPage.tsx` | 266 | **`.from('staff').update({ status: 'Active' }).eq('id', id)`** | `staff` | **DIRECT DB WRITE: Staff status change** |

---

### Backend Direct Supabase Calls (117 Call Sites)

The Express backend communicates exclusively via PostgREST HTTP queries through `supabaseAdmin`:

| Module / Controller | Call Sites | Target Tables | Nature of Queries |
|---|---|---|---|
| `attendanceCalculatorController.ts` | 8 | `staff`, `attendance_records`, `sites`, `attendance_sheets` | Raw delete, chunk insert, lookup |
| `authController.ts` | 3 | `auth.users`, `user_roles` | Password login, refresh session, role upsert |
| `bonusController.ts` | 8 | `staff`, `payroll_records`, `bonus_disbursements` | Accrual calculation, disbursement insert |
| `companyController.ts` / `companyService.ts` | 14 | `companies` | CRUD, non-atomic sequence increment |
| `documentController.ts` | 18 | `staff`, `employee_documents`, `site_documents`, `company_documents`, `invoices` | Metadata insert, delete, signed URL generation |
| `invoiceController.ts` / `invoiceQueryService.ts` | 36 | `invoices`, `sites`, `companies` | Insert, update, status change, delete, lock |
| `materialController.ts` / `materialService.ts` | 6 | `materials` | List, insert, update, delete |
| `siteController.ts` / `siteService.ts` | 12 | `sites`, `site_documents`, `companies` | Site CRUD, JSONB rate cards manipulation |
| `staffController.ts` | 9 | `staff`, `rate_cards`, `sites` | List, getById, update, delete, bulk assign |
| `authMiddleware.ts` | 3 | `user_roles`, `auth.getUser` | Token verification, role lookup |

---

## 3. Deployment Audit (Actual Production Configuration)

### Infrastructure & Server Specifications
- **Operating System:** Linux (systemd-managed VPS, likely Ubuntu 22.04 LTS).
- **Backend Service:** Managed via systemd service unit `ambeservice.service`:
  - `User=nodeuser`
  - `WorkingDirectory=/var/www/ambeservice/backend`
  - `ExecStart=/usr/bin/npm start` (Runs `node dist/server.js`)
  - `Restart=always`, `RestartSec=5s`
  - `LimitNOFILE=65536`
- **Watchdog Supervisor:** `backend/scripts/watchdog.sh` runs every minute via cron:
  - Pings `http://127.0.0.1:5000/api/health` with 5s timeout.
  - Automatically triggers `systemctl restart ambeservice` after 2 consecutive failures.
  - Posts webhook alerts to Slack/Discord if `ALERT_WEBHOOK_URL` is set.
- **Frontend Deployment:** Deployed on **Vercel** (`frontend/vercel.json` with SPA catch-all rewrites to `/index.html`), pointing to backend at `https://api.ambeservice.com`.
- **Domains & Hostnames (from CORS in `app.ts`):**
  - Web App: `https://ambeservice.com`, `https://app.ambeservice.com`, `https://admin.ambeservice.com`
  - Backend API: `https://api.ambeservice.com`
- **Reverse Proxy / SSL:** Handled upstream by Nginx / Cloudflare terminating SSL and forwarding traffic to Express on port 5000 (`app.set('trust proxy', 1)`).

---

## 4. Secrets & Credentials Forensic Audit

| Secret / Credential | Location | Purpose | Live Status | Required Action |
|---|---|---|---|---|
| `SUPABASE_URL` | `backend/.env`, `frontend/.env` | Supabase Cloud API endpoint | **LIVE CLOUD ENDPOINT** | Rotate & decommission after cutover |
| `SUPABASE_SERVICE_ROLE_KEY` | `backend/.env` | Backend PostgREST bypass key | **MISCONFIGURED:** Set to `sb_publishable_...` (Anon key) | Must be replaced with real backend credentials |
| `VITE_SUPABASE_ANON_KEY` | `frontend/.env` | Client-side PostgREST key | **EXPOSED IN CLIENT BUNDLE** | Remove from frontend bundle completely |
| `GCP_PRIVATE_KEY` | `backend/.env` | Service Account private RSA key | **LIVE PRIVATE KEY IN PLAINTEXT** | **CRITICAL:** Immediate rotation required |
| `GCP_CLIENT_EMAIL` | `backend/.env` | Google Cloud IAM email | Committed | Rotate with key |
| `GOOGLE_CLIENT_ID` / `SECRET` | `backend/.env` | Google OAuth app credentials | Committed | Rotate in Google Cloud Console |
| `GOOGLE_REFRESH_TOKEN` | `backend/.env` | Google Drive API access token | Committed | Revoke & rotate |
| `MINIO_ACCESS_KEY` / `SECRET` | `backend/.env` | S3 / MinIO Object Storage credentials | Committed | Rotate on production MinIO instance |
| `BACKUP_ENCRYPTION_KEY` | GitHub Repository Secret | Symmetric GPG key for daily DB dumps | In GitHub Actions Secrets | Retain securely for archive recovery |

---

## 5. Reconciliation with Existing Documentation

A strict reconciliation between existing documentation and codebase reveals several discrepancies:

1. **`DATABASE_MIGRATION_PLAN.md` vs Codebase:**
   - Previous plan suggested `pg` driver was already integrated. **Reality:** `pg` is in `package.json` but **never imported** anywhere in `backend/src/`.
2. **`ERP_CURRENT_STATE.md` vs Live Work Tree:**
   - Work tree contains unstaged changes in `PayslipHub.tsx` adding manual payslip overrides (`manual_override_data`, custom earnings/deductions) that match migration `17_add_payslip_manual_override_columns.sql`. These changes were implemented directly in the frontend without backend API support.
3. **`docker-compose.yml` vs Production Environment:**
   - `docker-compose.yml` was generated in the previous step, but production is **NOT containerized**. Production runs directly on a bare VM via `systemd` and `npm start`.
