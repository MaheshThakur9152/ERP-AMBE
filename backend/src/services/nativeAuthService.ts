import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool';
import { AuthUser } from '../types/express';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_erp_super_secret_jwt_key_2026';
const ACCESS_TOKEN_EXPIRY = '15m';

export interface AppUserRow {
  id: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'superadmin';
  company_id: string | null;
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
   * Generates a native signed JWT access token
   */
  static generateAccessToken(user: AuthUser): string {
    return jwt.sign(
      {
        sub: user.id,
        id: user.id,
        email: user.email,
        role: user.role,
        company_id: user.company_id,
        iss: 'erp-ambe-native-auth',
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
  }

  /**
   * Verifies a native signed JWT access token
   */
  static verifyAccessToken(token: string): AuthUser | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
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
