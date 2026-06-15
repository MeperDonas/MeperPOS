# Tasks: Multi-tenant Completion

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~2,050 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR #1 → PR #2 → PR #3 → PR #4 → PR #5 → PR #6 → PR #7 |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main (recommended) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | PR | Lines |
|---|---|---|---|
| 1 | CASHIER POS access | PR #1 | ~250 |
| 2 | Manual billing only | PR #2 | ~150 |
| 3 | Multi-org switcher backend | PR #3 | ~250 |
| 4 | Multi-org switcher frontend | PR #4 | ~300 |
| 5 | Physical receipt print | PR #5 | ~350 |
| 6 | SuperAdmin org management backend | PR #6 | ~400 |
| 7 | SuperAdmin org management frontend | PR #7 | ~350 |

## Tasks

| ID | Task | Capability | Acceptance Criteria | PR | Files | Lines | Tests | Deps |
|---|---|---|---|---|---|---|---|---|
| 1.1 | [x] Implement CASHIER POS access with tests | pos-cashier-access | R1.1–R1.9 | PR #1 | `sales.controller.ts`, `sales.service.ts`, `products-search.controller.ts`, `customers.controller.ts`, `roles.guard.spec.ts`, `sales.controller.spec.ts`, `frontend/src/app/pos/page.behavior.test.tsx` | ~250 | guard, sales, search, customers, POS | — |
| 2.1 | Disable automatic billing transitions with tests | manual-billing-only | R3.1–R3.5 | PR #2 | `billing.scheduler.ts`, `billing.scheduler.spec.ts` | ~150 | scheduler, admin | — |
| 3.1 | Implement multi-org switcher backend | multi-org-switcher | R2.1–R2.5 | PR #3 | `auth.service.ts`, `auth.controller.ts`, `auth.service.spec.ts`, `auth.controller.spec.ts` | ~250 | auth service/controller | — |
| 4.1 | Implement multi-org switcher frontend | multi-org-switcher | R2.6–R2.8 | PR #4 | `OrganizationSwitcher.tsx`, `Sidebar.tsx`, `AuthContext.tsx`, `Sidebar.test.tsx` | ~300 | component, AuthContext, Sidebar | 3.1 |
| 5.1 | Implement physical receipt print | physical-receipt-print | R4.1–R4.6 | PR #5 | `ThermalReceipt.tsx`, CSS, `useReceipt.ts`, `app/pos/page.tsx`, `ThermalReceipt.test.tsx`, `page.behavior.test.tsx` | ~350 | ThermalReceipt, useReceipt, POS | — |
| 6.1 | Implement SuperAdmin org management backend | superadmin-org-management | R5.1–R5.8 | PR #6 | `admin/dto/*.dto.ts`, `admin.service.ts`, `admin.controller.ts`, `admin.service.spec.ts`, `admin.controller.spec.ts` | ~400 | admin service/controller | — |
| 7.1 | Implement SuperAdmin org management frontend | superadmin-org-management | R5.1–R5.8 | PR #7 | `useAdmin.ts`, `admin/organizations/[id]/page.tsx`, `page.test.tsx` | ~350 | useAdmin, page | 6.1 |
