# 05 — Production Data Migration Matrix & Transformation Plan

**Objective:** Map 100% of live Supabase PostgreSQL data into the target normalized schema without data loss, truncation, or broken historical references.

---

## 1. Data Preservation Rules (Safety First)

1. **Zero Data Loss:** Never drop a column containing production data. If an old column does not map to the normalized schema, preserve it in a legacy column (`legacy_metadata JSONB`) or archive table.
2. **Deterministic Transforms:** All data migrations must be written as idempotent SQL scripts (`ON CONFLICT DO UPDATE` or `INSERT ... WHERE NOT EXISTS`).
3. **Pre- and Post-Verification:** Row counts, financial totals, and primary key checksums must match before proceeding to subsequent phases.

---

## 2. Table-by-Table Data Migration Matrix

| Source Table (Supabase) | Target Table (Normalized) | Transformation & Mapping Logic | Risk / Edge Case | Manual Review Trigger |
|---|---|---|---|---|
| `companies` | `companies` | 1:1 Direct mapping. `tax_sequence` and `proforma_sequence` initialized to `COALESCE(MAX, 1)`. | Sequence gaps | If `tax_sequence` < existing invoice max number |
| `sites.client_name`, `sites.gstin` | `clients` (**NEW**) | `INSERT INTO clients (name, gstin, company_id) SELECT DISTINCT TRIM(client_name), gstin, company_id FROM sites WHERE client_name IS NOT NULL` | Spelling variations ("ABC Corp" vs "ABC Corp.") | Multiple GSTINs for same client name |
| `sites` | `sites` | Direct mapping. Set `client_id = clients.id` by matching trimmed name. Retain JSONB `rate_cards` as `legacy_rate_cards` until verify. | Missing client match | Any site where `client_id IS NULL` |
| `sites.work_order_ref_no`, `work_order_period` | `work_orders` (**NEW**) | Extract into `work_orders` per site: `wo_number = COALESCE(work_order_ref_no, 'WO-' || code_name)`. | Duplicate WO refs across sites | Any site without WO reference |
| `sites.rate_cards` (JSONB) | `work_order_quotas` (**NEW**) | Unnest JSONB array `sites.rate_cards` into rows: `designation = roleName`, `contracted_headcount = COALESCE(persons, 1)`, `monthly_billing_rate = monthlyRate`. | Malformed JSONB | Non-array `rate_cards` in sites |
| `rate_cards` (Table) | `rate_cards` | 1:1 Direct mapping for payroll rate cards. Retain all wage components (`basic_da`, `hra`, `conveyance`, `bonus_amount`). | Missing site link | `site_id IS NULL` |
| `staff` | `staff` | 1:1 Direct mapping. Ensure `biometric_code` trimmed. Ensure `weekly_off` standardized. | Duplicate biometric codes | Multiple active staff with identical biometric code |
| `site_deployments` | `site_deployments` | 1:1 Direct mapping. Ensure FKs to `staff.id` and `sites.id` exist. | Orphaned staff IDs | Deployments referencing deleted staff |
| `attendance_sheets` | `attendance_sheets` | 1:1 Direct mapping. Retain JSONB summary and records blob. | Data size | Large JSONB payload sizes |
| `attendance_records` | `attendance_records` | 1:1 Direct mapping: `staff_id`, `site_id`, `record_date`, `status`, `duration_hours`. | Duplicate punches | `(staff_id, record_date)` collisions |
| `payroll_records` | `payroll_records` | 1:1 Direct mapping. Preserve manual override columns (`custom_earnings`, `custom_deductions`, `is_manually_edited`, `manual_override_data`). | Column name drift | Missing `total_net_salary` in old records |
| `bonus_disbursements` | `bonus_disbursements` | 1:1 Direct mapping. Verify `amount > 0` and valid `financial_year`. | Orphaned staff IDs | Deleted employee bonus records |
| `invoices` | `invoices` | 1:1 Header mapping: `invoice_no`, `date`, `billing_period`, `sub_total`, `tax_total`, `grand_total`. Retain `payload` as `legacy_payload`. | Unparseable JSON | Discrepancy between header grand_total and payload |
| `invoices.line_items` (JSONB) | `invoice_items` (**NEW**) | Unnest `line_items` JSONB array into relational rows. Calculate tax rates. | Missing line items | Invoices where unnested sum != `invoices.sub_total` |
| `materials` | `materials` | 1:1 Direct mapping. | Duplicate items | Same item name with different HSN code |
| `refresh_tokens` | `refresh_tokens` | 1:1 Direct mapping. Retain active hashes (`expires_at > now() AND revoked_at IS NULL`). | Expired tokens | Inactive tokens can be purged safely |
| `employee_documents` | `employee_documents` | 1:1 Direct mapping: `storage_key`, `file_name`, `staff_id`. | Dead storage keys | Objects missing in MinIO bucket |
| `site_documents` | `site_documents` | 1:1 Direct mapping. | Dead storage keys | Objects missing in MinIO bucket |
| `company_documents` | `company_documents` | 1:1 Direct mapping. | Dead storage keys | Objects missing in MinIO bucket |

