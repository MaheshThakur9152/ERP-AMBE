-- Migration 10: Add in_time, out_time, and duration_hours to attendance_records
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS in_time text,
  ADD COLUMN IF NOT EXISTS out_time text,
  ADD COLUMN IF NOT EXISTS duration_hours numeric DEFAULT 0;
