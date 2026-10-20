# Facility Management ERP — Complete Engineering Execution Plan

**Objective:** Transition `ERP-AMBE` from a hybrid split-brain prototype into an enterprise-grade, transactional, secure Facility Management ERP.  
**Execution Horizon:** 9 Structured Phases (Phases 0 through 8).

---

## Phase 0: Immediate Stabilization & Security Lockdown

**Goal:** Eliminate active data-loss vulnerabilities and secure all unauthenticated access routes without breaking current frontend user flows.

### Milestones:
1. **P0-M1: Secure Attendance Calculator API (`SEC-001`)**
   - Apply `requireAuth` and `requireAdmin` to `attendanceCalculatorRoutes.ts` (`/preview` and `/save`).
   - Add Zod body validation on `/save` to reject malformed arrays.
2. **P0-M2: Patch Privilege Escalation (`SEC-002`)**
   - In `authMiddleware.ts`, update `fetchUserRole()`: if user has no record in `user_roles`, reject access with 403 Forbidden instead of granting default `'admin'` privileges.
3. **P0-M3: Repair Multi-Tenant Scoping (`SEC-003`)**
   - Query user's assigned `company_id` from `user_roles` or user profile and populate `req.user.company_id`.
   - Ensure `verifySheetOwnership`, `verifyInvoiceOwnership`, and `verifySiteOwnership` strictly enforce tenant matching.
4. **P0-M4: Atomic Invoice Sequence Increment (`SEC-006`)**
   - Replace application-level `SELECT -> compute + 1 -> UPDATE` in `CompanyService.incrementSequence` with a single atomic SQL statement:
     ```sql
     UPDATE companies
     SET tax_sequence = tax_sequence + 1
     WHERE id = $1
     RETURNING tax_sequence, tax_prefix;
     ```
5. **P0-M5: Add Missing `POST /api/staff` Endpoint**
   - Implement `StaffController.create` with Zod validation and unique checking on `biometric_code`.

---

## Phase 1: Core Foundation & Dockerized Infrastructure

**Goal:** Establish reproducible local/cloud environments, comprehensive audit logging, and role-based access control.

### Milestones:
1. **P1-M1: Local Docker Development Stack**
   - Verify `docker compose up -d` boots PostgreSQL 15, MinIO, Backend API, and Frontend Nginx with health checks.
2. **P1-M2: Audit Logging Engine (`audit_logs`)**
   - Create table `public.audit_logs` tracking `user_id`, `action`, `entity_type`, `entity_id`, `old_values`, `new_values`, `ip_address`, `timestamp`.
   - Create Express audit interceptor for mutating operations.
3. **P1-M3: Expanded RBAC Permissions**
   - Extend user roles beyond `admin`/`superadmin` to include:
     - `SUPER_ADMIN`: System-wide access, record unlocking, company setup.
     - `ADMIN` / `OPERATIONS_MANAGER`: Site management, deployments, attendance.
     - `HR_MANAGER`: Staff onboarding, KYC documents, rate card assignments.
     - `ACCOUNTANT`: Payroll calculations, invoice certification, payment ledger.
     - `SITE_SUPERVISOR`: View assigned site, daily attendance entry.
4. **P1-M4: Standardized API Error & Response Schema**
   - Enforce uniform response contracts:
     - Success: `{ success: true, data: T, message?: string }`
     - Failure: `{ success: false, error: { code: string, message: string, details?: any } }`

---

## Phase 2: Core Facility Operations & Normalization

**Goal:** Model the true FM business chain: Company -> Client -> Site -> Work Order -> Quotas -> Staff.

### Milestones:
1. **P2-M1: Client Master Module**
   - Create normalized `clients` table.
   - Run migration script extracting distinct client names from `sites.client_name` to create initial client records.
   - Link `sites.client_id -> clients.id`.
   - Build frontend `ClientsMasterPage.tsx` with full CRUD.
2. **P2-M2: Work Orders & Headcount Quotas**
   - Create `work_orders` and `work_order_quotas` tables.
   - Define contractual headcount and monthly billing rates per designation.
   - Support "Minimum Guaranteed Headcount" vs "Actual Attendance" billing clauses.
3. **P2-M3: Site & Area Structure**
   - Support multi-wing / multi-area structures within a facility (e.g. "Podium", "Club House", "Tower A").
4. **P2-M4: Staff Master Decoupling**
   - Update `StaffFormModal.tsx` to communicate exclusively via `POST /api/staff` and `PUT /api/staff/:id`.
   - Remove direct client-side Supabase write calls.
5. **P2-M5: Deployment Engine Formalization**
   - Shift `site_deployments` management from client-side to backend service `DeploymentService.ts`.
   - Real-time comparison: **Work Order Quota** vs **Scheduled Deployments**.

---

## Phase 3: Attendance Processing & Lock Workflow

**Goal:** Robust, auditable punch capture with automated weekly-off rules and immutable locking.

