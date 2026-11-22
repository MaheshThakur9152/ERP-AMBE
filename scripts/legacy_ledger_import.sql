--
-- LEGACY LEDGER IMPORT (Generated from D:\ERP-AMBE\leger-lagcy)
--
BEGIN;

-- ============================================================================
-- SITE: Ajmera (HK) (6bc84687-a527-4154-b1b8-34dc530553cd) FROM ajmera-hk.csv
-- ============================================================================
-- Invoice: ASF/25-26/013 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '6bc84687-a527-4154-b1b8-34dc530553cd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/013'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '6bc84687-a527-4154-b1b8-34dc530553cd', 'ASF/25-26/013', 'Tax Invoice',
      'Generated', '2025-07-19', 'June-25', false, true, 'Legacy CSV import', 80188, 14434, 94622, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹93018, TDS=₹1603.76
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2025-08-06', 93018, 1603.76, 'Cheque', NULL, now());
END $$;

-- Invoice: ASF/25-26/014 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '6bc84687-a527-4154-b1b8-34dc530553cd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/014'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '6bc84687-a527-4154-b1b8-34dc530553cd', 'ASF/25-26/014', 'Tax Invoice',
      'Generated', '2025-08-25', 'July-25', false, true, 'Legacy CSV import', 73892.26, 13301, 87193, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹85715, TDS=₹1477.8452
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2025-09-17', 85715, 1477.8452, 'Cheque', NULL, now());
END $$;

-- Invoice: ASF/25-26/017 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '6bc84687-a527-4154-b1b8-34dc530553cd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/017'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '6bc84687-a527-4154-b1b8-34dc530553cd', 'ASF/25-26/017', 'Tax Invoice',
      'Generated', '2025-09-19', 'August-25', false, true, 'Legacy CSV import', 77827.1, 14009, 91836, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹90279, TDS=₹1556.542
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2025-10-13', 90279, 1556.542, 'Cheque', NULL, now());
END $$;

-- Invoice: ASF/25-26/020 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '6bc84687-a527-4154-b1b8-34dc530553cd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/020'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '6bc84687-a527-4154-b1b8-34dc530553cd', 'ASF/25-26/020', 'Tax Invoice',
      'Generated', '2025-10-09', 'September-4', false, true, 'Legacy CSV import', 83576, 15044, 98620, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹96948, TDS=₹1671.52
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2025-11-04', 96948, 1671.52, 'Cheque', NULL, now());
END $$;

-- Invoice: ASF/25-26/025 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '6bc84687-a527-4154-b1b8-34dc530553cd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/025'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '6bc84687-a527-4154-b1b8-34dc530553cd', 'ASF/25-26/025', 'Tax Invoice',
      'Generated', '2025-11-23', 'October-3', false, true, 'Legacy CSV import', 92910, 16724, 109634, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹107776, TDS=₹1858.2
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2025-11-23', 107776, 1858.2, 'NEFT', 'SEPT(key) + oct(key+hk)', now());
END $$;

-- Invoice: ASF/25-26/032 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '6bc84687-a527-4154-b1b8-34dc530553cd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/032'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '6bc84687-a527-4154-b1b8-34dc530553cd', 'ASF/25-26/032', 'Tax Invoice',
      'Generated', '2025-12-15', 'November-1', false, true, 'Legacy CSV import', 86287, 15532, 101819, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹100093, TDS=₹1725.74
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-01-12', 100093, 1725.74, 'Cheque', 'Nov (key + hk)', now());
END $$;

-- Invoice: ASF/25-26/041 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '6bc84687-a527-4154-b1b8-34dc530553cd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/041'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '6bc84687-a527-4154-b1b8-34dc530553cd', 'ASF/25-26/041', 'Tax Invoice',
      'Generated', '2026-02-04', 'Dec 25', false, true, 'Legacy CSV import', 95696, 17225, 112922, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹111008, TDS=₹1913.92
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-03-05', 111008, 1913.92, 'NEFT', 'dec - key (47710) + hk (111008) = 
158718  there is some mistake in payyment', now());
END $$;

-- Invoice: ASF/25-26/053 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '6bc84687-a527-4154-b1b8-34dc530553cd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/053'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '6bc84687-a527-4154-b1b8-34dc530553cd', 'ASF/25-26/053', 'Tax Invoice',
      'Generated', '2026-03-06', 'Jan 1', false, true, 'Legacy CSV import', 159226, 28661, 0, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/25-26/054 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '6bc84687-a527-4154-b1b8-34dc530553cd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/054'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '6bc84687-a527-4154-b1b8-34dc530553cd', 'ASF/25-26/054', 'Tax Invoice',
      'Generated', NULL, NULL, false, true, 'Legacy CSV import', 0, 0, 0, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/26-27/006 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '6bc84687-a527-4154-b1b8-34dc530553cd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/006'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '6bc84687-a527-4154-b1b8-34dc530553cd', 'ASF/26-27/006', 'Tax Invoice',
      'Generated', '2026-04-13', 'Jan 1', false, true, 'Legacy CSV import', 108191.61, 19474, 127667, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹125503, TDS=₹2163.8322
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-05-13', 125503, 2163.8322, 'NEFT', '5 invoices was paid together', now());
END $$;

