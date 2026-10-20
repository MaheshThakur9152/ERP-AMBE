# 04 — Forensic PostgreSQL Database Index Audit

**Audit Objective:** Analyze real query patterns from Express services and React components, identify missing foreign key indexes, eliminate sequential scans, and design high-performance composite indexes.

---

## 1. Indexing Principles for PostgreSQL

In PostgreSQL:
1. **Foreign Keys DO NOT automatically create indexes.** While PostgreSQL enforces foreign key constraints, it does not index referencing columns. Deleting or joining parent tables results in expensive sequential table scans on the child table.
2. **Column Order Matters in Composite Indexes:** Queries filtering on `(colB)` cannot use an index on `(colA, colB)`. The most selective, equality-filtered column must come first.
3. **Partial Indexes Save Space:** Indexing only active records (`WHERE status = 'Active'`) cuts index bloat by 50–80%.

---

## 2. Table-by-Table Index Analysis

### 1. Table: `public.attendance_records` (Highest Query Volume)
- **Current Indexes:**
  - `attendance_records_pkey` on `id` (PK)
  - `attendance_records_staff_id_record_date_key` UNIQUE on `(staff_id, record_date)`
- **Query Pattern Analysis:**
  - `AttendanceCalculatorController.preview` queries punches by `record_date` range.
  - `AttendanceCalculatorController.save` deletes punches by `(staff_id, record_date)`.
  - Monthly attendance summaries query by `site_id` and date range (`record_date >= start AND record_date <= end`).
- **Audit Finding:** **CRITICAL MISSING INDEX.** Queries filtering by `site_id` and `record_date` will perform sequential scans across all employee punches.
- **Classification:** `MISSING INDEX`
- **Recommendation:**
  ```sql
  CREATE INDEX idx_attendance_records_site_date 
  ON public.attendance_records(site_id, record_date);
  ```

---

### 2. Table: `public.staff`
- **Current Indexes:**
  - `staff_pkey` on `id` (PK)
- **Query Pattern Analysis:**
  - Frequent lookups by `biometric_code` during Excel attendance matching:
    `WHERE biometric_code = $1`
  - Frequent filtering by site:
    `WHERE site_id = $1 AND status = 'Active'`
  - Join on salary rate card:
    `JOIN rate_cards ON staff.rate_card_id = rate_cards.id`
- **Audit Finding:** `biometric_code` has **NO INDEX** and **NO UNIQUE CONSTRAINT**. Biometric matching scans the full staff table.
- **Classification:** `MISSING INDEX` & `MISSING UNIQUE CONSTRAINT`
- **Recommendation:**
  ```sql
  -- Unique active biometric index (prevents duplicate biometric registrations)
  CREATE UNIQUE INDEX idx_staff_biometric_code_active 
  ON public.staff(biometric_code) 
  WHERE status = 'Active' AND biometric_code IS NOT NULL;

  -- Foreign key index for site allocation
  CREATE INDEX idx_staff_site_id 
  ON public.staff(site_id);

  -- Foreign key index for salary rate card
  CREATE INDEX idx_staff_rate_card_id 
  ON public.staff(rate_card_id);
  ```

---

### 3. Table: `public.invoices`
- **Current Indexes:**
  - `invoices_pkey` on `id` (PK)
  - `invoices_invoice_no_key` UNIQUE on `invoice_no`
- **Query Pattern Analysis:**
  - Invoices filtered by company entity:
    `WHERE company_id = $1 ORDER BY invoice_date DESC`
  - Invoices filtered by site and status:
    `WHERE site_id = $1 AND status = $2`
- **Audit Finding:** Foreign keys `company_id` and `site_id` are completely unindexed. Listing invoices for an operating entity forces sequential scans.
- **Classification:** `MISSING INDEX`
- **Recommendation:**
  ```sql
  -- Tenant-scoped chronological index
  CREATE INDEX idx_invoices_company_date 
  ON public.invoices(company_id, invoice_date DESC);

  -- Site-level billing index
  CREATE INDEX idx_invoices_site_id 
  ON public.invoices(site_id);
  ```

---

### 4. Table: `public.sites`
- **Current Indexes:**
  - `sites_pkey` on `id` (PK)
- **Query Pattern Analysis:**
  - Sites filtered by operating entity:
    `WHERE company_id = $1`
  - Unique lookup by code name:
    `WHERE code_name = $1`
