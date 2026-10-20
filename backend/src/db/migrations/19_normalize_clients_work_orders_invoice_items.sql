-- ==============================================================================
-- Migration 19: Relational Normalization (Clients, Work Orders, Quotas, Invoice Items)
-- ==============================================================================

-- 1. Create public.clients
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  name text NOT NULL,
  legal_name text,
  gstin text,
  email text,
  phone text,
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT clients_company_name_unique UNIQUE (company_id, name)
);

-- Add client_id FK to sites
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sites_client_id ON public.sites(client_id);

-- 2. Create public.work_orders
CREATE TABLE IF NOT EXISTS public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  wo_number text NOT NULL UNIQUE,
  period text,
  start_date date DEFAULT CURRENT_DATE,
  end_date date,
  management_fee_percent numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_orders_site_id ON public.work_orders(site_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_client_id ON public.work_orders(client_id);

-- 3. Create public.work_order_quotas
CREATE TABLE IF NOT EXISTS public.work_order_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE CASCADE,
  designation text NOT NULL,
  location text,
  contracted_headcount integer DEFAULT 1,
  monthly_billing_rate numeric DEFAULT 0,
  working_days integer DEFAULT 31,
  hsn_code text DEFAULT '9985',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_order_quotas_wo_id ON public.work_order_quotas(work_order_id);

-- 4. Create public.invoice_items
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  location text DEFAULT '',
  hsn_code text DEFAULT '9985',
  quantity numeric DEFAULT 1.0,
  working_days numeric DEFAULT 30.0,
  unit_rate numeric DEFAULT 0.0,
  amount numeric DEFAULT 0.0,
  cgst_rate numeric DEFAULT 9.0,
  sgst_rate numeric DEFAULT 9.0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);

-- ==============================================================================
-- STEP 1: Extract and Normalize Clients from Sites
-- ==============================================================================
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

-- ==============================================================================
-- STEP 2: Extract Work Orders from Sites
-- ==============================================================================
INSERT INTO public.work_orders (id, site_id, client_id, wo_number, period, start_date, created_at)
SELECT 
  gen_random_uuid(),
  s.id,
  s.client_id,
  COALESCE(NULLIF(TRIM(s.work_order_ref), ''), 'WO-' || COALESCE(s.code_name, s.id::text)),
  s.work_order_period,
  CURRENT_DATE,
  now()
FROM public.sites s
WHERE s.client_id IS NOT NULL
ON CONFLICT (wo_number) DO NOTHING;

-- ==============================================================================
-- STEP 3: Extract Work Order Quotas from sites.rate_cards JSONB
-- ==============================================================================
INSERT INTO public.work_order_quotas (
  id,
  work_order_id,
  designation,
  location,
  contracted_headcount,
  monthly_billing_rate,
  working_days,
  hsn_code
)
SELECT
  gen_random_uuid(),
  wo.id AS work_order_id,
  COALESCE(elem->>'roleName', elem->>'post_name', 'General') AS designation,
  COALESCE(elem->>'location', '') AS location,
  COALESCE((elem->>'persons')::integer, 1) AS contracted_headcount,
  COALESCE((elem->>'monthlyRate')::numeric, (elem->>'rate')::numeric, 0) AS monthly_billing_rate,
  COALESCE((elem->>'workingDays')::integer, 31) AS working_days,
  COALESCE(elem->>'hsnCode', '9985') AS hsn_code
FROM public.sites s
JOIN public.work_orders wo ON wo.site_id = s.id,
LATERAL jsonb_array_elements(
  CASE 
    WHEN jsonb_typeof(s.rate_cards) = 'array' THEN s.rate_cards 
    ELSE '[]'::jsonb 
  END
) AS elem
WHERE s.rate_cards IS NOT NULL;

-- ==============================================================================
-- STEP 4: Normalize Invoice Line Items from JSONB
-- ==============================================================================
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
WHERE inv.line_items IS NOT NULL;