-- Invoice: ASF/26-27/007 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '6bc84687-a527-4154-b1b8-34dc530553cd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/007'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '6bc84687-a527-4154-b1b8-34dc530553cd', 'ASF/26-27/007', 'Tax Invoice',
      'Generated', '2026-04-13', 'Feb 1', false, true, 'Legacy CSV import', 107083.21, 19275, 126359, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/26-27/008 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '6bc84687-a527-4154-b1b8-34dc530553cd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/008'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '6bc84687-a527-4154-b1b8-34dc530553cd', 'ASF/26-27/008', 'Tax Invoice',
      'Generated', '2026-04-13', 'Mar 1', false, true, 'Legacy CSV import', 114204.19, 20557, 134761, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/26-27/033 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '6bc84687-a527-4154-b1b8-34dc530553cd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/033'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '6bc84687-a527-4154-b1b8-34dc530553cd', 'ASF/26-27/033', 'Tax Invoice',
      'Generated', NULL, 'Apr-26', false, true, 'Legacy CSV import', 38333.33, 6899.9994, 45234, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹44467.3334, TDS=₹766.6666
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-07-18', 44467.3334, 766.6666, 'RTGS', 'PAID ALL 4 BILLS TOGETHER', now());
END $$;

-- Invoice: ASF/26-27/035 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '6bc84687-a527-4154-b1b8-34dc530553cd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/035'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '6bc84687-a527-4154-b1b8-34dc530553cd', 'ASF/26-27/035', 'Tax Invoice',
      'Generated', NULL, 'May-26', false, true, 'Legacy CSV import', 48790, 8782.2, 57573, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹56597.2, TDS=₹975.8
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-07-18', 56597.2, 975.8, 'RTGS', 'PAID ALL 4 BILLS TOGETHER', now());
END $$;

-- Invoice: ASF/26-27/081 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '6bc84687-a527-4154-b1b8-34dc530553cd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/081'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '6bc84687-a527-4154-b1b8-34dc530553cd', 'ASF/26-27/081', 'Tax Invoice',
      'Generated', '2026-09-22', 'June-26', false, true, 'Legacy CSV import', 115098.5, 20718, 135816, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/26-27/082 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '6bc84687-a527-4154-b1b8-34dc530553cd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/082'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '6bc84687-a527-4154-b1b8-34dc530553cd', 'ASF/26-27/082', 'Tax Invoice',
      'Generated', '2026-09-22', 'July-26', false, true, 'Legacy CSV import', 103970.16, 18715, 122685, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- ============================================================================
-- SITE: Ajmera KEYMAN (36a03f01-fcb9-4f85-a226-a84964405aaf) FROM ajmera-key.csv
-- ============================================================================
-- Invoice: ASF/25-26/026 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '36a03f01-fcb9-4f85-a226-a84964405aaf' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/026'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '36a03f01-fcb9-4f85-a226-a84964405aaf', 'ASF/25-26/026', 'Tax Invoice',
      'Generated', '2025-11-23', 'SEPTEMEBER 2026', false, true, 'Legacy CSV import', 25833, 4649.94, 30482.94, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹29966, TDS=₹516.66
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2025-11-23', 29966, 516.66, 'NEFT', 'SEPT(key) + oct(key+hk)', now());
END $$;

-- Invoice: ASF/25-26/027 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '36a03f01-fcb9-4f85-a226-a84964405aaf' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/027'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '36a03f01-fcb9-4f85-a226-a84964405aaf', 'ASF/25-26/027', 'Tax Invoice',
      'Generated', '2025-11-23', 'October-1', false, true, 'Legacy CSV import', 50000, 9000, 59000, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/25-26/031 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '36a03f01-fcb9-4f85-a226-a84964405aaf' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/031'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '36a03f01-fcb9-4f85-a226-a84964405aaf', 'ASF/25-26/031', 'Tax Invoice',
      'Generated', '2025-12-15', 'Nov-25', false, true, 'Legacy CSV import', 47500, 8550, 56050, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹55100, TDS=₹950
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-01-12', 55100, 950, 'Cheque', 'Nov (key + hk)', now());
END $$;

-- Invoice: ASF/25-26/040 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '36a03f01-fcb9-4f85-a226-a84964405aaf' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/040'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '36a03f01-fcb9-4f85-a226-a84964405aaf', 'ASF/25-26/040', 'Tax Invoice',
      'Generated', '2026-02-04', 'Dec-25', false, true, 'Legacy CSV import', 41129.03, 7403.2254, 48533, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹47710, TDS=₹822.5806
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-03-05', 47710, 822.5806, 'NEFT', 'dec - key (47710) + hk (111008) = 
158718  there is some mistake in payyment', now());
END $$;

-- Invoice: ASF/25-26/053 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '36a03f01-fcb9-4f85-a226-a84964405aaf' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/053'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '36a03f01-fcb9-4f85-a226-a84964405aaf', 'ASF/25-26/053', 'Tax Invoice',
      'Generated', '2026-03-06', 'Jan-26', false, true, 'Legacy CSV import', 29032, 5225.76, 34258, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹33677, TDS=₹580.64
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-03-23', 33677, 580.64, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/26-27/009 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '36a03f01-fcb9-4f85-a226-a84964405aaf' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/009'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '36a03f01-fcb9-4f85-a226-a84964405aaf', 'ASF/26-27/009', 'Tax Invoice',
      'Generated', '2026-04-13', 'Feb-26', false, true, 'Legacy CSV import', 42857.14, 7714.2852, 50572, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹49715, TDS=₹857.1428
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-05-13', 49715, 857.1428, 'NEFT', '5 invoices was paid together', now());
END $$;

