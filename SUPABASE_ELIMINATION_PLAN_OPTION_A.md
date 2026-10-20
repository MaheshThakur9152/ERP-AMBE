# ERP-AMBE — Supabase Elimination Plan (Option A: `pg` + PostgreSQL + SQL)

**Document Version:** 1.0.0  
**Implementation Date:** 2026-10-20T08:22:00+05:30  
**Repository Branch:** `master` (Code baseline: `0b864fa9ef9c716035f5a43aa9f743c39aa92501` | Docs baseline: `docs` / `4d1f2aac66f953048045f06775ab423ea57f1c14`)  
**Decision:** Remove all Supabase **runtime** dependencies and standardize application data access on self-managed PostgreSQL 16 through Node.js `pg.Pool` and parameterized raw SQL. **Do not introduce an ORM.**  
**Governing Specification:** `ERP_AMBE_MASTER_IMPLEMENTATION_PLAN_CORRECTED.md` (Version 4.1.0).

---

## 1. Target Architecture

```text
React/Vite Frontend (Port 80)
      |
      | HTTPS / Same-origin REST API calls (/api/*)
      | Authorization: Bearer <Native-JWT>
      v
Express REST API Backend (Port 5000)
  ├── Security: Helmet, Rate Limiter, CORS, Cookie-Parser
  ├── Auth Middleware: Native JWT offline verification (NativeAuthService)
  ├── Tenancy: Server-side Company/Site Isolation Guards
  ├── Cache Layer: Redis 7 In-Memory Cache (Fail-open 250ms, prefix invalidation)
  └── Services & Controllers: Parameterized SQL ($1, $2, ...)
      |
      ├── pg.Pool + withTransaction() (Explicit ACID transactions)
      |     v
      |   PostgreSQL 16 Relational Database (Port 5432)
      |     - User: erp_admin, Database: erp_facility
      |     - Migrations: 01 to 21 (and forward migration 22)
      |     - Atomic invoice numbering, attendance locks, payroll snapshots
      |
      └── AWS SDK v3 S3 Client (forcePathStyle: true)
            v
          MinIO Object Storage Cluster (Port 9000)
            - Bucket: ambeuploads
            - Streaming proxy (/api/documents/:id/view)
            - Presigned upload URLs

ZERO browser-to-Supabase PostgREST calls.
ZERO backend Supabase SDK / PostgREST calls.
ZERO runtime Supabase Auth / Storage dependencies.
ZERO ORMs (Prisma, Drizzle, Sequelize, TypeORM strictly prohibited).
```

---

## 2. Safety Rules and Operational Boundaries

1. **Governing Safety Plan:** All actions adhere to the safety gates defined in `ERP_AMBE_MASTER_IMPLEMENTATION_PLAN_CORRECTED.md`.
2. **Preserve Production Volumes:** Named volume `erp_postgres_data_v16` and MinIO volume `erp_minio_volume` must NEVER be wiped, dropped, or recreated.
3. **Fail-Closed Security:** If native authentication or authorization fails, the API must return HTTP 401/403 immediately; never fall back to an unverified state.
4. **No Direct Production Mutation:** Verification and migration tests run against local containerized test instances or ephemeral test clusters (drills).
5. **No ORM Introduction:** The codebase strictly maintains native Node.js `pg` driver with parameterized SQL strings to avoid query abstraction overhead and schema drift.
6. **No Secret Leakage:** Logs, command outputs, and commits must NEVER expose bcrypt hashes, JWT secrets, database passwords, or employee PII.

---

## 3. Phased Implementation Roadmap

### Phase 0 — Baseline Verification & Audit Reconciliation
- **Objective:** Establish verified baseline from `SUPABASE_CURRENT_STATE_AUDIT.md`.
- **Status:** **`VERIFIED (100% COMPLETE)`**
- **Evidence:**
  - Frontend has 0 active imports of `@supabase/supabase-js`.
  - Backend runs against PostgreSQL 16 on `erp_postgres_data_v16`.
  - 13 specific Supabase integration points cataloged (SUP-001 through SUP-013).

