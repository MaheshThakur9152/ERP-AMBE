-- ==============================================================================
-- Migration 09: Separate Billing Rate Cards from Payroll Rate Cards (v2)
-- Safe Migration with Location-Aware Dedup, Backup Table & Safety Reports
-- ==============================================================================

-- STEP 1: Ensure location & company_id columns exist on public.rate_cards for safe querying
ALTER TABLE IF EXISTS public.rate_cards 
ADD COLUMN IF NOT EXISTS location text;

ALTER TABLE IF EXISTS public.rate_cards 
ADD COLUMN IF NOT EXISTS company_id uuid;

-- STEP 2: Create Backup Table
CREATE TABLE IF NOT EXISTS public.rate_cards_migration_backup_09 AS
SELECT * FROM public.rate_cards WHERE false;

-- STEP 3: Dry-Run Audit Queries (Run Manually in SQL Editor for Pre-Execution Verification)
/*
-- 3.1 Inspect all candidate billing-only rows in public.rate_cards
SELECT id, site_id, site_name, post_name, location, gross_salary, basic_da, hra, other_allowance, created_at
FROM public.rate_cards
WHERE (COALESCE(basic_da, 0) = 0 AND COALESCE(hra, 0) = 0 AND COALESCE(other_allowance, 0) = 0)
  AND (COALESCE(gross_salary, 0) = 0 OR (location IS NOT NULL AND TRIM(location) != ''));

-- 3.2 Check for any historical payroll_records referencing candidate rows (THESE WILL BE PROTECTED/SKIPPED)
SELECT pr.id AS payroll_id, pr.staff_id, pr.month, pr.year, pr.rate_card_id, rc.post_name, rc.site_name, rc.location
FROM public.payroll_records pr
JOIN public.rate_cards rc ON pr.rate_card_id = rc.id
WHERE (COALESCE(rc.basic_da, 0) = 0 AND COALESCE(rc.hra, 0) = 0 AND COALESCE(rc.other_allowance, 0) = 0)
  AND (COALESCE(rc.gross_salary, 0) = 0 OR (rc.location IS NOT NULL AND TRIM(rc.location) != ''));

-- 3.3 Check staff members currently assigned to candidate rows (will be set to NULL for clean reassignment)
SELECT s.id AS staff_id, s.employee_name, s.biometric_code, s.rate_card_id, rc.post_name, rc.site_name, rc.location
FROM public.staff s
JOIN public.rate_cards rc ON s.rate_card_id = rc.id
WHERE (COALESCE(rc.basic_da, 0) = 0 AND COALESCE(rc.hra, 0) = 0 AND COALESCE(rc.other_allowance, 0) = 0)
  AND (COALESCE(rc.gross_salary, 0) = 0 OR (rc.location IS NOT NULL AND TRIM(rc.location) != ''));
*/

-- STEP 4: Migration & Backup Execution Block
DO $$
DECLARE
  r RECORD;
  target_site_id UUID;
  existing_json JSONB;
  billing_card JSONB;
  already_in_json BOOLEAN;
  migrated_count INT := 0;
  backup_count INT := 0;
  deleted_count INT := 0;
  skipped_payroll_count INT := 0;
