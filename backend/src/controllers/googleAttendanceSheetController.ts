import { Request, Response, NextFunction } from 'express';
import { GoogleAttendanceSheetService } from '../services/googleAttendanceSheetService';
import { env } from '../config/env';

export class GoogleAttendanceSheetController {
  /**
   * Get existing Google Sheet or create new one for the specified site/month/year
   */
  static async getOrCreateSheet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const siteId = req.query.siteId as string;
      const month = req.query.month as string;
      const year = req.query.year as string;

      if (!siteId || !month || !year) {
        res.status(400).json({ success: false, error: 'siteId, month, and year query parameters are required' });
        return;
      }

      const result = await GoogleAttendanceSheetService.getOrCreateSpreadsheet(siteId, month, year, req.user);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('❌ Controller error getting/creating Google Sheet:', error.message);
      if (error.message?.includes('invalid_grant') || error.message?.includes('No refresh token')) {
        res.status(401).json({
          success: false,
          error: 'Google OAuth re-authorization required. Please connect your Google account.',
          authUrl: GoogleAttendanceSheetService.getAuthUrl('/attendance'),
          requiresAuth: true,
        });
        return;
      }
      if (error.message?.includes('has not been used in project') || error.message?.includes('is disabled')) {
        res.status(400).json({
          success: false,
          error: 'Google Sheets API has not been enabled in your Google Cloud Project. Please enable it in Google Cloud Console.',
          consoleUrl: 'https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=33967677106',
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Synchronize attendance data to the persistent Google Sheet
   */
  static async syncSheet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { siteId, month, year } = req.body;

      if (!siteId || !month || !year) {
        res.status(400).json({ success: false, error: 'siteId, month, and year are required in request body' });
        return;
      }

      const result = await GoogleAttendanceSheetService.syncAttendanceData(siteId, month, year, req.user);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('❌ Controller error syncing Google Sheet:', error.message);
      if (error.message?.includes('invalid_grant') || error.message?.includes('No refresh token')) {
        res.status(401).json({
          success: false,
          error: 'Google OAuth re-authorization required. Please connect your Google account.',
          authUrl: GoogleAttendanceSheetService.getAuthUrl('/attendance'),
          requiresAuth: true,
        });
        return;
      }
      if (error.message?.includes('has not been used in project') || error.message?.includes('is disabled')) {
        res.status(400).json({
          success: false,
          error: 'Google Sheets API has not been enabled in your Google Cloud Project. Please enable it in Google Cloud Console.',
          consoleUrl: 'https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=33967677106',
        });
        return;
      }
      next(error);
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