-- Invoice: ASF/26-27/010 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '36a03f01-fcb9-4f85-a226-a84964405aaf' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/010'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '36a03f01-fcb9-4f85-a226-a84964405aaf', 'ASF/26-27/010', 'Tax Invoice',
      'Generated', '2026-04-13', 'Mar-26', false, true, 'Legacy CSV import', 38709.68, 6967.7424, 45678, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/26-27/032 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '36a03f01-fcb9-4f85-a226-a84964405aaf' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/032'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '36a03f01-fcb9-4f85-a226-a84964405aaf', 'ASF/26-27/032', 'Tax Invoice',
      'Generated', NULL, 'Apr-26', false, true, 'Legacy CSV import', 96652.17, 17397.3906, 114050, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹112117, TDS=₹1933.0434
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-07-18', 112117, 1933.0434, 'RTGS', 'PAID ALL 4 BILLS TOGETHER', now());
END $$;

-- Invoice: ASF/26-27/034 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '36a03f01-fcb9-4f85-a226-a84964405aaf' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/034'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '36a03f01-fcb9-4f85-a226-a84964405aaf', 'ASF/26-27/034', 'Tax Invoice',
      'Generated', NULL, 'May-26', false, true, 'Legacy CSV import', 84106, 15139.08, 99246, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹97564, TDS=₹1682.12
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-07-18', 97564, 1682.12, 'RTGS', 'PAID ALL 4 BILLS TOGETHER', now());
END $$;

-- Invoice: ASF/26-27/067 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '36a03f01-fcb9-4f85-a226-a84964405aaf' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/067'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '36a03f01-fcb9-4f85-a226-a84964405aaf', 'ASF/26-27/067', 'Tax Invoice',
      'Generated', NULL, 'June-26', false, true, 'Legacy CSV import', 45833.33, 8250, 54083, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹53167, TDS=₹916.6666
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-08-27', 53167, 916.6666, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/26-27/065 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '36a03f01-fcb9-4f85-a226-a84964405aaf' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/065'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '36a03f01-fcb9-4f85-a226-a84964405aaf', 'ASF/26-27/065', 'Tax Invoice',
      'Generated', NULL, 'July-26', false, true, 'Legacy CSV import', 49193.55, 8855, 58048, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹57065, TDS=₹983.871
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-09-09', 57065, 983.871, 'NEFT', NULL, now());
END $$;

-- ============================================================================
-- SITE: Ceejay Residency 15th floor (e0aa84b9-2a5c-4522-a86c-fe104d38ac6e) FROM ceejay-15th floor.csv
-- ============================================================================
-- Invoice: ASF/25-26/0029 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/0029'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e', 'ASF/25-26/0029', 'Tax Invoice',
      'Generated', '2025-12-10', 'November  2025', false, true, 'Legacy CSV import', 42012, 7562.16, 49574.16, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹48734, TDS=₹840.24
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2025-12-12', 48734, 840.24, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/25-26/036 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/036'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e', 'ASF/25-26/036', 'Tax Invoice',
      'Generated', '2026-01-06', 'December 2025', false, true, 'Legacy CSV import', 42956, 7732.08, 50688.08, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹49829, TDS=₹859.12
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-01-08', 49829, 859.12, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/25-26/043 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/043'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e', 'ASF/25-26/043', 'Tax Invoice',
      'Generated', '2026-02-18', 'January 2026', false, true, 'Legacy CSV import', 19196, 3455.28, 22651.28, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹22267, TDS=₹383.92
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-02-25', 22267, 383.92, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/25-26/055 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/055'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e', 'ASF/25-26/055', 'Tax Invoice',
      'Generated', '2026-03-06', 'February  2026', false, true, 'Legacy CSV import', 20520, 3693.6, 24213.6, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹23803, TDS=₹410.4
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-04-02', 23803, 410.4, 'NEFT', 'not fully paid', now());
END $$;

-- Invoice: ASF/26-27/001 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/001'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e', 'ASF/26-27/001', 'Tax Invoice',
      'Generated', '2026-04-08', 'March  2026', false, true, 'Legacy CSV import', 20520, 3693.6, 24213.6, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹23803, TDS=₹410.4
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-05-18', 23803, 410.4, 'NEFT', 'not fully paid', now());
END $$;

-- Invoice: ASF/26-27/023 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/023'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e', 'ASF/26-27/023', 'Tax Invoice',
      'Generated', '2026-05-12', 'April  2026', false, true, 'Legacy CSV import', 20520, 3693.6, 24213.6, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/26-27/028 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/028'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e', 'ASF/26-27/028', 'Tax Invoice',
      'Generated', '2026-06-08', 'MAY 2026', false, true, 'Legacy CSV import', 17100, 3078, 20178, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹19836, TDS=₹342
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-06-22', 19836, 342, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/26-27/036 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/036'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e', 'ASF/26-27/036', 'Tax Invoice',
      'Generated', NULL, 'JUN 2026', false, true, 'Legacy CSV import', 20520, 3694, 24214, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹23803, TDS=₹410.4
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-08-03', 23803, 410.4, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/26-27/063 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/063'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e', 'ASF/26-27/063', 'Tax Invoice',
      'Generated', '2026-08-11', 'JUL 2026', false, true, 'Legacy CSV import', 19858, 3574, 23432, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/26-27/070 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/070'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e', 'ASF/26-27/070', 'Tax Invoice',
      'Generated', '2026-09-08', 'Aug  2026', false, true, 'Legacy CSV import', 20520, 3694, 24214, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/26-27/084 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/084'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', 'e0aa84b9-2a5c-4522-a86c-fe104d38ac6e', 'ASF/26-27/084', 'Tax Invoice',
      'Generated', '2026-10-06', 'Sep 2026', false, true, 'Legacy CSV import', 19152, 3447, 22599, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- ============================================================================
