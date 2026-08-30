-- Migration 06: Add remark to rate_cards and snapshot to payroll_records
ALTER TABLE public.rate_cards
ADD COLUMN IF NOT EXISTS remark text DEFAULT '';

ALTER TABLE public.payroll_records
ADD COLUMN IF NOT EXISTS rate_card_remark_snapshot text DEFAULT '';
