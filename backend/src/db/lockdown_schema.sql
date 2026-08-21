-- Phase 1: Lockdown Schema Migration

-- Add is_locked boolean column to attendance_sheets, payroll_records, and staff tables
ALTER TABLE IF EXISTS public.attendance_sheets 
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

ALTER TABLE IF EXISTS public.payroll_records 
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

ALTER TABLE IF EXISTS public.staff 
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

-- Fallback for alternative table naming conventions if present
ALTER TABLE IF EXISTS public.employees 
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

ALTER TABLE IF EXISTS public.payroll 
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

ALTER TABLE IF EXISTS public.attendance 
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
