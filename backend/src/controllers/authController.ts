import { Request, Response } from 'express';
import { getCookieOptions, REFRESH_TOKEN_MAX_AGE } from '../config/constants';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { TokenService } from '../services/tokenService';
import { NativeAuthService } from '../services/nativeAuthService';
import { NotificationService } from '../services/notificationService';
import { pool } from '../db/pool';
import { AuthUser } from '../types/express';

export class AuthController {
  /**
   * POST /api/auth/login
   * Authenticates user via PostgreSQL native auth.
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

      // 1. Native PostgreSQL authentication via public.app_users
      const nativeAuth = await NativeAuthService.validateCredentials(email, password);
      if (!nativeAuth) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const { user } = nativeAuth;
      const accessToken = NativeAuthService.generateAccessToken(user);

      let rawRefreshToken: string;
      try {
        const tokenResult = await TokenService.createRefreshToken(user.id);
        rawRefreshToken = tokenResult.rawToken;
      } catch (dbErr: any) {
        console.error('[auth:login] Failed to store refresh token in DB:', dbErr.message);
        res.status(500).json({ error: 'Failed to issue session credentials' });
        return;
      }

      res.cookie('refresh_token', rawRefreshToken, {
        ...getCookieOptions(req),
        maxAge: REFRESH_TOKEN_MAX_AGE,
      });

      res.status(200).json({
        success: true,
        token: accessToken,
        access_token: accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
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

      console.log(
        `[auth:refresh] Incoming refresh request. Cookie present: ${Boolean(req.cookies?.refresh_token)}, Body present: ${Boolean(req.body?.refresh_token)}`
      );

      if (!presentedRefreshToken) {
        console.warn('[auth:refresh] No refresh token provided in cookies or body');
        res.status(401).json({ error: 'Refresh token required' });
        return;
      }

      // Validate & rotate token in DB
      const validation = await TokenService.validateAndRotate(presentedRefreshToken);

      if (!validation.valid) {
        console.warn(`[auth:refresh] Token validation failed: ${validation.error}`);
        res.clearCookie('refresh_token', getCookieOptions(req));
        res.clearCookie('access_token', getCookieOptions(req));

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

      const targetUserId = validation.userId;
      const newRawRefreshToken = validation.newRawToken;

      if (!targetUserId) {
        res.clearCookie('refresh_token', getCookieOptions(req));
        res.clearCookie('access_token', getCookieOptions(req));
        res.status(401).json({ error: 'Invalid session state, please log in again' });
        return;
      }

      const appUserRes = await pool.query('SELECT * FROM public.app_users WHERE id = $1 LIMIT 1;', [targetUserId]);
      if (!appUserRes.rows || appUserRes.rows.length === 0) {
        res.clearCookie('refresh_token', getCookieOptions(req));
        res.clearCookie('access_token', getCookieOptions(req));
        res.status(401).json({ error: 'User account not found or deactivated' });
        return;
      }

      const row = appUserRes.rows[0];
      const user: AuthUser = {
        id: row.id,
        email: row.email,
        role: (row.role === 'superadmin' ? 'superadmin' : 'admin') as 'superadmin' | 'admin',
        company_id: row.company_id || undefined,
        companyId: row.company_id || undefined,
      };
      const newAccessToken = NativeAuthService.generateAccessToken(user);

      // Only set a replacement refresh cookie if a new token was actually issued (not in concurrent grace window)
      if (newRawRefreshToken) {
        res.cookie('refresh_token', newRawRefreshToken, {
          ...getCookieOptions(req),
          maxAge: REFRESH_TOKEN_MAX_AGE,
        });
      }

      res.status(200).json({
        success: true,
        token: newAccessToken,
        access_token: newAccessToken,
        ...(newRawRefreshToken && { refresh_token: newRawRefreshToken }),
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (err: any) {
      console.error('[auth:refresh] Unexpected error during refresh:', err);
      res.clearCookie('refresh_token', getCookieOptions(req));
      res.clearCookie('access_token', getCookieOptions(req));
      res.status(500).json({ error: 'Internal server error during session refresh' });
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

      res.clearCookie('access_token', getCookieOptions(req));
      res.clearCookie('refresh_token', getCookieOptions(req));
      res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (err: any) {
      console.error('Logout error:', err);
      res.clearCookie('access_token', getCookieOptions(req));
      res.clearCookie('refresh_token', getCookieOptions(req));
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

      await pool.query(
        'UPDATE public.app_users SET role = $1, updated_at = NOW() WHERE id = $2;',
        [newRole, targetUserId]
      );

      const roleRes = await pool.query(
        `INSERT INTO public.user_roles (user_id, role)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role
         RETURNING *;`,
        [targetUserId, newRole]
      );

      res.status(200).json({
        success: true,
        message: `Role for user ${targetUserId} successfully updated to ${newRole}`,
        data: roleRes.rows[0],
      });
    } catch (err: any) {
      console.error('updateRole error:', err);
      res.status(500).json({ error: 'Internal server error updating role' });
    }
  }

  /**
   * POST /api/auth/invite-user
   * SuperAdmin generates an onboarding invitation token for a new user
   */
  static async inviteUser(req: Request, res: Response): Promise<void> {
    try {
      const { email: rawEmail, role = 'admin', company_id } = req.body;
      if (!rawEmail) {
        res.status(400).json({ error: 'Email is required' });
        return;
      }
      const email = rawEmail.trim().toLowerCase();
      const validRole = role === 'superadmin' ? 'superadmin' : 'admin';

      let userRes = await pool.query('SELECT id, email, role FROM public.app_users WHERE LOWER(email) = $1', [email]);
      let userId: string;
      if (userRes.rows.length === 0) {
        const createRes = await pool.query(
          `INSERT INTO public.app_users (email, role, company_id, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, true, NOW(), NOW())
           RETURNING id;`,
          [email, validRole, company_id || null]
        );
        userId = createRes.rows[0].id;
        await pool.query(
          'INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;',
          [userId, validRole]
        );
      } else {
        userId = userRes.rows[0].id;
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await pool.query(
        `INSERT INTO public.user_invitations (user_id, token_hash, type, expires_at)
         VALUES ($1, $2, 'invitation', $3);`,
        [userId, tokenHash, expiresAt]
      );

      res.status(200).json({
        success: true,
        message: `Invitation generated for ${email}`,
        invitationToken: rawToken,
        expiresAt,
      });
    } catch (err: any) {
      console.error('[auth:inviteUser:error]', err.message);
      res.status(500).json({ error: 'Failed to generate invitation', details: err.message });
    }
  }

  /**
   * POST /api/auth/set-initial-password
   * Sets initial password for invited user using their token
   */
  static async setInitialPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        res.status(400).json({ error: 'Token and password are required' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters long' });
        return;
      }

      const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
      const invRes = await pool.query(
        `SELECT ui.*, u.email, u.role, u.company_id
         FROM public.user_invitations ui
         JOIN public.app_users u ON u.id = ui.user_id
         WHERE ui.token_hash = $1
           AND ui.type = 'invitation'
           AND ui.used_at IS NULL
           AND ui.expires_at > NOW()
         LIMIT 1;`,
        [tokenHash]
      );

      if (invRes.rows.length === 0) {
        res.status(400).json({ error: 'Invalid or expired invitation token' });
        return;
      }

      const invitation = invRes.rows[0];
      const passwordHash = await bcrypt.hash(password, 10);

      await pool.query('UPDATE public.app_users SET password_hash = $1, is_active = true, updated_at = NOW() WHERE id = $2;', [
        passwordHash,
        invitation.user_id,
      ]);
      await pool.query('UPDATE public.user_invitations SET used_at = NOW() WHERE id = $1;', [invitation.id]);

      const authUser: AuthUser = {
        id: invitation.user_id,
        email: invitation.email,
        role: invitation.role === 'superadmin' ? 'superadmin' : 'admin',
        company_id: invitation.company_id || undefined,
        companyId: invitation.company_id || undefined,
      };

      const accessToken = NativeAuthService.generateAccessToken(authUser);
      const { rawToken: rawRefreshToken } = await TokenService.createRefreshToken(invitation.user_id);

      res.cookie('refresh_token', rawRefreshToken, {
        ...getCookieOptions(req),
        maxAge: REFRESH_TOKEN_MAX_AGE,
      });

      res.status(200).json({
        success: true,
        accessToken,
        user: authUser,
      });
    } catch (err: any) {
      console.error('[auth:setInitialPassword:error]', err.message);
      res.status(500).json({ error: 'Failed to set password', details: err.message });
    }
  }

