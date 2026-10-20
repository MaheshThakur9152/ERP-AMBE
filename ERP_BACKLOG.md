# Facility Management ERP — Actionable Engineering Backlog

---

## 1. Comprehensive Task Backlog

| ID | Task | Module | Priority | Dependency | Complexity | Status |
|---|---|---|---|---|---|---|
| `SEC-01` | Add `requireAuth` & `requireAdmin` to Attendance Calculator routes (`/preview`, `/save`) | Security / Attendance | P0 | None | Small | ⚪ Todo |
| `SEC-02` | Patch `authMiddleware` to reject unknown users with 403 Forbidden instead of default `'admin'` | Security / Auth | P0 | None | Small | ⚪ Todo |
| `SEC-03` | Populate `company_id` on `req.user` in auth middleware and enforce tenant isolation | Security / Auth | P0 | None | Medium | ⚪ Todo |
| `SEC-04` | Implement atomic PostgreSQL sequence increment for Tax & Proforma invoices | Invoicing / Database | P0 | None | Small | ⚪ Todo |
| `API-01` | Add missing `POST /api/staff` endpoint with Zod schema and biometric uniqueness check | Workforce / API | P0 | None | Medium | ⚪ Todo |
| `DB-01` | Add composite indexes on `attendance_records(site_id, record_date)` & `invoices(company_id, invoice_date)` | Database / Perf | P0 | None | Small | ⚪ Todo |
| `DB-02` | Create `audit_logs` table and Express middleware for all update/delete mutations | Governance | P0 | None | Medium | ⚪ Todo |
| `DOCK-01` | Setup local Docker Compose environment with persistent PostgreSQL and MinIO storage | DevOps | P0 | None | Medium | ⚪ Todo |
| `MOD-01` | Create normalized `clients` table and migrate raw `sites.client_name` to `client_id` FK | Client Master | P1 | DOCK-01 | Medium | ⚪ Todo |
| `MOD-02` | Build frontend `ClientsMasterPage.tsx` with client directory, contacts, and associated sites | Client Master | P1 | MOD-01 | Medium | ⚪ Todo |
| `MOD-03` | Create `work_orders` & `work_order_quotas` tables for headcount and billing commitments | Site Operations | P1 | MOD-01 | Medium | ⚪ Todo |
| `MOD-04` | Build Work Order & Quota manager UI to define contracted roles, shifts, and monthly billing rates | Site Operations | P1 | MOD-03 | Medium | ⚪ Todo |
| `REF-01` | Decouple `StaffFormModal.tsx` from direct Supabase writes; route strictly via `/api/staff` | Workforce / UI | P1 | API-01 | Medium | ⚪ Todo |
| `MOD-05` | Build backend `DeploymentService` and API for scheduled employee-to-site assignments | Deployments | P1 | MOD-03, REF-01 | Medium | ⚪ Todo |
| `MOD-06` | Contrast Work Order Quota vs Deployed Roster vs Actual Attendance in Deployment Hub | Deployments | P1 | MOD-05 | Medium | ⚪ Todo |
| `ATT-01` | Wrap `AttendanceCalculatorController.save` in a transactional database execution | Attendance | P2 | DOCK-01 | Medium | ⚪ Todo |
| `ATT-02` | Implement Attendance monthly locking workflow (`Draft` -> `Approved` -> `Locked`) | Attendance | P2 | ATT-01 | Medium | ⚪ Todo |
| `PAY-01` | Port `payrollCalculator.ts` from frontend to backend `PayrollService.ts` | Payroll | P2 | ATT-02 | Large | ⚪ Todo |
| `PAY-02` | Implement transactional batch payroll generation endpoint `POST /api/payroll/calculate` | Payroll | P2 | PAY-01 | Medium | ⚪ Todo |
| `PAY-03` | Build server-side PDF payslip generation and download worker | Payroll | P2 | PAY-02 | Medium | ⚪ Todo |
| `INV-01` | Normalize `invoices.line_items` JSONB into relational `invoice_items` table | Invoicing | P2 | MOD-03 | Medium | ⚪ Todo |
| `INV-02` | Auto-populate invoice line items directly from locked attendance days and work order rates | Invoicing | P2 | INV-01, ATT-02 | Medium | ⚪ Todo |
| `FIN-01` | Create `client_payments` & `invoice_payment_allocations` tables for receivables tracking | Finance | P3 | INV-01 | Medium | ⚪ Todo |
| `FIN-02` | Build Payments Hub UI for recording client remittances, TDS deductions, and bank references | Finance | P3 | FIN-01 | Medium | ⚪ Todo |
| `FIN-03` | Create `site_expenses` table and UI for tracking cleaning chemicals and consumables | Finance | P3 | MOD-01 | Medium | ⚪ Todo |
| `FIN-04` | Build normalized `employee_advances` ledger with monthly EMI payroll recovery | Finance / Payroll | P3 | PAY-01 | Medium | ⚪ Todo |
| `COMP-01` | Implement statutory ECR and ESIC monthly export file generators | Compliance | P3 | PAY-01 | Medium | ⚪ Todo |
| `REP-01` | Build Site-Level Profitability dashboard (Billed Revenue - Wages - Statutory - Consumables) | Reporting | P4 | FIN-01, FIN-03 | Medium | ⚪ Todo |
| `REP-02` | Build Aged Accounts Receivable report (0-30, 31-60, 61-90, 90+ days overdue) | Reporting | P4 | FIN-01 | Small | ⚪ Todo |
| `TEST-01` | Implement Vitest unit test suite covering 100% of payroll tax math and Indian statutory rules | Testing | P1 | PAY-01 | Medium | ⚪ Todo |
| `TEST-02` | Implement Supertest API integration tests for authentication, RBAC, and invoice lifecycle | Testing | P1 | DOCK-01 | Medium | ⚪ Todo |
| `CI-01` | Setup GitHub Actions CI workflow (lint, typecheck, unit tests, docker build) | CI/CD | P1 | TEST-01 | Small | ⚪ Todo |

