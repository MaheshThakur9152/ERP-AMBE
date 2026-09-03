-- Migration 11: Add duration text column to attendance_records
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS duration text;

-- Add unique constraint on (staff_id, record_date) to allow upsert by (staff_id, record_date)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_staff_id_record_date_key'
  ) THEN
    ALTER TABLE public.attendance_records
      ADD CONSTRAINT attendance_records_staff_id_record_date_key UNIQUE (staff_id, record_date);
  END IF;
END $$;