-- SITE: Sheela ceejay (46449d39-dccb-4c8e-aa0d-790141572cb0) FROM ceejay-residency.csv
-- ============================================================================
-- Invoice: ASF/25-26/033 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '46449d39-dccb-4c8e-aa0d-790141572cb0' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/033'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '46449d39-dccb-4c8e-aa0d-790141572cb0', 'ASF/25-26/033', 'Tax Invoice',
      'Generated', '2025-12-22', 'November-1', false, true, 'Legacy CSV import', 161208, 29017.44, 190225.44, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹190225.44, TDS=₹0
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-01-14', 190225.44, 0, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/25-26/037 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '46449d39-dccb-4c8e-aa0d-790141572cb0' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/037'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '46449d39-dccb-4c8e-aa0d-790141572cb0', 'ASF/25-26/037', 'Tax Invoice',
      'Generated', '2026-01-08', 'December-1', false, true, 'Legacy CSV import', 169507, 30511.26, 200018.26, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹196628, TDS=₹3390.14
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-03-13', 196628, 3390.14, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/25-26/042 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '46449d39-dccb-4c8e-aa0d-790141572cb0' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/042'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '46449d39-dccb-4c8e-aa0d-790141572cb0', 'ASF/25-26/042', 'Tax Invoice',
      'Generated', '2026-02-06', 'January-1', false, true, 'Legacy CSV import', 180185, 32433.3, 212619, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹209015, TDS=₹3603.7
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-03-30', 209015, 3603.7, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/25-26/060 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '46449d39-dccb-4c8e-aa0d-790141572cb0' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/060'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '46449d39-dccb-4c8e-aa0d-790141572cb0', 'ASF/25-26/060', 'Tax Invoice',
      'Generated', '2026-03-25', 'February-1', false, true, 'Legacy CSV import', 221708, 39907.44, 261616, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/25-26/061 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '46449d39-dccb-4c8e-aa0d-790141572cb0' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/061'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '46449d39-dccb-4c8e-aa0d-790141572cb0', 'ASF/25-26/061', 'Tax Invoice',
      'Generated', '2026-03-26', 'March-1', false, true, 'Legacy CSV import', 246205, 44316.9, 290522, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹285598, TDS=₹4924.1
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-03-31', 285598, 4924.1, 'NEFT', 'not fullt paid- is there
 correction in inv amt?', now());
END $$;

-- Invoice: ASF/26-27/026 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '46449d39-dccb-4c8e-aa0d-790141572cb0' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/026'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '46449d39-dccb-4c8e-aa0d-790141572cb0', 'ASF/26-27/026', 'Tax Invoice',
      'Generated', '2026-05-14', 'April 26', false, true, 'Legacy CSV import', 247248, 44504.64, 291752.64, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹286808, TDS=₹4944.96
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-05-25', 286808, 4944.96, 'Cheque', NULL, now());
END $$;

-- Invoice: ASF/P/26-27/026 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '46449d39-dccb-4c8e-aa0d-790141572cb0' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/P/26-27/026'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '46449d39-dccb-4c8e-aa0d-790141572cb0', 'ASF/P/26-27/026', 'Proforma Invoice',
      'Generated', '2026-05-07', 'MAY 2026', false, true, 'Legacy CSV import', 158516, 28532.88, 187048.88, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/26-27/037 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '46449d39-dccb-4c8e-aa0d-790141572cb0' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/037'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '46449d39-dccb-4c8e-aa0d-790141572cb0', 'ASF/26-27/037', 'Tax Invoice',
      'Generated', NULL, 'MAY 2026', false, true, 'Legacy CSV import', 164612, 29630.16, 194242.16, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹190950, TDS=₹3292.24
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-08-27', 190950, 3292.24, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/26-27/038 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '46449d39-dccb-4c8e-aa0d-790141572cb0' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/038'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '46449d39-dccb-4c8e-aa0d-790141572cb0', 'ASF/26-27/038', 'Tax Invoice',
      'Generated', NULL, 'Jun 2026', false, true, 'Legacy CSV import', 141426, 25457, 166883, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹164054, TDS=₹2828.52
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-08-20', 164054, 2828.52, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/26-27/062 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '46449d39-dccb-4c8e-aa0d-790141572cb0' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/062'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '46449d39-dccb-4c8e-aa0d-790141572cb0', 'ASF/26-27/062', 'Tax Invoice',
      'Generated', '2026-08-10', 'JUL 2026', false, true, 'Legacy CSV import', 187188, 33694, 220882, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹217138, TDS=₹3743.76
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-09-29', 217138, 3743.76, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/26-27/073 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '46449d39-dccb-4c8e-aa0d-790141572cb0' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/073'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '46449d39-dccb-4c8e-aa0d-790141572cb0', 'ASF/26-27/073', 'Tax Invoice',
      'Generated', '2026-09-09', 'Aug  2026', false, true, 'Legacy CSV import', 174019, 31323, 205342, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹201862, TDS=₹3480.38
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-10-15', 201862, 3480.38, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/26-27/085 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '46449d39-dccb-4c8e-aa0d-790141572cb0' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/085'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '46449d39-dccb-4c8e-aa0d-790141572cb0', 'ASF/26-27/085', 'Tax Invoice',
      'Generated', '2026-10-06', 'September   2026', false, true, 'Legacy CSV import', 204120, 36742, 240862, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- ============================================================================
