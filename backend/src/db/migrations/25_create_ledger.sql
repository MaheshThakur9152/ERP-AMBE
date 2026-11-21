-- Outstanding ledger: payments received against invoices + per-site opening balance.
-- Paid/Partial/Unpaid status is derived from these rows, never stored on invoices.

CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  paid_date date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  tds_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (tds_amount >= 0),
  mode text NOT NULL DEFAULT 'NEFT' CHECK (mode IN ('NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'Cash', 'Other')),
  ref_no text,
  remark text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON public.invoice_payments (invoice_id);

-- "Previous Year pending" carried into a site's ledger.
CREATE TABLE IF NOT EXISTS public.ledger_opening_balances (
  site_id uuid PRIMARY KEY REFERENCES public.sites(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
