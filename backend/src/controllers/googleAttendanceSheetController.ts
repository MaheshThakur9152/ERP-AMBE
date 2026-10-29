import { Request, Response, NextFunction } from 'express';
import { GoogleAttendanceSheetService } from '../services/googleAttendanceSheetService';
import { env } from '../config/env';

function parseGoogleError(error: any): { status: number; message: string; requiresAuth?: boolean; authUrl?: string; consoleUrl?: string } {
  const fullMsg = [
    error?.message,
    error?.response?.data?.error_description,
    error?.response?.data?.error?.message,
    typeof error?.response?.data?.error === 'string' ? error?.response?.data?.error : '',
    error?.cause?.message,
  ].filter(Boolean).join(' ');

  if (
    fullMsg.includes('invalid_grant') ||
    fullMsg.includes('No refresh token') ||
    fullMsg.includes('Token has been expired or revoked') ||
    fullMsg.includes('unauthorized_client') ||
    fullMsg.includes('OAuth authorization required') ||
    fullMsg.includes('Google Drive integration is not configured') ||
    error?.code === 401 ||
    error?.code === 'AUTH_REQUIRED'
  ) {
    if (fullMsg.includes('invalid_grant') || fullMsg.includes('Token has been expired or revoked')) {
      GoogleAttendanceSheetService.clearStoredToken().catch(() => {});
    }
    let authUrl: string | undefined;
    try {
      authUrl = GoogleAttendanceSheetService.getAuthUrl('/attendance');
    } catch {
      // client credentials missing
    }
    return {
      status: 401,
      message: authUrl
        ? 'Google Drive / Sheets authorization required. Please connect your Google account.'
        : 'Google Drive integration is not configured. Google Client ID and Secret are required.',
      requiresAuth: Boolean(authUrl),
      authUrl,
    };
  }

  if (fullMsg.includes('has not been used in project') || fullMsg.includes('is disabled')) {
    return {
      status: 400,
      message: 'Google Sheets API has not been enabled in your Google Cloud Project. Please enable it in Google Cloud Console.',
      consoleUrl: 'https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=33967677106',
    };
  }

  if (fullMsg.includes('storage quota') || fullMsg.includes('quota has been exceeded')) {
    let authUrl: string | undefined;
    try {
      authUrl = GoogleAttendanceSheetService.getAuthUrl('/attendance');
    } catch {}
    return {
      status: 403,
      message: "Drive storage quota exceeded: Google Service Accounts cannot create files in personal My Drive folders. Please connect via OAuth (click 'Authorize with Google') or use a Google Workspace Shared Drive.",
      requiresAuth: Boolean(authUrl),
      authUrl,
    };
  }

  return {
    status: 400,
    message: fullMsg || 'Google Drive / Sheets API synchronization failed.',
  };
}

export class GoogleAttendanceSheetController {
  /**
   * Fast DB-only lookup to check if a spreadsheet is already registered for the site/month/year.
   * Does NOT call Google APIs and never throws 500 on passive page view.
   */
  static async getExistingSheet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const siteId = req.query.siteId as string;
      const month = req.query.month as string;
      const year = req.query.year as string;

      if (!siteId || !month || !year) {
        res.status(400).json({ success: false, error: 'siteId, month, and year query parameters are required' });
        return;
      }

      const result = await GoogleAttendanceSheetService.getExistingSpreadsheet(siteId, month, year, req.user);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('❌ Controller error checking existing Google Sheet:', error.message);
      if (error.statusCode === 403) {
        res.status(403).json({ success: false, error: error.message });
        return;
      }
      next(error);
    }
  }

  /**
   * Synchronize attendance data to the persistent Google Sheet (creates on first click, updates on later clicks)
   */
  static async syncSheet(req: Request, res: Response): Promise<void> {
    try {
      const { siteId, month, year } = req.body;

      if (!siteId || !month || !year) {
        res.status(400).json({ success: false, error: 'siteId, month, and year are required in request body' });
        return;
      }

      const result = await GoogleAttendanceSheetService.syncAttendanceData(siteId, month, year, req.user);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('❌ Controller error syncing Google Sheet:', error);
      const parsed = parseGoogleError(error);
      res.status(parsed.status).json({
        success: false,
        error: parsed.message,
        requiresAuth: parsed.requiresAuth,
        authUrl: parsed.authUrl,
        consoleUrl: parsed.consoleUrl,
      });
    }
  }

  /**
   * Return Google OAuth authorization URL
   */
  static async getAuthUrl(req: Request, res: Response): Promise<void> {
    try {
      const state = (req.query.state as string) || '/attendance';
      const authUrl = GoogleAttendanceSheetService.getAuthUrl(state);
      res.json({ success: true, authUrl });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Handle OAuth Redirect Callback from Google
   */
  static async handleAuthCallback(req: Request, res: Response): Promise<void> {
    try {
      const code = req.query.code as string;
      const state = (req.query.state as string) || '/attendance';

      if (!code) {
        res.status(400).send('Missing authorization code from Google.');
        return;
      }

      await GoogleAttendanceSheetService.handleOAuthCallback(code);

      const rawFrontend = env.FRONTEND_URL || env.CLIENT_URL || '';
      const origins = rawFrontend.split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
      const frontendUrl =
        origins.find((o) => o.includes('admin.ambeservice.com')) ||
        origins.find((o) => o.startsWith('https://')) ||
        origins[0] ||
        'https://admin.ambeservice.com';
      const redirectTarget = `${frontendUrl}${state.startsWith('/') ? state : `/${state}`}?google_auth=success`;
      res.redirect(redirectTarget);
    } catch (error: any) {
      console.error('❌ Google OAuth callback error:', error.message);
      const rawFrontend = env.FRONTEND_URL || env.CLIENT_URL || '';
      const origins = rawFrontend.split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
      const frontendUrl =
        origins.find((o) => o.includes('admin.ambeservice.com')) ||
        origins.find((o) => o.startsWith('https://')) ||
        origins[0] ||
        'https://admin.ambeservice.com';
      res.redirect(`${frontendUrl}/attendance?google_auth_error=${encodeURIComponent(error.message)}`);
    }
  }
}
