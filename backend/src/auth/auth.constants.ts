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
