-- Migration 04: Add bonus_percent to rate_cards and snapshot to payroll_records
ALTER TABLE public.rate_cards
ADD COLUMN IF NOT EXISTS bonus_percent numeric DEFAULT 8.33;

ALTER TABLE public.payroll_records
ADD COLUMN IF NOT EXISTS bonus_percent_snapshot numeric DEFAULT 8.33;
