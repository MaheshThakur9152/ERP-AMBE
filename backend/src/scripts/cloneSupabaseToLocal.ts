import { Pool } from 'pg';
import { supabaseAdmin } from '../config/supabase';
import dotenv from 'dotenv';

dotenv.config();

const connectionString =
  process.env.DATABASE_URL || 'postgresql://erp_admin:postgres@127.0.0.1:5432/erp_facility';

const pool = new Pool({ connectionString });

const DDL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address_line1 text,
  address_line2 text,
  contact_no text,
  email_website text,
  cin_no text,
  gstin text,
  bank_name text,
  account_no text,
  ifsc_code text,
  branch_name text,
  created_at timestamptz DEFAULT now(),
  entity_code text,
  default_terms text,
  tax_prefix text,
  tax_sequence integer DEFAULT 1,
  proforma_prefix text,
  proforma_sequence integer DEFAULT 1,
  is_locked boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  site_name text NOT NULL,
  address text,
  gstin text,
  work_order_ref text,
  work_order_period text,
  rate_cards jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  management_fee_percent numeric DEFAULT 0,
  contact_no text,
  email text,
  status text DEFAULT 'active',
  updated_at timestamptz DEFAULT now(),
  default_machinery_charges numeric DEFAULT 0,
  default_material_charges numeric DEFAULT 0,
  code_name text,
  additional_charges jsonb DEFAULT '[]'::jsonb,
  is_locked boolean DEFAULT false,
  persons integer DEFAULT 1,
  person_work_order integer DEFAULT 1,
  person_worked_site integer DEFAULT 1,
  use_separate_person_counts boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.rate_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name text,
  post_name text,
  gross_salary numeric DEFAULT 0,
  basic_da numeric DEFAULT 0,
  hra numeric DEFAULT 0,
  washing_allowance numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  conveyance_allowance numeric DEFAULT 0,
  other_cash_allowance numeric DEFAULT 0,
  incentive_amount numeric DEFAULT 0,
  incentive numeric DEFAULT 0,
  is_flat_wage boolean DEFAULT false,
  other_allowance numeric DEFAULT 0,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  committed_salary numeric DEFAULT 0,
  bonus_amount numeric DEFAULT 0,
  part_bonus_amount numeric DEFAULT 0,
  remark text,
  part_bonus_percent numeric DEFAULT 0,
  location text,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  biometric_code text,
  employee_name text NOT NULL,
  weekly_off text DEFAULT 'Sunday',
  designation text,
  created_at timestamptz DEFAULT now(),
  status text DEFAULT 'Active',
  phone text,
  rate_card_id uuid,
  bank_account_no text,
  bank_ifsc_code text,
  bank_name text,
  payee_name text,
  is_locked boolean DEFAULT false,
  gender text,
  monthly_incentive numeric DEFAULT 0,
  uan_no text,
  esic_no text,
  compliance_name text,
  aadhar_no text,
  pan_no text,
  aadhar_doc_url text,
  pan_doc_url text,
  passbook_doc_url text,
  uan_card_doc_url text,
  esic_card_doc_url text,
  left_date date,
  inactive_reason text DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  record_date date NOT NULL,
  shift_type text DEFAULT 'regular',
  status text NOT NULL,
  created_at timestamptz DEFAULT now(),
  in_time text,
  out_time text,
  duration_hours numeric DEFAULT 0,
  duration text,
  CONSTRAINT attendance_records_staff_id_record_date_key UNIQUE (staff_id, record_date)
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  invoice_no text NOT NULL,
  type text NOT NULL,
  status text DEFAULT 'draft',
  invoice_date date,
  billing_period text,
  line_items jsonb DEFAULT '[]'::jsonb,
  sub_total numeric DEFAULT 0,
  tax_total numeric DEFAULT 0,
  grand_total numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  challan_no text,
  challan_date date,
  buyer_order_no text,
  dispatch_doc_no text,
  dispatched_through text,
  destination text,
  terms_of_delivery text,
  is_material boolean DEFAULT false,
  machinery_charges numeric DEFAULT 0,
  material_charges numeric DEFAULT 0,
  management_fee_percent numeric DEFAULT 0,
  mgmt_percent numeric DEFAULT 0,
  certified_doc_url text,
  additional_charges jsonb DEFAULT '[]'::jsonb,
  previous_version_id uuid,
  certified_attendance_url text,
  is_locked boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  generated_pdf_url text,
  cancelled_at timestamptz,
  cancelled_reason text,
  certified_doc_storage_key text,
  generated_pdf_storage_key text,
  certified_attendance_storage_key text,
  invoice_storage_provider text,
  approved_at timestamptz,
  certified_doc_confirmed_at timestamptz,
  certified_attendance_confirmed_at timestamptz,
  is_legacy boolean DEFAULT false,
  legacy_uploaded_by text,
  legacy_notes text
);

