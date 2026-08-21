# JWT Secret Rotation Runbook

How to rotate `JWT_SECRET` for the MeperPOS backend API (NestJS, deployed on Railway).

## Background: how tokens are issued in this codebase

- **Access tokens** are JWTs signed with `JWT_SECRET` (HS256 via `@nestjs/jwt`). They are
  issued by `AuthService.generateTokenPair()` with an **8-hour** expiry (the explicit
  `expiresIn: '8h'` in `generateTokenPair` overrides the `15m` default registered in
  `auth.module.ts`). A short-lived **pre-auth token** used for organization selection
  expires after 5 minutes.
- **Refresh tokens are NOT derived from `JWT_SECRET`.** They are random 40-byte hex
  values (`crypto.randomBytes(40)`), stored **sha256-hashed** in the database
  (`refresh_token` table) with a 7-day expiry. Changing `JWT_SECRET` does not affect
  their validity.

### What rotation invalidates

Rotating `JWT_SECRET` invalidates **outstanding ACCESS tokens only**: they fail
signature verification on their next use and the API answers `401`.

The frontend client (`frontend/src/lib/api.ts`) reacts to any `401` by clearing stored
credentials and redirecting to `/login`, so users will be asked to log back in with a
fresh token pair signed by the new secret. The server-side refresh endpoint
(`POST /api/auth/refresh`) still works with existing refresh tokens, but the current
frontend does not invoke it automatically on `401` — plan for a one-time re-login per
active session during the rotation window.

## Requirement

`JWT_SECRET` must be **at least 32 characters** long. This is enforced at boot by
`validateJwtSecretOrExit()` (`backend/src/config/runtime-env.ts`): in production the
backend **refuses to start** if the secret is missing or shorter than 32 characters;
in non-production environments it only logs a warning.

## Rotation procedure

1. **Generate a new secret** (32+ characters), for example:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

2. **Update Railway**: open the backend service → *Variables* → replace the value of
   `JWT_SECRET` with the new secret.

3. **Redeploy the backend service** so the new environment variable is picked up.
   A single deploy is a clean cutover: every request served after the deploy validates
   against the new secret only. Avoid running old and new instances concurrently.

4. **Verify**:
   - Log in from https://meperpos.vercel.app → login succeeds.
   - Confirm an authenticated request works (e.g., the dashboard loads data).
   - Reuse a pre-rotation access token against the API → it is rejected with `401`.

5. **Frontend needs no changes.** It reads the API base URL from
   `NEXT_PUBLIC_API_URL`; nothing about the frontend depends on `JWT_SECRET`.

## Rollback note

Reverting `JWT_SECRET` to the previous value and redeploying re-validates tokens signed
with the old secret, but any access tokens issued between rotation and rollback become
invalid instead. Keep the exposure window short and treat rollback as rotating back,
with the same user re-login impact.
