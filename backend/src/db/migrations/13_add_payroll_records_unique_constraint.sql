-- Migration 13: Add unique constraint on payroll_records (staff_id, month_year)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payroll_records_staff_month_unique'
  ) THEN
    ALTER TABLE public.payroll_records
      ADD CONSTRAINT payroll_records_staff_month_unique UNIQUE (staff_id, month_year);
  END IF;
END $$;
