# Facility Management ERP — Business Domain Analysis & Module Roadmap

**Target Industry:** Facility Management, Housekeeping & Security Manpower Operations  
**Planning Horizon:** 2026 – Production Hardening & Feature Expansion

---

## 1. Facility Management Business Domain Analysis

In a commercial facility management enterprise, the operational and financial lifecycle follows a strict sequential value chain:

```text
       Operating Company (Legal Entity, Bank, GSTIN)
                          ↓
       Client (Customer Corporate Org, Billing Terms)
                          ↓
       Site / Facility / Building (Physical Location, Service Areas)
                          ↓
       Work Order / Agreement (Scope, Billing Rates, Required Manpower Quotas)
                          ↓
       Required Manpower (Headcount by Role: e.g. 10 Housekeepers, 2 Supervisors)
                          ↓
       Employee Deployment / Roster (Scheduled staff assigned to shifts & posts)
                          ↓
       Attendance Records (Actual Punches: Present, Absent, Overtime, Relievers)
                          ↓
              ┌───────────┴───────────┐
              ↓                       ↓
    Payroll Engine (Staff)    Billing Engine (Client)
    • Wage Rate Cards         • Client Billing Rate Cards
    • Actual Days Worked      • Attendance-based vs Quota-based
    • Overtime, Deductions    • Management Fee %, Materials
    • EPF, ESIC, PT, Bonus    • Tax / Proforma Invoices
              │                       │
              └───────────┬───────────┘
                          ↓
                 Finance & Ledger
                 • Receivables & Client Collections
                 • Wage Disbursals & Advance Deductions
                 • Consumables & Machinery Costs
                          ↓
              Site-Level Profitability
              (Client Revenue - Site Direct Wages - Material Costs = Gross Margin)
```

---

## 2. Where the Current ERP Breaks This Chain

The existing codebase breaks this vital chain in five critical areas:

### Break 1: Missing "Client" Entity
- **Current State:** Clients do not exist as distinct entities. In `public.sites`, `client_name` and `gstin` are stored as loose string text.
- **Consequence:** Cannot aggregate multiple sites under a single corporate client (e.g. 5 commercial towers belonging to "DLF"). Invoices cannot be grouped, and corporate-level credit limits or receivables cannot be tracked.

### Break 2: Missing "Work Order" and Quota Specifications
- **Current State:** Sites only store a single string `work_order_ref_no` and integer counters (`person_work_order`, `person_worked_site`).
- **Consequence:** There is no concept of contracted shifts, contracted designations, billable vs non-billable posts, or contractual billing rules (e.g., whether the client pays for actual attendance or a guaranteed fixed headcount).

### Break 3: Disconnected Deployment Engine
- **Current State:** The `site_deployments` table exists only as an ad-hoc frontend store (`DeploymentsHub.tsx`) without backend validation, shift scheduling, or roster enforcement.
- **Consequence:** The system cannot verify whether the staff member who punched in on the biometric machine was actually scheduled to work at that site, nor can it track absent replacements (relievers).

### Break 4: Critical Separation of Work Order Quota vs Actual Manpower Worked

In facility management contracts, clients frequently dispute billing based on discrepancies between agreed headcount and physical presence. The system must cleanly distinguish between:

```text
┌───────────────────────────────────────────────┐
│     PERSON ACCORDING TO WORK ORDER (WO)      │
│  • Agreed contractual headcount per shift    │
│  • Example: 10 Housekeepers + 2 Supervisors   │
│  • Fixed monthly billing commitment or cap   │
└───────────────────────┬───────────────────────┘
                        │
                        ▼ (Variance: Shortage / Over-deployment)
┌───────────────────────────────────────────────┐
│       PERSON ACTUALLY WORKED AT SITE          │
│  • Verified attendance punches for the day   │
│  • Example: 8 Regular + 2 Relievers           │
│  • Base for wage calculation & deductions    │
└───────────────────────────────────────────────┘
```

The data model must explicitly support:
1. **Contracted Headcount:** Defined in the Work Order.
2. **Deployed Roster:** Scheduled staff for that shift.
3. **Actual Attendance:** Bio-metric validated punch record.
4. **Billing Variance Clause:** Whether the client bills based on (a) Minimum Guaranteed Manpower, (b) Exact Attendance Days, or (c) Penalty-deducted short staffing.

### Break 5: Client-Side Payroll Calculation & Lack of Finance Ledger
- **Current State:** Payroll calculations run in JavaScript in the browser. Invoices have a status of "Paid" or "Pending", but there is no `payments` table, no payment dates, no bank reconciliation, and no site expense tracking.
- **Consequence:** The business cannot determine true site profitability (Revenue minus Direct Labor minus Consumables).

---

## 3. Prioritized Module Roadmap

