-- Migration 08: Add certification confirmation timestamp columns to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS certified_doc_confirmed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS certified_attendance_confirmed_at timestamp with time zone;
