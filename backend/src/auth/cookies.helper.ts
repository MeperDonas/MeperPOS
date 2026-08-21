import { randomBytes } from 'crypto';
import { Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const CSRF_TOKEN_COOKIE = 'csrf_token';

/**
 * TTLs mirror AuthService.generateTokenPair(): access JWTs are signed with
 * expiresIn '8h' and refresh-token rows expire 7 days after issuance.
 */
const ACCESS_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthCookieOptions {
  httpOnly: boolean;
  sameSite: 'lax' | 'none';
  secure: boolean;
  path: string;
  maxAge?: number;
}

export interface CookieDescriptor {
  name: string;
  value?: string;
  options: AuthCookieOptions;
}

/**
 * Cross-site deployments (Vercel frontend -> Railway API) require
 * SameSite=None; Secure, while localhost development works best with Lax.
 */
function resolveSitePolicy(): { sameSite: 'lax' | 'none'; secure: boolean } {
  return process.env.NODE_ENV === 'production'
    ? { sameSite: 'none', secure: true }
    : { sameSite: 'lax', secure: false };
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Builds Set-Cookie descriptors for a fresh session:
 * - access_token: httpOnly, site-wide (path /)
 * - refresh_token: httpOnly, scoped to /api/auth so it is only sent to auth routes
 * - csrf_token: readable by JS (double-submit CSRF pattern), session-scoped
 *
 * The existing csrf_token cookie is reused when present so open tabs keep a
 * stable header value across token rotations.
 */
export function buildAuthCookies(
  tokens: { accessToken: string; refreshToken: string },
  existingCsrfToken?: string | null,
): CookieDescriptor[] {
  const { sameSite, secure } = resolveSitePolicy();
  const csrfToken =
    existingCsrfToken && existingCsrfToken.length > 0
      ? existingCsrfToken
      : generateCsrfToken();

  return [
    {
      name: ACCESS_TOKEN_COOKIE,
      value: tokens.accessToken,
      options: {
        httpOnly: true,
        sameSite,
        secure,
        path: '/',
        maxAge: ACCESS_TOKEN_TTL_MS,
      },
    },
    {
      name: REFRESH_TOKEN_COOKIE,
      value: tokens.refreshToken,
      options: {
        httpOnly: true,
        sameSite,
        secure,
        path: '/api/auth',
        maxAge: REFRESH_TTL_MS,
      },
    },
    {
      name: CSRF_TOKEN_COOKIE,
      value: csrfToken,
      options: { httpOnly: false, sameSite, secure, path: '/' },
    },
  ];
}

/**
 * Descriptors for expiring every auth cookie on logout. Express's
 * clearCookie() adds the past Expires header; the refresh cookie must repeat
 * its scoped path or the browser will not remove it.
 */
export function buildClearedAuthCookies(): CookieDescriptor[] {
  const { sameSite, secure } = resolveSitePolicy();

  return [
    {
      name: ACCESS_TOKEN_COOKIE,
      options: { httpOnly: true, sameSite, secure, path: '/' },
    },
    {
      name: REFRESH_TOKEN_COOKIE,
      options: { httpOnly: true, sameSite, secure, path: '/api/auth' },
    },
    {
      name: CSRF_TOKEN_COOKIE,
      options: { httpOnly: false, sameSite, secure, path: '/' },
    },
  ];
}

/** Applies the given descriptors to the passthrough response. */
function writeCookies(res: Response, descriptors: CookieDescriptor[]): void {
  for (const descriptor of descriptors) {
    res.cookie(descriptor.name, descriptor.value ?? '', descriptor.options);
  }
}

/** Sets all session cookies on a passthrough response. */
export function applyAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  existingCsrfToken?: string | null,
): void {
  writeCookies(res, buildAuthCookies(tokens, existingCsrfToken));
}

/** Expires all three auth cookies on a passthrough response. */
export function clearAuthCookies(res: Response): void {
  for (const descriptor of buildClearedAuthCookies()) {
    res.clearCookie(descriptor.name, descriptor.options);
  }
}
