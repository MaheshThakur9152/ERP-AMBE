/**
 * Shared business constants for the ERP backend.
 */

/** Default management fee percentage applied to invoices and sites when none is specified. */
export const DEFAULT_MGMT_FEE_PERCENT = 5;

/**
 * Resolves cookie configuration dynamically based on request host or environment.
 * Ensures localhost / 127.0.0.1 development over HTTP can set and send cookies (secure: false, no foreign domain).
 */
export function getCookieOptions(req?: any): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'none' | 'lax';
  path: string;
  domain?: string;
} {
  const host = (req?.hostname || req?.headers?.host || '').toLowerCase();
  const isLocal = !host || host.includes('localhost') || host.includes('127.0.0.1');

  if (isLocal) {
    return {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    };
  }

  const isProd = process.env.NODE_ENV === 'production';
  const defaultCookieDomain = host.includes('ambeservice.com') ? '.ambeservice.com' : undefined;
  const resolvedCookieDomain = process.env.COOKIE_DOMAIN || defaultCookieDomain;

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    ...(resolvedCookieDomain ? { domain: resolvedCookieDomain } : {}),
  };
}

export const COOKIE_OPTIONS = getCookieOptions();

export const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000; // 15 minutes in ms
export const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