BEGIN
  -- 4.1 Count rows that must be protected because of existing payroll history
  SELECT COUNT(DISTINCT rc.id) INTO skipped_payroll_count
  FROM public.rate_cards rc
  JOIN public.payroll_records pr ON pr.rate_card_id = rc.id
  WHERE (COALESCE(rc.basic_da, 0) = 0 AND COALESCE(rc.hra, 0) = 0 AND COALESCE(rc.other_allowance, 0) = 0)
    AND (COALESCE(rc.gross_salary, 0) = 0 OR (rc.location IS NOT NULL AND TRIM(rc.location) != ''));

  IF skipped_payroll_count > 0 THEN
    RAISE NOTICE 'SAFETY NOTICE: % rate card rows have historical payroll_records attached and will NOT be deleted.', skipped_payroll_count;
  END IF;

  -- 4.2 Archive candidate rows to backup table (excluding any with historical payroll_records)
  INSERT INTO public.rate_cards_migration_backup_09
  SELECT rc.*
  FROM public.rate_cards rc
  WHERE (COALESCE(rc.basic_da, 0) = 0 AND COALESCE(rc.hra, 0) = 0 AND COALESCE(rc.other_allowance, 0) = 0)
    AND (COALESCE(rc.gross_salary, 0) = 0 OR (rc.location IS NOT NULL AND TRIM(rc.location) != ''))
    AND rc.id NOT IN (
      SELECT rate_card_id FROM public.payroll_records WHERE rate_card_id IS NOT NULL
    );

  GET DIAGNOSTICS backup_count = ROW_COUNT;
  RAISE NOTICE 'Archived % suspect rate card rows into rate_cards_migration_backup_09', backup_count;

  -- 4.3 Iterate through archived rows and ensure they exist in sites.rate_cards JSONB
  -- LOCATION-AWARE MATCHING: Ensures multiple entries for same role with different locations (e.g. Housekeeper Podium vs Club House) are preserved!
  FOR r IN 
    SELECT * FROM public.rate_cards_migration_backup_09
  LOOP
    -- Resolve site_id if missing but site_name present (scoped by company_id if available)
    target_site_id := r.site_id;
    IF target_site_id IS NULL AND r.site_name IS NOT NULL AND TRIM(r.site_name) != '' THEN
      SELECT id INTO target_site_id 
      FROM public.sites 
      WHERE LOWER(TRIM(site_name)) = LOWER(TRIM(r.site_name))
        AND (r.company_id IS NULL OR company_id = r.company_id)
      LIMIT 1;
    END IF;

    IF target_site_id IS NOT NULL THEN
      SELECT rate_cards INTO existing_json FROM public.sites WHERE id = target_site_id;
      
      IF existing_json IS NULL OR jsonb_typeof(existing_json) != 'array' THEN
        existing_json := '[]'::jsonb;
      END IF;

      -- Matching includes BOTH roleName AND location
      already_in_json := EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(existing_json) elem 
        WHERE LOWER(TRIM(COALESCE(elem->>'roleName', elem->>'post_name', ''))) = LOWER(TRIM(r.post_name))
          AND LOWER(TRIM(COALESCE(elem->>'location', ''))) = LOWER(TRIM(COALESCE(r.location, '')))
      );

      IF NOT already_in_json THEN
        billing_card := jsonb_build_object(
          'id', 'rc-' || gen_random_uuid()::text,
          'roleName', r.post_name,
          'location', COALESCE(r.location, ''),
          'monthlyRate', COALESCE(r.gross_salary, 0),
          'workingDays', 31,
          'hsnCode', '9985',
          'persons', 1
        );
        existing_json := existing_json || billing_card;

        UPDATE public.sites 
        SET rate_cards = existing_json 
        WHERE id = target_site_id;

        migrated_count := migrated_count + 1;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'Synced % location-aware billing rate cards into sites.rate_cards JSONB', migrated_count;

  -- 4.4 Nullify staff.rate_card_id for staff assigned to archived rows (prevents FK blocker & invalid payroll calculation)
  UPDATE public.staff
  SET rate_card_id = NULL
  WHERE rate_card_id IN (SELECT id FROM public.rate_cards_migration_backup_09);

  -- 4.5 Delete archived rows from public.rate_cards (strictly safe: only rows in backup and NOT in payroll_records)
  DELETE FROM public.rate_cards
  WHERE id IN (SELECT id FROM public.rate_cards_migration_backup_09);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Safely deleted % billing-only rows from public.rate_cards', deleted_count;
END $$;

-- ==============================================================================
-- STEP 5: POST-MIGRATION AUDIT & ACTION REPORTS
-- ==============================================================================

-- 5.1 REPORT: Protected rows that were SKIPPED because of payroll history (Require manual decision)
SELECT rc.id, rc.post_name, rc.site_name, rc.location, COUNT(pr.id) AS payroll_history_count
FROM public.rate_cards rc
JOIN public.payroll_records pr ON pr.rate_card_id = rc.id
WHERE (COALESCE(rc.basic_da, 0) = 0 AND COALESCE(rc.hra, 0) = 0 AND COALESCE(rc.other_allowance, 0) = 0)
  AND (COALESCE(rc.gross_salary, 0) = 0 OR (rc.location IS NOT NULL AND TRIM(rc.location) != ''))
GROUP BY rc.id, rc.post_name, rc.site_name, rc.location;

-- 5.2 REPORT: Staff members whose rate_card_id was cleared and need real payroll rate card assignment
SELECT s.id, s.employee_name, s.biometric_code, s.designation, s.site_id, sites.site_name
FROM public.staff s
LEFT JOIN public.sites ON s.site_id = sites.id
WHERE s.rate_card_id IS NULL;
