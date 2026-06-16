# Design: Multi-tenant Completion

## Technical Approach

Close the remaining multi-tenant gaps using the existing NestJS role guard and JWT organization scoping, plus incremental Next.js UI changes. Each capability is isolated so it can be reviewed and merged independently.

## Architecture Decisions

| Capability | Decision | Alternatives Rejected | Rationale |
|---|---|---|---|
| POS CASHIER access | Add `CASHIER` to `@Roles()` on POS endpoints only; keep mutations ADMIN-only | Role hierarchy auto-grant everything to CASHIER | Limits blast radius; existing `SalesService.buildScopeFilter` already denies-by-default for non-ADMIN |
| Multi-org switcher | Reuse existing `POST /auth/select-org`; add `GET /auth/organizations` | Custom `/auth/switch` endpoint | Reuses token generation and suspension checks; avoids duplicating JWT logic |
| Manual billing only | Wrap scheduler body in early return / guard instead of deleting the cron | Remove `@Cron` entirely | Keeps scheduler registration observable and preserves rollback path |
| Physical receipt print | Browser `window.print()` with dedicated 80 mm print styles; PDF endpoint untouched | ESC/POS native driver | No extra dependencies; works with any thermal printer that Windows/macOS sees |
| SuperAdmin org mgmt | Extend `AdminController`/`AdminService`; rely on Prisma `onDelete: Cascade` | Soft delete + manual cleanup | Cascade delete is already modeled; explicit confirmation reduces accident risk |
| Role mapping | Keep backend `OWNER`→`ADMIN` JWT mapping; frontend `AppRole` stays as-is | Add MEMBER to frontend roles | Existing mapping already preserves OWNER access; MEMBER is not used in UI routes |

## Data Flow

### Multi-org switch

```
Sidebar OrgSwitcher ──POST /auth/select-org──► AuthService.selectOrg
                         │                         │
                         ▼                         ▼
              GET /auth/organizations       generateTokenPair
                         │                         │
                         ▼                         ▼
              invalidateQueries()           localStorage token/user
                         │                         │
                         └────────► redirect /dashboard ◄────────┘
```

### POS sale with CASHIER

```
POS cart ──POST /sales──► JwtAuthGuard ──RolesGuard(CASHIER)──► SalesController
                                                             │
                                                             ▼
                                                    SalesService.create
                                                             │
                                         ┌───────────────────┼───────────────────┐
                                         ▼                   ▼                   ▼
                                    organizationId       userId=user.userId    stock decrement
```

### SuperAdmin org management

```
Admin UI ──PATCH/POST/DELETE /admin/organizations/...──► JwtAuthGuard ──RolesGuard(SUPER_ADMIN)
                                                                          │
                                                                          ▼
                                                                   AdminService
                                                                          │
                                                          ┌─────────────┼─────────────┐
                                                          ▼             ▼             ▼
                                                    update details   manage members   delete (cascade)
```

## File Changes

### Capability: pos-cashier-access

| File | Action | Description |
|---|---|---|
| `backend/src/sales/sales.controller.ts` | Modify | Add `OrgRole.CASHIER` to `@Roles()` on POST, GET, GET `:id`, GET `number/:saleNumber`, POST `:id/receipt`; keep PUT/force-close ADMIN-only |
| `backend/src/sales/sales.service.ts` | Modify | Update `buildScopeFilter` to treat `CASHIER` as non-ADMIN (own sales only) |
| `backend/src/products/products-search.controller.ts` | Modify | Add `OrgRole.CASHIER` to `@Roles()` on `search` and `quick-search` |
| `backend/src/customers/customers.controller.ts` | Modify | Add `OrgRole.CASHIER` to `@Roles()` on GET list, POST, GET by document, GET `:id`; keep PUT/DELETE ADMIN-only |
| `backend/src/common/guards/roles.guard.spec.ts` | Modify | Add CASHIER hierarchy tests |
| `backend/src/sales/sales.controller.spec.ts` | Modify (or create) | Assert CASHIER can create and cannot update |
| `frontend/src/app/pos/page.behavior.test.tsx` | Modify | Add CASHIER checkout test |

### Capability: multi-org-switcher

