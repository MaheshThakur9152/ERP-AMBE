import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthUser } from '../types/express';

/**
 * Middleware: requireAuth
 * Extracts JWT token from HTTP-only cookie or Authorization header,
 * verifies token with Supabase, fetches user's role from user_roles table,
 * and attaches req.user to the Request object.
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // 1. Read token from HTTP-only cookie or Bearer auth header
    const token = req.cookies?.access_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
      return;
    }

    // 2. Verify token using Supabase admin client
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
      return;
    }

    // 3. Query user_roles table for user's assigned role
    let role: 'admin' | 'superadmin' = 'admin';

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!roleError && roleData?.role) {
      role = roleData.role as 'admin' | 'superadmin';
    }

    // 4. Attach user object to request
    req.user = {
      id: user.id,
      email: user.email,
      role,
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
      next();
    }
  };
};
