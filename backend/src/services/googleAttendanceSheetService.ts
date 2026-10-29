import { google } from 'googleapis';
import { pool, withTransaction } from '../db/pool';
import { env } from '../config/env';
import { AuthUser } from '../types/express';
import { Readable } from 'stream';
import ExcelJS from 'exceljs';

export interface GoogleSheetSyncResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  isNew: boolean;
  siteName: string;
  month: string;
  year: string;
  lastSyncedAt: string;
  status: string;
}

export class GoogleAttendanceSheetService {
  private static tablesInitialized = false;

  public static getEffectiveRedirectUri(): string {
    if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
    if (env.GOOGLE_REDIRECT_URI && env.GOOGLE_REDIRECT_URI !== 'https://developers.google.com/oauthplayground') {
      return env.GOOGLE_REDIRECT_URI;
    }
    const base = (env.FRONTEND_URL || env.CLIENT_URL || 'https://admin.ambeservice.com').replace(/\/+$/, '');
    return `${base}/api/attendance/google-sheet/callback`;
  }

  public static async ensureTablesExist(): Promise<void> {
    if (this.tablesInitialized) return;
    try {
      await pool.query(`
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
      `);
      this.tablesInitialized = true;
    } catch (err: any) {
      console.warn('⚠️ Auto-init google_attendance_sheets warning:', err.message);
    }
  }

  /**
   * Resolve an authorized OAuth2 or Service Account client.
   * Priority:
   * 1. Dynamic OAuth token stored in PostgreSQL (public.google_integration_tokens)
   * 2. Environment GOOGLE_REFRESH_TOKEN
   * 3. GCP Service Account JWT (if configured and supported)
   */
  private static async getAuthClient(): Promise<{ auth: any; type: 'oauth' | 'service_account' }> {
    // 1. Check PostgreSQL for stored dynamic OAuth token
    try {
      const tokenRes = await pool.query(
        'SELECT refresh_token FROM public.google_integration_tokens WHERE id = $1 LIMIT 1;',
        ['attendance_oauth']
      );
      if (tokenRes.rows?.[0]?.refresh_token) {
        const oauth2Client = new google.auth.OAuth2(
          env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
          env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
          this.getEffectiveRedirectUri()
        );
        oauth2Client.setCredentials({ refresh_token: tokenRes.rows[0].refresh_token });
        return { auth: oauth2Client, type: 'oauth' };
      }
    } catch {
      // Ignore table read error, fallback to env
    }

    // 2. Check environment variable GOOGLE_REFRESH_TOKEN
    const envRefreshToken = env.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;
    if (envRefreshToken && (env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID)) {
      const oauth2Client = new google.auth.OAuth2(
        env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
        this.getEffectiveRedirectUri()
      );
      oauth2Client.setCredentials({ refresh_token: envRefreshToken });
      return { auth: oauth2Client, type: 'oauth' };
    }

    // 3. Service Account JWT fallback
    const saEmail = env.GCP_CLIENT_EMAIL || process.env.GCP_CLIENT_EMAIL;
    let saKey = env.GCP_PRIVATE_KEY || process.env.GCP_PRIVATE_KEY;
    if (saEmail && saKey) {
      saKey = saKey.replace(/\\n/g, '\n');
      const jwtClient = new google.auth.JWT({
        email: saEmail,
        key: saKey,
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/spreadsheets',
        ],
      });
      return { auth: jwtClient, type: 'service_account' };
    }