Modules are categorized using strict industry priority levels:
- **P0:** Critical Foundation (Security, Data Integrity, Core Stability)
- **P1:** Core Business Operations (Clients, Sites, Work Orders, Staff, Deployments)
- **P2:** Operational Automation (Server Attendance, Server Payroll, Billing, Invoicing)
- **P3:** Advanced Business Workflows (Finance, Receivables, Statutory Compliance, Documents)
- **P4:** Future / Strategic (Client Portal, Profitability Analytics, Mobile App)

---

### P0 — Critical Foundation (Immediate Priority)

#### P0.1: Security Hardening & Unauthenticated Route Protection
- **Module:** Security & Middleware
- **Scope:**
  - Secure `/api/attendance-calculator/preview` and `/api/attendance-calculator/save` behind `requireAuth` and `requireAdmin`.
  - Fix `authMiddleware.ts` default role assignment: unknown users must default to `'unassigned'` (403 Forbidden), never `'admin'`.
  - Fix multi-tenant scoping: populate `company_id` on `req.user` during token verification.
- **DB Changes:** Add `company_id` to `user_roles` table if multi-tenant scoping is required.
- **Impact:** Eliminates data deletion vulnerabilities and unauthorized privilege escalation.

#### P0.2: Unified Backend Data Access Layer (Eliminate Split-Brain)
- **Module:** Core Architecture & Database
- **Scope:**
  - Establish a unified database access pattern on the backend using connection pooling (`pg` pool or ORM) with explicit transaction support (`BEGIN ... COMMIT`).
  - Migrate all direct frontend Supabase queries (`StaffFormModal`, `PayrollHub`, `DeploymentsHub`, `AdvancesHub`) into dedicated Express REST endpoints.
  - Disable client write privileges on PostgreSQL via Supabase RLS policies (read-only or token-scoped).
- **Impact:** Guarantees atomic writes, eliminates orphaned records, and centralizes validation.

#### P0.3: Audit Logging System
- **Module:** System Governance
- **Scope:**
  - Create table `audit_logs` tracking `user_id`, `action`, `entity_type`, `entity_id`, `old_values`, `new_values`, `ip_address`, `timestamp`.
  - Implement an audit middleware/service intercepting all mutations on staff, salaries, site rate cards, attendance, and invoices.
- **Impact:** Complete legal traceability for salary modifications, invoice revisions, and attendance tampering.

---

### P1 — Core Business Operations (Foundation for FM)

#### P1.1: Normalized Client Master Module
- **Module:** Client Management
- **Scope:**
  - Create normalized `clients` table: `id`, `company_id`, `name`, `legal_name`, `gstin`, `pan`, `contact_person`, `phone`, `email`, `billing_address`, `payment_terms_days`, `status`.
  - Migrate `sites.client_name` and `sites.gstin` to foreign key `sites.client_id -> clients.id`.
  - CRUD endpoints: `GET /api/clients`, `POST /api/clients`, `PUT /api/clients/:id`.
  - Frontend: `ClientsMasterPage.tsx` with client cards, associated sites, and contract history.
- **Impact:** Enables corporate multi-site aggregation and centralized billing.

#### P1.2: Work Orders & Manpower Quotas Engine
- **Module:** Site Operations & Contracts
- **Scope:**
  - Create `work_orders` table: `id`, `site_id`, `client_id`, `wo_number`, `start_date`, `end_date`, `billing_frequency` (Monthly/Bi-weekly), `billing_type` (Attendance-based vs Fixed Headcount), `status`.
  - Create `work_order_quotas` table: `id`, `work_order_id`, `designation`, `shift_type` (Day/Night/General), `contracted_headcount`, `billing_rate_per_shift`, `monthly_rate`.
  - Backend validation: Ensure site billing rate cards map directly to approved work orders.
- **Impact:** Replaces informal integer fields (`person_work_order`, `person_worked_site`) with legally auditable contract quotas.

#### P1.3: Employee Lifecycle Master & Missing Backend CRUD
- **Module:** Workforce Management
- **Scope:**
  - Add missing `POST /api/staff` endpoint with full Zod validation and unique constraint on `biometric_code`.
  - Implement structured employee lifecycle transitions: `Onboarding` -> `Active` -> `On Leave` -> `Transferred` -> `Offboarded`.
  - Track employee history in `staff_site_history` (date joined site, date relieved).
- **Impact:** Prevents duplicate biometric registrations and provides historical staff movements across client locations.

#### P1.4: Deployment & Roster Allocation Engine
- **Module:** Site Deployment
- **Scope:**
  - Formalize `site_deployments` on the backend: `POST /api/deployments/bulk`, `GET /api/deployments/site/:siteId`.
  - Contrast **Required Manpower (from Work Order Quotas)** vs **Scheduled Deployments** vs **Actual Attendance**.
  - Highlight staffing shortages (vacancies) in real-time.
- **Impact:** Operational control over site staffing compliance prior to daily shift starts.

---

### P2 — Operational Automation & Financial Processing

