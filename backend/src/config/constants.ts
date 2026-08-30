/**
 * Shared business constants for the ERP backend.
 */

/** Default management fee percentage applied to invoices and sites when none is specified. */
export const DEFAULT_MGMT_FEE_PERCENT = 5;

/** Shared cookie configuration for secure JWT and refresh token storage */
const isProd = process.env.NODE_ENV === 'production';
const defaultCookieDomain = isProd ? '.ambeservice.com' : undefined;
const resolvedCookieDomain = process.env.COOKIE_DOMAIN || defaultCookieDomain;

export const COOKIE_OPTIONS: {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'none' | 'lax';
  path: string;
  domain?: string;
} = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  path: '/',
  ...(resolvedCookieDomain ? { domain: resolvedCookieDomain } : {}),
};

export const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000; // 15 minutes in ms
export const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

