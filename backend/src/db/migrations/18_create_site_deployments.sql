-- Migration 18: Create site_deployments table
CREATE TABLE IF NOT EXISTS public.site_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_year text NOT NULL,
  site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
  designation text,
  rate_card_id uuid REFERENCES public.rate_cards(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT site_deployments_month_site_staff_unique UNIQUE (month_year, site_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_site_deployments_month_year ON public.site_deployments(month_year);
CREATE INDEX IF NOT EXISTS idx_site_deployments_site_id ON public.site_deployments(site_id);
CREATE INDEX IF NOT EXISTS idx_site_deployments_staff_id ON public.site_deployments(staff_id);
