# Facility Management ERP — Comprehensive Current State Audit & Architecture Review

**Audit Timestamp:** October 2026  
**Auditor Role:** Senior Software Architect, Backend/Database Engineer, DevOps Engineer, Security Reviewer  
**Target Codebase:** Facility Management / Housekeeping Manpower ERP (`ERP-AMBE`)

---

## Complete Architecture Map (Actual Existing Implementation)

The system currently operates with a **split-brain hybrid architecture** where business logic, data access, and authorization are fractured between an Express backend and direct client-side Supabase PostgREST queries:

```text
[ Browser / React 18 SPA (Vite) ]
   │
   ├── (Path A: Direct DB Query via @supabase/supabase-js) ──────────────────────────┐
   │    • Direct SELECT / INSERT / UPDATE on:                                       │
   │      - staff (StaffFormModal direct insert)                                    │
   │      - sites (SiteList, DeploymentsHub)                                        │
   │      - rate_cards (RateCardManager, DeploymentsHub)                            │
   │      - site_deployments (DeploymentsHub upsert)                                │
   │      - payroll_records (PayrollHub calculation & bulk upsert)                  │
   │      - bonus_disbursements (BonusHub direct fetch)                             │
   │      - employee_documents (StaffPage / EmployeeDocuments)                      │
   │      - company_documents (InvoiceVault)                                        │
   │    * Bypasses Express backend, rate limiting, and backend lock validations     │
   │                                                                                │
   └── (Path B: REST API via apiClient.ts / fetchWithRetry)                         │
        │                                                                           │
        ▼                                                                           │
   [ Express 4.21 Gateway (Port 5000) ]                                             │
        │                                                                           │
        ├── Middlewares: Helmet, CORS, CookieParser, ExpressRateLimit               │
        ├── Auth Middleware: requireAuth, requireAdmin, requireSuperAdmin           │
        ├── Lock Bouncers: checkLockBouncer, checkFieldLockBouncer                  │
        ├── File Validation: detectMagicMimeType (PDF, PNG, JPG, WEBP)             │
        │                                                                           │
        ▼                                                                           │
   [ Express Controllers & Services ]                                               │
        ├── AuthController (Login, Refresh, Logout, Role update)                    │
        ├── CompanyController / CompanyService                                      │
        ├── SiteController / SiteService                                            │
        ├── StaffController (List, GetById, BulkAssignRateCard, Update, Delete)     │
        ├── AttendanceController / AttendanceService (Sheets CRUD)                  │
        ├── AttendanceCalculatorController / attendanceDurationParser               │
        ├── InvoiceController / InvoiceService / InvoiceQueryService                │
        ├── BonusController (Accrual aggregation & disbursement API)                │
        ├── MaterialController / MaterialService                                    │
        ├── DocumentController (Multipart upload, compression, MinIO signing)       │
        └── ExcelController / ExcelService (CSV generation)                         │
        │                                                                           │
        ├── DB Client: supabaseAdmin (@supabase/supabase-js via PostgREST HTTP) ────┤
        │   (No raw PostgreSQL pool used; pg driver is unused dependency)          │
        └── Object Storage: OracleStorageService (S3-compatible MinIO SDK)          ▼
                                                                           [ Supabase PostgreSQL 15+ ]
                                                                           • Schemas: public.*
                                                                           • Tables: 14 active
                                                                           • Auth: supabase.auth
```

---

## 1. Executive Summary

### What the ERP Currently Does
The ERP serves as an operational back-office portal for a manpower/facility management company providing housekeeping and security staff to client sites. Currently, it supports:
1. **Company Profiles (Multi-Entity):** Creating and updating operating company profiles (GSTIN, legal name, bank details, invoice prefixes, sequential invoice counters).
2. **Sites & Billing Rate Cards:** Creating client sites with embedded JSONB billing rate cards, client contact details, address, and management fee percentages.
3. **Staff Records:** Basic staff directory with employee name, biometric code, weekly-off day, designation, KYC numbers (Aadhaar, PAN, Bank, ESIC, UAN), and site assignment.
4. **Attendance Calculation via Excel:** Uploading biometric/punch Excel spreadsheets, parsing duration hours, matching staff by biometric code, and generating daily attendance records (`P`, `A`, `W/O`, `WOP`).
5. **Invoicing Hub & Generation:** Generating Tax Invoices and Proforma Invoices with line items, management fee calculations, machinery/material charges, GST breakdowns, number-to-words currency formatting, PDF export via client-side `jspdf`/`html2pdf`, and certification attachments.
6. **Payroll Calculation (Frontend-driven):** Running monthly salary calculations (Basic+DA, HRA, Conveyance, EPF, ESIC, PT, Advances deduction, Bonus allocation) based on attendance and saving snapshots into `payroll_records`.
7. **Document Management:** Uploading staff KYC documents, site agreements, and company files to S3/MinIO storage with server-side compression (`sharp`/`pdf-lib`) and pre-signed read URLs.
8. **Locking & Security Center:** SuperAdmin lock bouncer preventing Admins from modifying locked sites, invoices, staff records, or attendance sheets.

