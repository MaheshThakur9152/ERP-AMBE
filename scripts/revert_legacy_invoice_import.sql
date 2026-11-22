-- Revert everything the legacy CSV import scripts put into the real invoice tables (2026-11-22).
-- The old xlsx now lives in public.legacy_ledger_rows (Ledger > Upload legacy xlsx) and never touches
-- public.invoices. Take a DB backup first: this deletes rows.
--
-- invoice_payments: the ERP only inserts payments through the ledger with created_by set, so rows with
-- created_by IS NULL came from the scripts (legacy_ledger_import.sql, deduplicate step 1, fix_combined_payments).
BEGIN;

SELECT
  (SELECT COUNT(*) FROM public.invoice_payments WHERE created_by IS NULL) AS script_payments_to_delete,
  (SELECT COUNT(*) FROM public.invoices WHERE legacy_notes = 'Legacy CSV import') AS legacy_invoices_to_delete;

DELETE FROM public.invoice_payments WHERE created_by IS NULL;

-- Payments typed in the ERP against a legacy CSV bill would block the delete below; list them instead of losing them.
SELECT i.invoice_no, p.paid_date, p.amount, p.tds_amount
FROM public.invoice_payments p JOIN public.invoices i ON i.id = p.invoice_id
WHERE i.legacy_notes = 'Legacy CSV import';

DELETE FROM public.invoices i
WHERE i.legacy_notes = 'Legacy CSV import'
  AND NOT EXISTS (SELECT 1 FROM public.invoice_payments p WHERE p.invoice_id = i.id);

-- Undo the cancel from fix_combined_payments.sql (ASF/26-27/069 is before Ceejay's cut-off, so the ledger hides it anyway).
UPDATE public.invoices
SET status = 'Generated', cancelled_at = NULL, cancelled_reason = NULL
WHERE cancelled_reason = 'Not in client ledger; August 2026 billed as ASF/26-27/073';

COMMIT;
