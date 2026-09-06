-- Migration 15: Add manual PT adjustment columns to payroll_records
ALTER TABLE public.payroll_records
ADD COLUMN IF NOT EXISTS manual_pt_adjustment numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS manual_pt_adjustment_reason text DEFAULT '';
