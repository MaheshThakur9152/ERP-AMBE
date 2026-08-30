-- Migration 05: Replace percentage-based bonus with fixed rupee amount system
ALTER TABLE public.rate_cards
DROP COLUMN IF EXISTS bonus_percent,
DROP COLUMN IF EXISTS part_bonus_percent;

ALTER TABLE public.rate_cards
ADD COLUMN IF NOT EXISTS bonus_amount numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS part_bonus_amount numeric DEFAULT NULL;

ALTER TABLE public.payroll_records
DROP COLUMN IF EXISTS bonus_percent_snapshot,
DROP COLUMN IF EXISTS part_bonus_percent_snapshot,
DROP COLUMN IF EXISTS bonus_full_entitlement,
DROP COLUMN IF EXISTS bonus_monthly_allocation;

ALTER TABLE public.payroll_records
ADD COLUMN IF NOT EXISTS bonus_amount_snapshot numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS part_bonus_amount_snapshot numeric DEFAULT NULL;
