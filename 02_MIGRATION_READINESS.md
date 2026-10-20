# 02 — Migration Readiness & Breaking Dependency Analysis

**Objective:** Audit the exact operational impact of removing Supabase as a runtime dependency and map every prerequisite required for a zero-downtime cutover.

---

## 1. What Breaks if Supabase is Shut Down Today?

If the Supabase project is paused or disconnected today, **100% of the ERP will immediately collapse**:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        CATASTROPHIC OUTAGE                             │
├────────────────────────────────┬───────────────────────────────────────┤
│ Component                      │ Failure Mode                          │
├────────────────────────────────┼───────────────────────────────────────┤
│ User Authentication            │ Cannot log in; signInWithPassword fails │
│ Token Verification             │ requireAuth fails (auth.getUser fails) │
│ Session Refresh                │ /api/auth/refresh crashes             │
│ Staff Directory                │ StaffPage crashes (direct Supabase query)│
│ Staff Onboarding               │ StaffFormModal cannot insert staff    │
│ Attendance Processing          │ Biometric Excel parser cannot save    │
│ Payroll Engine                 │ PayrollHub cannot fetch or save       │
│ Payslips                       │ PayslipHub cannot load records        │
│ Invoicing                      │ Invoice creation & listing fails      │
│ Document Viewing               │ Metadata lookup fails                 │
│ Deployments                    │ DeploymentsHub crashes                │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

## 2. Exhaustive Dependency Decoupling Matrix

To remove Supabase cleanly, four distinct layers must be rebuilt in Express and PostgreSQL:

```text
                               CURRENT DEPENDENCY                     REPLACEMENT ARCHITECTURE
                     ┌───────────────────────────────────┐    ┌────────────────────────────────────────┐
Auth Provider        │ Supabase Auth (GoTrue API)        │ ──►│ Standalone Express Auth (Argon2id + JWT)│
Session Validation   │ supabaseAdmin.auth.getUser()      │ ──►│ Asymmetric JWKS / Public Key Verify    │
Data Access Layer    │ @supabase/supabase-js (PostgREST) │ ──►│ Direct pg.Pool Connection Pool         │
Database Mutations   │ Frontend Direct Supabase Calls    │ ──►│ Standard Express REST Endpoints        │
Object Storage       │ Supabase Storage / S3             │ ──►│ Pure MinIO / S3 Object Storage API     │
Database Migrations  │ Ad-hoc SQL scripts                │ ──►│ Version-controlled Migration Runner   │
                     └───────────────────────────────────┘    └────────────────────────────────────────┘
```

---

## 3. Detailed Component Decoupling Checklist

### Layer A: Authentication & Identity Provider (GoTrue Replacement)
- [ ] Create standalone `public.users` table with `id`, `email`, `password_hash` (Argon2id), `company_id`, `role`, `status`.
- [ ] Implement `POST /api/auth/login` verifying password against Argon2id hash.
- [ ] Implement `POST /api/auth/refresh` rotating refresh tokens using the existing `public.refresh_tokens` table.
- [ ] Implement `GET /api/auth/me` returning user identity and tenant context from database.
- [ ] Expose `GET /.well-known/jwks.json` serving public keys for token validation.
- [ ] Refactor `authMiddleware.ts` to verify JWT locally using public key without external network calls.

### Layer B: Database Connection Layer (`pg.Pool`)
- [ ] Create `backend/src/db/pool.ts` instantiating a singleton `pg.Pool` with connection pooling (min 5, max 30 connections).
- [ ] Implement `transaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T>` helper supporting automatic `BEGIN`, `COMMIT`, and `ROLLBACK`.
- [ ] Implement health check ping `SELECT 1` with 3-second timeout circuit breaker.
- [ ] Implement graceful connection pool draining on `SIGTERM` / `SIGINT`.

### Layer C: Missing REST Endpoints (To absorb 52 Frontend Supabase Calls)
- [ ] `POST /api/staff` (Replaces `StaffFormModal` direct insert).
- [ ] `GET /api/rate-cards` and `POST /api/rate-cards` (Replaces `RateCardManager` direct queries).
- [ ] `DELETE /api/rate-cards/:id` (Replaces `RateCardManager` direct deletion).
- [ ] `GET /api/deployments` and `POST /api/deployments/bulk` (Replaces `DeploymentsHub` direct writes).
- [ ] `POST /api/payroll/calculate` (Replaces `PayrollHub` client-side bulk upserts).
- [ ] `POST /api/payroll/advances` (Replaces `AdvancesHub` direct upserts).
- [ ] `PUT /api/payroll/payslips/:id/override` (Replaces `PayslipHub` manual override direct updates).

### Layer D: Frontend Client Sanitization
- [ ] Delete `frontend/src/lib/supabase.ts`.
- [ ] Remove `@supabase/supabase-js` from `frontend/package.json`.
- [ ] Replace every instance of `supabase.from('...')` with `fetchWithRetry('/api/...')`.
- [ ] Purge `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from environment files.

---

## 4. Migration Readiness Score & Risk Rating

```text
┌─────────────────────────────────────────────────────────────┐
│             MIGRATION READINESS SCORE: 28 / 100             │
├─────────────────────────────────────────────────────────────┤
│ Architectural Coupling:   VERY HIGH (117 backend, 52 frontend call sites) │
│ Data Complexity:          MEDIUM (14 tables, ~5k records)   │
│ In-Flight Changes:        UNCOMMITTED (PayslipHub.tsx has unstaged edits) │
│ Cutover Risk:             CRITICAL (Live commercial ERP)    │
└─────────────────────────────────────────────────────────────┘
```

### Mandatory Prerequisites Before Touching Production:
1. **Uncommitted Work Tree Cleanliness:** Commit or stash the unstaged changes in `frontend/src/features/payroll/components/PayslipHub.tsx`.
2. **Encrypted Backup Decryption Verification:** Test decrypting and restoring the latest nightly backup release from GitHub Actions.
3. **Local Docker Environment Parity:** Ensure the full database schema, migrations, and seed scripts run cleanly inside local Docker containers before staging deployment.
