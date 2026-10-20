-- ==============================================================================
-- Migration 20: IGST Support, Invoice Idempotency, and Sequence Synchronization
-- ==============================================================================

BEGIN;

-- 1. Add IGST and persistent calculated tax amount columns to public.invoice_items
ALTER TABLE public.invoice_items
ADD COLUMN IF NOT EXISTS igst_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00;

ALTER TABLE public.invoice_items
ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(14,2),
ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(14,2);

-- 2. Add idempotency tracking columns to public.invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS idempotency_key UUID,
ADD COLUMN IF NOT EXISTS idempotency_request_hash TEXT;

-- 3. Idempotency and uniqueness constraints on invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_company_type_invoice_no'
  ) THEN
    ALTER TABLE public.invoices
    ADD CONSTRAINT uq_company_type_invoice_no UNIQUE (company_id, type, invoice_no);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_invoices_idempotency'
  ) THEN
    ALTER TABLE public.invoices
    ADD CONSTRAINT uq_invoices_idempotency UNIQUE (company_id, idempotency_key);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_idempotency_lookup
  ON public.invoices (company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_company_type_no
  ON public.invoices (company_id, type, invoice_no);

-- 4. Synchronize per-company invoice counters independently for Tax and Proforma
-- Scalar numeric suffix extraction: SUBSTRING(invoice_no FROM '([0-9]+)$')::integer
-- Stored counter set to GREATEST(current_counter, max_extracted_number)
WITH max_tax AS (
  SELECT 
    company_id,
    MAX(SUBSTRING(invoice_no FROM '([0-9]+)$')::integer) AS max_num
  FROM public.invoices
  WHERE type = 'Tax Invoice'
    AND invoice_no ~ '([0-9]+)$'
  GROUP BY company_id
)
UPDATE public.companies c
SET tax_sequence = GREATEST(COALESCE(c.tax_sequence, 0), COALESCE(m.max_num, 0))
FROM max_tax m
WHERE c.id = m.company_id;

WITH max_proforma AS (
  SELECT 
    company_id,
    MAX(SUBSTRING(invoice_no FROM '([0-9]+)$')::integer) AS max_num
  FROM public.invoices
  WHERE type = 'Proforma Invoice'
    AND invoice_no ~ '([0-9]+)$'
  GROUP BY company_id
)
UPDATE public.companies c
SET proforma_sequence = GREATEST(COALESCE(c.proforma_sequence, 0), COALESCE(m.max_num, 0))
FROM max_proforma m
WHERE c.id = m.company_id;

COMMIT;
