-- Migration 07: Add KYC fields to staff table
-- Adds missing aadhar_no, pan_no and optional direct document columns to public.staff

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS aadhar_no text,
  ADD COLUMN IF NOT EXISTS pan_no text;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
