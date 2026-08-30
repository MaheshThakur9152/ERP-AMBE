import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthUser } from '../types/express';
import { COOKIE_OPTIONS, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE } from '../config/constants';

/**
 * Robust user role lookup with retries and loud logging.
 * Prevents cold-start DB connection drops from silently downgrading privileges.
 */
export async function fetchUserRole(
  userId: string,
  email?: string
): Promise<{ role: 'admin' | 'superadmin'; rawDbRole: string | null; error?: any }> {
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        lastError = error;
        console.error(
          `[auth:db:error] attempt=${attempt}/${maxRetries} user_id=${userId} email=${email || 'unknown'} error=${error.message}`
        );
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
          continue;
        }
        break;
      }

      if (data && data.role) {
        const parsedRole = data.role.trim().toLowerCase() === 'superadmin' ? 'superadmin' : 'admin';
        console.warn(
          `[auth:db:success] user_id=${userId} email=${email || 'unknown'} rawDbRole=${data.role} parsedRole=${parsedRole}`
        );
        return { role: parsedRole, rawDbRole: data.role };
      }

      // Query succeeded cleanly with zero rows
      console.warn(
        `[auth:db:empty] user_id=${userId} email=${email || 'unknown'} no row in user_roles -> default admin`
      );
      return { role: 'admin', rawDbRole: null };
    } catch (err: any) {
      lastError = err;
      console.error(
        `[auth:db:exception] attempt=${attempt}/${maxRetries} user_id=${userId} email=${email || 'unknown'} exception=${err?.message || err}`
      );
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
      }
    }
  }

  // All retries failed with an active error
  return { role: 'admin', rawDbRole: null, error: lastError };
}

/**
 * Middleware: requireAuth
 * Extracts JWT access token from Authorization header, HTTP-only cookie, or query param.
 * Verifies access token with Supabase and attaches user & fresh role to req.user.
 * If expired/invalid, returns 401 so the frontend client can perform token refresh via /api/auth/refresh.
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const accessToken =
      req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
      req.cookies?.access_token ||
      (typeof req.query.token === 'string' ? req.query.token : undefined);

    if (!accessToken) {
      res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
      return;
    }

    // Validate Access Token with Supabase
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !authUser) {
      console.warn(`[auth:jwt] accessToken validation failed: ${authError?.message || 'Invalid token'}`);
      res.status(401).json({ error: 'Unauthorized: Access token expired or invalid' });
      return;
    }

    // Query user_roles table for user's assigned role with retry
    const { role, rawDbRole, error: roleFetchError } = await fetchUserRole(authUser.id, authUser.email);

    if (roleFetchError) {
      console.error(
        `[auth:db:fatal] Failed all retries querying user_roles for user_id=${authUser.id} email=${authUser.email}: ${roleFetchError.message || roleFetchError}`
      );
      res.status(503).json({ error: 'Service Unavailable: Role authorization lookup failed, please retry' });
      return;
    }

    // Attach user object to request
    req.user = {
      id: authUser.id,
      email: authUser.email,
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
    console.warn(`[authz:admin] path=${req.originalUrl} method=${req.method} user=null decision=DENY reason=unauthenticated`);
    res.status(401).json({ error: 'Unauthorized: User not authenticated' });
    return;
  }

  const allowed = req.user.role === 'admin' || req.user.role === 'superadmin';
  console.warn(`[authz:admin] path=${req.originalUrl} method=${req.method} user=${req.user.id} email=${req.user.email} role=${req.user.role} requiredRole=admin|superadmin decision=${allowed ? 'ALLOW' : 'DENY'}`);

  if (!allowed) {
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
    console.warn(`[authz:superadmin] path=${req.originalUrl} method=${req.method} user=null decision=DENY reason=unauthenticated`);
    res.status(401).json({ error: 'Unauthorized: User not authenticated' });
    return;
  }

  const allowed = req.user.role === 'superadmin';
  console.warn(`[authz:superadmin] path=${req.originalUrl} method=${req.method} user=${req.user.id} email=${req.user.email} dbRole=${req.user.role} requiredRole=superadmin decision=${allowed ? 'ALLOW' : 'DENY'}`);

  if (!allowed) {
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

/**
 * Helper to check if a value is considered already filled / non-empty
 */