-- SITE: Minerva 9th (86a3563f-6d0b-4ed6-b9dc-367e922c64fd) FROM lkcpl-chs.csv
-- ============================================================================
-- Invoice: ASF/25-26/049 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '86a3563f-6d0b-4ed6-b9dc-367e922c64fd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/049'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '86a3563f-6d0b-4ed6-b9dc-367e922c64fd', 'ASF/25-26/049', 'Tax Invoice',
      'Generated', '2026-02-27', 'January-26', false, true, 'Legacy CSV import', 119459, 21503, 140962, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹138573, TDS=₹2389
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-03-17', 138573, 2389, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/M/25-26/009 (MATERIAL)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '86a3563f-6d0b-4ed6-b9dc-367e922c64fd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/M/25-26/009'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '86a3563f-6d0b-4ed6-b9dc-367e922c64fd', 'ASF/M/25-26/009', 'Tax Invoice',
      'Generated', '2026-02-28', 'January-26', true, true, 'Legacy CSV import', 7996, 1388, 9384, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹9384, TDS=₹0
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-03-17', 9384, 0, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/25-26/063 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '86a3563f-6d0b-4ed6-b9dc-367e922c64fd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/063'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '86a3563f-6d0b-4ed6-b9dc-367e922c64fd', 'ASF/25-26/063', 'Tax Invoice',
      'Generated', '2026-04-03', 'February-26', false, true, 'Legacy CSV import', 110253, 19846, 130099, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹127893, TDS=₹2205
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-04-16', 127893, 2205, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/M/25-26/012 (MATERIAL)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '86a3563f-6d0b-4ed6-b9dc-367e922c64fd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/M/25-26/012'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '86a3563f-6d0b-4ed6-b9dc-367e922c64fd', 'ASF/M/25-26/012', 'Tax Invoice',
      'Generated', '2026-04-03', 'February-26', true, true, 'Legacy CSV import', 8081, 1454, 9535, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹9535, TDS=₹0
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-04-16', 9535, 0, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/26-27/011 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '86a3563f-6d0b-4ed6-b9dc-367e922c64fd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/011'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '86a3563f-6d0b-4ed6-b9dc-367e922c64fd', 'ASF/26-27/011', 'Tax Invoice',
      'Generated', '2026-04-23', 'March-26', false, true, 'Legacy CSV import', 115992, 20879, 136871, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹134551, TDS=₹2320
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-05-19', 134551, 2320, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/26-27/020 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '86a3563f-6d0b-4ed6-b9dc-367e922c64fd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/020'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '86a3563f-6d0b-4ed6-b9dc-367e922c64fd', 'ASF/26-27/020', 'Tax Invoice',
      'Generated', '2026-05-07', 'April-26', false, true, 'Legacy CSV import', 114339, 20581, 134920, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹132634, TDS=₹2287
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-06-06', 132634, 2287, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/M/26-27/002 (MATERIAL)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '86a3563f-6d0b-4ed6-b9dc-367e922c64fd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/M/26-27/002'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '86a3563f-6d0b-4ed6-b9dc-367e922c64fd', 'ASF/M/26-27/002', 'Tax Invoice',
      'Generated', '2026-05-17', NULL, true, true, 'Legacy CSV import', 7527, 1354, 8881, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹8881, TDS=₹0
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-06-06', 8881, 0, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/26-27/050 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '86a3563f-6d0b-4ed6-b9dc-367e922c64fd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/050'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '86a3563f-6d0b-4ed6-b9dc-367e922c64fd', 'ASF/26-27/050', 'Tax Invoice',
      'Generated', NULL, 'May-26', false, true, 'Legacy CSV import', 104669, 18840, 123509, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹121416, TDS=₹2093.38
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-09-09', 121416, 2093.38, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/26-27/047 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '86a3563f-6d0b-4ed6-b9dc-367e922c64fd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/047'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '86a3563f-6d0b-4ed6-b9dc-367e922c64fd', 'ASF/26-27/047', 'Tax Invoice',
      'Generated', NULL, 'June-26', false, true, 'Legacy CSV import', 117414, 21135, 138549, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹136200, TDS=₹2348.28
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-09-09', 136200, 2348.28, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/P/26-27/043 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '86a3563f-6d0b-4ed6-b9dc-367e922c64fd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/P/26-27/043'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '86a3563f-6d0b-4ed6-b9dc-367e922c64fd', 'ASF/P/26-27/043', 'Proforma Invoice',
      'Generated', '2026-08-07', 'July 26', false, true, 'Legacy CSV import', 112203, 20197, 132400, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/P/26-27/052 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '86a3563f-6d0b-4ed6-b9dc-367e922c64fd' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/P/26-27/052'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '86a3563f-6d0b-4ed6-b9dc-367e922c64fd', 'ASF/P/26-27/052', 'Proforma Invoice',
      'Generated', '2026-09-08', 'Aug 26', false, true, 'Legacy CSV import', 112289, 20212, 132501, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- ============================================================================
