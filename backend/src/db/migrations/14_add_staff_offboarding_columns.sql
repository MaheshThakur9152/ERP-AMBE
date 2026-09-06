-- Migration 14: Add offboarding columns to staff table
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS left_date date,
ADD COLUMN IF NOT EXISTS inactive_reason text DEFAULT '';

UPDATE public.staff SET status = 'Active' WHERE status IS NULL;