### What Appears Production-Ready
- **Token Rotation & Session Management (`TokenService`):** Deterministic SHA-256 token hashing, family revocation on token reuse/theft detection, and HTTP-only cookie transport.
- **Deep Health Check (`/api/health`):** Active TCP/HTTP pings to both database and MinIO storage with 4-second timeout circuits.
- **File Validation (`fileValidator.ts`):** File magic byte verification (JPEG, PNG, PDF, WEBP) preventing malicious extension spoofing.
- **Client-Side Silent Token Refresh (`apiClient.ts`):** Single-flight promise deduplication and transparent 401 interceptor replay.

### What is Prototype-Level / Fragile
- **Split-Brain Data Access:** The frontend queries Supabase tables directly with publishable anonymous credentials, bypassing backend validation, business logic, and lock checks.
- **Client-Side Payroll Execution:** Payroll computation happens exclusively inside React components (`PayrollHub.tsx`). If an admin's browser crashes or network drops during a 100-employee calculation, half the payroll is written to the database with no rollback.
- **Attendance Calculator API Open to Public:** `/api/attendance-calculator/preview` and `/api/attendance-calculator/save` lack authentication middleware (`requireAuth`), allowing any unauthenticated attacker to wipe and overwrite company attendance records.
- **Sequential Invoicing Race Condition:** Invoice numbers are fetched, incremented, and saved in two separate non-transactional HTTP requests without database-level atomic sequences or row locks.
- **Direct PostgREST HTTP Calls (Zero DB Transactions):** Because the backend uses `@supabase/supabase-js` instead of a direct connection pool (`pg`/ORM), multi-table operations (e.g. invoice creation + ledger entry + sequence update) cannot use PostgreSQL `BEGIN ... COMMIT` transactions.

### Biggest Technical Risks
1. **Critical Unauthenticated Data Loss API:** Public `/api/attendance-calculator/save` endpoint has full delete-and-insert capabilities over `attendance_records` without authentication.
2. **Zero Transactional Guarantees:** Any network hiccup during multi-step operations (invoice saves, attendance uploads, payroll batch runs) leaves partial, corrupted data.
3. **No Audit Logging:** No tracking of who altered employee bank details, who changed invoice amounts, or who manipulated attendance records.
4. **Broken Tenant Isolation:** Multi-tenancy checks in backend services (`attendanceService`, `invoiceQueryService`, `siteService`) check `user.company_id`, but `authMiddleware.ts` never populates `company_id` on `req.user`. All tenant checks are silently bypassed.
5. **Zero Test Coverage:** Exactly one 19-line test script exists in the entire repository. No CI test runner, no unit tests for payroll or tax math, no integration tests.

### Biggest Business Gaps
1. **Broken FM Value Chain:** Missing Client Entity -> Missing Contract/Work Order Entity -> Missing Roster/Deployment Requirement -> Broken Link between Contracted Headcount vs Deployed Headcount vs Actual Attendance.
2. **Missing Finance & Accounting:** No Payments table, no Payment Receipts, no Accounts Receivable ledger, no Vendor/Site Expenses, no site-level Gross Margin / Net Profitability calculation.
3. **No Client Portal or Multi-User RBAC:** Only `admin` and `superadmin` exist. No roles for `Site Supervisor`, `Accountant`, `HR Manager`, or `Client Viewer`.
4. **Attendance Locking & Payroll Freezing Gaps:** Attendance and payroll lack formal workflow states (Draft -> Submitted -> Approved -> Locked -> Disbursed).

---

## 2. Feature Inventory