-- SITE: Minerva 58th Ho (25335366-f738-4a77-8b58-bc6c5681c135) FROM min-58th.csv
-- ============================================================================
-- Invoice: ASF/25-26/048 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '25335366-f738-4a77-8b58-bc6c5681c135' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/048'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '25335366-f738-4a77-8b58-bc6c5681c135', 'ASF/25-26/048', 'Tax Invoice',
      'Generated', '2026-02-27', 'January-26', false, true, 'Legacy CSV import', 135318, 24357, 159675, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹156969, TDS=₹2706
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-03-17', 156969, 2706, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/25-26/065 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '25335366-f738-4a77-8b58-bc6c5681c135' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/065'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '25335366-f738-4a77-8b58-bc6c5681c135', 'ASF/25-26/065', 'Tax Invoice',
      'Generated', '2026-04-06', 'February-26', false, true, 'Legacy CSV import', 26226, 4721, 0, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/26-27/003 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '25335366-f738-4a77-8b58-bc6c5681c135' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/003'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '25335366-f738-4a77-8b58-bc6c5681c135', 'ASF/26-27/003', 'Tax Invoice',
      'Generated', '2026-04-12', 'February-26', false, true, 'Legacy CSV import', 26226, 4721, 30947, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹30422, TDS=₹525
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-05-19', 30422, 525, 'NEFT', 'is 65 chnged to 003 ??', now());
END $$;

-- Invoice: ASF/M/25-26/013 (MATERIAL)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '25335366-f738-4a77-8b58-bc6c5681c135' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/M/25-26/013'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '25335366-f738-4a77-8b58-bc6c5681c135', 'ASF/M/25-26/013', 'Tax Invoice',
      'Generated', '2026-04-05', 'February-26', true, true, 'Legacy CSV import', 15864, 2656, 18520, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹18203, TDS=₹317
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-05-19', 18203, 317, 'NEFT', 'no tds ded ??', now());
END $$;

-- Invoice: ASF/26-27/013 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '25335366-f738-4a77-8b58-bc6c5681c135' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/013'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '25335366-f738-4a77-8b58-bc6c5681c135', 'ASF/26-27/013', 'Tax Invoice',
      'Generated', '2026-04-23', 'March-26', false, true, 'Legacy CSV import', 40410, 7274, 47684, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹46876, TDS=₹808
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-05-19', 46876, 808, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/26-27/021 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '25335366-f738-4a77-8b58-bc6c5681c135' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/021'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '25335366-f738-4a77-8b58-bc6c5681c135', 'ASF/26-27/021', 'Tax Invoice',
      'Generated', '2026-05-07', 'April-26', false, true, 'Legacy CSV import', 43197, 7775, 50972, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹50109, TDS=₹864
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-06-06', 50109, 864, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/26-27/051 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '25335366-f738-4a77-8b58-bc6c5681c135' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/051'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '25335366-f738-4a77-8b58-bc6c5681c135', 'ASF/26-27/051', 'Tax Invoice',
      'Generated', NULL, 'June-26', false, true, 'Legacy CSV import', 20878, 3758, 24636, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹24218, TDS=₹417.56
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-09-09', 24218, 417.56, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/P/26-27/045 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '25335366-f738-4a77-8b58-bc6c5681c135' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/P/26-27/045'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '25335366-f738-4a77-8b58-bc6c5681c135', 'ASF/P/26-27/045', 'Proforma Invoice',
      'Generated', '2026-08-06', 'July 26', false, true, 'Legacy CSV import', 36229.74, 6521, 42751, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/P/26-27/056 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '25335366-f738-4a77-8b58-bc6c5681c135' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/P/26-27/056'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '25335366-f738-4a77-8b58-bc6c5681c135', 'ASF/P/26-27/056', 'Proforma Invoice',
      'Generated', '2026-09-08', 'Aug 26', false, true, 'Legacy CSV import', 56434.79, 10158, 66593, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- ============================================================================
