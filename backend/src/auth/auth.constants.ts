/**
 * Single source of truth for the access-token lifetime (issue #48, design D1).
 *
 * AuthService.generateTokenPair() signs access JWTs with expiresIn
 * ACCESS_TOKEN_TTL_SECONDS and cookies.helper.ts mirrors the same lifetime as
 * the access_token cookie maxAge via ACCESS_TOKEN_TTL_MS. Both consumers MUST
 * keep importing these constants — token-ttl.spec.ts asserts the decoded JWT
 * exp−iat and the cookie maxAge against them, so any drift between the JWT
 * lifetime and the cookie fails CI structurally.
 */
export const ACCESS_TOKEN_TTL_SECONDS = 30 * 60;
export const ACCESS_TOKEN_TTL_MS = ACCESS_TOKEN_TTL_SECONDS * 1000;

/**
 * Concurrent-tab refresh reuse grace (issue #48, amendment 2 / design D3.2).
 *
 * Tabs sharing a session keep per-tab in-memory access tokens that expire
 * simultaneously; the losing tab presents a refresh token another tab's
 * rotation just revoked. While a NEWER active refresh-token row for the same
 * user exists within this window, refresh() rotates from that row instead of
 * failing the tab with 401. Beyond the window, presentation of a revoked
 * token is a genuine reuse signal and stays a 401.
 */
export const REFRESH_REUSE_GRACE_MS = 60_000;