| Module | Status | Backend | Frontend | Database | Tests | Production Ready |
|---|---|---|---|---|---|---|
| **Authentication & Refresh Tokens** | ✅ Complete | Complete (`authController.ts`, `tokenService.ts`) | Complete (`AuthContext.tsx`, `apiClient.ts`) | Complete (`refresh_tokens`, `user_roles`) | 🟡 Minimal (19 lines) | **Yes** |
| **RBAC / Authorization** | 🟡 Partial | Partial (Only `admin`, `superadmin`; tenant isolation broken) | Partial (Only checks `isSuperAdmin`) | Partial (`user_roles` simple table) | 🔴 None | **No** |
| **SuperAdmin Security / Record Locking** | 🟡 Partial | Complete (`adminController.ts`, lock bouncers) | Complete (`SecurityCenter.tsx`, `LockdownQueue.tsx`) | Complete (`is_locked` columns) | 🔴 None | **Partial** (Bypassed by frontend Supabase calls) |
| **Company Profiles (Operating Entities)** | ✅ Complete | Complete (`companyController.ts`, `companyService.ts`) | Complete (`CompanyProfilesPage.tsx`, `CompanyCard.tsx`) | Complete (`companies` table) | 🔴 None | **Yes** |
| **Client Management** | ⚪ Missing | ⚪ None (No client table or endpoints) | ⚪ None (Clients are typed as raw strings in Sites) | ⚪ Missing (Embedded in `sites.client_name`) | 🔴 None | **No** |
| **Sites & Buildings** | 🟡 Partial | Partial (`siteController.ts`, `siteService.ts`) | Complete (`SitesMasterPage.tsx`, `SiteList.tsx`) | Partial (`sites` table with JSONB rate cards) | 🔴 None | **Partial** |
| **Work Orders & Quotas** | ⚪ Missing | ⚪ None (Only `work_order_ref` string column in `sites`) | ⚪ None | ⚪ Missing (No quotas, shifts, or rates per WO) | 🔴 None | **No** |
| **Rate Cards (Billing vs Payroll)** | 🟡 Partial | Partial (Billing in `sites.rate_cards` JSONB, Payroll in `rate_cards` table) | Complete (`RateCardManager.tsx`) | 🟡 Fragmented (`rate_cards` table + JSONB) | 🔴 None | **No** (Fragmented schema) |
| **Staff / Manpower Directory** | 🟡 Partial | Partial (`staffController.ts` missing `POST /api/staff`) | Complete (`StaffPage.tsx`, `StaffFormModal.tsx`) | Complete (`staff` table + KYC columns) | 🔴 None | **No** (Frontend writes directly to DB) |
| **Deployments (Site Roster Allocation)** | 🟣 Mocked/Fragile | ⚪ None in Backend (0 endpoints) | Partial (`DeploymentsHub.tsx` writes direct to DB) | Partial (`site_deployments` table) | 🔴 None | **No** |
| **Attendance (Manual / Monthly Sheets)** | 🟡 Partial | Complete (`attendanceController.ts`, `attendanceService.ts`) | Complete (`AttendancePage.tsx`, `AttendanceTab.tsx`) | Complete (`attendance_sheets` table) | 🔴 None | **Partial** |
| **Attendance Calculator (Excel Parser)** | 🔴 Broken (Security) | Broken: Public unauthenticated endpoints (`save`, `preview`) | Complete (`AttendanceCalculatorPage.tsx`) | Complete (`attendance_records` table) | 🔴 None | **No** (Critical security vulnerability) |
| **Payroll Processing** | 🔴 Broken (Architecture) | ⚪ None in Backend (Zero calculation or approval API) | Broken: Client-side bulk calculation in `PayrollHub.tsx` | Complete (`payroll_records` table) | 🔴 None | **No** (Client-side execution risk) |
| **Payslips Generation** | 🟡 Partial | ⚪ None in Backend | Complete (`PayslipHub.tsx`, `pdfService.ts`) | Complete (Uses `payroll_records` snapshots) | 🔴 None | **Partial** |
| **Advances Management** | 🟡 Partial | ⚪ None in Backend | Complete (`AdvancesHub.tsx` writes direct to DB) | Partial (Stored as columns in `payroll_records`) | 🔴 None | **No** (No advance ledger / installment tracking) |
| **Bonus Disbursal (Statutory)** | 🟡 Partial | Complete (`bonusController.ts`) | Complete (`BonusPage.tsx`, `BonusHub.tsx`) | Complete (`bonus_disbursements` table) | 🔴 None | **Partial** |
| **Invoicing (Tax & Proforma)** | 🟡 Partial | Complete (`invoiceController.ts`, `invoiceService.ts`) | Complete (`InvoiceHubTable.tsx`, `InvoiceForm.tsx`) | 🟡 Partial (`invoices` table; line items in JSONB) | 🔴 None | **Partial** (Sequence race condition) |
| **Invoice Tracker (Workflow Status)** | 🟡 Partial | Complete (`/approve`, `/cancel`, `/convert-to-tax-invoice`) | Complete (`InvoiceTrackerPage.tsx`, Kanban board) | Complete (`status`, `approved_at`, `cancelled_at`) | 🔴 None | **Partial** |
| **Material Master & Invoicing** | 🟡 Partial | Complete (`materialController.ts`, `materialService.ts`) | Complete (`MaterialsMasterPage.tsx`, `MaterialGeneratorPage.tsx`) | Complete (`materials` table) | 🔴 None | **Partial** |
| **Document Management & Storage** | ✅ Complete | Complete (`documentController.ts`, `oracleStorageService.ts`) | Complete (`DocumentsMasterPage.tsx`, `InvoiceVault.tsx`) | Complete (`employee_documents`, `site_documents`) | 🔴 None | **Yes** |
| **Payments & Accounts Receivable** | ⚪ Missing | ⚪ None | ⚪ None | ⚪ None | 🔴 None | **No** |
| **Expenses & Petty Cash** | ⚪ Missing | ⚪ None | ⚪ None | ⚪ None | 🔴 None | **No** |
| **Financial Ledger & Profitability** | ⚪ Missing | ⚪ None | ⚪ None | ⚪ None | 🔴 None | **No** |
| **Audit Logging** | ⚪ Missing | ⚪ None | ⚪ None | ⚪ None | 🔴 None | **No** |
| **Management Analytics Dashboard** | 🟣 Mocked | ⚪ None | Mocked (Redirects to `/invoice-hub`) | ⚪ None | 🔴 None | **No** |

---

## 3. Architecture Review

### Frontend Architecture
- **Framework:** React 18 with Vite 6, TypeScript 5.7, Tailwind CSS 3.4.
- **Routing:** React Router v7 (`react-router-dom`).
- **State Management:** Local React state (`useState`, `useEffect`) and Context API (`AuthContext`). **No global state store** (Zustand, Redux, or TanStack Query).
- **Network Layer:** Custom fetch wrapper `fetchWithRetry` in `apiClient.ts` handling JWT header injection, 401 interceptor replay, and exponential backoff.
- **Critical Flaw:** Multiple massive monolithic UI files (`InvoiceHubTable.tsx` - 2,010 lines, `PayrollHub.tsx` - 1,934 lines, `RateCardManager.tsx` - 1,720 lines, `StaffPage.tsx` - 1,373 lines). These files combine API fetches, direct Supabase writes, complex tax math, Excel parsing, and huge JSX modals into single components.

