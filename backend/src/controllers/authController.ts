import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

// 10 years in milliseconds: 10 * 365 * 24 * 60 * 60 * 1000 = 315,360,000,000
const TEN_YEARS_MS = 315360000000;

export class AuthController {
  /**
   * POST /api/auth/login
   * Authenticates user via Supabase, sets 10-year HTTP-only cookie, and returns user role.
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

      // Set 10-Year HTTP-Only Cookie
      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: TEN_YEARS_MS,
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
   * Clears HTTP-only authentication cookie.
   */
  static async logout(req: Request, res: Response): Promise<void> {
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
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

    res.status(200).json({
      success: true,
      user: req.user,
    });
  }
}
