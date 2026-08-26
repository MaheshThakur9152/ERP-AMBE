import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { COOKIE_OPTIONS, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE } from '../config/constants';

export class AuthController {
  /**
   * POST /api/auth/login
   * Authenticates user via Supabase, sets HTTP-only Access & Refresh token cookies, and returns user role.
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
      const refreshToken = data.session.refresh_token;

      // Set 1-Hour Access Token Cookie
      res.cookie('access_token', accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: ACCESS_TOKEN_MAX_AGE,
      });

      // Set 1-Year Refresh Token Cookie
      res.cookie('refresh_token', refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: REFRESH_TOKEN_MAX_AGE,
      });

      // Fetch user role from user_roles table
      let role: 'admin' | 'superadmin' = 'admin';
      const { data: roleData } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (roleData?.role) {
        role = roleData.role as 'admin' | 'superadmin';
      }

      res.status(200).json({
        success: true,
        token: accessToken,
        access_token: accessToken,
        refresh_token: refreshToken,
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
   * POST /api/auth/logout
   * Clears HTTP-only access_token and refresh_token authentication cookies.
   */
  static async logout(req: Request, res: Response): Promise<void> {
    res.clearCookie('access_token', COOKIE_OPTIONS);
    res.clearCookie('refresh_token', COOKIE_OPTIONS);
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  }

  /**
   * GET /api/auth/me
   * Returns current authenticated user and role.
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
}
