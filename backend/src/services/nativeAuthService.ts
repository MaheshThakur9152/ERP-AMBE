import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool';
import { AuthUser } from '../types/express';

const ACCESS_TOKEN_EXPIRY = '15m';
export const JWT_ISSUER = 'erp-ambe-native-auth';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is missing, empty, or too short (minimum 32 characters required). Application cannot safely sign or verify tokens.'
    );
  }
  return secret.trim();
}

export interface AppUserRow {
  id: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'superadmin';
  company_id: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export class NativeAuthService {
  /**
   * Validates user credentials against PostgreSQL public.app_users
   */
  static async validateCredentials(
    rawEmail: string,
    password: string
  ): Promise<{ user: AuthUser; rawUser: AppUserRow } | null> {
    const email = rawEmail.trim().toLowerCase();
    try {
      const res = await pool.query(
        'SELECT * FROM public.app_users WHERE LOWER(email) = $1 LIMIT 1',
        [email]
      );

      if (!res.rows || res.rows.length === 0) {
        return null;
      }

      const row: AppUserRow = res.rows[0];
      if (row.is_active === false) {
        return null;
      }

      const isMatch = await bcrypt.compare(password, row.password_hash);
      if (!isMatch) {
        return null;
      }

      const user: AuthUser = {
        id: row.id,
        email: row.email,
        role: row.role === 'superadmin' ? 'superadmin' : 'admin',
        company_id: row.company_id || undefined,
        companyId: row.company_id || undefined,
      };

      return { user, rawUser: row };
    } catch (err) {
      console.error('[NativeAuthService:validateCredentials] Database error:', err);
      return null;
    }
  }

  /**
   * Generates a native signed JWT access token using explicit HS256 algorithm and required issuer
   */
  static generateAccessToken(user: AuthUser): string {
    const secret = getJwtSecret();
    return jwt.sign(
      {
        sub: user.id,
        id: user.id,
        email: user.email,
        role: user.role,
        company_id: user.company_id,
        iss: JWT_ISSUER,
      },
      secret,
      {
        algorithm: 'HS256',
        expiresIn: ACCESS_TOKEN_EXPIRY,
      }
    );
  }

  /**
   * Verifies a native signed JWT access token enforcing HS256 algorithm and expected issuer
   */
  static verifyAccessToken(token: string): AuthUser | null {
    try {
      const secret = getJwtSecret();
      const decoded = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
      }) as any;
      if (!decoded || !decoded.id) {
        return null;
      }
      return {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role === 'superadmin' ? 'superadmin' : 'admin',
        company_id: decoded.company_id,
        companyId: decoded.company_id,
      };
    } catch {
      return null;
    }
  }
}
