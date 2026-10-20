-- Migration 23: Add company_id and metadata columns to attendance_sheets
ALTER TABLE public.attendance_sheets
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS site_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS month text DEFAULT '',
  ADD COLUMN IF NOT EXISTS year text DEFAULT '';

-- Backfill company_id from sites if missing
UPDATE public.attendance_sheets a
SET company_id = s.company_id
FROM public.sites s
WHERE a.site_id = s.id AND a.company_id IS NULL;
