# JWT Secret Rotation Runbook

How to rotate `JWT_SECRET` for the MeperPOS backend API (NestJS, deployed on Railway).

## Background: how tokens are issued in this codebase

- **Access tokens** are JWTs signed with `JWT_SECRET` (HS256 via `@nestjs/jwt`). They are issued by `AuthService.generateTokenPair()` with a **30-minute** expiry. The TTL has a single source of truth: `ACCESS_TOKEN_TTL_SECONDS` in `backend/src/auth/auth.constants.ts`, consumed by both the JWT signer and the access-token cookie `maxAge` (`cookies.helper.ts`), so the two can never drift. A short-lived **pre-auth token** used for organization selection expires after 5 minutes.
- **Refresh tokens are NOT derived from `JWT_SECRET`.** They are random 40-byte hex values (`crypto.randomBytes(40)`), stored **sha256-hashed** in the database (`refresh_token` table) with a 7-day expiry. They are single-use (rotated on every refresh, with a 60-second reuse-grace window so concurrent tabs do not kill each other's sessions) and are bound to the organization selected at issuance. Changing `JWT_SECRET` does not affect their validity.

### What rotation invalidates

Rotating `JWT_SECRET` invalidates **outstanding ACCESS tokens only** (both Bearer headers and access-token cookies): they fail signature verification on their next use and the API answers `401`.

The frontend client (`frontend/src/lib/api.ts`) handles that `401` automatically: its response interceptor starts a **single-flight** silent refresh (concurrent 401s share one in-flight `POST /api/auth/refresh`, sent with the httpOnly `refresh_token` cookie), stores the new access token in memory, and retries the original request exactly once. Users stay logged in; no re-login is required.

Only if the refresh itself fails (refresh token expired or revoked) does the client clear the in-memory token and redirect to `/login`. Plan for a rotation window with no user-visible downtime: requests that hit the cutover deploy simply incur one extra refresh call each.

## Requirement

`JWT_SECRET` must be **at least 32 characters** long. This is enforced at boot by `validateJwtSecretOrExit()` (`backend/src/config/runtime-env.ts`): in production the backend **refuses to start** if the secret is missing or shorter than 32 characters; in non-production environments it only logs a warning.

## Rotation procedure

1. **Generate a new secret** (32+ characters), for example:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
2. **Update Railway**: open the backend service, go to *Variables*, and replace the value of `JWT_SECRET` with the new secret.
3. **Redeploy the backend service** so the new environment variable is picked up. A single deploy is a clean cutover: every request served after the deploy validates against the new secret only. Avoid running old and new instances concurrently.
4. **Verify**:
   - Log in from https://meperpos.vercel.app; login succeeds.
   - Confirm an authenticated request works (e.g., the dashboard loads data).
   - Reuse a pre-rotation access token against the API: it is rejected with `401`, the client performs one automatic silent refresh, and the retried request succeeds (in the browser network tab expect a single `POST /api/auth/refresh` followed by a successful retry, not a redirect to `/login`).
5. **Frontend needs no changes.** It reads the API base URL from `NEXT_PUBLIC_API_URL`; nothing about the frontend depends on `JWT_SECRET`.

## Rollback note

Reverting `JWT_SECRET` to the previous value and redeploying re-validates tokens signed with the old secret, but any access tokens issued between rotation and rollback become invalid instead. Keep the exposure window short and treat rollback as rotating back, with the same re-login impact (handled silently by the frontend refresh flow).

## Cookie sessions interplay

Auth responses also set httpOnly cookies (`access_token`, `refresh_token`, `csrf_token`).

Rotating `JWT_SECRET` kills access-token **cookies** exactly like Bearer tokens; the `refresh_token` cookie keeps working because refresh tokens are DB-stored hashes, so cookie-based clients recover via `POST /api/auth/refresh` without re-login.

## Database credential rotation (Supabase PostgreSQL)

The backend talks to a Supabase Postgres database using two credentials from `backend/.env.example`, both embedding the Postgres password:

- `DATABASE_URL` - session pooler connection, used by Prisma Client at runtime.
- `DIRECT_URL` - direct connection, used by Prisma for migrations.

Procedure:

1. **Reset the database password**: Supabase dashboard, Project Settings, Database, "Reset database password". Supabase generates a new password and drops existing connections.
2. **Update both variables** in Railway (*Variables*): replace the password segment in `DATABASE_URL` and `DIRECT_URL` with the new password.
3. **Redeploy the backend service** so Prisma reconnects with the new credentials.
4. **Verify**: the backend boots (Prisma connects), a read and a write work end to end, and migrations still run (`npx prisma migrate deploy` against the new `DIRECT_URL`).

Notes:

- Rotating the database password does **not** invalidate JWTs or refresh tokens; user sessions survive.
- In-flight requests at the moment of the password reset fail once; retry them or schedule the rotation in a brief maintenance window.

## Cloudinary credential rotation (product images)

Product image uploads are signed with three credentials from `backend/.env.example`:

- `CLOUDINARY_CLOUD_NAME` - the Cloudinary account cloud name (unchanged by rotation).
- `CLOUDINARY_API_KEY` - the API key identifying the credential pair.
- `CLOUDINARY_API_SECRET` - the secret used to sign upload requests.

Procedure:

1. **Create a new key pair**: Cloudinary console, Settings, Access Keys, "Generate New Access Key".
2. **Update Railway** (*Variables*): replace the values of `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` with the new pair. `CLOUDINARY_CLOUD_NAME` stays the same.
3. **Redeploy the backend service** so uploads are signed with the new pair.
4. **Verify**: upload a product image through the inventory UI and confirm the asset appears in the Cloudinary media library.
5. **Revoke the old key pair last**: once the new pair is verified in production, disable the old keys in the Cloudinary console. Revoke after cutover, never before, to avoid an upload outage window.

Notes:

- Rotating Cloudinary credentials does **not** affect auth sessions; previously uploaded images keep working (their URLs are public CDN URLs).
- If the Cloudinary keys leak, revoke immediately and accept the short upload outage instead of waiting for a staged cutover.
