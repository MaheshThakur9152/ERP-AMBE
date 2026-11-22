-- One-off prod fix (2026-11-22): payments that settled several legacy bills at once were booked on
-- the first bill only, leaving the rest Unpaid. Adds the missing payment where the bill has none.
-- Also cancels ASF/26-27/069 (Ceejay): not in the client's ledger, August 2026 is billed as ASF/26-27/073.
BEGIN;

WITH fix(site_id, invoice_no, paid_date, amount, tds) AS (VALUES
  ('6bc84687-a527-4154-b1b8-34dc530553cd'::uuid, 'ASF/26-27/007', '2026-05-13'::date, 124217::numeric, 2141.66::numeric),
  ('6bc84687-a527-4154-b1b8-34dc530553cd'::uuid, 'ASF/26-27/008', '2026-05-13'::date, 132477, 2284.08),
  ('36a03f01-fcb9-4f85-a226-a84964405aaf'::uuid, 'ASF/25-26/027', '2025-12-11'::date, 58000, 1000),
  ('36a03f01-fcb9-4f85-a226-a84964405aaf'::uuid, 'ASF/26-27/010', '2026-05-13'::date, 44904, 774.19),
  ('46449d39-dccb-4c8e-aa0d-790141572cb0'::uuid, 'ASF/25-26/060', '2026-03-30'::date, 257182, 4434.16)
),
target AS (
  -- Real platform bill wins over its legacy CSV copy (same rule as the ledger's NOT_SHADOWED).
  SELECT DISTINCT ON (f.site_id, f.invoice_no) i.id, f.paid_date, f.amount, f.tds
  FROM fix f
  JOIN public.invoices i
    ON i.site_id = f.site_id
   AND regexp_replace(upper(i.invoice_no), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(f.invoice_no), '[^A-Z0-9]', '', 'g')
  ORDER BY f.site_id, f.invoice_no, (i.legacy_notes = 'Legacy CSV import') NULLS FIRST, i.created_at
)
INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
SELECT t.id, t.paid_date, t.amount, t.tds, 'NEFT', 'Paid with previous bill', now()
FROM target t
WHERE NOT EXISTS (SELECT 1 FROM public.invoice_payments p WHERE p.invoice_id = t.id);

UPDATE public.invoices i
SET status = 'Cancelled', cancelled_at = now(),
    cancelled_reason = 'Not in client ledger; August 2026 billed as ASF/26-27/073'
WHERE i.site_id = '46449d39-dccb-4c8e-aa0d-790141572cb0'
  AND TRIM(i.invoice_no) = 'ASF/26-27/069'
  AND i.cancelled_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.invoice_payments p WHERE p.invoice_id = i.id);

COMMIT;