-- SITE: Minerva Sales (5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa) FROM min-sales.csv
-- ============================================================================
-- Invoice: ASF/25-26/051 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/051'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa', 'ASF/25-26/051', 'Tax Invoice',
      'Generated', '2026-02-27', 'December-25', false, true, 'Legacy CSV import', 117935, 21228, 139163, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹136805, TDS=₹2359
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-03-17', 136805, 2359, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/25-26/048 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/048'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa', 'ASF/25-26/048', 'Tax Invoice',
      'Generated', '2026-02-27', 'January-26', false, true, 'Legacy CSV import', 135318, 24357, 159675, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹156969, TDS=₹2706
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-03-17', 156969, 2706, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/26-27/004 (REL) (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/004 (REL)'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa', 'ASF/26-27/004 (REL)', 'Tax Invoice',
      'Generated', '2026-04-12', 'December-25', false, true, 'Legacy CSV import', 15681, 2823, 18504, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/26-27/005 (REL) (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/005 (REL)'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa', 'ASF/26-27/005 (REL)', 'Tax Invoice',
      'Generated', '2026-04-12', 'January-26', false, true, 'Legacy CSV import', 15424, 2776, 18200, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/26-27/002 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/002'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa', 'ASF/26-27/002', 'Tax Invoice',
      'Generated', '2026-04-12', 'February-26', false, true, 'Legacy CSV import', 146048, 26289, 172337, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹169416, TDS=₹2921
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-05-19', 169416, 2921, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/26-27/012 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/012'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa', 'ASF/26-27/012', 'Tax Invoice',
      'Generated', '2026-04-23', 'March-26', false, true, 'Legacy CSV import', 139763, 25157, 164920, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹162125, TDS=₹2795
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-05-19', 162125, 2795, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/26-27/022 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/022'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa', 'ASF/26-27/022', 'Tax Invoice',
      'Generated', '2026-05-07', 'April-26', false, true, 'Legacy CSV import', 89322, 16078, 105400, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹103614, TDS=₹1786.44
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-06-06', 103614, 1786.44, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/26-27/048 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/048'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa', 'ASF/26-27/048', 'Tax Invoice',
      'Generated', NULL, 'May-26', false, true, 'Legacy CSV import', 72007.94, 12961, 84969, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹83529, TDS=₹1440.1588
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-09-09', 83529, 1440.1588, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/26-27/049 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/049'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa', 'ASF/26-27/049', 'Tax Invoice',
      'Generated', NULL, 'June-26', false, true, 'Legacy CSV import', 85267, 15348, 100615, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹98910, TDS=₹1705.34
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-09-09', 98910, 1705.34, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/P/26-27/044 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/P/26-27/044'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa', 'ASF/P/26-27/044', 'Proforma Invoice',
      'Generated', '2026-08-07', 'July 26', false, true, 'Legacy CSV import', 116247, 20924, 137171, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/P/26-27/053 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/P/26-27/053'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5f8aa026-37f6-4ee9-b121-8e2f78b6c6aa', 'ASF/P/26-27/053', 'Proforma Invoice',
      'Generated', '2026-09-08', 'Aug 26', false, true, 'Legacy CSV import', 116863, 21035, 137898, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- ============================================================================
-- SITE: Minerva Big site (5772ede7-7923-47fb-ab7b-fe4cd7c4309a) FROM minchs big site.csv
-- ============================================================================
-- Invoice: ASF/25-26/052 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5772ede7-7923-47fb-ab7b-fe4cd7c4309a' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/052'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5772ede7-7923-47fb-ab7b-fe4cd7c4309a', 'ASF/25-26/052', 'Tax Invoice',
      'Generated', '2026-02-27', 'December-25', false, true, 'Legacy CSV import', 71572, 12883, 84455, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹83024, TDS=₹1431
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-03-17', 83024, 1431, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/25-26/050 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5772ede7-7923-47fb-ab7b-fe4cd7c4309a' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/25-26/050'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5772ede7-7923-47fb-ab7b-fe4cd7c4309a', 'ASF/25-26/050', 'Tax Invoice',
      'Generated', '2026-02-27', 'January-26', false, true, 'Legacy CSV import', 451481, 81267, 532748, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹523718, TDS=₹9030
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-03-17', 523718, 9030, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/M/25-26/008 (MATERIAL)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5772ede7-7923-47fb-ab7b-fe4cd7c4309a' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/M/25-26/008'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5772ede7-7923-47fb-ab7b-fe4cd7c4309a', 'ASF/M/25-26/008', 'Tax Invoice',
      'Generated', '2026-02-28', 'January-26', true, true, 'Legacy CSV import', 11433, 1755, 13188, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹12959, TDS=₹229
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-03-17', 12959, 229, 'NEFT', NULL, now());
END $$;

-- Invoice: ASF/26-27/015 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5772ede7-7923-47fb-ab7b-fe4cd7c4309a' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/015'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5772ede7-7923-47fb-ab7b-fe4cd7c4309a', 'ASF/26-27/015', 'Tax Invoice',
      'Generated', '2026-05-04', 'Above changed to 15 Inv no', false, true, 'Legacy CSV import', 29452, 5301, 34753, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹34164, TDS=₹589
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-05-29', 34164, 589, 'Cheque', NULL, now());
END $$;

-- Invoice: ASF/26-27/016 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5772ede7-7923-47fb-ab7b-fe4cd7c4309a' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/016'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5772ede7-7923-47fb-ab7b-fe4cd7c4309a', 'ASF/26-27/016', 'Tax Invoice',
      'Generated', '2026-05-04', 'Above changed to 16 Inv no', false, true, 'Legacy CSV import', 491752, 88515, 580267, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹570432, TDS=₹9835
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-05-29', 570432, 9835, 'Cheque', NULL, now());
END $$;

-- Invoice: ASF/M/25-26/011 (MATERIAL)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5772ede7-7923-47fb-ab7b-fe4cd7c4309a' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/M/25-26/011'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5772ede7-7923-47fb-ab7b-fe4cd7c4309a', 'ASF/M/25-26/011', 'Tax Invoice',
      'Generated', '2026-04-03', 'March-26', true, true, 'Legacy CSV import', 6808, 1000, 7808, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹7672, TDS=₹136
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-05-29', 7672, 136, 'Cheque', 'THIS INVOICE WAS DULICATE OF 001, ITS NOT IN GST SO, HAASH \', now());
END $$;

-- Invoice: ASF/26-27/017 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5772ede7-7923-47fb-ab7b-fe4cd7c4309a' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/017'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5772ede7-7923-47fb-ab7b-fe4cd7c4309a', 'ASF/26-27/017', 'Tax Invoice',
      'Generated', '2026-05-04', 'March-26', false, true, 'Legacy CSV import', 533205.3, 95977, 629182, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹618518, TDS=₹10664
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-05-29', 618518, 10664, 'Cheque', NULL, now());
END $$;

-- Invoice: ASF/26-27/018 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5772ede7-7923-47fb-ab7b-fe4cd7c4309a' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/018'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5772ede7-7923-47fb-ab7b-fe4cd7c4309a', 'ASF/26-27/018', 'Tax Invoice',
      'Generated', '2026-05-04', 'April-26', false, true, 'Legacy CSV import', 465638.44, 83815, 549453, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹540141, TDS=₹9313
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-07-28', 540141, 9313, 'Cheque', NULL, now());
END $$;

-- Invoice: ASF/M/26-27/001 (MATERIAL)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5772ede7-7923-47fb-ab7b-fe4cd7c4309a' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/M/26-27/001'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5772ede7-7923-47fb-ab7b-fe4cd7c4309a', 'ASF/M/26-27/001', 'Tax Invoice',
      'Generated', '2026-05-04', NULL, true, true, 'Legacy CSV import', 6808, 1000.4, 7808, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹7672, TDS=₹136
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-05-29', 7672, 136, 'Cheque', NULL, now());
END $$;

-- Invoice: ASF/M/26-27/003 (MATERIAL)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5772ede7-7923-47fb-ab7b-fe4cd7c4309a' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/M/26-27/003'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5772ede7-7923-47fb-ab7b-fe4cd7c4309a', 'ASF/M/26-27/003', 'Tax Invoice',
      'Generated', '2026-05-26', NULL, true, true, 'Legacy CSV import', 24092, 3832, 27924, now()
    ) RETURNING id INTO v_id;
  END IF;
  -- Payment: Paid=₹27442, TDS=₹482
  DELETE FROM public.invoice_payments WHERE invoice_id = v_id;
  INSERT INTO public.invoice_payments (invoice_id, paid_date, amount, tds_amount, mode, remark, created_at)
  VALUES (v_id, '2026-05-29', 27442, 482, 'Cheque', NULL, now());
