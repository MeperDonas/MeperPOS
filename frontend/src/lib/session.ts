/**
 * In-memory access token store.
 *
 * The access token lives ONLY in this module-scoped variable. It never
 * touches localStorage, sessionStorage, or document.cookie, so XSS cannot
 * exfiltrate persistent credentials. A full page reload intentionally loses
 * the token; AuthContext restores the session silently through the httpOnly
 * refresh_token cookie (POST /auth/refresh).
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}
