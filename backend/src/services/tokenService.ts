import crypto from 'crypto';
import { pool } from '../db/pool';
import { REFRESH_TOKEN_MAX_AGE } from '../config/constants';

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  family_id: string;
  supabase_refresh_token: string | null;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface ValidationResult {
  valid: boolean;
  userId?: string;
  supabaseRefreshToken?: string | null;
  newRawToken?: string;
  familyId?: string;
  error?: string;
  theftDetected?: boolean;
}

export class TokenService {
  /**
   * Hashes a raw token string with SHA-256 for secure DB persistence.
   */
  static hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Generates a cryptographically strong opaque random token.
   */
  static generateRawToken(): string {
    return crypto.randomBytes(48).toString('hex');
  }

  /**
   * Creates and stores a new refresh token record in the DB.
   */
  static async createRefreshToken(
    userId: string,
    supabaseRefreshToken?: string,
    familyId?: string
  ): Promise<{ rawToken: string; record: RefreshTokenRecord }> {
    const rawToken = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE).toISOString();
    const finalFamilyId = familyId || crypto.randomUUID();

    const insertSql = `
      INSERT INTO public.refresh_tokens (
        user_id, token_hash, family_id, supabase_refresh_token, expires_at, revoked_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, NULL, NOW())
      RETURNING *;
    `;

    const res = await pool.query(insertSql, [
      userId,
      tokenHash,
      finalFamilyId,
      supabaseRefreshToken || null,
      expiresAt,
    ]);

    return { rawToken, record: res.rows[0] as RefreshTokenRecord };
  }

  /**
   * Validates presented refresh token, detects reuse/theft, and rotates to a new token.
   */
  static async validateAndRotate(presentedRawToken: string): Promise<ValidationResult> {
    if (!presentedRawToken) {
      return { valid: false, error: 'Refresh token missing' };
    }

    const tokenHash = this.hashToken(presentedRawToken);
    const shortHash = tokenHash.substring(0, 12);

    console.log(`[TokenService:validate] Checking token shortHash=${shortHash}...`);

    // Look up token by hash
    const res = await pool.query('SELECT * FROM public.refresh_tokens WHERE token_hash = $1 LIMIT 1', [tokenHash]);
    const record = res.rows?.[0];

    if (!record) {
      console.warn(`[TokenService] Token hash ${shortHash} not found in database`);
      return { valid: false, error: 'Invalid refresh token' };
    }

    const now = Date.now();
    const expiresAtMs = new Date(record.expires_at).getTime();

    // 🚨 Reuse Detection: If token is already revoked, check grace period (30s)
    if (record.revoked_at) {
      const revokedAtMs = new Date(record.revoked_at).getTime();
      const revokedAgoMs = now - revokedAtMs;

      // Grace period (30s) to handle concurrent requests / React StrictMode double mounts
      if (revokedAgoMs <= 30000 && revokedAgoMs >= 0) {
        console.warn(
          `[TokenService:grace] Token ${shortHash} revoked ${revokedAgoMs}ms ago (within 30s grace window). Finding active family token for user ${record.user_id}...`
        );

        const activeRes = await pool.query(
          `SELECT * FROM public.refresh_tokens
           WHERE family_id = $1 AND revoked_at IS NULL
           ORDER BY created_at DESC
           LIMIT 1;`,
          [record.family_id]
        );
        const activeToken = activeRes.rows?.[0];

        if (activeToken && new Date(activeToken.expires_at).getTime() > now) {
          console.log(`[TokenService:grace] Returning existing active family token id=${activeToken.id}`);
          return {
            valid: true,
            userId: activeToken.user_id,
            supabaseRefreshToken: activeToken.supabase_refresh_token,
            familyId: activeToken.family_id,
          };
        }
      }

      console.error(
        `🚨 [TokenService:theft] Reuse of revoked token detected for family ${record.family_id} (user_id=${record.user_id}, revoked_at=${record.revoked_at}, revokedAgo=${revokedAgoMs}ms > 30s)`
      );
      // Invalidate entire token family for this user
      await this.revokeFamily(record.family_id, record.user_id);
      return {
        valid: false,
        theftDetected: true,
        userId: record.user_id,
        error: 'Security alert: Token reuse detected. Session invalidated.',
      };
    }

    // Check expiration
    if (expiresAtMs <= now) {
      console.warn(`[TokenService] Token expired at ${record.expires_at}`);
      await pool.query('UPDATE public.refresh_tokens SET revoked_at = NOW() WHERE id = $1', [record.id]);
      return { valid: false, error: 'Refresh token expired' };
    }

    // ✅ Token is valid: Revoke old token and issue rotated token in the same family
    await pool.query('UPDATE public.refresh_tokens SET revoked_at = NOW() WHERE id = $1', [record.id]);

    // Issue new token in same family
    const { rawToken: newRawToken } = await this.createRefreshToken(
      record.user_id,
      record.supabase_refresh_token,
      record.family_id
    );

    return {
      valid: true,
      userId: record.user_id,
      supabaseRefreshToken: record.supabase_refresh_token,
      newRawToken,
      familyId: record.family_id,
    };
  }

  /**
   * Updates supabase_refresh_token on the latest active token of a family.
   */
  static async updateSupabaseRefreshToken(tokenHash: string, newSupabaseRefreshToken: string): Promise<void> {
    await pool.query(
      'UPDATE public.refresh_tokens SET supabase_refresh_token = $1 WHERE token_hash = $2',
      [newSupabaseRefreshToken, tokenHash]
    );
  }

  /**
   * Revokes a single refresh token by raw token value (e.g. on user logout).
   */
  static async revokeToken(rawToken: string): Promise<void> {
    if (!rawToken) return;
    const tokenHash = this.hashToken(rawToken);
    await pool.query('UPDATE public.refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1', [tokenHash]);
  }

  /**
   * Revokes all refresh tokens belonging to a family (used on theft detection).
   */
  static async revokeFamily(familyId: string, userId?: string): Promise<void> {
    await pool.query(
      'UPDATE public.refresh_tokens SET revoked_at = NOW() WHERE family_id = $1 AND revoked_at IS NULL',
      [familyId]
    );

    if (userId) {
      await this.revokeAllUserTokens(userId);
    }
  }

  /**
   * Revokes all tokens for a given user (e.g. "sign out everywhere").
   */
  static async revokeAllUserTokens(userId: string): Promise<void> {
    await pool.query(
      'UPDATE public.refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );
  }
}
