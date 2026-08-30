-- Migration: 02_add_part_bonus_tracking.sql
-- Add Part Bonus statutory disbursement tracking columns to rate_cards and payroll_records

ALTER TABLE public.rate_cards
ADD COLUMN IF NOT EXISTS part_bonus_percent numeric DEFAULT 0;

ALTER TABLE public.payroll_records
ADD COLUMN IF NOT EXISTS part_bonus_percent_snapshot numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_full_entitlement numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_monthly_allocation numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS earned_part_bonus numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_part_bonus numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_net_salary numeric DEFAULT 0;
