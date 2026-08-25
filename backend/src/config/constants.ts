/**
 * Shared business constants for the ERP backend.
 */

/** Default management fee percentage applied to invoices and sites when none is specified. */
export const DEFAULT_MGMT_FEE_PERCENT = 5;

/** Shared cookie configuration for secure JWT storage */
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
};

export const ACCESS_TOKEN_MAX_AGE = 3600000; // 1 hour in ms
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
