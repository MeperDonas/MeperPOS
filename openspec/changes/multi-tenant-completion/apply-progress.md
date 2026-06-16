# Apply Progress: Multi-tenant Completion — PR #1 + PR #2 + PR #3

**Change**: multi-tenant-completion  
**Mode**: Strict TDD  
**Chain strategy**: stacked-to-main  

## Completed Tasks

- [x] 1.1 Implement CASHIER POS access with tests (R1.1–R1.9)
- [x] 2.1 Disable automatic billing transitions with tests (R3.1–R3.5)
- [x] 3.1 Implement multi-org switcher backend with tests (R2.1–R2.5)

## Files Changed

### PR #1 — CASHIER POS access

| File | Action | What Was Done |
|------|--------|---------------|
| `backend/src/sales/sales.controller.ts` | Modified | Added `OrgRole.CASHIER` to `@Roles()` on POST, GET, GET `number/:saleNumber`, GET `:id`, POST `:id/receipt`; kept PUT and force-close ADMIN-only |
| `backend/src/products/products-search.controller.ts` | Modified | Added `OrgRole.CASHIER` to `@Roles()` on `search` and `quick-search` |
| `backend/src/customers/customers.controller.ts` | Modified | Added `OrgRole.CASHIER` to `@Roles()` on GET list, POST, GET by document, GET `:id`; kept PUT/DELETE ADMIN-only |
| `backend/src/common/guards/roles.guard.spec.ts` | Modified | Added CASHIER hierarchy tests |
| `backend/src/sales/sales.controller.spec.ts` | Created | Asserts CASHIER can create/access sales and cannot update/force-close |
| `backend/src/sales/sales.service.spec.ts` | Modified | Added CASHIER own-sales scope tests for list and detail |
| `backend/src/products/products-search.controller.spec.ts` | Created | Asserts CASHIER can access product search endpoints |
| `backend/src/customers/customers.controller.spec.ts` | Created | Asserts CASHIER can read/create customers and cannot update/delete |
| `frontend/src/app/pos/page.behavior.test.tsx` | Modified | Added CASHIER checkout behavior test |

### PR #2 — Manual billing only

| File | Action | What Was Done |
|------|--------|---------------|
| `backend/src/billing/billing.scheduler.ts` | Modified | Replaced automatic transition body with no-op; preserved `@Cron` decorator and added observability log |
| `backend/src/billing/billing.scheduler.spec.ts` | Modified | Replaced transition assertions with no-op assertions: no `organization.findMany`, no `organization.update`, no `organizationUser.findMany`, no token revocation |

### PR #3 — Multi-org switcher backend