### Backend Architecture
- **Framework:** Express 4.21 on Node.js 22 with TypeScript (`ts-node-dev` in dev, `tsc` for dist).
- **Layering:** Route -> Middleware -> Controller -> Service -> Supabase Client.
- **Data Access Layer:** Direct invocation of `@supabase/supabase-js` inside services and controllers. The official `pg` driver is present in `package.json` but **completely unimported and unused**.
- **Process Supervision:** Systemd service script (`ambeservice.service`) and Bash cron watchdog (`watchdog.sh`) pinging `/api/health`.

### API Architecture
- REST API exposed under `/api/*`.
- Health endpoint `/api/health` performs live deep checks against PostgreSQL and MinIO storage.
- Standard response wrapper `{ success: true, data: ... }` is used in some endpoints, but many others return naked JSON arrays or error objects `{ error: string }`.

### Database Architecture
- Managed PostgreSQL instance hosted on Supabase Cloud.
- Migrations are managed as ad-hoc SQL files in `backend/src/db/migrations/` (01 to 17), without a migration runner or tracking table (e.g. `_prisma_migrations` or `knex_migrations`).

### Authentication & Authorization
- **Auth Engine:** Supabase Auth (`supabaseAdmin.auth.signInWithPassword`, `refreshSession`).
- **Access Tokens:** Short-lived JWTs (15 min) kept in memory in the frontend.
- **Refresh Tokens:** Stored in `refresh_tokens` table in PostgreSQL with SHA-256 hashes, family ID rotation, and theft detection. Transported via HTTP-only cookie (`SameSite=Strict`).
- **RBAC Defect:** User roles are limited to `admin` and `superadmin`. In `authMiddleware.ts`, any user without an explicit entry in `user_roles` automatically falls back to `admin`. Multi-tenant scoping by `company_id` is non-functional because `company_id` is never injected into `req.user`.

### File Handling & Object Storage
- S3-compatible MinIO / Oracle Object Storage via `@aws-sdk/client-s3`.
- In-memory upload handling using `multer.memoryStorage()`.
- Server-side image and PDF compression via `sharp` and `pdf-lib` before upload.
- Magic byte validation prevents file spoofing.
- Time-limited pre-signed URLs (60 minutes) generated for document viewing.

---

## 4. Database Review

### Table Inventory & Structural Analysis

#### 1. `public.companies`
- **Purpose:** Manages operating legal entities.
- **Key Columns:** `id` (UUID PK), `code` (Text, Unique), `entity_code`, `name`, `legal_name`, `gstin`, `pan`, `cin`, `bank_name`, `bank_account_no`, `bank_ifsc`, `bank_branch`, `terms_and_conditions` (JSONB/Text[]), `tax_prefix`, `tax_sequence`, `proforma_prefix`, `proforma_sequence`, `is_active`, `is_locked`, `created_at`, `updated_at`.
- **Integrity Issues:** `tax_sequence` and `proforma_sequence` are updated non-atomically in application code.

#### 2. `public.sites`
- **Purpose:** Represents client facility locations.
- **Key Columns:** `id` (UUID PK), `company_id` (UUID FK -> companies.id), `site_name`, `code_name`, `client_name` (Text), `gstin`, `work_order_ref_no`, `work_order_period`, `address`, `contact_no`, `email`, `status`, `management_fee_percent`, `default_machinery_charges`, `default_material_charges`, `default_additional_charges` (JSONB), `rate_cards` (JSONB), `persons`, `person_work_order`, `person_worked_site`, `use_separate_person_counts`, `is_locked`, `created_at`, `updated_at`.
- **Integrity Issues:**
  - `client_name` and `gstin` are raw strings. No normalized `clients` table exists.
  - Billing rate cards are serialized as raw JSONB inside `sites.rate_cards`, preventing foreign keys from invoices and preventing SQL joins.
  - Quotas (`person_work_order`, `person_worked_site`) are stored as scalar integers on the site rather than by designation or work order.

#### 3. `public.rate_cards` (Payroll Rate Cards)
- **Purpose:** Salary components per designation/site for payroll generation.
- **Key Columns:** `id` (UUID PK), `site_id` (UUID FK -> sites.id), `company_id` (UUID FK), `post_name` (Designation), `gross_salary`, `basic_da`, `hra`, `washing_allowance`, `conveyance_allowance`, `other_allowance`, `incentive_amount`, `is_flat_wage`, `bonus_amount`, `part_bonus_amount`, `remark`, `created_at`.
- **Integrity Issues:** Split-brain between `rate_cards` table (used for payroll) and `sites.rate_cards` JSONB (used for billing).

#### 4. `public.staff`
- **Purpose:** Employee / workforce directory.
- **Key Columns:** `id` (UUID PK), `employee_name`, `biometric_code` (Text), `phone`, `gender`, `designation`, `status` ('Active'|'Inactive'), `weekly_off`, `site_id` (UUID FK -> sites.id), `rate_card_id` (UUID FK -> rate_cards.id), `compliance_name`, `bank_account_no`, `bank_ifsc_code`, `bank_name`, `bank_branch`, `aadhar_no`, `pan_no`, `uan_no`, `esic_no`, `left_date`, `inactive_reason`, `is_locked`, `created_at`, `updated_at`.
- **Integrity Issues:**
  - `biometric_code` lacks a UNIQUE constraint across active employees.
  - `site_id` is a 1-to-1 relationship on the employee row, making multi-site deployment or historical site transfers impossible without overwriting the record.