| File | Action | Description |
|---|---|---|
| `backend/src/auth/auth.controller.ts` | Modify | Add `GET /auth/organizations` guarded endpoint |
| `backend/src/auth/auth.service.ts` | Modify | Add `getUserOrganizations()`; update `selectOrg()` to revoke prior refresh tokens |
| `frontend/src/contexts/AuthContext.tsx` | Modify | Expose `switchOrganization`; invalidate queries and redirect on success |
| `frontend/src/components/layout/Sidebar.tsx` | Modify | Add `<OrganizationSwitcher />` below user card; hide when <=1 org |
| `frontend/src/components/auth/OrganizationSwitcher.tsx` | Create | Dropdown listing orgs with role/plan; loading state; error toast |
| `frontend/src/hooks/useAuth.ts` | Create (optional) | Thin wrapper if AuthContext grows too large |
| `backend/src/auth/auth.service.spec.ts` | Modify | Tests for list orgs, switch rejection, suspended org |
| `frontend/src/components/layout/Sidebar.test.tsx` | Create | Switcher visibility for multi/single org users |

### Capability: manual-billing-only

| File | Action | Description |
|---|---|---|
| `backend/src/billing/billing.scheduler.ts` | Modify | Replace transition body with no-op (keep `@Cron` and logging) |
| `backend/src/billing/billing.scheduler.spec.ts` | Modify | Assert no `organization.update`, no token revocation |
| `backend/src/admin/admin.controller.ts` | No change | Existing `PATCH .../status` remains manual path |

### Capability: physical-receipt-print

| File | Action | Description |
|---|---|---|
| `frontend/src/components/pos/ThermalReceipt.tsx` | Create | 80 mm receipt view with org name, sale number, items, totals, payments, change, footer |
| `frontend/src/components/pos/ThermalReceipt.test.tsx` | Create | Render items and totals |
| `frontend/src/hooks/useReceipt.ts` | Modify | Keep `printReceipt` for PDF; add `printThermalReceipt(sale)` helper opening print window |
| `frontend/src/app/pos/page.tsx` | Modify | Add "Print Receipt" button to success modal alongside PDF; wire `window.print()` |
| `frontend/src/app/globals.css` or `thermal-receipt.module.css` | Modify/Create | `@media print { width: 80mm; height: auto; }` and hide chrome |

### Capability: superadmin-org-management

| File | Action | Description |
|---|---|---|
| `backend/src/admin/admin.controller.ts` | Modify | Add PATCH `/admin/organizations/:id`, POST/DELETE members, PATCH role, DELETE org |
| `backend/src/admin/admin.service.ts` | Modify | Add update org, invite/add member, change role, remove member, delete org |
| `backend/src/admin/dto/update-organization.dto.ts` | Create | DTO for editable org fields |
| `backend/src/admin/dto/add-organization-member.dto.ts` | Create | DTO for email, name, role, optional password |
| `backend/src/admin/dto/delete-organization.dto.ts` | Create | `{ confirmOrganizationName: string }` |
| `backend/src/admin/admin.service.spec.ts` | Modify | Tests for update, slug conflict, invite new/existing user, role change, primary owner guard, delete confirmation, cascade |
| `frontend/src/hooks/useAdmin.ts` | Modify | Add mutations: `useUpdateOrganization`, `useAddOrganizationMember`, `useUpdateMemberRole`, `useRemoveOrganizationMember`, `useDeleteOrganization` |
| `frontend/src/app/admin/organizations/[id]/page.tsx` | Modify | Editable org form, member table with role dropdown, add-member modal, delete confirmation modal |
| `frontend/src/app/admin/organizations/[id]/page.test.tsx` | Create | Render member management UI |

## Interfaces / Contracts

```typescript
// GET /auth/organizations response
interface UserOrganizationsResponse {
  organizations: Array<{
    id: string;
    name: string;
    role: OrgRole;
    plan: PlanType;
    status: OrgStatus;
  }>;
}

// POST /auth/select-org response — same as login
interface SelectOrgResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}
```

## Error Handling Strategy