| File | Action | What Was Done |
|------|--------|---------------|
| `backend/src/auth/auth.controller.ts` | Modified | Added `GET /auth/organizations` guarded endpoint with `@UseGuards(JwtAuthGuard)` and `@ApiBearerAuth()` |
| `backend/src/auth/auth.service.ts` | Modified | Added `getUserOrganizations()` returning id, name, role, plan, status; updated `selectOrg()` to revoke prior refresh tokens via `revokeUserTokens()` and issue new token pair with incremented `tokenVersion` |
| `backend/src/auth/auth.service.spec.ts` | Modified | Added tests for `getUserOrganizations` (list, exclude foreign, user not found, inactive, empty) and `selectOrg` (non-member rejection, suspended rejection, token revocation) |
| `backend/src/auth/auth.controller.spec.ts` | Modified | Added test for `GET /auth/organizations` delegation to `authService.getUserOrganizations` |
| `openspec/changes/multi-tenant-completion/tasks.md` | Modified | Marked task 3.1 complete |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 guard CASHIER | `common/guards/roles.guard.spec.ts` | Unit | ✅ 10/10 | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Clean |
| 1.1 sales controller access | `sales/sales.controller.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 8 cases | ✅ Clean |
| 1.1 sales service scope | `sales/sales.service.spec.ts` | Unit | ✅ 25/25 | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Clean |
| 1.1 product search access | `products/products-search.controller.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Clean |
| 1.1 customers access | `customers/customers.controller.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 7 cases | ✅ Clean |
| 1.1 POS checkout | `frontend/src/app/pos/page.behavior.test.tsx` | Integration | ✅ 4/6 (2 pre-existing scanner failures) | ✅ Written | ✅ Passed | ➖ Single | ✅ Clean |
| 2.1 scheduler no-op | `billing/billing.scheduler.spec.ts` | Unit | ✅ 7/7 | ✅ Written | ✅ Passed | ✅ 5 cases | ✅ Clean |
| 3.1 list organizations | `auth/auth.service.spec.ts` | Unit | ✅ 11/11 | ✅ Written | ✅ Passed | ✅ 5 cases | ✅ Clean |
| 3.1 selectOrg rejection + revocation | `auth/auth.service.spec.ts` | Unit | ✅ 11/11 | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Clean |
| 3.1 organizations endpoint | `auth/auth.controller.spec.ts` | Unit | ✅ 4/4 | ✅ Written | ✅ Passed | ✅ 1 case | ✅ Clean |

### Test Summary

- **Total tests written (this PR)**: 9 new auth tests
- **Total tests passing** (relevant files): 31/31 auth service, 5/5 auth controller
- **Full backend suite**: 289 tests, 289 passed
- **Full frontend suite**: 50 tests, 48 passed, 2 pre-existing failures (`page.behavior.test.tsx` scanner tests)
- **Layers used**: Unit (backend), Integration (frontend)
- **Approval tests**: `sales.service.spec.ts` CASHIER scope — `buildScopeFilter` already denied-by-default for non-ADMIN roles
- **Pure functions created**: 0

## Deviations from Design

1. PR #1: The design listed only `sales.controller.spec.ts` for new backend controller tests. To satisfy the spec test scenarios for `products-search.controller` and `customers.controller`, I created focused controller spec files for both.
2. PR #1: `SalesService.buildScopeFilter` already implemented deny-by-default scoping for non-ADMIN roles, which covers CASHIER. No code change was required; tests were added as approval/verification coverage.
3. PR #2: The design suggested wrapping the scheduler body in an early return/guard. Implementation uses an early return by replacing the entire method body with a single log statement, which is equivalent and preserves the `@Cron` decorator.
4. PR #3: The design stated `selectOrg` should throw `401 Unauthorized` for suspended org. The existing `selectOrg` already used `UnauthorizedException` for suspended org, while `selectOrganization` (login flow) uses `ForbiddenException`. Implementation preserves this distinction.
5. PR #3: The design noted "Old refresh tokens SHOULD be revoked on switch" via `revokeUserTokens`. `revokeUserTokens` also increments `tokenVersion`; implementation returns the updated user from `revokeUserTokens` so the new access token carries the incremented `tokenVersion` and remains valid.

## Issues Found

- **Pre-existing frontend test failures**: `page.behavior.test.tsx` scanner tests fail because the scan feedback message is not found in the rendered output. These failures exist before PR #3 and are unrelated to auth changes.
- **Pre-existing uncommitted changes**: `backend/src/common/guards/roles.guard.spec.ts`, `backend/src/customers/customers.controller.spec.ts`, `backend/src/tasks/tasks.controller.spec.ts`, and `frontend/src/lib/auth.ts` show modifications in the working tree that are not part of PR #3. They were present before this apply phase.

## Remaining Tasks

- [ ] 4.1 Implement multi-org switcher frontend (PR #4)
- [ ] 5.1 Implement physical receipt print (PR #5)
- [ ] 6.1 Implement SuperAdmin org management backend (PR #6)
- [ ] 7.1 Implement SuperAdmin org management frontend (PR #7)

## Workload / PR Boundary

- **Mode**: chained PR slice
- **Current work unit**: PR #3 — Multi-org switcher backend
- **Boundary**: Backend auth endpoints for organization listing and secure switching, plus auth service/controller tests
- **Estimated review budget impact**: PR #3 diff is 288 changed lines (282 insertions + 6 deletions), within the ~250 estimate and well under the 400-line budget.

## Status

3/7 tasks complete. Ready for verify phase for PR #3.
