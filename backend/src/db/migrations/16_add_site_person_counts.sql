-- Migration 16: Add person_work_order, person_worked_site, persons, and use_separate_person_counts to sites
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS persons integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS person_work_order integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS person_worked_site integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS use_separate_person_counts boolean DEFAULT false;

UPDATE public.sites
SET 
  persons = COALESCE(persons, 1),
  person_work_order = COALESCE(person_work_order, persons, 1),
  person_worked_site = COALESCE(person_worked_site, persons, 1),
  use_separate_person_counts = COALESCE(use_separate_person_counts, false)
WHERE persons IS NULL OR person_work_order IS NULL OR person_worked_site IS NULL OR use_separate_person_counts IS NULL;
