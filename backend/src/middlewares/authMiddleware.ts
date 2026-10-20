import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';
import { AuthUser } from '../types/express';
import { COOKIE_OPTIONS, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE } from '../config/constants';
import { NativeAuthService } from '../services/nativeAuthService';

/**
 * Robust user role lookup.
 * Queries PostgreSQL connection pool directly (public.app_users, public.user_roles).
 * Enforces strict authorization: never defaults unassigned users to 'admin'.
 */
export async function fetchUserRole(
  userId: string,
  email?: string
): Promise<{ role: 'admin' | 'superadmin' | null; rawDbRole: string | null; companyId?: string | null; error?: any }> {
  try {
    // 1. Check public.app_users table
    const userRes = await pool.query(
      'SELECT role, company_id FROM public.app_users WHERE id = $1 LIMIT 1',
      [userId]
    );
    if (userRes.rows && userRes.rows.length > 0) {
      const row = userRes.rows[0];
      const parsedRole = String(row.role || '').trim().toLowerCase() === 'superadmin' ? 'superadmin' : 'admin';
      return { role: parsedRole, rawDbRole: row.role, companyId: row.company_id || null };
    }

    // 2. Check public.user_roles table
    const pgRes = await pool.query(
      'SELECT role, company_id FROM public.user_roles WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    if (pgRes.rows && pgRes.rows.length > 0) {
      const row = pgRes.rows[0];
      const parsedRole = String(row.role || '').trim().toLowerCase() === 'superadmin' ? 'superadmin' : 'admin';
      return { role: parsedRole, rawDbRole: row.role, companyId: row.company_id || null };
    }

    return { role: null, rawDbRole: null, companyId: null };
  } catch (pgErr: any) {
    console.error(`[auth:pg:error] user_id=${userId} database query error: ${pgErr?.message || pgErr}`);
    return { role: null, rawDbRole: null, error: pgErr };
  }
}

/**
 * Middleware: requireAuth
 * Extracts JWT access token from Authorization header, HTTP-only cookie, or query param.
 * Verifies access token using NativeAuthService and attaches user to req.user.
 * If expired/invalid, returns 401.
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

    // Validate Native JWT access token
    const nativeUser = NativeAuthService.verifyAccessToken(accessToken);
    if (!nativeUser) {
      res.status(401).json({ error: 'Unauthorized: Access token expired or invalid' });
      return;
    }

    req.user = nativeUser;
    next();
  } catch (err: any) {
    console.error('requireAuth unexpected exception:', err);
    res.status(500).json({ error: 'Internal server error validating authorization' });
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
 * Canonical allowlist of tables supporting record-level and field-level locking.
 */
export const ALLOWED_LOCK_TABLES = new Set([
  'invoices',
  'payroll_records',
  'attendance_records',
  'attendance_sheets',
  'sites',
  'bonus_disbursements',
  'staff',
  'companies',
]);

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

      if (!ALLOWED_LOCK_TABLES.has(tableName)) {
        res.status(400).json({ error: 'Invalid lock target table' });
        return;
      }

      const pgRes = await pool.query(
        `SELECT is_locked FROM public.${tableName} WHERE id = $1 LIMIT 1`,
        [id]
      );

      if (pgRes.rows && pgRes.rows.length > 0 && pgRes.rows[0].is_locked === true) {
        res.status(403).json({
          error: 'Forbidden: Record is locked by SuperAdmin',
          is_locked: true,
        });
        return;
      }

      next();
    } catch (err: any) {
      console.error(`checkLockBouncer [${tableName}] error:`, err);
      res.status(503).json({ error: 'Service Unavailable: Failed to verify lock status' });
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
 * Helper to check if two values are actually different, ignoring formatting differences
 */
export function areValuesDifferent(currentVal: any, newVal: any): boolean {
  if (currentVal === newVal) return false;
  if (currentVal == null && newVal == null) return false;
  if (currentVal == null || newVal == null) return true;

  // Compare arrays
  if (Array.isArray(currentVal) && Array.isArray(newVal)) {
    if (currentVal.length !== newVal.length) return true;
    return JSON.stringify(currentVal) !== JSON.stringify(newVal);
  }

  // Compare numbers / strings
  if (typeof currentVal === 'number' || typeof newVal === 'number') {
    const n1 = Number(currentVal);
    const n2 = Number(newVal);
    if (!isNaN(n1) && !isNaN(n2)) {
      return n1 !== n2;
    }
  }

  // Compare dates
  if (typeof currentVal === 'string' && typeof newVal === 'string') {
    const d1 = Date.parse(currentVal);
    const d2 = Date.parse(newVal);
    if (!isNaN(d1) && !isNaN(d2) && (currentVal.includes('T') || currentVal.includes('-'))) {
      return new Date(d1).toISOString() !== new Date(d2).toISOString();
    }
    return currentVal.trim() !== newVal.trim();
  }

  return JSON.stringify(currentVal) !== JSON.stringify(newVal);
}

/**
 * Middleware: checkFieldLockBouncer
 * Field-level lock enforcement on update requests.
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

      if (!ALLOWED_LOCK_TABLES.has(tableName)) {
        res.status(400).json({ error: 'Invalid lock target table' });
        return;
      }

      const pgRes = await pool.query(
        `SELECT * FROM public.${tableName} WHERE id = $1 LIMIT 1`,
        [id]
      );

      const currentRow = pgRes.rows?.[0] || null;

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

        const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        let currentVal = currentRow[key];
        let matchedDbKey = key;

        if (currentVal === undefined && currentRow[snakeKey] !== undefined) {
          currentVal = currentRow[snakeKey];
          matchedDbKey = snakeKey;
        }

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
      res.status(503).json({ error: 'Service Unavailable: Failed to verify field lock status' });
    }
  };
};
