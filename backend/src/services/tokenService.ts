import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase';
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

    const insertPayload: Partial<RefreshTokenRecord> = {
      user_id: userId,
      token_hash: tokenHash,
      family_id: finalFamilyId,
      supabase_refresh_token: supabaseRefreshToken || null,
      expires_at: expiresAt,
      revoked_at: null,
    };

    const { data, error } = await supabaseAdmin
      .from('refresh_tokens')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      console.error('[TokenService:create] Error saving refresh token:', error.message);
      throw new Error(`Failed to create refresh token record: ${error.message}`);
    }

    return { rawToken, record: data as RefreshTokenRecord };
  }

  /**
   * Validates presented refresh token, detects reuse/theft, and rotates to a new token.
   */
  static async validateAndRotate(presentedRawToken: string): Promise<ValidationResult> {
    if (!presentedRawToken) {
      return { valid: false, error: 'Refresh token missing' };
    }

    const tokenHash = this.hashToken(presentedRawToken);

    // Look up token by hash
    const { data: record, error } = await supabaseAdmin
      .from('refresh_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (error) {
      console.error('[TokenService:lookup] DB query failed:', error.message);
      return { valid: false, error: 'Database lookup error' };
    }

    if (!record) {
      console.warn('[TokenService] Token hash not found in database');
      return { valid: false, error: 'Invalid refresh token' };
    }

    // 🚨 Reuse Detection: If token is already revoked, treat as token theft!
    if (record.revoked_at) {
      console.error(
        `🚨 [TokenService:THEFT_DETECTED] Revoked token reuse attempted! user_id=${record.user_id} family_id=${record.family_id}`
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
    const expiresAtMs = new Date(record.expires_at).getTime();
    if (expiresAtMs <= Date.now()) {
      console.warn(`[TokenService] Token expired at ${record.expires_at}`);
      await supabaseAdmin
        .from('refresh_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', record.id);
      return { valid: false, error: 'Refresh token expired' };
    }

    // ✅ Token is valid: Revoke old token and issue rotated token in the same family
    const nowIso = new Date().toISOString();
    const { error: revokeOldError } = await supabaseAdmin
      .from('refresh_tokens')
      .update({ revoked_at: nowIso })
      .eq('id', record.id);

    if (revokeOldError) {
      console.error('[TokenService:revokeOld] Failed to revoke current token:', revokeOldError.message);
      return { valid: false, error: 'Failed to rotate token' };
    }

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
    await supabaseAdmin
      .from('refresh_tokens')
      .update({ supabase_refresh_token: newSupabaseRefreshToken })
      .eq('token_hash', tokenHash);
  }

  /**
   * Revokes a single refresh token by raw token value (e.g. on user logout).
   */
  static async revokeToken(rawToken: string): Promise<void> {
    if (!rawToken) return;
    const tokenHash = this.hashToken(rawToken);
    const { error } = await supabaseAdmin
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token_hash', tokenHash);

    if (error) {
      console.error('[TokenService:revoke] Error revoking token:', error.message);
    }
  }

  /**
   * Revokes all refresh tokens belonging to a family (used on theft detection).
   */
  static async revokeFamily(familyId: string, userId?: string): Promise<void> {
    const query = supabaseAdmin
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('family_id', familyId)
      .is('revoked_at', null);

    const { error } = await query;
    if (error) {
      console.error(`[TokenService:revokeFamily] Error revoking family ${familyId}:`, error.message);
    }

    if (userId) {
      // Also revoke all tokens for this user for safety
      await this.revokeAllUserTokens(userId);
    }
  }

  /**
   * Revokes all tokens for a given user (e.g. "sign out everywhere").
   */
  static async revokeAllUserTokens(userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('revoked_at', null);

    if (error) {
      console.error(`[TokenService:revokeAll] Error revoking all user tokens for ${userId}:`, error.message);
    }
  }
}