    throw new Error('Google Drive integration is not configured. OAuth credentials or Service Account required.');
  }

  /**
   * Generates Google OAuth authorization URL for offline access
   */
  public static getAuthUrl(state = ''): string {
    const clientId = env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = this.getEffectiveRedirectUri();

    if (!clientId || !clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured to generate an authorization URL.');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
      state,
    });
  }

  /**
   * Exchanges authorization code for tokens and persists to database
   */
  public static async handleOAuthCallback(code: string): Promise<void> {
    const clientId = env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = this.getEffectiveRedirectUri();

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      throw new Error('Google did not return a refresh token. Please re-authorize with prompt=consent.');
    }

    await pool.query(
      `INSERT INTO public.google_integration_tokens (id, refresh_token, access_token, expiry_date, scope, updated_at)
       VALUES ('attendance_oauth', $1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET
         refresh_token = EXCLUDED.refresh_token,
         access_token = EXCLUDED.access_token,
         expiry_date = EXCLUDED.expiry_date,
         scope = EXCLUDED.scope,
         updated_at = NOW();`,
      [tokens.refresh_token, tokens.access_token || null, tokens.expiry_date || null, tokens.scope || null]
    );
  }

  /**
   * Helper: Find template file in the attendance folder
   */
  public static async findTemplateFile(drive: any, folderId: string): Promise<{ id: string; name: string; isNative: boolean }> {
    // 1. Check if configured explicitly
    const explicitTemplateId = process.env.GOOGLE_ATTENDANCE_TEMPLATE_SPREADSHEET_ID;
    if (explicitTemplateId) {
      try {
        const meta = await drive.files.get({ fileId: explicitTemplateId, fields: 'id, name, mimeType', supportsAllDrives: true });
        return {
          id: meta.data.id!,
          name: meta.data.name!,
          isNative: meta.data.mimeType === 'application/vnd.google-apps.spreadsheet',
        };
      } catch {
        // Fallback to searching the folder
      }
    }

    // 2. Search folder for native sheet or xlsx
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, modifiedTime)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const files = res.data.files || [];
    // Prefer native sheet template first
    const nativeSheet = files.find((f: any) => f.mimeType === 'application/vnd.google-apps.spreadsheet');
    if (nativeSheet) {
      return { id: nativeSheet.id!, name: nativeSheet.name!, isNative: true };
    }

    // Otherwise use xlsx template
    const xlsxFile = files.find((f: any) =>
      f.name?.toLowerCase().includes('attendance') ||
      f.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    if (xlsxFile) {
      return { id: xlsxFile.id!, name: xlsxFile.name!, isNative: false };
    }

    if (files.length > 0) {
      return { id: files[0].id!, name: files[0].name!, isNative: false };
    }

    throw new Error(`No attendance template found in Google Drive folder: ${folderId}`);
  }

  /**
   * Fast DB-only lookup to check if a spreadsheet is already registered for this site/period.
   * Does NOT call Google APIs and never throws 500 on passive page view.
   */
  public static async getExistingSpreadsheet(
    siteId: string,
    monthStr: string,
    yearStr: string,
    user?: AuthUser
  ): Promise<{ spreadsheetId: string; spreadsheetUrl: string; lastSyncedAt?: string; status?: string } | null> {
    try {
      await this.ensureTablesExist();

      const siteRes = await pool.query('SELECT company_id FROM public.sites WHERE id = $1 LIMIT 1;', [siteId]);
      if (!siteRes.rows || siteRes.rows.length === 0) {
        return null;
      }
      const site = siteRes.rows[0];

      const userCompanyId = user?.company_id || user?.companyId;
      if (user && user.role !== 'superadmin' && userCompanyId && site.company_id && site.company_id !== userCompanyId) {
        return null;
      }

      const existingRes = await pool.query(
        `SELECT spreadsheet_id, spreadsheet_url, last_synced_at, sync_status
         FROM public.google_attendance_sheets
         WHERE site_id = $1 AND month = $2 AND year = $3 LIMIT 1;`,
        [siteId, monthStr, yearStr]
      );

      if (existingRes.rows && existingRes.rows.length > 0) {
        const row = existingRes.rows[0];
        return {
          spreadsheetId: row.spreadsheet_id,
          spreadsheetUrl: row.spreadsheet_url,
          lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at).toISOString() : undefined,
          status: row.sync_status,
        };
      }

      return null;
    } catch (err: any) {
      console.warn('⚠️ getExistingSpreadsheet safe fallback to null:', err.message);
      return null;
    }
  }

  /**
   * Find or create persistent Google Spreadsheet for a given (siteId, month, year)
   */
  public static async getOrCreateSpreadsheet(
    siteId: string,
    monthStr: string,
    yearStr: string,
    user?: AuthUser
  ): Promise<{ spreadsheetId: string; spreadsheetUrl: string; isNew: boolean; templateFileId: string }> {
    // Verify site authorization
    const siteRes = await pool.query('SELECT * FROM public.sites WHERE id = $1 LIMIT 1;', [siteId]);
    if (!siteRes.rows || siteRes.rows.length === 0) {
      const err: any = new Error('Site not found');
      err.statusCode = 404;
      throw err;
    }
    const site = siteRes.rows[0];

    const userCompanyId = user?.company_id || user?.companyId;
    if (user && user.role !== 'superadmin' && userCompanyId && site.company_id && site.company_id !== userCompanyId) {
      const err: any = new Error('Access denied: Unauthorized site access');
      err.statusCode = 403;
      throw err;
    }

    const { auth } = await this.getAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    const folderId = process.env.DRIVE_ATTENDANCE_FOLDER_ID || '13-QiXNmxhFrvS3GCzfPU4U_4EcO4VhzS';

    // 1. Check existing persistent mapping in database
    const existingRes = await pool.query(
      `SELECT * FROM public.google_attendance_sheets WHERE site_id = $1 AND month = $2 AND year = $3 LIMIT 1;`,
      [siteId, monthStr, yearStr]
    );

    if (existingRes.rows && existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      // Verify spreadsheet still exists in Drive
      try {
        await drive.files.get({ fileId: existing.spreadsheet_id, fields: 'id, trashed', supportsAllDrives: true });
        return {
          spreadsheetId: existing.spreadsheet_id,
          spreadsheetUrl: existing.spreadsheet_url,
          isNew: false,
          templateFileId: existing.template_file_id || '',
        };
      } catch (checkErr: any) {
        // If file was deleted/trashed on Drive (404), purge row and recreate
        if (checkErr.code === 404 || checkErr.status === 404) {
          await pool.query('DELETE FROM public.google_attendance_sheets WHERE id = $1;', [existing.id]);
        } else {
          // Pass through authorization or network errors
          throw checkErr;
        }
      }
    }

    // 2. Identify master template
    const template = await this.findTemplateFile(drive, folderId);

    const monthNum = parseInt(monthStr, 10);
    const monthName = !isNaN(monthNum)
      ? new Date(2000, monthNum - 1, 1).toLocaleString('default', { month: 'long' })
      : monthStr;
    const cleanSiteName = (site.name || 'Site').trim();
    const sheetTitle = `Attendance - ${cleanSiteName} - ${monthName} ${yearStr}`;

    let createdId = '';
    let webViewLink = '';

    if (template.isNative) {
      // Copy native Google Sheet template
      const copyRes = await drive.files.copy({
        fileId: template.id,
        requestBody: {
          name: sheetTitle,
          parents: [folderId],
        },
        fields: 'id, name, webViewLink',
        supportsAllDrives: true,
      });
      createdId = copyRes.data.id!;
      webViewLink = copyRes.data.webViewLink || `https://docs.google.com/spreadsheets/d/${createdId}/edit`;
    } else {
      // Convert / import XLSX template into a native Google Sheet
      const xlsxBuffer = await drive.files.get(
        { fileId: template.id, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' }
      );
      const stream = Readable.from(Buffer.from(xlsxBuffer.data as ArrayBuffer));

      const createRes = await drive.files.create({
        requestBody: {
          name: sheetTitle,
          mimeType: 'application/vnd.google-apps.spreadsheet',
          parents: [folderId],
        },
        media: {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          body: stream,
        },
        fields: 'id, name, webViewLink',
        supportsAllDrives: true,
      });
      createdId = createRes.data.id!;
      webViewLink = createRes.data.webViewLink || `https://docs.google.com/spreadsheets/d/${createdId}/edit`;
    }

    // Persist mapping with conflict guard
    const insertRes = await pool.query(
      `INSERT INTO public.google_attendance_sheets (
         company_id, site_id, month, year, spreadsheet_id, spreadsheet_url, template_file_id, sync_status, last_synced_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
       ON CONFLICT (site_id, month, year) DO UPDATE SET
         spreadsheet_id = EXCLUDED.spreadsheet_id,
         spreadsheet_url = EXCLUDED.spreadsheet_url,
         template_file_id = EXCLUDED.template_file_id,
         updated_at = NOW()
       RETURNING *;`,
      [site.company_id || null, siteId, monthStr, yearStr, createdId, webViewLink, template.id]
    );

    return {
      spreadsheetId: createdId,
      spreadsheetUrl: webViewLink,
      isNew: true,
      templateFileId: template.id,
    };
  }

  /**
   * Synchronize attendance database records into the Google Sheet
   */
  public static async syncAttendanceData(
    siteId: string,
    month: string | number,
    year: string | number,
    user?: AuthUser
  ): Promise<GoogleSheetSyncResult> {
    const monthStr = String(month);
    const yearStr = String(year);
    const monthNum = parseInt(monthStr, 10);
    const yearNum = parseInt(yearStr, 10);

    // 1. Get or create persistent spreadsheet
    const { spreadsheetId, spreadsheetUrl, isNew } = await this.getOrCreateSpreadsheet(
      siteId,
      monthStr,
      yearStr,
      user
    );

    const { auth } = await this.getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // 2. Fetch site & company
    const siteRes = await pool.query('SELECT * FROM public.sites WHERE id = $1 LIMIT 1;', [siteId]);
    const site = siteRes.rows[0];

    let companyName = 'AMBE SERVICE FACILITY PVT. LTD.';
    if (site.company_id) {
      const compRes = await pool.query('SELECT name, legal_name FROM public.companies WHERE id = $1 LIMIT 1;', [site.company_id]);
      if (compRes.rows?.[0]) {
        companyName = compRes.rows[0].legal_name || compRes.rows[0].name || companyName;
      }
    }

    // 3. Fetch active staff members for this site
    const staffRes = await pool.query(
      `SELECT id, biometric_code, employee_name, weekly_off, designation
       FROM public.staff
       WHERE site_id = $1 AND (status IS NULL OR status NOT IN ('Deleted', 'Stopped'))
       ORDER BY designation ASC, employee_name ASC;`,
      [siteId]
    );
    const staffList = staffRes.rows || [];

    // 4. Fetch attendance records for the month
    const mPadded = String(monthNum).padStart(2, '0');
    const startDate = `${yearNum}-${mPadded}-01`;
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const endDate = `${yearNum}-${mPadded}-${String(daysInMonth).padStart(2, '0')}`;

    const recRes = await pool.query(
      `SELECT staff_id, record_date, status, shift_type, in_time, out_time, duration_hours
       FROM public.attendance_records
       WHERE site_id = $1 AND record_date >= $2 AND record_date <= $3;`,
      [siteId, startDate, endDate]
    );

    // Build attendance lookup: staffId -> Map(dayNumber -> status)
    const attMap = new Map<string, Map<number, string>>();
    for (const r of recRes.rows || []) {
      const sId = r.staff_id;
      const d = new Date(r.record_date).getUTCDate();
      if (!attMap.has(sId)) {
        attMap.set(sId, new Map());
      }
      attMap.get(sId)!.set(d, r.status);
    }

    // 5. Inspect spreadsheet metadata to get target sheet title
    const metaRes = await sheets.spreadsheets.get({ spreadsheetId });
    const firstSheetTitle = metaRes.data.sheets?.[0]?.properties?.title || 'Sheet1';

    // 6. Build batch value updates
    const monthName = new Date(2000, monthNum - 1, 1).toLocaleString('default', { month: 'long' });
    const valueUpdates: Array<{ range: string; values: any[][] }> = [];

    // Top headers
    valueUpdates.push({
      range: `'${firstSheetTitle}'!B2:D2`,
      values: [[companyName, '', '']],
    });
    valueUpdates.push({
      range: `'${firstSheetTitle}'!B3:D3`,
      values: [[`SITE - ${(site.name || '').toUpperCase()}`, '', '']],
    });
    valueUpdates.push({
      range: `'${firstSheetTitle}'!B4:D4`,
      values: [[`ATTENDANCE FOR THE MONTH OF ${monthName.toUpperCase()}-${yearNum}`, '', '']],
    });

    // Day numbers (Row 5, Cols F to AJ)
    const dayNumbersRow: any[] = [];
    for (let d = 1; d <= 31; d++) {
      dayNumbersRow.push(d <= daysInMonth ? d : '');
    }
    valueUpdates.push({
      range: `'${firstSheetTitle}'!F5:AJ5`,
      values: [dayNumbersRow],
    });

    // Weekdays (Row 6, Cols F to AJ)
    const weekdaysRow: any[] = [];
    for (let d = 1; d <= 31; d++) {
      if (d <= daysInMonth) {
        const dt = new Date(yearNum, monthNum - 1, d);
        weekdaysRow.push(dt.toLocaleDateString('en-US', { weekday: 'short' }));
      } else {
        weekdaysRow.push('');
      }
    }
    valueUpdates.push({
      range: `'${firstSheetTitle}'!F6:AJ6`,
      values: [weekdaysRow],
    });

    // Employee rows (Starting row 7, 2 rows per employee)
    for (let i = 0; i < staffList.length; i++) {
      const emp = staffList[i];
      const r = 7 + (i * 2);
      const sr = i + 1;
      const empMap = attMap.get(emp.id) || new Map();

      // Attendance values for Days 1 to 31
      const dayValues: any[] = [];
      for (let d = 1; d <= 31; d++) {
        if (d <= daysInMonth) {
          dayValues.push(empMap.get(d) || '');
        } else {
          dayValues.push('');
        }
      }

      // Metadata (Cols B to E)
      valueUpdates.push({
        range: `'${firstSheetTitle}'!B${r}:E${r}`,
        values: [[sr, emp.biometric_code || '', emp.employee_name || '', emp.weekly_off || 'Sunday']],
      });

      // Attendance cells (Cols F to AJ)
      valueUpdates.push({
        range: `'${firstSheetTitle}'!F${r}:AJ${r}`,
        values: [dayValues],
      });

      // Summary formulas (Cols AK to AN)
      valueUpdates.push({
        range: `'${firstSheetTitle}'!AK${r}:AN${r}`,
        values: [[
          `=COUNTIF(F${r}:AJ${r},"P")`,
          `=COUNTIF(F${r}:AJ${r},"W/O")`,
          `=COUNTIF(F${r}:AJ${r},"HD")`,
          `=SUM(AK${r}:AM${r + 1})`,
        ]],
      });
    }

    // 7. Execute batch value update
    try {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: valueUpdates,
        },
      });

      // Update sync status in DB
      await pool.query(
        `UPDATE public.google_attendance_sheets
         SET sync_status = 'synced', last_synced_at = NOW(), last_error = NULL, updated_at = NOW()
         WHERE site_id = $1 AND month = $2 AND year = $3;`,
        [siteId, monthStr, yearStr]
      );

      return {
        spreadsheetId,
        spreadsheetUrl,
        isNew,
        siteName: site.name || 'Site',
        month: monthStr,
        year: yearStr,
        lastSyncedAt: new Date().toISOString(),
        status: 'synced',
      };
    } catch (apiErr: any) {
      // Record failure in DB
      const safeErrorMsg = (apiErr.message || 'Unknown Google Sheets API error')
        .replace(/(Bearer\s+)[A-Za-z0-9_.-]+/gi, '$1[REDACTED]')
        .replace(/key=[A-Za-z0-9_.-]+/gi, 'key=[REDACTED]');

      await pool.query(
        `UPDATE public.google_attendance_sheets
         SET sync_status = 'failed', last_error = $1, updated_at = NOW()
         WHERE site_id = $2 AND month = $3 AND year = $4;`,
        [safeErrorMsg, siteId, monthStr, yearStr]
      );

      throw apiErr;
    }
  }
}
