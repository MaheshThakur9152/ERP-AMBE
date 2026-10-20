# 10 — Final Implementation Backlog & First Safe Implementation Phase

---

## 1. Structured Engineering Backlog

| Epic | Task ID | Task Description | Dependencies | Risk | Acceptance Criteria |
|---|---|---|---|---|---|
| **P0: Safety & Work Tree** | `SAFE-01` | Commit/stash unstaged edits in `PayslipHub.tsx` | None | Low | Clean working tree; `git status -s` shows no unstaged diffs. |
| **P0: Security Lockdown** | `SEC-01` | Add `requireAuth` + `requireAdmin` to `/attendance-calculator/*` | None | High | Anonymous requests return 401; admin requests succeed. |
| **P0: Security Lockdown** | `SEC-02` | Patch `authMiddleware.ts` to reject unknown users with 403 Forbidden | None | High | Users without `user_roles` cannot access protected APIs. |
| **P0: Security Lockdown** | `SEC-03` | Inject `company_id` into `req.user` in auth middleware | None | High | `req.user.company_id` is populated; cross-tenant calls return 403. |
| **P0: Data Layer** | `DB-POOL-01` | Implement `pg.Pool` singleton & transaction helper (`withTransaction`) | None | High | Multi-step queries run inside atomic `BEGIN...COMMIT/ROLLBACK`. |
| **P0: Invoicing** | `SEC-04` | Atomic invoice sequence generation via `UPDATE ... RETURNING` | DB-POOL-01 | High | Concurrent requests never produce duplicate invoice numbers. |
| **P1: Decoupling** | `API-STAFF-01`| Implement `POST /api/staff` on Express backend | DB-POOL-01 | Medium | Staff can be created via REST API with Zod validation. |
| **P1: Decoupling** | `UI-STAFF-01` | Refactor `StaffFormModal.tsx` to use `/api/staff` instead of direct DB writes | API-STAFF-01 | Medium | Zero direct Supabase calls in `StaffFormModal.tsx`. |
| **P1: Decoupling** | `API-RC-01` | Implement backend Rate Card endpoints (`GET`, `POST`, `DELETE /api/rate-cards`) | DB-POOL-01 | Medium | `RateCardManager.tsx` routes all CRUD through Express. |
| **P1: Decoupling** | `API-DEP-01` | Implement backend Deployment endpoints (`POST /api/deployments/bulk`) | DB-POOL-01 | Medium | `DeploymentsHub.tsx` routes all saves through Express. |
| **P2: Standalone Auth**| `AUTH-01` | Create `public.users` table with Argon2id hashing | DB-POOL-01 | High | Users stored in local PostgreSQL with encrypted hashes. |
| **P2: Standalone Auth**| `AUTH-02` | Implement RS256 Asymmetric JWT signing & JWKS endpoint | AUTH-01 | High | Token verification works without external Supabase calls. |
| **P2: Standalone Auth**| `AUTH-03` | Dual verifier for bcrypt migration to Argon2id | AUTH-02 | High | Supabase users can log in with existing passwords seamlessly. |
| **P2: Server Payroll** | `PAY-SRV-01` | Port `payrollCalculator.ts` to backend `PayrollService.ts` | DB-POOL-01 | High | Payroll runs transactionally on server; zero client math. |
| **P3: Normalized CRM** | `CRM-01` | Create `clients` table & extract distinct client records from `sites` | DB-POOL-01 | Medium | All sites linked to verified `client_id` foreign keys. |
| **P3: Normalized CRM** | `CRM-02` | Create `work_orders` & `work_order_quotas` tables | CRM-01 | Medium | Headcount quotas tracked separately from actual punches. |
| **P3: Normalized Inv** | `INV-NORM-01`| Extract `invoice_items` from `invoices.line_items` JSONB | DB-POOL-01 | Medium | Invoices join to relational line items table. |
| **P4: Finance Ledger** | `FIN-01` | Create `client_payments` & `invoice_payment_allocations` | INV-NORM-01 | Medium | Payments reconcile against invoices; AR balance automated. |

---

## 2. FIRST SAFE IMPLEMENTATION PHASE (Foundation & Non-Destructive Lockdown)

To guarantee zero regression on the live ERP, **Phase 1 executes strictly non-destructive security patches, clean connection pooling, and the staff API decoupling**:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   FIRST SAFE IMPLEMENTATION PHASE                      │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Git Cleanliness: Commit uncommitted PayslipHub override changes.    │
│ 2. Security Lock: Add requireAuth to attendanceCalculatorRoutes.ts.    │
│ 3. RBAC Fix: Reject unknown users in authMiddleware (403, not admin).  │
│ 4. Connection Pool: Introduce backend/src/db/pool.ts (pg.Pool).        │
│ 5. Staff Decoupling: Create POST /api/staff and refactor StaffFormModal│
│ 6. Verification: Full build, typecheck, lint, and test pass.           │
└────────────────────────────────────────────────────────────────────────┘
```

### Why This Comes First:
1. **Zero Disruption:** It does not modify existing production database schemas or break live user sessions.
2. **Plugs Critical Hole:** Closes the open unauthenticated attendance wipe endpoint (`SEC-001`).
3. **Prepares Connection Layer:** Introduces `pg.Pool` alongside `supabaseAdmin` so routes can be migrated one by one without a big-bang rewrite.
4. **Removes Most Dangerous Direct Write:** Staff registration is the most frequent administrative operation currently bypassing the backend.
