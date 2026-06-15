# Apply Progress: Multi-tenant Completion — PR #1

**Change**: multi-tenant-completion  
**Mode**: Strict TDD  
**PR**: #1 — CASHIER POS access  
**Chain strategy**: stacked-to-main  

## Completed Tasks

- [x] 1.1 Implement CASHIER POS access with tests (R1.1–R1.9)

## Files Changed

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

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 guard CASHIER | `common/guards/roles.guard.spec.ts` | Unit | ✅ 10/10 | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Clean |
| 1.1 sales controller access | `sales/sales.controller.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 8 cases | ✅ Clean |
| 1.1 sales service scope | `sales/sales.service.spec.ts` | Unit | ✅ 25/25 | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Clean |
| 1.1 product search access | `products/products-search.controller.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 3 cases | ✅ Clean |
| 1.1 customers access | `customers/customers.controller.spec.ts` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ 7 cases | ✅ Clean |
| 1.1 POS checkout | `frontend/src/app/pos/page.behavior.test.tsx` | Integration | ✅ 4/6 (2 pre-existing scanner failures) | ✅ Written | ✅ Passed | ➖ Single | ✅ Clean |

### Test Summary
- **Total tests written**: 31
- **Total tests passing** (relevant files): 49 backend / 4 new frontend
- **Full backend suite**: 280 tests, 279 passed, 1 pre-existing failure (`tasks/tasks.controller.spec.ts`)
- **Full frontend suite**: 50 tests, 48 passed, 2 pre-existing failures (`page.behavior.test.tsx` scanner tests)
- **Layers used**: Unit (backend), Integration (frontend)
- **Approval tests** (pre-existing behavior): `sales.service.spec.ts` CASHIER scope — `buildScopeFilter` already denied-by-default for non-ADMIN roles
- **Pure functions created**: 0

## Deviations from Design

1. The design listed only `sales.controller.spec.ts` for new backend controller tests. To satisfy the spec test scenarios for `products-search.controller` and `customers.controller`, I created focused controller spec files for both.
2. `SalesService.buildScopeFilter` already implemented deny-by-default scoping for non-ADMIN roles, which covers CASHIER. No code change was required; tests were added as approval/verification coverage.

## Issues Found

- **Pre-existing frontend test failures**: `page.behavior.test.tsx` scanner tests fail because the scan feedback message is not found in the rendered output. These failures exist before this PR and are unrelated to CASHIER access.
- **Pre-existing backend test failure**: `tasks/tasks.controller.spec.ts` `denies access to roles outside the configured task boundary` fails because the uncommitted role-hierarchy change in `roles.guard.ts` now allows OWNER to inherit ADMIN access. This is outside PR #1 scope.
- **Pre-existing uncommitted changes**: `backend/src/auth/jwt.strategy.ts`, `backend/src/common/guards/roles.guard.ts`, `frontend/next.config.ts`, `frontend/src/components/layout/DashboardLayout.tsx`, `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/contexts/AuthContext.tsx`, and untracked `frontend/src/lib/auth.ts` were present in the working tree before this apply phase. They are **not** part of PR #1.
- **Line count exceeded estimate**: PR #1 diff is ~448 changed lines (436 insertions + 12 deletions) versus the tasks estimate of ~250 lines, primarily due to additional controller spec files and service tests required by the spec scenarios.

## Remaining Tasks

- [ ] 2.1 Disable automatic billing transitions with tests (PR #2)
- [ ] 3.1 Implement multi-org switcher backend (PR #3)
- [ ] 4.1 Implement multi-org switcher frontend (PR #4)
- [ ] 5.1 Implement physical receipt print (PR #5)
- [ ] 6.1 Implement SuperAdmin org management backend (PR #6)
- [ ] 7.1 Implement SuperAdmin org management frontend (PR #7)

## Workload / PR Boundary

- **Mode**: chained PR slice
- **Current work unit**: PR #1 — CASHIER POS access
- **Boundary**: Backend role decorators + service scope tests + frontend POS behavior test
- **Estimated review budget impact**: Actual diff is ~448 lines, slightly above the 400-line budget. The increase comes from required controller spec coverage for products-search and customers.

## Status

1/7 tasks complete. Ready for verify phase for PR #1.