export function isValueFilled(val: any): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string' && val.trim() === '') return false;
  if (Array.isArray(val) && val.length === 0) return false;
  return true;
}

/**
 * Helper to check if two values are meaningfully different
 */
export function areValuesDifferent(oldVal: any, newVal: any): boolean {
  if (newVal === undefined) return false; // Key not provided in patch

  // Normalize null / undefined / empty string
  const normOld = oldVal === null || oldVal === undefined || oldVal === '' ? null : oldVal;
  const normNew = newVal === null || newVal === undefined || newVal === '' ? null : newVal;
  if (normOld === null && normNew === null) return false;
  if (normOld === null || normNew === null) return true;

  // Numbers / numeric strings comparison
  if (
    (typeof normOld === 'number' || typeof normOld === 'string') &&
    (typeof normNew === 'number' || typeof normNew === 'string') &&
    !isNaN(Number(normOld)) &&
    !isNaN(Number(normNew))
  ) {
    if (Number(normOld) === Number(normNew)) return false;
  }

  // Booleans
  if (typeof normOld === 'boolean' || typeof normNew === 'boolean') {
    return Boolean(normOld) !== Boolean(normNew);
  }

  // Strings (trimmed)
  if (typeof normOld === 'string' && typeof normNew === 'string') {
    return normOld.trim() !== normNew.trim();
  }

  // Objects / Arrays
  if (typeof normOld === 'object' && typeof normNew === 'object') {
    return JSON.stringify(normOld) !== JSON.stringify(normNew);
  }

  return normOld !== normNew;
}

/**
 * Middleware: checkFieldLockBouncer
 * Partial field-level lock enforcement for entities like staff and sites.
 *
 * Rules when is_locked === true AND role === 'admin':
 * 1. Existing filled fields (non-null, non-empty) are frozen -> returns 403 if modified.
 * 2. Empty/missing fields (null, "", undefined) can be filled in by admin.
 * 3. SuperAdmin bypasses all locks.
 */
export const checkFieldLockBouncer = (tableName: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id) {
        next();
        return;
      }

      // SuperAdmin override
      if (req.user?.role === 'superadmin') {
        next();
        return;
      }

      const { data: currentRow, error } = await supabaseAdmin
        .from(tableName)
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error(`checkFieldLockBouncer [${tableName}] db error:`, error);
        res.status(500).json({ error: 'Failed to verify lock status' });
        return;
      }

      if (!currentRow) {
        next();
        return;
      }

      // If record is not locked, allow update
      if (!currentRow.is_locked) {
        next();
        return;
      }

      const incoming = req.body || {};
      const ignoreKeys = new Set([
        'id',
        'created_at',
        'createdAt',
        'updated_at',
        'updatedAt',
        'is_locked',
        'isLocked',
      ]);

      // Guard: Admin cannot toggle is_locked
      if (incoming.is_locked !== undefined && incoming.is_locked !== currentRow.is_locked) {
        res.status(403).json({
          error: 'Forbidden: Only SuperAdmin can change lock status',
          field: 'is_locked',
          is_locked: true,
        });
        return;
      }

      for (const [key, newVal] of Object.entries(incoming)) {
        if (ignoreKeys.has(key)) continue;

        // Determine current value in database (supporting camelCase / snake_case)
        const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        let currentVal = currentRow[key];
        let matchedDbKey = key;

        if (currentVal === undefined && currentRow[snakeKey] !== undefined) {
          currentVal = currentRow[snakeKey];
          matchedDbKey = snakeKey;
        }

        // If field exists in DB and already has data
        const hadExistingValue = isValueFilled(currentVal);

        if (hadExistingValue) {
          const isDifferent = areValuesDifferent(currentVal, newVal);
          if (isDifferent) {
            console.warn(
              `[checkFieldLockBouncer] 403 Blocked edit on locked ${tableName} id=${id}. Field "${key}" (DB: ${matchedDbKey}) had value "${JSON.stringify(currentVal)}" but incoming was "${JSON.stringify(newVal)}"`
            );
            res.status(403).json({
              error: `Field "${key}" is locked and cannot be modified`,
              field: key,
              is_locked: true,
            });
            return;
          }
        }
      }

      next();
    } catch (err: any) {
      console.error(`checkFieldLockBouncer [${tableName}] exception:`, err);
      res.status(500).json({ error: 'Failed to verify field lock status' });
    }
  };
};
