-- Migration 17: Add manual payslip override columns to payroll_records
ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS designation text,
  ADD COLUMN IF NOT EXISTS pf_no text,
  ADD COLUMN IF NOT EXISTS esic_no text,
  ADD COLUMN IF NOT EXISTS bank_account_no text,
  ADD COLUMN IF NOT EXISTS bank_ifsc_code text,
  ADD COLUMN IF NOT EXISTS days_in_month integer,
  ADD COLUMN IF NOT EXISTS custom_earnings jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_deductions jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_manually_edited boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_override_data jsonb DEFAULT null;
