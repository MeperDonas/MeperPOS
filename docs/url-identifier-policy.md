# URL Identifier Policy

Scope: backend authorization for endpoints that address resources through
identifiers in the URL (path or query). Status: enforced as of issue #47.

## 1. Principle

Identifiers in URLs are **not secrets**. UUIDv4 unguessability is a collision
property, not an access-control mechanism, and it is never treated as
authorization. Any authenticated client may observe, guess, replay, or leak
identifiers (logs, browser history, referrer headers, support tickets), so
every `:id` endpoint must enforce, **per request**:

1. **Organization scoping** — the requested resource must belong to the
   caller's organization (`organizationId` from the verified JWT, re-validated
   against the current `OrganizationUser` membership), and
2. **Role authorization** — the caller's role must permit the operation
   (`JwtAuthGuard` + role guards/decorators).

Because scoping in this codebase is a service-layer convention (no Prisma row
level extension), every service method reachable from a controller is expected
to filter by `organizationId` explicitly. A missing organization context is a
hard error, never an implicit "all organizations" query.

## 2. Guarantees added by this change

- **Tasks — cross-org assignment blocked.** Assigning a task now requires the
  assignee to hold an active `OrganizationUser` membership in the caller's
  organization (`TasksService.ensureAssignableUser`). A user id that exists
  globally but belongs to another organization is rejected with
  `NotFoundException`, on both create and update.
- **Users — membership-safe delete.** `DELETE /users/:id` with an organization
  context removes only the `(userId, organizationId)` membership row. The
  global `User` account is hard-deleted exclusively when no memberships remain,
  so removing a shared user from one organization can no longer destroy their
  account everywhere else. Existing guard rails are preserved: self-deletion,
  primary-owner removal, and last-admin removal remain forbidden.
- **Dashboard KPIs and low-stock report require organization context.**
  `ReportsService.getDashboardKPIs` and
  `ProductsService.getLowStockProducts` throw `BadRequestException` when called
  without an `organizationId`. The previous unscoped fallbacks (including the
  `dashboard:all` cache key) are removed; SuperAdmin tokens without an
  `x-organization-id` header no longer resolve cross-organization aggregates.

## 3. Accepted risks pending product decision

The following behaviors intentionally remain unchanged and are flagged for an
owner decision:

- **Password reset by org admin mutates the global account.** An
  organization-scoped admin password reset changes the credential for *every*
  organization the target user belongs to, after org-scoped authorization of
  the request itself.
- **Name/email updates mutate the global record.** The same applies to admin
  edits of user name/email: authorization is org-scoped, but the write hits the
  shared `User` row.

Both affect users shared across multiple organizations. Resolving them likely
requires a product decision (per-org credentials/identity vs. accepting the
shared-account semantics) and is out of scope for this change.

## 4. Known test-coverage follow-ups

- `cash-registers` module: no organization-isolation specs yet.
- `imports` module: no organization-isolation specs yet.

New isolation specs should follow the pattern used in
`tasks.service.spec.ts` / `users.service.spec.ts`: assert rejection when a
resource from another organization is addressed, and correct scoping filters
when it is not.

## 5. Frontend detail routes

Frontend detail pages place identifiers in the URL bar:
`/sales/[id]`, `/purchase-orders/[id]`, `/admin/organizations/[id]`.

This is acceptable. URL visibility exposes the identifier, not the resource:
every page load triggers server-side requests that re-check the JWT, the
organization scope, and the caller's role before returning data. Deep links,
bookmarks, and refreshes stay functional, while a forged or foreign id yields
the same response as a nonexistent one (`404`/`403`) — information about other
organizations never leaves the API layer.