- **Audit Finding:** `company_id` foreign key is unindexed.
- **Classification:** `MISSING INDEX`
- **Recommendation:**
  ```sql
  CREATE INDEX idx_sites_company_id 
  ON public.sites(company_id);

  CREATE UNIQUE INDEX idx_sites_code_name 
  ON public.sites(code_name) 
  WHERE code_name IS NOT NULL AND code_name <> '';
  ```

---

### 5. Table: `public.payroll_records`
- **Current Indexes:**
  - `payroll_records_pkey` on `id` (PK)
  - `payroll_records_staff_month_unique` UNIQUE on `(staff_id, month_year)`
- **Query Pattern Analysis:**
  - Monthly payroll listings query:
    `WHERE month_year = $1`
  - Bonus accrual queries:
    `WHERE month_year IN (...) AND staff_id IN (...)`
- **Audit Finding:** The unique constraint on `(staff_id, month_year)` supports queries leading with `staff_id`, but queries filtering **only** by `month_year` cannot use this index efficiently!
- **Classification:** `MISSING INDEX` (Wrong column order for monthly lookups)
- **Recommendation:**
  ```sql
  -- Fast monthly payroll runs index
  CREATE INDEX idx_payroll_records_month_year 
  ON public.payroll_records(month_year);
  ```

---

### 6. Document Metadata Tables (`employee_documents`, `site_documents`, `company_documents`)
- **Current Indexes:** Only PKs on `id`.
- **Audit Finding:** Foreign keys (`staff_id`, `site_id`, `company_id`) are unindexed.
- **Classification:** `MISSING INDEX`
- **Recommendation:**
  ```sql
  CREATE INDEX idx_employee_documents_staff_id ON public.employee_documents(staff_id);
  CREATE INDEX idx_site_documents_site_id ON public.site_documents(site_id);
  CREATE INDEX idx_company_documents_company_id ON public.company_documents(company_id);
  ```

---

## 3. Executive Index Audit Summary

| Table | Column(s) | Type | Status | Action Required |
|---|---|---|---|---|
| `attendance_records` | `(site_id, record_date)` | B-Tree | 🔴 Missing | Add composite index |
| `staff` | `biometric_code` (Active) | Unique B-Tree | 🔴 Missing | Add partial unique index |
| `staff` | `site_id` | B-Tree FK | 🔴 Missing | Add index |
| `staff` | `rate_card_id` | B-Tree FK | 🔴 Missing | Add index |
| `invoices` | `(company_id, invoice_date)` | B-Tree | 🔴 Missing | Add composite index |
| `invoices` | `site_id` | B-Tree FK | 🔴 Missing | Add index |
| `sites` | `company_id` | B-Tree FK | 🔴 Missing | Add index |
| `payroll_records` | `month_year` | B-Tree | 🔴 Missing | Add index |
| `employee_documents` | `staff_id` | B-Tree FK | 🔴 Missing | Add index |
| `site_documents` | `site_id` | B-Tree FK | 🔴 Missing | Add index |
| `company_documents` | `company_id` | B-Tree FK | 🔴 Missing | Add index |
| `refresh_tokens` | `token_hash`, `user_id` | B-Tree | ✅ Good | Retain existing indexes |
| `bonus_disbursements` | `staff_id`, `financial_year` | B-Tree | ✅ Good | Retain existing indexes |

---

## 4. Single-Batch Index Migration Script

This non-blocking migration script can be run safely against PostgreSQL:

```sql
-- =============================================================================
-- Migration: Add Missing Production Performance Indexes
-- =============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_records_site_date 
  ON public.attendance_records(site_id, record_date);

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_staff_biometric_code_active 
  ON public.staff(biometric_code) 
  WHERE status = 'Active' AND biometric_code IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staff_site_id 
  ON public.staff(site_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staff_rate_card_id 
  ON public.staff(rate_card_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_company_date 
  ON public.invoices(company_id, invoice_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_site_id 
  ON public.invoices(site_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sites_company_id 
  ON public.sites(company_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payroll_records_month_year 
  ON public.payroll_records(month_year);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employee_documents_staff_id 
  ON public.employee_documents(staff_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_site_documents_site_id 
  ON public.site_documents(site_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_company_documents_company_id 
  ON public.company_documents(company_id);
```