### Milestones:
1. **P3-M1: Transactional Excel Attendance Pipeline**
   - Refactor `AttendanceCalculatorController.save` to execute inside a single PostgreSQL transaction (`BEGIN ... COMMIT`).
   - If chunk insertion fails, automatically roll back the initial deletion.
2. **P3-M2: Multi-Site Punch Support**
   - Refactor unique constraint on `attendance_records` from `(staff_id, record_date)` to `(staff_id, site_id, record_date)` to allow multi-site reliever deployments.
3. **P3-M3: Attendance Workflow States & Monthly Closing**
   - Introduce states: `DRAFT` -> `SUPERVISOR_SUBMITTED` -> `MANAGER_APPROVED` -> `LOCKED`.
   - Prevent modifications to daily records once monthly sheet is marked `is_locked = true`.

---

## Phase 4: Server-Side Payroll Engine

**Goal:** Move all salary calculations from client React memory into an atomic, tested backend engine.

### Milestones:
1. **P4-M1: Backend `PayrollService.ts`**
   - Port `payrollCalculator.ts` logic into TypeScript backend service.
   - Unit tests covering:
     - Attendance proration: `Basic * (Present + WeeklyOff) / DaysInMonth`
     - EPF statutory cap (12% of Basic up to ₹15,000 threshold)
     - ESIC calculation (0.75% of Gross up to ₹21,000 threshold)
     - Maharashtra Professional Tax (PT slab: ₹200/mo, Feb ₹300/mo, zero for females earning < ₹25,000)
     - Bonus monthly allocation (8.33% statutory cap)
     - Advances recovery deduction
2. **P4-M2: Transactional Payroll Generation Endpoint**
   - `POST /api/payroll/calculate`: Runs batch calculation for a site/month and persists records in `payroll_records` atomically.
3. **P4-M3: Payslip PDF Server Generation**
   - Generate digitally signed, standardized PDF payslips on the server with QR codes and download links.

---

## Phase 5: Billing & Invoicing Engine

**Goal:** Seamless transformation of locked attendance and work orders into GST-compliant invoices.

### Milestones:
1. **P5-M1: Normalized Invoice Line Items**
   - Transition `invoices.line_items` JSONB into normalized `invoice_items` table.
2. **P5-M2: Automated Invoice Generation from Attendance**
   - Auto-calculate billing lines from approved monthly attendance days multiplied by work order billing rates.
3. **P5-M3: Financial Invoicing Controls**
   - Enforce tax invoice immutability: once status = `Approved`, only Credit Notes or Debit Notes can adjust billing totals.

---

## Phase 6: Finance, Receivables & Expense Tracking

**Goal:** Complete accounting loop: payments, client receivables aging, and site expense tracking.

### Milestones:
1. **P6-M1: Accounts Receivable & Payment Ledger**
   - Implement `client_payments` and `invoice_payment_allocations`.
   - Automatically reconcile partial payments and compute outstanding balance.
2. **P6-M2: Site Expenses & Consumables Accounting**
   - Implement `site_expenses` table for cleaning chemicals, machinery maintenance, and uniform costs.
3. **P6-M3: Employee Advance Ledger**
   - Create normalized `employee_advances` table tracking disbursement date, approved amount, monthly EMI recovery, and outstanding balance.

---

## Phase 7: Reporting & Executive Dashboards

**Goal:** Real-time visibility into gross margin, manpower utilization, and receivables aging.

### Milestones:
1. **P7-M1: True Site-Level Profitability Dashboard**
   - Real-time gross profit per site:
     $$\text{Gross Profit} = \text{Billed Revenue} - (\text{Net Wages} + \text{Employer Statutory Costs} + \text{Site Expenses})$$
2. **P7-M2: Aged Receivables Report**
   - Debtors aging bucketed into 0–30, 31–60, 61–90, and 90+ days.
3. **P7-M3: Manpower Shortage & Utilization Analysis**
   - Contracted vs Actual deployment fill-rate percentages per client location.

---

## Phase 8: Production Hardening & CI/CD Pipeline

**Goal:** Zero-downtime reliability, security automation, and performance tuning.

### Milestones:
1. **P8-M1: Comprehensive Automated Test Suite**
   - Jest / Vitest test suite covering:
     - 100% of payroll calculation formulas and statutory slabs.
     - 100% of invoice tax and GST math.
     - Integration tests for auth, refresh token rotation, and RBAC bouncers.
2. **P8-M2: Database Indexing & Pagination**
   - Add composite indexes on `(site_id, record_date)` in `attendance_records` and `(company_id, invoice_date)` in `invoices`.
   - Add cursor-based / limit-offset pagination across all list APIs.
3. **P8-M3: Structured Logging & Telemetry**
   - Integrate Winston / Pino with structured JSON output.
   - Sentry or OpenTelemetry tracing for error monitoring.
4. **P8-M4: GitHub Actions CI/CD Pipeline**
   - Automated workflow: Lint -> Typecheck -> Test -> Docker Build -> Container Registry Push.
