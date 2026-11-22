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
    ON UPPER(TRIM(legacy.invoice_no)) = UPPER(TRIM(original.invoice_no))
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
    ON UPPER(TRIM(legacy.invoice_no)) = UPPER(TRIM(original.invoice_no))
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
    ON UPPER(TRIM(legacy.invoice_no)) = UPPER(TRIM(original.invoice_no))
   AND legacy.site_id = original.site_id
   AND legacy.id <> original.id
  WHERE legacy.legacy_notes = 'Legacy CSV import'
    AND (original.legacy_notes IS DISTINCT FROM 'Legacy CSV import' OR original.created_at < legacy.created_at)
);

-- 4. Standardize types across any remaining imported legacy bills to ERP casing
UPDATE public.invoices
SET type = 'Tax Invoice'
WHERE type = 'tax_invoice';

UPDATE public.invoices
SET type = 'Proforma Invoice'
WHERE type = 'proforma';

COMMIT;