  /**
   * POST /api/auth/forgot-password
   * Initiates password reset for an account
   */
  static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email: rawEmail } = req.body;
      if (!rawEmail) {
        res.status(400).json({ error: 'Email is required' });
        return;
      }
      const email = rawEmail.trim().toLowerCase();
      const userRes = await pool.query('SELECT id, email FROM public.app_users WHERE LOWER(email) = $1 LIMIT 1;', [email]);

      if (userRes.rows.length > 0) {
        const userId = userRes.rows[0].id;
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

        // Invalidate any existing unused reset tokens for this user
        await pool.query(
          `UPDATE public.user_invitations SET used_at = NOW() WHERE user_id = $1 AND type = 'reset' AND used_at IS NULL;`,
          [userId]
        );

        await pool.query(
          `INSERT INTO public.user_invitations (user_id, token_hash, type, expires_at)
           VALUES ($1, $2, 'reset', $3);`,
          [userId, tokenHash, expiresAt]
        );

        // Out-of-band delivery via notification service (never exposed in HTTP response or logs)
        await NotificationService.sendPasswordResetNotification(email, rawToken, expiresAt);
      }

      // Consistent generic response for both existing and non-existent accounts
      res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    } catch (err: any) {
      console.error('[auth:forgotPassword:error]', err.message);
      res.status(500).json({ error: 'Failed to process forgot password request' });
    }
  }

  /**
   * POST /api/auth/reset-password
   * Finalizes password reset with token
   */
  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        res.status(400).json({ error: 'Token and password are required' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters long' });
        return;
      }

      const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
      const invRes = await pool.query(
        `SELECT ui.*, u.email, u.role, u.company_id
         FROM public.user_invitations ui
         JOIN public.app_users u ON u.id = ui.user_id
         WHERE ui.token_hash = $1
           AND ui.type = 'reset'
           AND ui.used_at IS NULL
           AND ui.expires_at > NOW()
         LIMIT 1;`,
        [tokenHash]
      );

      if (invRes.rows.length === 0) {
        res.status(400).json({ error: 'Invalid or expired password reset token' });
        return;
      }

      const invitation = invRes.rows[0];
      const passwordHash = await bcrypt.hash(password, 10);

      await pool.query('UPDATE public.app_users SET password_hash = $1, is_active = true, updated_at = NOW() WHERE id = $2;', [
        passwordHash,
        invitation.user_id,
      ]);
      await pool.query('UPDATE public.user_invitations SET used_at = NOW() WHERE id = $1;', [invitation.id]);

      await TokenService.revokeAllUserTokens(invitation.user_id);

      const authUser: AuthUser = {
        id: invitation.user_id,
        email: invitation.email,
        role: invitation.role === 'superadmin' ? 'superadmin' : 'admin',
        company_id: invitation.company_id || undefined,
        companyId: invitation.company_id || undefined,
      };

      const accessToken = NativeAuthService.generateAccessToken(authUser);
      const { rawToken: rawRefreshToken } = await TokenService.createRefreshToken(invitation.user_id);

      res.cookie('refresh_token', rawRefreshToken, {
        ...getCookieOptions(req),
        maxAge: REFRESH_TOKEN_MAX_AGE,
      });

      res.status(200).json({
        success: true,
        accessToken,
        user: authUser,
      });
    } catch (err: any) {
      console.error('[auth:resetPassword:error]', err.message);
      res.status(500).json({ error: 'Failed to reset password', details: err.message });
    }
  }
}