#### 5. `public.site_deployments`
- **Purpose:** Monthly employee site allocation.
- **Key Columns:** `id` (UUID PK), `month_year` (Text, e.g. "April 2026"), `site_id` (UUID FK -> sites.id), `staff_id` (UUID FK -> staff.id), `role_name`, `created_at`.
- **Constraint:** Unique on `(month_year, site_id, staff_id)`.
- **Integrity Issues:** Managed exclusively by frontend components; zero backend validation.

#### 6. `public.attendance_sheets`
- **Purpose:** Monthly summary attendance document per site.
- **Key Columns:** `id` (UUID PK), `site_id` (UUID FK), `company_id` (UUID FK), `month`, `year`, `records` (JSONB array), `summary` (JSONB), `file_url`, `is_locked`, `created_at`, `updated_at`.
- **Constraint:** Unique on `(site_id, month, year)`.

#### 7. `public.attendance_records`
- **Purpose:** Daily granular attendance punches.
- **Key Columns:** `id` (UUID PK), `staff_id` (UUID FK -> staff.id), `site_id` (UUID FK -> sites.id), `record_date` (Date), `shift_type` ('regular'|'overtime'), `status` ('P'|'A'|'W/O'|'WOP'), `in_time` (Text), `out_time` (Text), `duration` (Text), `duration_hours` (Numeric), `created_at`.
- **Constraint:** Unique on `(staff_id, record_date)`.
- **Integrity Issues:** An employee cannot work at two different sites on the same date because of the unique constraint `(staff_id, record_date)`.

#### 8. `public.payroll_records`
- **Purpose:** Monthly employee payslip and statutory snapshot.
- **Key Columns:** `id` (UUID PK), `staff_id` (UUID FK), `rate_card_id` (UUID FK), `month_year` (Text), `present_days`, `weekly_off_days`, `payable_days`, `days_in_month`, `earned_basic`, `earned_hra`, `earned_conveyance`, `earned_other`, `earned_incentive`, `earned_gross`, `epf`, `esic`, `pt`, `advances`, `bonus_amount_snapshot`, `part_bonus_amount_snapshot`, `earned_bonus`, `earned_part_bonus`, `remaining_part_bonus`, `net_salary`, `total_net_salary`, `manual_pt_adjustment`, `manual_pt_adjustment_reason`, `designation`, `pf_no`, `esic_no`, `bank_account_no`, `bank_ifsc_code`, `custom_earnings` (JSONB), `custom_deductions` (JSONB), `is_manually_edited`, `manual_override_data` (JSONB), `is_locked`, `status` ('Paid'|'Pending'), `created_at`, `updated_at`.
- **Constraint:** Unique on `(staff_id, month_year)`.

#### 9. `public.bonus_disbursements`
- **Purpose:** Records statutory year-end bonus payments.
- **Key Columns:** `id` (UUID PK), `staff_id` (UUID FK), `site_id` (UUID FK), `financial_year` (Text), `amount` (Numeric > 0), `disbursed_date` (Date), `remark` (Text), `created_at`.

#### 10. `public.invoices`
- **Purpose:** Invoicing records.
- **Key Columns:** `id` (UUID PK), `company_id` (UUID FK), `site_id` (UUID FK), `invoice_no` (Text, Unique), `type` ('Tax Invoice'|'Proforma Invoice'), `status` ('Draft'|'Pending'|'Paid'|'Cancelled'), `invoice_date` (Date), `billing_period` (Text), `sub_total`, `tax_total`, `grand_total`, `management_fee_percent`, `mgmt_percent`, `machinery_charges`, `material_charges`, `additional_charges` (JSONB), `line_items` (JSONB), `challan_no`, `challan_date`, `buyer_order_no`, `dispatch_doc_no`, `dispatched_through`, `destination`, `terms_of_delivery`, `is_material` (Boolean), `is_locked`, `is_legacy`, `legacy_uploaded_by`, `legacy_notes`, `previous_version_id` (UUID FK), `certified_doc_url`, `certified_attendance_url`, `generated_pdf_url`, `cancelled_at`, `cancelled_reason`, `approved_at`, `created_at`, `updated_at`.
- **Integrity Issues:** `line_items` stored as JSONB rather than normalized `invoice_items` table. No connection to actual attendance sheets or work order rates.

#### 11. `public.materials`
- **Purpose:** Catalog of housekeeping consumables and machinery.
- **Key Columns:** `id` (UUID PK), `item_name`, `hsn_code`, `gst_rate`, `default_rate`, `unit`, `created_at`, `updated_at`.

#### 12. `public.refresh_tokens`
- **Purpose:** Server-side token rotation & theft detection.
- **Key Columns:** `id` (UUID PK), `user_id` (UUID), `token_hash` (Text Unique), `family_id` (UUID), `supabase_refresh_token`, `expires_at`, `revoked_at`, `created_at`.

#### 13. `public.employee_documents` / `public.site_documents` / `public.company_documents`
- **Purpose:** Document storage metadata.
- **Key Columns:** `id` (UUID PK), `staff_id` / `site_id` / `company_id`, `document_type`, `file_name`, `storage_provider`, `storage_key`, `view_url`, `created_at`.