END $$;

-- Invoice: ASF/26-27/029 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5772ede7-7923-47fb-ab7b-fe4cd7c4309a' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/029'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5772ede7-7923-47fb-ab7b-fe4cd7c4309a', 'ASF/26-27/029', 'Tax Invoice',
      'Generated', '2026-06-14', 'May-26', false, true, 'Legacy CSV import', 275471, 49585, 325056, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/26-27/039 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5772ede7-7923-47fb-ab7b-fe4cd7c4309a' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/039'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5772ede7-7923-47fb-ab7b-fe4cd7c4309a', 'ASF/26-27/039', 'Tax Invoice',
      'Generated', NULL, 'June-26', false, true, 'Legacy CSV import', 245232, 44142, 289373, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/26-27/080 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5772ede7-7923-47fb-ab7b-fe4cd7c4309a' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/080'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5772ede7-7923-47fb-ab7b-fe4cd7c4309a', 'ASF/26-27/080', 'Tax Invoice',
      'Generated', '2026-09-15', 'July 26', false, true, 'Legacy CSV import', 313172, 56371, 369543, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/26-27/077 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '5772ede7-7923-47fb-ab7b-fe4cd7c4309a' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/077'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '5772ede7-7923-47fb-ab7b-fe4cd7c4309a', 'ASF/26-27/077', 'Tax Invoice',
      'Generated', '2026-09-15', 'Aug 26', false, true, 'Legacy CSV import', 323250, 58185, 381435, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- ============================================================================
-- SITE: AJmera Greenfinity (244f478c-46a9-4363-ab56-a158b58024d6) FROM greenfinity.csv
-- ============================================================================
-- Invoice: ASF/26-27/068 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '244f478c-46a9-4363-ab56-a158b58024d6' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/068'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '244f478c-46a9-4363-ab56-a158b58024d6', 'ASF/26-27/068', 'Tax Invoice',
      'Generated', '2026-08-11', 'July-26', false, true, 'Legacy CSV import', 34720, 6250, 40970, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

-- Invoice: ASF/26-27/083 (SERVICE)
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- 1. Check if invoice already exists in platform for this site
  SELECT id INTO v_id FROM public.invoices
  WHERE site_id = '244f478c-46a9-4363-ab56-a158b58024d6' AND UPPER(TRIM(invoice_no)) = UPPER(TRIM('ASF/26-27/083'))
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      company_id, site_id, invoice_no, type, status, invoice_date, billing_period,
      is_material, is_legacy, legacy_notes, sub_total, tax_total, grand_total, created_at
    ) VALUES (
      '24a111d0-b7ec-4eb2-8d04-b32f9b3f04c6', '244f478c-46a9-4363-ab56-a158b58024d6', 'ASF/26-27/083', 'Tax Invoice',
      'Generated', '2026-10-06', 'Aug  2026', false, true, 'Legacy CSV import', 20520, 3694, 24214, now()
    ) RETURNING id INTO v_id;
  END IF;
END $$;

COMMIT;
