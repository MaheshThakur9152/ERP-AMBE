-- Migration: Add bonus_disbursements table for statutory year-end bonus tracking
CREATE TABLE IF NOT EXISTS public.bonus_disbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  financial_year text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  disbursed_date date NOT NULL,
  remark text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bonus_disbursements_staff ON public.bonus_disbursements(staff_id);
CREATE INDEX IF NOT EXISTS idx_bonus_disbursements_fy ON public.bonus_disbursements(financial_year);
CREATE INDEX IF NOT EXISTS idx_bonus_disbursements_site ON public.bonus_disbursements(site_id);
