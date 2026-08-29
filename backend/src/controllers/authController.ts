import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { COOKIE_OPTIONS, REFRESH_TOKEN_MAX_AGE } from '../config/constants';
import { fetchUserRole } from '../middlewares/authMiddleware';
import { TokenService } from '../services/tokenService';

export class AuthController {
  /**
   * POST /api/auth/login
   * Authenticates user via Supabase.
   * Returns short-lived access token in response body.
   * Sets long-lived rotating refresh token in HTTP-only, Secure, SameSite=Strict cookie.
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email: rawEmail, password } = req.body;

      if (!rawEmail || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      // Format pseudo-email if domain omitted (e.g. ambe -> ambe@ambe.local)
      const email = rawEmail.includes('@') ? rawEmail.trim() : `${rawEmail.trim()}@ambe.local`;

      // Authenticate user with Supabase Auth
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.session || !data.user) {
        res.status(401).json({ error: error?.message || 'Invalid credentials' });
        return;
      }

      const accessToken = data.session.access_token;
      const supabaseRefreshToken = data.session.refresh_token;

      // Create server-side refresh token record with rotation & family tracking
      let rawRefreshToken: string;
      try {
        const tokenResult = await TokenService.createRefreshToken(data.user.id, supabaseRefreshToken);
        rawRefreshToken = tokenResult.rawToken;
      } catch (dbErr: any) {
        console.error('[auth:login] Failed to store refresh token in DB, falling back to Supabase refresh token:', dbErr.message);
        rawRefreshToken = supabaseRefreshToken;
      }

      // Set 30-Day Long-Lived Refresh Token Cookie (httpOnly, secure, SameSite=Strict)
      res.cookie('refresh_token', rawRefreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: REFRESH_TOKEN_MAX_AGE,
      });

      // Fetch user role from user_roles table with retry
      const { role } = await fetchUserRole(data.user.id, data.user.email);

      res.status(200).json({
        success: true,
        token: accessToken,
        access_token: accessToken,
        user: {
          id: data.user.id,
          email: data.user.email,
          role,
        },
      });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Internal server error during login' });
    }
  }

  /**
   * POST /api/auth/refresh
   * Reads refresh_token cookie, verifies server-side state, rotates refresh token,
   * detects token theft/reuse, and issues a fresh short-lived access token.
   */
  static async refresh(req: Request, res: Response): Promise<void> {
    try {
      const presentedRefreshToken =
        req.cookies?.refresh_token ||
        (typeof req.body?.refresh_token === 'string' ? req.body.refresh_token : undefined);

      if (!presentedRefreshToken) {
        res.status(401).json({ error: 'Refresh token required' });
        return;
      }

      // Validate & rotate token in DB
      let newRawRefreshToken: string | undefined;
      let targetUserId: string | undefined;
      let targetSupabaseRefreshToken: string | null | undefined = presentedRefreshToken;

      try {
        const validation = await TokenService.validateAndRotate(presentedRefreshToken);

        if (!validation.valid) {
          // Clear refresh cookie
          res.clearCookie('refresh_token', COOKIE_OPTIONS);
          res.clearCookie('access_token', COOKIE_OPTIONS);

          if (validation.theftDetected) {
            console.error(`🚨 [auth:theft] Token family revoked for user_id=${validation.userId}`);
            res.status(401).json({
              error: 'Security alert: Token reuse detected. All sessions terminated.',
              theftDetected: true,
            });
            return;
          }

          res.status(401).json({ error: validation.error || 'Session expired, please log in again' });
          return;
        }

        targetUserId = validation.userId;
        targetSupabaseRefreshToken = validation.supabaseRefreshToken || presentedRefreshToken;
        newRawRefreshToken = validation.newRawToken;
      } catch (dbErr: any) {
        console.warn('[auth:refresh] DB validation failed, checking direct Supabase refresh:', dbErr.message);
      }

      // Refresh session via Supabase to obtain new short-lived access token
      const { data: refreshData, error: refreshError } = await supabaseAdmin.auth.refreshSession({
        refresh_token: targetSupabaseRefreshToken || presentedRefreshToken,
      });

      if (refreshError || !refreshData.session || !refreshData.user) {
        console.error('[auth:refresh] Supabase refreshSession failed:', refreshError?.message);
        res.clearCookie('refresh_token', COOKIE_OPTIONS);
        res.clearCookie('access_token', COOKIE_OPTIONS);
        res.status(401).json({ error: 'Session expired or invalid, please log in again' });
        return;
      }

      const newAccessToken = refreshData.session.access_token;
      const latestSupabaseRefreshToken = refreshData.session.refresh_token;

      // Update the DB record with the latest Supabase refresh token if rotated
      if (newRawRefreshToken && latestSupabaseRefreshToken) {
        try {
          await TokenService.updateSupabaseRefreshToken(
            TokenService.hashToken(newRawRefreshToken),
            latestSupabaseRefreshToken
          );
        } catch (err: any) {
          console.error('[auth:refresh] Error updating Supabase refresh token in DB:', err.message);
        }
      }

      const finalRefreshToken = newRawRefreshToken || latestSupabaseRefreshToken;

      // Set new rotated 30-day refresh token cookie
      res.cookie('refresh_token', finalRefreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: REFRESH_TOKEN_MAX_AGE,
      });

      // Fetch fresh role
      const userId = refreshData.user.id || targetUserId;
      const userEmail = refreshData.user.email;
      const { role } = await fetchUserRole(userId!, userEmail);

      res.status(200).json({
        success: true,
        token: newAccessToken,
        access_token: newAccessToken,
        user: {
          id: userId,
          email: userEmail,
          role,
        },
      });
    } catch (err: any) {
      console.error('Refresh token error:', err);
      res.status(500).json({ error: 'Internal server error during token refresh' });
    }
  }

  /**
   * POST /api/auth/logout
   * Revokes the current refresh token in the DB and clears cookies.
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const presentedRefreshToken =
        req.cookies?.refresh_token ||
        (typeof req.body?.refresh_token === 'string' ? req.body.refresh_token : undefined);

      if (presentedRefreshToken) {
        await TokenService.revokeToken(presentedRefreshToken).catch((err) => {
          console.warn('[auth:logout] Token revocation error:', err.message);
        });
      }

      res.clearCookie('access_token', COOKIE_OPTIONS);
      res.clearCookie('refresh_token', COOKIE_OPTIONS);
      res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (err: any) {
      console.error('Logout error:', err);
      res.clearCookie('access_token', COOKIE_OPTIONS);
      res.clearCookie('refresh_token', COOKIE_OPTIONS);
      res.status(200).json({ success: true, message: 'Logged out' });
    }
  }

  /**
   * GET /api/auth/me
   * Returns current authenticated user and role fresh from user_roles.
   */
  static async me(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const token = req.cookies?.access_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');

    res.status(200).json({
      success: true,
      token,
      access_token: token,
      user: req.user,
    });
  }

  /**
   * PATCH /api/auth/role
   * Protected: SuperAdmin only.
   * Updates user role in public.user_roles database table for another user.
   */
  static async updateRole(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      if (req.user.role !== 'superadmin') {
        res.status(403).json({ error: 'Forbidden: Superadmin access required' });
        return;
      }

      const { user_id: targetUserId, role: newRole } = req.body;

      if (!targetUserId) {
        res.status(400).json({ error: 'Target user_id is required' });
        return;
      }

      if (req.user.id === targetUserId) {
        res.status(403).json({ error: 'Forbidden: SuperAdmin cannot edit their own role' });
        return;
      }

      if (!newRole || !['admin', 'superadmin'].includes(newRole)) {
        res.status(400).json({ error: 'Valid role ("admin" | "superadmin") is required' });
        return;
      }

      const { data, error } = await supabaseAdmin
        .from('user_roles')
        .upsert(
          {
            user_id: targetUserId,
            role: newRole,
          },
          { onConflict: 'user_id' }
        )
        .select('*')
        .single();

      if (error) {
        console.error('Failed to update role in user_roles table:', error);
        res.status(500).json({ error: `Database error updating user_roles: ${error.message}` });
        return;
      }

      res.status(200).json({
        success: true,
        message: `Role for user ${targetUserId} successfully updated to ${newRole}`,
        data,
      });
    } catch (err: any) {
      console.error('updateRole error:', err);
      res.status(500).json({ error: 'Internal server error updating role' });
    }
  }
}