| Layer | Strategy |
|---|---|
| Backend role denial | `RolesGuard` throws `403 Forbidden` with required roles |
| Invalid org switch | `AuthService.selectOrg` throws `401 Unauthorized` for non-membership or suspended org |
| Validation errors | Existing `ValidationPipe` returns `400 Bad Request` |
| Slug conflict | `AdminService` throws `409 Conflict` |
| Primary owner removal | `AdminService` throws `400 Bad Request` |
| Org delete mismatch | `AdminService` throws `400 Bad Request` when confirmation name does not match |
| Frontend | Use `getApiErrorMessage(error, fallback)` + toast; keep current session on switch failure |

## Caching / React Query Strategy

- Organization-scoped keys to invalidate on switch: `['products']`, `['sales']`, `['customers']`, `['dashboard']`, `['settings']`, `['users']`, `['tasks']`, `['categories']`, `['suppliers']`, `['purchase-orders']`.
- Implementation: in `AuthContext.switchOrganization`, after storing new tokens call `queryClient.invalidateQueries({ predicate: (q) => !q.queryKey.includes('admin') })` or explicitly invalidate the list above.
- Admin mutations invalidate `['admin', 'organizations']` and `['admin', 'organization', id]`.
- PDF/print paths do not cache receipt blobs.

## Security / Tenant Isolation Design

- Every non-SuperAdmin request carries `organizationId` in JWT; all Prisma reads/writes include `organizationId`.
- SuperAdmin endpoints are guarded by `RolesGuard` with `@Roles('SUPER_ADMIN')`.
- Organization switch rejects non-membership and `SUSPENDED` status.
- Old refresh tokens are revoked on org switch via `revokeUserTokens`.
- `CASHIER` cannot update sales, customers, or force-close; `SalesService` enforces own-sale scope for non-ADMIN.
- Organization delete relies on Prisma `onDelete: Cascade`; no application-level cleanup that could bypass constraints.

## Testing Strategy

| Slice | Backend | Frontend |
|---|---|---|
| pos-cashier-access | `roles.guard.spec.ts`, `sales.controller.spec.ts`, `sales.service.int.spec.ts` CASHIER scenarios | `page.behavior.test.tsx` checkout with CASHIER |
| multi-org-switcher | `auth.controller.spec.ts`, `auth.service.spec.ts` list/reject/suspended | `Sidebar.test.tsx` switcher visibility, `AuthContext` cache invalidation |
| manual-billing-only | `billing.scheduler.spec.ts` no-op assertions | N/A |
| physical-receipt-print | N/A | `ThermalReceipt.test.tsx`, `page.behavior.test.tsx` print button + `window.print()` |
| superadmin-org-management | `admin.controller.spec.ts`, `admin.service.spec.ts` CRUD + guards | `admin/organizations/[id]/page.test.tsx` |

Run commands:

```bash
cd backend && npm run test
cd frontend && npm run test
```

## Migration / Rollout

- No database migrations required; existing schema already supports all operations.
- Billing rollback: remove the no-op guard in `billing.scheduler.ts`.
- Role rollback: revert `@Roles()` decorator changes.
- Org deletion is destructive; restore from backup if needed.

## PR Boundaries (400-line budget)

Forecast total change is well above 400 lines, so use **stacked PRs to `main`** in this order:

1. **PR #1 — CASHIER POS access** (~250 lines): backend role decorators + service scope + tests.
2. **PR #2 — Manual billing only** (~150 lines): scheduler no-op + tests.
3. **PR #3 — Multi-org switcher backend** (~250 lines): `GET /auth/organizations` + token revocation + tests.
4. **PR #4 — Multi-org switcher frontend** (~300 lines): sidebar switcher + AuthContext changes + tests.
5. **PR #5 — Physical receipt print** (~350 lines): `ThermalReceipt` component, styles, POS wiring, tests.
6. **PR #6 — SuperAdmin org management backend** (~400 lines): admin endpoints, DTOs, service logic, tests.
7. **PR #7 — SuperAdmin org management frontend** (~350 lines): admin detail page extensions, hooks, tests.

Each PR is an autonomous work unit with its own tests and can be rolled back independently.

## Open Questions

- [ ] Should org switch invalidate **all** queries or only organization-scoped keys? Proposal: invalidate all non-admin keys to avoid stale data.
- [ ] Should adding a member send a real email, or is returning a temporary password sufficient for MVP? Proposal: temporary password only (matches existing `createOrganization` admin flow).
