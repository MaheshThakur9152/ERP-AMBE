-- Migration 24: Create Google Attendance Sheets tracking and OAuth tokens
CREATE TABLE IF NOT EXISTS public.google_attendance_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  month text NOT NULL,
  year text NOT NULL,
  spreadsheet_id text NOT NULL,
  spreadsheet_url text NOT NULL,
  template_file_id text,
  sync_status text NOT NULL DEFAULT 'synced',
  last_synced_at timestamptz DEFAULT NOW(),
  last_error text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  CONSTRAINT uq_google_attendance_site_month_year UNIQUE (site_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_google_att_sheets_lookup ON public.google_attendance_sheets(site_id, month, year);

CREATE TABLE IF NOT EXISTS public.google_integration_tokens (
  id text PRIMARY KEY DEFAULT 'attendance_oauth',
  refresh_token text NOT NULL,
  access_token text,
  expiry_date bigint,
  scope text,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);