---

## 2. TOP 10 THINGS TO FIX FIRST (Immediate Stability & Security)

1. **`SEC-01`: Secure Attendance Calculator Endpoints (`attendanceCalculatorRoutes.ts`)**
   - *Why:* Open to public internet without auth; enables unauthenticated deletion and tampering of company attendance.
2. **`SEC-02`: Patch Default Admin Privilege Escalation (`authMiddleware.ts`)**
   - *Why:* Unmapped users are automatically given `'admin'` privileges instead of being rejected.
3. **`SEC-03`: Repair Tenant Isolation Scoping**
   - *Why:* Tenant ownership checks are bypassed across all services because `req.user.company_id` is never set.
4. **`SEC-04`: Fix Sequential Invoicing Race Condition (`companyService.ts`)**
   - *Why:* Concurrent invoice saves generate duplicate invoice numbers, violating Indian GST compliance.
5. **`API-01`: Implement `POST /api/staff` on Backend**
   - *Why:* Frontend is forced to bypass Express and write directly to Supabase to register employees.
6. **`ATT-01`: Transactional Attendance Calculator Save**
   - *Why:* Current logic deletes existing punches and inserts new rows in separate HTTP chunks. Failure halfway permanently corrupts attendance.
7. **`DB-01`: Add Critical Performance Indexes**
   - *Why:* `attendance_records` will degrade to full-table sequential scans as punch records grow.
8. **`DB-02`: Implement `audit_logs` Table & Interceptor**
   - *Why:* Zero tracking exists for changes made to employee bank accounts, salaries, or invoices.
9. **`REF-01`: Cut Direct Frontend Writes in `StaffFormModal.tsx` & `PayrollHub.tsx`**
   - *Why:* Prevents malicious clients from bypassing backend lock bouncers using the public Supabase anon key.
10. **`TEST-01`: Establish Automated Test Suite for Payroll & Invoicing Math**
    - *Why:* Zero automated tests exist for money-critical operations (EPF, ESIC, Professional Tax, GST).

---

## 3. TOP 10 MODULES/FEATURES TO BUILD NEXT (Business Value Sequence)

1. **Normalized Client Management (`clients` Table & UI)**
   - *Why:* The foundational entity for B2B facility management contracts. Enables multi-site grouping and corporate billing.
2. **Work Orders & Contract Quotas (`work_orders`, `work_order_quotas`)**
   - *Why:* Formally defines contracted headcount, shift requirements, and agreed billing rates per site.
3. **Formalized Deployment & Roster Engine (`site_deployments` Backend)**
   - *Why:* Bridges the gap between **Contracted Manpower (Work Order)** vs **Scheduled Deployment** vs **Actual Biometric Attendance**.
4. **Server-Side Transactional Payroll Engine (`POST /api/payroll/calculate`)**
   - *Why:* Eliminates fragile client-side browser calculations and ensures atomic, immutable monthly wage disbursements.
5. **Attendance Approval & Monthly Locking State Machine**
   - *Why:* Locks attendance data prior to payroll run, preventing payroll discrepancies caused by retroactive punch edits.
6. **Relational Invoice Items & Automated Billing Generation**
   - *Why:* Normalizes line items out of JSONB and auto-generates invoice items from locked attendance sheets and work order rate cards.
7. **Client Payments & Accounts Receivable Ledger (`client_payments`)**
   - *Why:* Tracks actual money collected against issued invoices, calculating outstanding debtor balances and TDS deducted.
8. **Site Expenses & Petty Cash Accounting (`site_expenses`)**
   - *Why:* Captures non-payroll operational costs (chemicals, machinery repairs, uniform replacements) per facility.
9. **Site-Level Gross Profitability Engine**
   - *Why:* Delivers core executive business intelligence: Billed Revenue minus Direct Wages minus Consumables = Real Gross Margin per building.
10. **Statutory Compliance Exporter (EPFO ECR & ESIC Monthly Returns)**
    - *Why:* Saves countless accounting hours by auto-generating statutory upload files directly from approved payroll runs.