#### P2.1: Transactional Server-Side Payroll Engine
- **Module:** Payroll & Compensation
- **Scope:**
  - Port `payrollCalculator.ts` from client-side React code to backend `PayrollService.ts`.
  - Create `payroll_batches` table: `id`, `company_id`, `month_year`, `status` ('Draft'|'Calculated'|'Approved'|'Disbursed'|'Locked'), `total_gross`, `total_net`, `approved_by`.
  - Endpoint: `POST /api/payroll/calculate` (accepts month/year, siteId, runs inside a single database transaction).
  - Atomic bulk upsert with recalculation rollback on error.
- **Impact:** Eliminates client-side execution crashes and ensures immutable payroll records.

#### P2.2: Attendance Verification & Monthly Lock Workflow
- **Module:** Attendance Processing
- **Scope:**
  - Wrap Excel biometric upload into a transactional pipeline (`parse` -> `validate staff` -> `batch insert punches`).
  - Attendance State Machine: `Uploaded` -> `Supervisor Verified` -> `Manager Approved` -> `Locked for Payroll`.
  - Enforce constraint: Once attendance sheet is `Locked`, no daily punches can be modified without SuperAdmin override.
- **Impact:** Prevents payroll recalculation discrepancies caused by post-facto attendance edits.

#### P2.3: Atomic Invoicing & Sequential Number Generator
- **Module:** Invoicing & Billing
- **Scope:**
  - Eliminate sequence race condition using PostgreSQL atomic increment:
    ```sql
    UPDATE companies 
    SET tax_sequence = tax_sequence + 1 
    WHERE id = $1 
    RETURNING tax_sequence, tax_prefix;
    ```
  - Normalize invoice line items into `invoice_items` table: `id`, `invoice_id`, `description`, `hsn_code`, `rate`, `working_days`, `persons`, `amount`, `cgst_rate`, `sgst_rate`.
  - Auto-generate invoice line items directly from locked attendance sheets and work order rate cards.
- **Impact:** Eliminates duplicate invoice numbers and guarantees tax compliance under Indian GST laws.

---

### P3 — Advanced Business Workflows & Governance

#### P3.1: Accounts Receivable & Client Payments Ledger
- **Module:** Finance & Cash Flow
- **Scope:**
  - Create `client_payments` table: `id`, `client_id`, `company_id`, `payment_date`, `amount_received`, `tds_deducted`, `bank_reference`, `mode` ('NEFT'|'RTGS'|'Cheque').
  - Create `payment_allocations` table: Maps a payment against one or more `invoice_id`s.
  - Automatically update invoice status: `Paid`, `Partially Paid`, `Overdue`.
- **Impact:** Gives management real-time visibility into outstanding receivables and aged debtors (30/60/90 days).

#### P3.2: Site Expenses & Petty Cash Management
- **Module:** Cost Control
- **Scope:**
  - Create `site_expenses` table: `id`, `site_id`, `expense_category` ('Chemicals', 'Machine Repair', 'Uniforms', 'Local Conveyance'), `amount`, `receipt_doc_id`, `spent_by`, `approved_by`.
- **Impact:** Tracks direct non-manpower costs required for site-level profitability calculations.

#### P3.3: Statutory Compliance Tracker (PF / ESIC / PT / Labor Welfare)
- **Module:** Legal & Statutory Compliance
- **Scope:**
  - Monthly automated generation of EPFO ECR text format files and ESIC contribution monthly upload files.
  - Verification checklist for monthly labor compliance submissions (Form 16, Form T, Minimum Wages register).
- **Impact:** Protects the company from severe statutory labor penalties during client audits.

---

### P4 — Future Strategic Modules

#### P4.1: Site & Client Level Profitability Engine
- **Module:** Executive Analytics
- **Formula:**
  $$\text{Gross Margin} = \text{Invoice Revenue} - (\text{Direct Site Wages} + \text{Employer Statutory PF/ESIC} + \text{Consumables} + \text{Machinery Depreciation})$$
- **Deliverable:** Executive dashboard displaying top 10 most profitable and bottom loss-making client sites.

#### P4.2: Client Billing & Attendance Verification Portal
- **Scope:** Restricted role `client_representative` with access to view only their assigned sites, download certified tax invoices, and inspect daily attendance counts.

---

## 4. Recommended Module Execution Order

```text
Step 1: Security Fixes & Unauthenticated Route Protection (P0)
   ↓
Step 2: Normalized Client Master & Work Order Quotas (P1)
   ↓
Step 3: Unified Backend Staff CRUD & Biometric Validation (P1)
   ↓
Step 4: Transactional Attendance Processing & Lock Workflow (P2)
   ↓
Step 5: Server-Side Transactional Payroll Engine (P2)
   ↓
Step 6: Atomic Sequential Invoicing & Normalized Line Items (P2)
   ↓
Step 7: Accounts Receivable & Payment Allocations (P3)
   ↓
Step 8: Site Expenses, Petty Cash & Direct Cost Tracking (P3)
   ↓
Step 9: Site Profitability & Executive Dashboard (P4)
```
