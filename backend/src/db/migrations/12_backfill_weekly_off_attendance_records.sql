-- ==============================================================================
-- Migration 12: Backfill weekly-off classification on attendance_records
-- Converts 'A' -> 'W/O' and 'P' -> 'WOP' (with shift_type='overtime')
-- strictly when record_date matches staff.weekly_off using exact day name match.
-- ==============================================================================

-- 1. DRY RUN AUDIT QUERY (Run this first to inspect affected rows):
/*
SELECT 
  r.id AS record_id,
  r.staff_id,
  s.employee_name,
  s.weekly_off,
  r.record_date,
  TRIM(TO_CHAR(r.record_date, 'Day')) AS calendar_day_name,
  r.status AS current_status,
  CASE 
    WHEN r.status = 'A' THEN 'W/O'
    WHEN r.status = 'P' THEN 'WOP'
    ELSE r.status 
  END AS target_status,
  CASE 
    WHEN r.status = 'P' THEN 'overtime'
    ELSE r.shift_type 
  END AS target_shift_type
FROM public.attendance_records r
JOIN public.staff s ON s.id = r.staff_id
WHERE s.weekly_off IS NOT NULL
  AND s.weekly_off <> 'None'
  AND LOWER(s.weekly_off) LIKE '%' || LOWER(TRIM(TO_CHAR(r.record_date, 'Day'))) || '%'
  AND r.status IN ('A', 'P')
ORDER BY r.record_date, s.employee_name;
*/

-- 2. BACKFILL: Update absent records on weekly off -> 'W/O'
UPDATE public.attendance_records r
SET status = 'W/O'
FROM public.staff s
WHERE s.id = r.staff_id
  AND s.weekly_off IS NOT NULL
  AND s.weekly_off <> 'None'
  AND LOWER(s.weekly_off) LIKE '%' || LOWER(TRIM(TO_CHAR(r.record_date, 'Day'))) || '%'
  AND r.status = 'A';

-- 3. BACKFILL: Update present records on weekly off -> 'WOP' & shift_type = 'overtime'
UPDATE public.attendance_records r
SET status = 'WOP',
    shift_type = 'overtime'
FROM public.staff s
WHERE s.id = r.staff_id
  AND s.weekly_off IS NOT NULL
  AND s.weekly_off <> 'None'
  AND LOWER(s.weekly_off) LIKE '%' || LOWER(TRIM(TO_CHAR(r.record_date, 'Day'))) || '%'
  AND r.status = 'P';