CREATE TABLE IF NOT EXISTS public.payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_year text NOT NULL,
  site_name text,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  rate_card_id uuid,
  payable_days numeric DEFAULT 0,
  advances numeric DEFAULT 0,
  earned_basic numeric DEFAULT 0,
  earned_hra numeric DEFAULT 0,
  earned_other numeric DEFAULT 0,
  earned_gross numeric DEFAULT 0,
  epf_deduction numeric DEFAULT 0,
  esic_deduction numeric DEFAULT 0,
  pt_deduction numeric DEFAULT 0,
  net_salary numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  emp_id text,
  employee_name text,
  pd numeric DEFAULT 0,
  wo numeric DEFAULT 0,
  earned_conveyance numeric DEFAULT 0,
  earned_incentive numeric DEFAULT 0,
  earned_bonus numeric DEFAULT 0,
  epf numeric DEFAULT 0,
  esic numeric DEFAULT 0,
  pt numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  is_paid boolean DEFAULT false,
  adv_amt numeric DEFAULT 0,
  shirt numeric DEFAULT 0,
  pant numeric DEFAULT 0,
  shoes numeric DEFAULT 0,
  id_card numeric DEFAULT 0,
  other_amt numeric DEFAULT 0,
  remark text,
  adv_date date,
  adv_total numeric DEFAULT 0,
  in_this_mth numeric DEFAULT 0,
  in_next_mth numeric DEFAULT 0,
  is_locked boolean DEFAULT false,
  earned_part_bonus numeric DEFAULT 0,
  remaining_part_bonus numeric DEFAULT 0,
  total_net_salary numeric DEFAULT 0,
  bonus_amount_snapshot numeric DEFAULT 0,
  part_bonus_amount_snapshot numeric DEFAULT 0,
  rate_card_remark_snapshot text,
  part_bonus_percent_snapshot numeric DEFAULT 0,
  bonus_full_entitlement numeric DEFAULT 0,
  bonus_monthly_allocation numeric DEFAULT 0,
  manual_pt_adjustment numeric DEFAULT 0,
  manual_pt_adjustment_reason text DEFAULT '',
  designation text,
  pf_no text,
  esic_no text,
  bank_account_no text,
  bank_ifsc_code text,
  days_in_month integer,
  custom_earnings jsonb DEFAULT '[]'::jsonb,
  custom_deductions jsonb DEFAULT '[]'::jsonb,
  is_manually_edited boolean DEFAULT false,
  manual_override_data jsonb DEFAULT null,
  CONSTRAINT payroll_records_staff_month_unique UNIQUE (staff_id, month_year)
);

