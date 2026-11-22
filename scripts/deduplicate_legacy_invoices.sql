-- ==============================================================================
-- DEDUPLICATE LEGACY IMPORTED INVOICES
-- Removes duplicate "Legacy CSV import" bills when a real platform bill exists
-- ==============================================================================

BEGIN;

-- 1. Reassign payments from duplicate "Legacy CSV import" invoices to the original invoices
WITH dupes AS (
  SELECT 
    legacy.id AS legacy_id,
    original.id AS original_id,
    legacy.invoice_no
  FROM public.invoices legacy
  JOIN public.invoices original 
    ON regexp_replace(UPPER(legacy.invoice_no), '[^A-Z0-9]', '', 'g') = regexp_replace(UPPER(original.invoice_no), '[^A-Z0-9]', '', 'g')
   AND legacy.site_id = original.site_id
   AND legacy.id <> original.id
  WHERE legacy.legacy_notes = 'Legacy CSV import'
    AND (original.legacy_notes IS DISTINCT FROM 'Legacy CSV import' OR original.created_at < legacy.created_at)
)
UPDATE public.invoice_payments p
SET invoice_id = d.original_id
FROM dupes d
WHERE p.invoice_id = d.legacy_id
  AND NOT EXISTS (
    SELECT 1 FROM public.invoice_payments p2 
    WHERE p2.invoice_id = d.original_id 
      AND p2.amount = p.amount 
      AND p2.paid_date = p.paid_date
  );

-- 2. Delete orphaned duplicate payments
DELETE FROM public.invoice_payments
WHERE invoice_id IN (
  SELECT legacy.id
  FROM public.invoices legacy
  JOIN public.invoices original 
    ON regexp_replace(UPPER(legacy.invoice_no), '[^A-Z0-9]', '', 'g') = regexp_replace(UPPER(original.invoice_no), '[^A-Z0-9]', '', 'g')
   AND legacy.site_id = original.site_id
   AND legacy.id <> original.id
  WHERE legacy.legacy_notes = 'Legacy CSV import'
    AND (original.legacy_notes IS DISTINCT FROM 'Legacy CSV import' OR original.created_at < legacy.created_at)
);

-- 3. Delete the duplicate "Legacy CSV import" invoices
DELETE FROM public.invoices
WHERE id IN (
  SELECT legacy.id
  FROM public.invoices legacy
  JOIN public.invoices original 
    ON regexp_replace(UPPER(legacy.invoice_no), '[^A-Z0-9]', '', 'g') = regexp_replace(UPPER(original.invoice_no), '[^A-Z0-9]', '', 'g')
   AND legacy.site_id = original.site_id
   AND legacy.id <> original.id
  WHERE legacy.legacy_notes = 'Legacy CSV import'
    AND (original.legacy_notes IS DISTINCT FROM 'Legacy CSV import' OR original.created_at < legacy.created_at)
);

-- 3b. Delete superseded CSV rows (renumbered bills, blank amount) that carry no payments
DELETE FROM public.invoices i
WHERE i.legacy_notes = 'Legacy CSV import'
  AND COALESCE(i.grand_total, 0) = 0
  AND NOT EXISTS (SELECT 1 FROM public.invoice_payments p WHERE p.invoice_id = i.id);

-- 3c. Reissued bills imported with the CSV note as their billing period
UPDATE public.invoices SET billing_period = '1st to 30th November 2025'
WHERE legacy_notes = 'Legacy CSV import' AND billing_period ILIKE 'Above changed to 15%' AND TRIM(invoice_no) = 'ASF/26-27/015';
UPDATE public.invoices SET billing_period = '1st to 28th February 2026'
WHERE legacy_notes = 'Legacy CSV import' AND billing_period ILIKE 'Above changed to 16%' AND TRIM(invoice_no) = 'ASF/26-27/016';

-- 4. Standardize types across any remaining imported legacy bills to ERP casing
-- Skip rows whose number already exists under the new type (uq_company_type_invoice_no).
UPDATE public.invoices i
SET type = 'Tax Invoice'
WHERE i.type = 'tax_invoice'
  AND NOT EXISTS (SELECT 1 FROM public.invoices o
                  WHERE o.company_id = i.company_id AND o.type = 'Tax Invoice' AND o.invoice_no = i.invoice_no);

UPDATE public.invoices i
SET type = 'Proforma Invoice'
WHERE i.type = 'proforma'
  AND NOT EXISTS (SELECT 1 FROM public.invoices o
                  WHERE o.company_id = i.company_id AND o.type = 'Proforma Invoice' AND o.invoice_no = i.invoice_no);

COMMIT;