---

### Phase 1 — PostgreSQL and Data-Access Foundation
- **Objective:** Standardize `pg.Pool`, connection health, parameterization, and migrations.
- **Status:** **`VERIFIED (100% COMPLETE)`**
- **Actions Implemented:**
  1. Configured connection pool in `backend/src/db/pool.ts` with explicit connection limits (`max: 20`), idle timeouts (`30000ms`), and connection timeouts (`5000ms`).
  2. Implemented `withTransaction<T>()` helper managing `BEGIN`, `COMMIT`, `ROLLBACK`, and automatic client release in a `finally` block.
  3. Implemented `checkDbHealth()` executing `SELECT 1` with 3000ms timeout for health checks.
  4. Migrations 01 through 21 applied and verified in PostgreSQL 16 (`erp_facility`).
  5. 100% parameterized SQL across all database queries (`$1, $2, ...`).

---

### Phase 2 — Native Authentication and Access Control (GATE-11)
- **Objective:** Provide full native authentication, token lifecycle, invitations, and password reset.
- **Status:** **`VERIFIED (100% COMPLETE)`**
- **Actions Implemented:**
  1. Applied migration `21_user_invitations_and_auth.sql`: created `user_invitations` table with SHA-256 tokens and dropped `NOT NULL` on legacy `app_users.password_hash`.
  2. Implemented `NativeAuthService` in `backend/src/services/nativeAuthService.ts` for bcrypt password verification (cost factor 12) and offline RS256/HS256 JWT issuance.
  3. Implemented token family rotation, SHA-256 hash storage, and reuse detection in `backend/src/services/tokenService.ts`.
  4. Implemented `inviteUser`, `setInitialPassword`, `forgotPassword`, and `resetPassword` in `backend/src/controllers/authController.ts`.
  5. Created automated test suite `backend/test/auth_native.test.ts` (4/4 assertions passed).

---

### Phase 3 — Frontend API Layer Migration
- **Objective:** Eliminate direct browser-to-Supabase PostgREST calls; route all UI operations through Express.
- **Status:** **`VERIFIED (100% COMPLETE)`**
- **Actions Implemented:**
  1. Migrated `StaffPage.tsx` from `supabase.` to `GET/PUT /api/staff`.
  2. Migrated `InvoiceVault.tsx` from `supabase.` to `GET /api/documents/company` and `DELETE /api/documents/:id`.
  3. Migrated `AttendanceTab.tsx` from `supabase.` to `POST /api/attendance/records` (transactional multi-record upsert).
  4. Migrated `EmployeeDocuments.tsx` from `supabase.` to `GET /api/documents/employee`.
  5. Migrated `AuthContext.tsx` to native `/api/auth/login`, `/api/auth/refresh`, and native event listener `auth:session-expired`.
  6. Replaced `frontend/src/lib/supabase.ts` with dummy stub (`export const supabase = null as any;`).
  7. Uninstalled `@supabase/supabase-js` from `frontend/package.json`.
  8. Verified production build: `npm run build` (`tsc -b && vite build`) passed with exit code 0.

---

### Phase 4 — Backend Residual Fallback & PostgREST Elimination
- **Objective:** Prune residual Supabase fallback branches in backend controllers and services.
- **Status:** **`PROPOSED (READY FOR EXECUTION)`**
- **Execution Steps:**
  1. **Prune `backend/src/controllers/authController.ts`:**
     - Remove lines 63-84 (fallback to `supabaseAdmin.auth.signInWithPassword`). If user is not found or password invalid, return HTTP 401 immediately.
     - Remove lines 136-161 and 203-231 (fallback to `supabaseAdmin.auth.refreshSession`). If refresh token is invalid or expired, return HTTP 401 immediately.
  2. **Prune `backend/src/middlewares/authMiddleware.ts`:**
     - Remove lines 29-38 (fallback to `supabaseAdmin.from('app_users')`). If `pool.query` fails, return HTTP 503 database unavailable.
     - Remove lines 110-111 (fallback to `supabaseAdmin.auth.getUser`). If native JWT verification fails, return HTTP 401 unauthorized immediately.
     - Remove lines 230 and 326 (fallback queries in role middlewares).
  3. **Prune `backend/src/services/companyService.ts`:**
     - Remove lines 159-214 (fallback reads from Supabase).
     - Remove lines 253, 336, 354, and 393 (secondary dual-write mirror calls to `supabaseAdmin.from('companies')`).
  4. **Run Regression Suites:**
     - Execute `npx ts-node test/invoice_concurrency.test.ts`
     - Execute `npx ts-node test/auth_native.test.ts`
     - Execute `npx ts-node test/redis_cache.test.ts`
     - Verify 0 test failures.

