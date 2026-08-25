import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthUser } from '../types/express';
import { COOKIE_OPTIONS, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE } from '../config/constants';

/**
 * Middleware: requireAuth
 * Extracts JWT access token from HTTP-only cookie or Authorization header.
 * If access token is invalid/expired, attempts silent refresh using refresh_token cookie.
 * Verifies user with Supabase, fetches role from user_roles, and attaches req.user.
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const accessToken = req.cookies?.access_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const refreshToken = req.cookies?.refresh_token;

    let user: any = null;

    // 1. Validate Access Token if provided
    if (accessToken) {
      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
      if (!authError && authUser) {
        user = authUser;
      }
    }

    // 2. Silent Refresh if Access Token invalid/expired/missing
    if (!user && refreshToken) {
      const { data: refreshData, error: refreshError } = await supabaseAdmin.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (!refreshError && refreshData.session && refreshData.user) {
        user = refreshData.user;

        // Quietly update cookies in background
        res.cookie('access_token', refreshData.session.access_token, {
          ...COOKIE_OPTIONS,
          maxAge: ACCESS_TOKEN_MAX_AGE,
        });
        res.cookie('refresh_token', refreshData.session.refresh_token, {
          ...COOKIE_OPTIONS,
          maxAge: REFRESH_TOKEN_MAX_AGE,
        });
      } else {
        // Refresh token invalid or expired -> Clear cookies & 401
        res.clearCookie('access_token', COOKIE_OPTIONS);
        res.clearCookie('refresh_token', COOKIE_OPTIONS);
        res.status(401).json({ error: 'Unauthorized: Session expired, please log in again' });
        return;
      }
    }

    // 3. Reject if no valid user found
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: Missing or invalid authentication token' });
      return;
    }

    // 4. Query user_roles table for user's assigned role
    let role: 'admin' | 'superadmin' = 'admin';
    let companyId: string | undefined = undefined;

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role, company_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!roleError && roleData) {
      if (roleData.role) {
        role = roleData.role as 'admin' | 'superadmin';
      }
      if (roleData.company_id) {
        companyId = roleData.company_id;
      }
    }

    // 5. Attach user object to request
    req.user = {
      id: user.id,
      email: user.email,
      role,
      company_id: companyId,
      companyId: companyId,
    };

    next();
  } catch (err: any) {
    console.error('requireAuth middleware error:', err);
    res.status(500).json({ error: 'Internal server authentication error' });
  }
};

/**
 * Middleware: requireAdmin
 * Verifies that req.user has role 'admin' or 'superadmin'.
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized: User not authenticated' });
    return;
  }

  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
    return;
  }

  next();
};

/**
 * Middleware: requireSuperAdmin
 * Verifies that req.user is set and has role === 'superadmin'.
 * Returns 403 Forbidden if user is not a superadmin.
 */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized: User not authenticated' });
    return;
  }

  if (req.user.role !== 'superadmin') {
    res.status(403).json({ error: 'Forbidden: Superadmin access required' });
    return;
  }

  next();
};

/**
 * Middleware: checkLockBouncer
 * Checks if target entity (by req.params.id) is locked in database.
 * If is_locked === true AND user role === 'admin', returns 403 Forbidden.
 */
export const checkLockBouncer = (tableName: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id) {
        next();
        return;
      }

      // Superadmins can override locked items
      if (req.user?.role === 'superadmin') {
        next();
        return;
      }

      const { data, error } = await supabaseAdmin
        .from(tableName)
        .select('is_locked')
        .eq('id', id)
        .maybeSingle();

      if (!error && data && data.is_locked === true) {
        res.status(403).json({
          error: 'Forbidden: Record is locked by SuperAdmin',
          is_locked: true,
        });
        return;
      }

      next();
    } catch (err: any) {
      console.error(`checkLockBouncer [${tableName}] error:`, err);
      res.status(500).json({ error: 'Failed to verify lock status' });
    }
  };
};