---

## 5. API Review

| Method | Path | Auth Req | Role Req | Validation | DB Operations | Error Handling | Status / Vulnerability |
|---|---|---|---|---|---|---|---|
| `POST` | `/api/auth/login` | No | Public | Body email + password | `auth.signInWithPassword`, `refresh_tokens.insert` | Try/catch 401/500 | ✅ Complete |
| `POST` | `/api/auth/refresh` | No (Cookie) | Public | Cookie `refresh_token` | TokenService lookup & rotation | Try/catch 401/500 | ✅ Complete |
| `POST` | `/api/auth/logout` | No | Public | None | `refresh_tokens.update(revoked_at)` | Try/catch 200 | ✅ Complete |
| `GET` | `/api/auth/me` | Yes | Any | Bearer/Cookie | `user_roles.select` | Try/catch 401 | ✅ Complete |
| `PATCH` | `/api/auth/role` | Yes | SuperAdmin | Target user_id & role | `user_roles.upsert` | Try/catch 400/403/500 | ✅ Complete |
| `GET` | `/api/health` | No | Public | None | Ping `companies`, ping MinIO | Returns 200/503 | ✅ Complete |
| `GET` | `/api/companies` | Yes | Any | None | `companies.select` | Next(error) | ✅ Complete |
| `POST` | `/api/companies` | Yes | Admin | None | `companies.insert` | Next(error) | 🟡 Missing body validation |
| `PUT` | `/api/companies/:id` | Yes | Admin | `checkLockBouncer` | `companies.update` | Next(error) | 🟡 Missing body validation |
| `PATCH` | `/api/companies/:id/status` | Yes | SuperAdmin | None | `companies.update` | Next(error) | ✅ Complete |
| `GET` | `/api/sites` | Yes | Any | None | `sites.select` | Next(error) | 🔴 Tenant check bypassed |
| `POST` | `/api/sites` | Yes | Admin | None | `sites.insert` | Next(error) | 🟡 Missing schema validation |
| `PUT` | `/api/sites/:id` | Yes | Admin | `checkFieldLockBouncer` | `sites.update` | Next(error) | 🟡 Partial validation |
| `DELETE` | `/api/sites/:id` | Yes | Admin | `checkLockBouncer` | `sites.delete` | Next(error) | 🔴 No check for staff on site |
| `GET` | `/api/staff` | Yes | Any | None | `staff.select` joined rate cards & sites | Try/catch 500 | 🔴 Missing pagination |
| `GET` | `/api/staff/:id` | Yes | Any | None | `staff.select` | Try/catch 404/500 | ✅ Complete |
| `PATCH` | `/api/staff/bulk-assign-rate-card` | Yes | Admin | Zod schema | Batch `staff.update` loop | Try/catch 500 | 🔴 Non-transactional loop |
| `PUT/PATCH` | `/api/staff/:id` | Yes | Admin | `checkFieldLockBouncer` | `staff.update` | Try/catch 500 | 🟡 Partial field validation |
| `DELETE` | `/api/staff/:id` | Yes | Admin | `checkLockBouncer` | `staff.delete` | Try/catch 500 | 🔴 Missing attendance FK check |
| **`POST`** | **`/api/staff`** | — | — | — | — | — | ⚪ **MISSING ROUTE** (UI writes direct) |
| `GET` | `/api/attendance` | Yes | Any | Query params | `attendance_sheets.select` | Next(error) | ✅ Complete |
| `POST` | `/api/attendance` | Yes | Admin | None | `attendance_sheets.insert` | Next(error) | 🟡 Missing schema validation |
| `PUT` | `/api/attendance/:id` | Yes | Admin | `checkLockBouncer` | `attendance_sheets.update` | Next(error) | 🟡 Missing schema validation |
| `POST` | `/api/attendance-calculator/preview` | **NO** | **None** | Multer 25MB | `staff.select` | Try/catch 500 | 🔴 **CRITICAL: Unauthenticated** |
| `POST` | `/api/attendance-calculator/save` | **NO** | **None** | Basic body checks | `attendance_records.delete`, `insert` chunks | Try/catch 500 | 🔴 **CRITICAL: Unauthenticated Data Wipe** |
| `GET` | `/api/bonus/summary` | Yes | Any | Query FY, siteId | `staff`, `payroll_records`, `bonus_disbursements` | Try/catch 500 | 🔴 URL length overflow on `.in()` |
| `POST` | `/api/bonus/disburse` | Yes | Any | Zod schema | `bonus_disbursements.insert` | Try/catch 400/500 | 🟡 Any user can record bonus |
| `GET` | `/api/invoices` | Yes | Any | None | `invoices.select` joined sites, companies | Next(error) | 🔴 Missing pagination |
| `POST` | `/api/invoices` | Yes | Admin | Partial Zod | `invoices.insert`, `company.update` | Next(error) | 🔴 Non-transactional race condition |
| `PUT` | `/api/invoices/:id` | Yes | Admin | `checkLockBouncer` | `invoices.update` | Next(error) | 🟡 Partial validation |
| `DELETE` | `/api/invoices/:id` | Yes | Admin | `checkLockBouncer` | `invoices.delete` | Next(error) | 🔴 Deletes invoice permanently |
| `PATCH` | `/api/invoices/:id/lock` | Yes | SuperAdmin | Body `is_locked` | `invoices.update` | Next(error) | ✅ Complete |
| `PATCH` | `/api/invoices/:id/cancel` | Yes | Admin | `checkLockBouncer` | `invoices.update` | Next(error) | ✅ Complete |
| `PATCH` | `/api/invoices/:id/approve` | Yes | Admin | `checkLockBouncer` | `invoices.update` | Next(error) | ✅ Complete |
| `POST` | `/api/invoices/:id/convert-to-tax-invoice` | Yes | Admin | `checkLockBouncer` | `invoices.update` | Next(error) | 🔴 Race condition on sequence |
| `POST` | `/api/documents/upload` | Yes | Any | Magic bytes | MinIO upload + `employee_documents.insert` | Try/catch 500 | ✅ Complete |
| `GET` | `/api/documents/:documentId/view` | Yes | Any | None | Generate MinIO signed URL | Try/catch 500 | ✅ Complete |
| `DELETE` | `/api/documents/:documentId` | Yes | Admin | None | MinIO delete + DB delete | Try/catch 500 | ✅ Complete |

