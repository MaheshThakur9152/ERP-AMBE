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
    error?.code === 401
  ) {
    return {
      status: 401,
      message: 'Google OAuth authorization required or token expired. Please connect your Google account.',
      requiresAuth: true,
      authUrl: GoogleAttendanceSheetService.getAuthUrl('/attendance'),
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
    return {
      status: 403,
      message: "Drive storage quota exceeded: Google Service Accounts cannot create files in personal My Drive folders. Please connect via OAuth (click 'Authorize with Google') or use a Google Workspace Shared Drive.",
      requiresAuth: true,
      authUrl: GoogleAttendanceSheetService.getAuthUrl('/attendance'),
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

      const frontendUrl = env.FRONTEND_URL || env.CLIENT_URL || 'http://localhost:5173';
      const redirectTarget = `${frontendUrl.replace(/\/+$/, '')}${state.startsWith('/') ? state : `/${state}`}?google_auth=success`;
      res.redirect(redirectTarget);
    } catch (error: any) {
      console.error('❌ Google OAuth callback error:', error.message);
      const frontendUrl = env.FRONTEND_URL || env.CLIENT_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl.replace(/\/+$/, '')}/attendance?google_auth_error=${encodeURIComponent(error.message)}`);
    }
  }
}