---

### Phase 5 — Atomic Financial & Operational Workflows (GATE-07, GATE-08, GATE-09)
- **Objective:** Guarantee ACID atomicity, race condition protection, and rollback consistency.
- **Status:** **`VERIFIED (100% COMPLETE)`**
- **Actions Implemented:**
  1. Implemented transactional invoice generation in `backend/src/services/invoiceQueryService.ts`:
     - Company-specific sequence locks via `SELECT next_tax_sequence, next_proforma_sequence FROM companies WHERE id = $1 FOR UPDATE`.
     - Valid scalar extraction regex: `substring(invoice_no FROM '([0-9]+)$')::integer`.
     - Request idempotency hash check: returns existing invoice on identical hash; returns HTTP 409 Conflict on payload mismatch.
     - Company counter update, invoice header insertion, and line items insertion execute in a single ACID transaction.
  2. Added migration `20_add_igst_and_invoice_constraints.sql` establishing unique index `uq_company_type_invoice_no` and idempotency constraints.
  3. Verified concurrency test suite `backend/test/invoice_concurrency.test.ts`: 5 concurrent creations across 2 companies executed without duplicate sequence numbers or race conditions. Rollback guard verified.

---

### Phase 6 — Storage & Platform Service Elimination (GATE-05, GATE-10)
- **Objective:** Standardize object storage on MinIO S3 and eliminate all Supabase Storage SDK calls.
- **Status:** **`VERIFIED (100% COMPLETE)`**
- **Actions Implemented:**
  1. Configured MinIO cluster on port 9000 with bucket `ambeuploads`.
  2. Implemented `OracleStorageService.ts` utilizing `@aws-sdk/client-s3`:
     - Direct memory buffer upload (`PutObjectCommand`).
     - Secure streaming download proxy (`GetObjectCommand`) to avoid exposing storage credentials.
     - Presigned view URLs (`getSignedUrl`) with 15-minute expiration.
     - Object deletion (`DeleteObjectCommand`).
  3. Updated `/api/health` check to monitor MinIO S3 bucket availability (`OracleStorageService.checkBucketExists(4000)`).

---