---

## 6. Security Review

### Vulnerability Matrix

| Severity | Vulnerability ID | Component | Description | Remediation |
|---|---|---|---|---|
| **CRITICAL** | `SEC-001` | `attendanceCalculatorRoutes.ts` | **Public Attendance Delete & Overwrite:** Missing `requireAuth` and `requireAdmin` on `/preview` and `/save`. Any anonymous user can upload attendance or trigger batch deletion of daily records. | Add `router.use(requireAuth, requireAdmin)` to `attendanceCalculatorRoutes.ts`. |
| **CRITICAL** | `SEC-002` | `authMiddleware.ts` | **Default Privilege Escalation to Admin:** If a user account exists in Supabase Auth but has no entry in `public.user_roles`, `fetchUserRole()` returns role `'admin'`. | Default unknown users to `'unassigned'` or `'guest'` and return 403 Forbidden. |
| **CRITICAL** | `SEC-003` | `authMiddleware.ts` / Services | **Completely Broken Multi-Tenant Isolation:** `verifySheetOwnership`, `verifyInvoiceOwnership`, and `verifySiteOwnership` check `if (!user.company_id) return;`. Because `req.user` in `authMiddleware.ts` never sets `company_id`, all cross-tenant isolation checks are bypassed. | Populate `company_id` on `req.user` from `user_roles` or profiles table; reject requests with missing tenant context. |
| **HIGH** | `SEC-004` | Frontend (`StaffFormModal`, `PayrollHub`, etc.) | **Bypassed Backend Security via Frontend Supabase Client:** Frontend has write credentials (`VITE_SUPABASE_ANON_KEY`) and performs direct `.insert()` and `.upsert()` into `staff`, `payroll_records`, `site_deployments`. | Route all mutations strictly through Express backend endpoints; disable write access for anon key via PostgreSQL RLS policies. |
| **HIGH** | `SEC-005` | `backend/.env` | **Live Cloud Credentials in Repository:** `.env` in `backend/` contains actual Google Cloud private keys, Google OAuth client credentials, and live Supabase URLs. | Rotate all keys immediately; add `.env` to `.gitignore` and enforce vault/secret injection. |
| **HIGH** | `SEC-006` | `companyService.ts` / `invoiceQueryService.ts` | **Invoice Sequence Race Condition & Duplicate Invoices:** Sequence generation does a `SELECT` followed by application-level increment and `UPDATE` in separate calls. Concurrent requests produce identical invoice numbers. | Implement atomic PostgreSQL sequence or `UPDATE companies SET tax_sequence = tax_sequence + 1 RETURNING tax_sequence`. |
| **MEDIUM** | `SEC-007` | `StaffController.delete` / `InvoiceController.delete` | **Hard Deletion of Financial & Operational Records:** Records are permanently deleted from database via `DELETE FROM` instead of soft deletion (`deleted_at`). Causes orphan foreign keys or data loss. | Implement `deleted_at timestamptz` soft deletion pattern across all primary business entities. |
| **MEDIUM** | `SEC-008` | `bonusController.ts` | **No RBAC on Bonus Disbursement:** Any authenticated user with an access token can trigger `/api/bonus/disburse` to record financial payouts. | Require `requireAdmin` or specific `payroll_manager` role. |
| **LOW** | `SEC-009` | `app.ts` | **Permissive CORS Localhost Fallbacks in Production:** `DEFAULT_ALLOWED_ORIGINS` includes `http://localhost:5173`, `http://localhost:3000`, `http://localhost:5000` regardless of `NODE_ENV`. | Restrict origins strictly to verified domain in production mode. |

---

## 7. Code Quality Review

### Monolithic Frontend Files
The frontend suffers from massive monolithic React components that violate single responsibility:
- `frontend/src/features/invoice-hub/components/InvoiceHubTable.tsx` (**2,010 lines**)
- `frontend/src/features/payroll/components/PayrollHub.tsx` (**1,934 lines**)
- `frontend/src/features/sites/components/RateCardManager.tsx` (**1,720 lines**)
- `frontend/src/features/payroll/components/PayslipHub.tsx` (**1,525 lines**)
- `frontend/src/features/staff/components/StaffFormModal.tsx` (**1,461 lines**)
- `frontend/src/features/attendance/components/AttendanceTab.tsx` (**1,442 lines**)
- `frontend/src/pages/StaffPage.tsx` (**1,373 lines**)

