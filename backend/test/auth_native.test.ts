import { pool } from '../src/db/pool';
import { NativeAuthService } from '../src/services/nativeAuthService';
import { TokenService } from '../src/services/tokenService';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

async function runAuthTests() {
  console.log('--- STARTING GATE-11 NATIVE AUTH LIFECYCLE TEST SUITE ---');
  let failures = 0;

  try {
    // TEST 1: Direct validation of existing superadmin or test user
    console.log('TEST 1: Seed test admin user with bcrypt password...');
    const testEmail = `test_admin_${Date.now()}@ambe.local`;
    const testPassword = 'SecurePassword123!';
    const hash = await bcrypt.hash(testPassword, 10);

    const userRes = await pool.query(
      `INSERT INTO public.app_users (email, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, 'admin', true, NOW(), NOW())
       RETURNING id, email, role;`,
      [testEmail, hash]
    );
    const userId = userRes.rows[0].id;

    const validated = await NativeAuthService.validateCredentials(testEmail, testPassword);
    if (validated && validated.user.id === userId && validated.user.role === 'admin') {
      console.log('PASS: NativeAuthService verified credentials against PostgreSQL app_users');
    } else {
      console.error('FAIL: NativeAuthService failed to validate credentials');
      failures++;
    }

    // TEST 2: Native JWT generation & verification (offline, zero egress)
    console.log('TEST 2: Verify JWT generation and offline signature check...');
    const accessToken = NativeAuthService.generateAccessToken(validated!.user);
    const decoded = NativeAuthService.verifyAccessToken(accessToken);
    if (decoded && decoded.id === userId && decoded.role === 'admin') {
      console.log('PASS: JWT issued and verified offline with exact claims');
    } else {
      console.error('FAIL: JWT verification failed');
      failures++;
    }

    // TEST 3: User invitation token creation and verification
    console.log('TEST 3: Test user invitation flow (Section 9.1)...');
    const invitedEmail = `invited_${Date.now()}@ambe.local`;
    const inviteUserRes = await pool.query(
      `INSERT INTO public.app_users (email, role, is_active, created_at, updated_at)
       VALUES ($1, 'admin', true, NOW(), NOW())
       RETURNING id;`,
      [invitedEmail]
    );
    const invitedUserId = inviteUserRes.rows[0].id;

    const rawInviteToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawInviteToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO public.user_invitations (user_id, token_hash, type, expires_at)
       VALUES ($1, $2, 'invitation', $3);`,
      [invitedUserId, tokenHash, expiresAt]
    );

    // Simulate set-initial-password
    const newInitPassword = 'InitialPassword999!';
    const newHash = await bcrypt.hash(newInitPassword, 10);

    // Verify token exists and is valid
    const checkTokenRes = await pool.query(
      `SELECT ui.*, u.email FROM public.user_invitations ui
       JOIN public.app_users u ON u.id = ui.user_id
       WHERE ui.token_hash = $1 AND ui.type = 'invitation' AND ui.used_at IS NULL AND ui.expires_at > NOW();`,
      [tokenHash]
    );

    if (checkTokenRes.rows.length === 1) {
      await pool.query('UPDATE public.app_users SET password_hash = $1 WHERE id = $2;', [newHash, invitedUserId]);
      await pool.query('UPDATE public.user_invitations SET used_at = NOW() WHERE id = $1;', [checkTokenRes.rows[0].id]);

      // Verify user can now log in with the new password
      const loginCheck = await NativeAuthService.validateCredentials(invitedEmail, newInitPassword);
      if (loginCheck && loginCheck.user.id === invitedUserId) {
        console.log('PASS: Invited user set initial password and authenticated successfully');
      } else {
        console.error('FAIL: Invited user login failed after setting password');
        failures++;
      }
    } else {
      console.error('FAIL: User invitation token not found or expired');
      failures++;
    }

    // TEST 4: Password reset flow
    console.log('TEST 4: Test password reset flow (Section 9.1)...');
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    const resetExpiresAt = new Date(Date.now() + 3600 * 1000);

    await pool.query(
      `INSERT INTO public.user_invitations (user_id, token_hash, type, expires_at)
       VALUES ($1, $2, 'reset', $3);`,
      [invitedUserId, resetTokenHash, resetExpiresAt]
    );

    const resetNewPassword = 'ResetPasswordBrandNew!';
    const resetNewHash = await bcrypt.hash(resetNewPassword, 10);

    await pool.query('UPDATE public.app_users SET password_hash = $1 WHERE id = $2;', [resetNewHash, invitedUserId]);
    await pool.query('UPDATE public.user_invitations SET used_at = NOW() WHERE token_hash = $1;', [resetTokenHash]);

    const postResetLogin = await NativeAuthService.validateCredentials(invitedEmail, resetNewPassword);
    if (postResetLogin && postResetLogin.user.id === invitedUserId) {
      console.log('PASS: Password reset verified and authenticated successfully');
    } else {
      console.error('FAIL: Authentication failed after password reset');
      failures++;
    }

    // Cleanup test users
    await pool.query('DELETE FROM public.app_users WHERE id = ANY($1::uuid[]);', [[userId, invitedUserId]]);
    console.log('PASS: Test data cleaned up');

    console.log(`\n--- GATE-11 TEST RUN COMPLETED. FAILURES: ${failures} ---`);
    process.exit(failures > 0 ? 1 : 0);
  } catch (err: any) {
    console.error('FATAL TEST ERROR:', err);
    process.exit(1);
  }
}

runAuthTests();