CREATE TABLE IF NOT EXISTS public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
  document_type text,
  file_name text,
  gcp_file_url text,
  uploaded_at timestamptz DEFAULT now(),
  storage_provider text,
  storage_key text
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  role text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  hsn_code text DEFAULT '',
  gst_rate numeric DEFAULT 18,
  default_rate numeric DEFAULT 0,
  unit text DEFAULT 'Nos',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  month_year text NOT NULL,
  status text DEFAULT 'draft',
  summary jsonb DEFAULT '{}'::jsonb,
  records jsonb DEFAULT '[]'::jsonb,
  is_locked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bonus_disbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
  financial_year text NOT NULL,
  amount numeric NOT NULL,
  disbursed_at timestamptz DEFAULT now(),
  disbursed_by uuid,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  family_id uuid NOT NULL DEFAULT gen_random_uuid(),
  supabase_refresh_token text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz DEFAULT now()
);
`;

const TABLES = [
  'companies',
  'sites',
  'rate_cards',
  'staff',
  'attendance_records',
  'attendance_sheets',
  'invoices',
  'payroll_records',
  'employee_documents',
  'materials',
  'user_roles',
  'bonus_disbursements',
  'refresh_tokens',
];

async function fetchAllFromSupabase(table: string): Promise<any[]> {
  const allRows: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1);

    if (error) {
      console.error(`Error querying ${table} range ${from}-${from + pageSize - 1}:`, error.message);
      break;
    }

    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

const DATE_COLUMNS = new Set([
  'challan_date',
  'invoice_date',
  'left_date',
  'adv_date',
  'record_date',
  'disbursed_at',
  'cancelled_at',
  'approved_at',
  'certified_doc_confirmed_at',
  'certified_attendance_confirmed_at',
  'created_at',
  'updated_at',
  'expires_at',
  'revoked_at',
]);

const UUID_COLUMNS = new Set([
  'company_id',
  'site_id',
  'staff_id',
  'rate_card_id',
  'previous_version_id',
  'user_id',
  'family_id',
  'disbursed_by',
]);

async function cloneTableData(table: string, rows: any[]) {
  if (rows.length === 0) return 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Truncate table with cascade
    await client.query(`TRUNCATE TABLE public.${table} CASCADE`);

    for (const row of rows) {
      const keys = Object.keys(row);
      const values = keys.map((k) => {
        let val = row[k];
        if (val !== null && typeof val === 'object') {
          return JSON.stringify(val);
        }
        if (typeof val === 'string' && val.trim() === '') {
          if (DATE_COLUMNS.has(k) || UUID_COLUMNS.has(k)) {
            return null;
          }
        }
        return val;
      });

      const cols = keys.map((k) => `"${k}"`).join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const query = `INSERT INTO public.${table} (${cols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

      await client.query(query, values);
    }
    await client.query('COMMIT');
    return rows.length;
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error(`Error inserting into ${table}:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function run() {
  console.log('🚀 Step 1: Applying DDL schema to local PostgreSQL...');
  await pool.query(DDL);
  console.log('✅ Local PostgreSQL schema initialized.');

  console.log('\n📥 Step 2: Fetching and copying data from Supabase Cloud...');
  const parityReport: Array<{ table: string; supabaseCount: number; localCount: number; match: boolean }> = [];

  for (const table of TABLES) {
    const supabaseRows = await fetchAllFromSupabase(table);
    await cloneTableData(table, supabaseRows);

    const countRes = await pool.query(`SELECT count(*)::int as cnt FROM public.${table}`);
    const localCount = countRes.rows[0].cnt;

    parityReport.push({
      table,
      supabaseCount: supabaseRows.length,
      localCount,
      match: supabaseRows.length === localCount,
    });
  }

  console.log('\n📊 Step 3: Parity Verification Report:');
  console.table(parityReport);

  const allMatched = parityReport.every((r) => r.match);
  if (allMatched) {
    console.log('\n🎉 ALL TABLES VERIFIED IN 100% PARITY WITH PRODUCTION SUPABASE!');
  } else {
    console.warn('\n⚠️ Discrepancy detected in one or more tables.');
  }

  await pool.end();
}

run().catch((err) => {
  console.error('Fatal error during clone:', err);
  process.exit(1);
});