### Type Safety & Unsafe Casts
- Frequent use of `any` across controllers and components: `(doc: any)`, `(staffData as any)`, `records.map((r: any) => ...)`.
- Schema drift between frontend and backend:
  - Frontend uses `camelCase` (`siteName`, `biometricCode`, `workOrderRefNo`), backend uses `snake_case` (`site_name`, `biometric_code`, `work_order_ref_no`).
  - Mapping functions (`mapRowToSite`, `mapRowToInvoiceRecord`, `mapRowToAttendanceSheet`) are littered with dual-format checks like `row.siteName || row.site_name || ''` to prevent null crashes.

### Dead Code & Unused Modules
- `pg` driver in `backend/package.json` is never imported.
- `gcpStorageService.ts` and `googleDriveService.ts` are legacy storage connectors largely superseded by `oracleStorageService.ts`.
- `mockInvoices.ts` and `mockSites.ts` are empty arrays kept as artifact stubs.

---

## 8. Performance Review

### Top 8 Performance Bottlenecks & Query Risks

1. **Unindexed Big-Table Scans:**
   - `attendance_records` has an index on `(staff_id, record_date)`, but lacks an index on `(site_id, record_date)` or `(record_date)`. Monthly site-level queries will perform full table sequential scans as attendance rows scale past 100,000.
2. **Missing Pagination on Primary Endpoints:**
   - `GET /api/staff`, `GET /api/invoices`, `GET /api/sites`, and `GET /api/materials` return all rows in a single query (`.select('*')`). When the company reaches 1,000+ staff and 5,000+ invoices, payloads will cause browser memory bloat and high latency.
3. **URL Length Explosion in Bonus Summary:**
   - `BonusController.getSummary` executes `.in('staff_id', staffIds)` with up to hundreds of UUIDs in the query string. PostgREST will fail with HTTP 414 once staff count exceeds ~150.
4. **N+1 PostgREST Queries in Attendance Calculator Save:**
   - Iterates through `recordsBySite` and executes separate `sites` queries and `attendance_sheets` queries inside a JavaScript `for` loop.
5. **Client-Side Heavy PDF Rendering:**
   - Large invoice and payslip PDFs are generated directly in the browser DOM using `html2canvas` and `jspdf`, freezing client CPU threads on low-spec office workstations.
6. **No Database Connection Pooling:**
   - Backend communicates with Supabase exclusively via PostgREST HTTP queries. Each request incurs HTTP TLS handshake overhead.
7. **Large JSONB Payload Bloat:**
   - `attendance_sheets.records` stores an entire month of staff attendance inside a single JSONB blob per site, duplicating data already in `attendance_records`.
8. **Lack of Query Result Caching:**
   - Company profiles, rate card templates, and materials are fetched repeatedly on page transitions with zero client-side caching (no TanStack Query or SWR).

---

## 9. Production Readiness Score

```text
┌─────────────────────────────────────────────────────────────┐
│               OVERALL SCORE: 44 / 100                       │
├──────────────────────────────┬──────────────────────────────┤
│ Category                     │ Score (0-10)                 │
├──────────────────────────────┼──────────────────────────────┤
│ Architecture                 │ 4 / 10                       │
│ Database Schema & Integrity  │ 4 / 10                       │
│ Security & RBAC              │ 3 / 10                       │
│ Backend API Design           │ 5 / 10                       │
│ Frontend Quality             │ 4 / 10                       │
│ Business Logic Alignment     │ 5 / 10                       │
│ Automated Testing            │ 1 / 10                       │
│ DevOps & Containerization    │ 3 / 10                       │
│ Observability & Logging      │ 5 / 10                       │
│ Documentation & Setup        │ 4 / 10                       │
└──────────────────────────────┴──────────────────────────────┘
```

**Score Rationale:**
- **Architecture (4/10):** Fractured between Express backend and direct client-side Supabase writes; absence of an ORM or transactional data layer.
- **Database (4/10):** Lack of normalized client, work order, and invoice item tables; JSONB dumping for core entities; non-atomic sequence generation.
- **Security (3/10):** Critical open endpoints (`/attendance-calculator/save`); admin escalation on missing role; multi-tenancy checks broken.
- **Backend (5/10):** Solid token rotation and health checks, but missing CRUD routes (`POST /api/staff`), missing pagination, and zero transactions.
- **Frontend (4/10):** Rich UI and workable workflows, but massive monolithic files (1,000–2,000 lines each) and dangerous client-side payroll calculations.
- **Business Logic (5/10):** Good Indian statutory understanding (EPF, ESIC, PT, Bonus Act), but breaks the facility management chain (Client -> Site -> Work Order -> Deployment).
- **Testing (1/10):** Single 19-line assertion file. Zero integration tests, zero CI test runners.
- **DevOps (3/10):** No Dockerfiles, no Docker Compose. Relies on ad-hoc systemd on a single VM.
- **Observability (5/10):** Deep health check exists, but lacks structured JSON logging (Winston/Pino), APM, or audit trails.
- **Documentation (4/10):** Decent restore guide for Supabase, but missing environment configuration docs and local database reproduction scripts.