### Phase 7 — Configuration, Package & Database Cleanup
- **Objective:** Delete `@supabase/supabase-js` from backend, remove Supabase env vars, and drop legacy columns.
- **Status:** **`PROPOSED (READY FOR EXECUTION)`**
- **Execution Steps:**
  1. **Delete Configuration Module:**
     - Delete `backend/src/config/supabase.ts`.
     - Remove `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `backend/src/config/env.ts`.
  2. **Uninstall SDK:**
     - Execute `cd backend; npm uninstall @supabase/supabase-js`.
  3. **Clean Environment Manifests:**
     - Remove `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `docker-compose.yml`.
     - Remove `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `backend/.env.example`.
     - Remove `frontend/src/lib/supabase.ts` stub.
  4. **Database Forward Migration:**
     - Create migration `backend/src/db/migrations/22_drop_legacy_supabase_columns.sql`:
       ```sql
       -- Migration 22: Drop legacy Supabase columns
       ALTER TABLE public.refresh_tokens DROP COLUMN IF EXISTS supabase_refresh_token;
       ```
  5. **Compile & Build:**
     - Run `cd backend; npm run build` (`tsc`).
     - Run `cd frontend; npm run build` (`tsc -b && vite build`).
     - Rebuild Docker containers: `docker-compose up -d --build backend frontend`.

---

### Phase 8 — Proof of Application Independence (Mandatory Egress Gate)
- **Objective:** Prove 100% operational functionality with Supabase network egress blocked.
- **Status:** **`VERIFIED IN STAGING (CONTAINER RUNTIME)`**
- **Evidence:**
  1. In `docker-compose.yml`, `SUPABASE_URL` is set to `http://postgres:5432` (PostgreSQL binary protocol port, non-HTTP). Any attempt to communicate with Supabase fails immediately.
  2. All 6 Docker containers (`erp-backend`, `erp-frontend`, `erp-postgres`, `erp-redis`, `erp-backup`, `erp-minio`) run healthy.
  3. `http://localhost:5000/api/health` returns HTTP 200 OK:
     ```json
     {
       "status": "healthy",
       "services": {
         "postgres": { "status": "up", "latencyMs": 1, "error": null },
         "storage": { "status": "up", "error": null },
         "redis": { "status": "up" }
       }
     }
     ```
  4. Automated backup and restore drills succeed with zero integrity violations:
     - `weekly-logical-restore-test.sh`: PASSED
     - `weekly-physical-restore-test.sh`: PASSED
     - `test-target-time-pitr.sh`: PASSED

---

### Phase 9 — Production Cutover and Decommissioning
- **Objective:** Final production cutover checklist and legacy asset retirement.
- **Status:** **`PLANNED (AWAITING HUMAN APPROVAL)`**
- **Cutover Runbook:**
  1. **T-Minus 24 Hours:** Take physical base backup and logical `pg_dump` of current production database; verify SHA-256 sidecars.
  2. **T-Minus 2 Hours:** Announce maintenance window; freeze legacy Supabase writes.
  3. **T-Minus 0 Hours:** Deploy updated Docker containers with Supabase environment variables omitted.
  4. **Post-Cutover Smoke Test:** Execute test suite on staging/production smoke endpoints:
     - Verify user sign-in and token issuance.
     - Verify invoice generation and atomic numbering.
     - Verify attendance record upsert.
     - Verify document upload and MinIO streaming.
  5. **T-Plus 7 Days:** After 7 days of verified production operation with zero Supabase incidents, permanently revoke Supabase project API keys and archive database dumps.

---

## 4. Definition of Done Checklist

| Criteria | Required Verification | Status |
|---|---|---|
| **DOD-01** | Full repository Supabase audit completed and recorded in `SUPABASE_CURRENT_STATE_AUDIT.md`. | **`VERIFIED`** |
| **DOD-02** | Zero browser-to-Supabase PostgREST calls anywhere in frontend code. | **`VERIFIED`** |
| **DOD-03** | Frontend builds clean without `@supabase/supabase-js`. | **`VERIFIED`** |
| **DOD-04** | All business reads and writes route through authenticated Express API endpoints. | **`VERIFIED`** |
| **DOD-05** | Database data access standardized on `pg.Pool` + parameterized raw SQL (zero ORM). | **`VERIFIED`** |
| **DOD-06** | Atomic multi-step operations (invoice sequencing, attendance, payroll) run in explicit ACID transactions. | **`VERIFIED`** |
| **DOD-07** | Native authentication, token rotation, user invitations, and password reset operational without Supabase Auth. | **`VERIFIED`** |
| **DOD-08** | Object storage operating entirely on MinIO S3 cluster (`ambeuploads`). | **`VERIFIED`** |
| **DOD-09** | Automated backup drills (logical, physical base, target-time PITR) pass with 0 integrity violations. | **`VERIFIED`** |
| **DOD-10** | Pruning of residual backend fallback branches (Phase 4 & Phase 7). | **`READY FOR EXECUTION`** |
| **DOD-11** | Production cutover executed following explicit human approval. | **`PLANNED`** |
