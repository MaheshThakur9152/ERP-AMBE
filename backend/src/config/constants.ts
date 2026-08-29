/**
 * Shared business constants for the ERP backend.
 */

/** Default management fee percentage applied to invoices and sites when none is specified. */
export const DEFAULT_MGMT_FEE_PERCENT = 5;

/** Shared cookie configuration for secure JWT and refresh token storage */
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  path: '/',
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
};

export const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000; // 15 minutes in ms
export const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