---

## 3. SQL Data Migration Pipeline

```sql
-- =============================================================================
-- STEP 1: Extract and Normalize Clients from Sites
-- =============================================================================
INSERT INTO public.clients (id, company_id, name, legal_name, gstin, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  s.company_id,
  TRIM(s.client_name) AS name,
  TRIM(s.client_name) AS legal_name,
  NULLIF(TRIM(s.gstin), '') AS gstin,
  MIN(s.created_at),
  now()
FROM public.sites s
WHERE s.client_name IS NOT NULL AND TRIM(s.client_name) <> ''
GROUP BY s.company_id, TRIM(s.client_name), NULLIF(TRIM(s.gstin), '')
ON CONFLICT (company_id, name) DO NOTHING;

-- Link sites to newly created clients
UPDATE public.sites s
SET client_id = c.id
FROM public.clients c
WHERE s.company_id = c.company_id 
  AND TRIM(s.client_name) = c.name
  AND s.client_id IS NULL;

-- =============================================================================
-- STEP 2: Extract Work Orders from Sites
-- =============================================================================
INSERT INTO public.work_orders (id, site_id, client_id, wo_number, start_date, created_at)
SELECT 
  gen_random_uuid(),
  s.id,
  s.client_id,
  COALESCE(NULLIF(TRIM(s.work_order_ref_no), ''), 'WO-' || COALESCE(s.code_name, s.id::text)),
  CURRENT_DATE,
  now()
FROM public.sites s
WHERE s.client_id IS NOT NULL
ON CONFLICT (wo_number) DO NOTHING;

-- =============================================================================
-- STEP 3: Normalize Invoice Line Items from JSONB
-- =============================================================================
INSERT INTO public.invoice_items (
  id,
  invoice_id,
  description,
  location,
  hsn_code,
  quantity,
  working_days,
  unit_rate,
  amount,
  cgst_rate,
  sgst_rate
)
SELECT 
  gen_random_uuid(),
  inv.id AS invoice_id,
  COALESCE(item->>'description', item->>'roleName', 'Facility Service') AS description,
  COALESCE(item->>'location', '') AS location,
  COALESCE(item->>'hsnCode', '9985') AS hsn_code,
  COALESCE((item->>'persons')::numeric, 1.0) AS quantity,
  COALESCE((item->>'workingDays')::numeric, 30.0) AS working_days,
  COALESCE((item->>'rate')::numeric, (item->>'monthlyRate')::numeric, 0.0) AS unit_rate,
  COALESCE((item->>'amount')::numeric, 0.0) AS amount,
  9.00,
  9.00
FROM public.invoices inv,
LATERAL jsonb_array_elements(
  CASE 
    WHEN jsonb_typeof(inv.line_items) = 'array' THEN inv.line_items 
    ELSE '[]'::jsonb 
  END
) AS item
WHERE inv.line_items IS NOT NULL
ON CONFLICT DO NOTHING;
```

---

## 4. Verification Checksums & Verification Queries

```sql
-- Verification 1: Confirm 0 unmapped sites
SELECT COUNT(*) AS unmapped_sites 
FROM public.sites 
WHERE client_id IS NULL AND client_name IS NOT NULL;

-- Verification 2: Check invoice line item sums match invoice sub_totals
SELECT 
  inv.id,
  inv.invoice_no,
  inv.sub_total AS recorded_subtotal,
  SUM(ii.amount) AS calculated_items_total,
  (inv.sub_total - SUM(ii.amount)) AS variance
FROM public.invoices inv
JOIN public.invoice_items ii ON ii.invoice_id = inv.id
GROUP BY inv.id, inv.invoice_no, inv.sub_total
HAVING ABS(inv.sub_total - SUM(ii.amount)) > 1.00;
```
