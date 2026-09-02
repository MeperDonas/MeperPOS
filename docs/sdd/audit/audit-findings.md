# Audit Findings

> **Scope:** technical audit of the repository state documented in `docs/sdd/project-baseline.md`, with targeted source verification.  
> **Date:** 2026-09-02.  
> **Evidence convention:** **FACT** is directly confirmed by repository evidence; **INFERENCE** is a supported consequence not reproduced at runtime; **UNKNOWN** could not be established.  
> This artifact identifies problems and investigation targets. It does not define implementation designs or start SDD changes.

## Executive Summary

The audit consolidated 49 specialist candidates into **20 root-cause findings** after removing duplicates, cleanup-only observations, and unsupported claims.

| Severity / status | Count |
|---|---:|
| CRITICAL | 0 |
| HIGH | 11 |
| MEDIUM | 7 |
| LOW | 2 |
| REQUIRES INVESTIGATION | 2 of the 20 |
| CONFIRMED | 18 of the 20 |

No finding was classified CRITICAL. Several paths can produce security, integrity, or deployment failures, but repository evidence does not prove current tenant compromise, deployed database drift, data loss in production, or a universally failing production system.

Primary root causes:

1. Authentication/session state is global-user scoped where session-family and organization scope are required.
2. Multi-tenant and financial/inventory invariants rely excessively on application conventions rather than atomic/database-enforced boundaries.
3. Critical workflows are not proven at the deployed composition boundary; some tests are globally quarantined.
4. Runtime contracts have multiple authorities: API types, controllers, tests, documentation, CI, and platform configuration can disagree.
5. Asynchronous imports and reporting/cache behavior assume one long-lived process and bounded data volumes.

## Critical Findings

None confirmed.

## High Findings

## AUDIT-FINDING-001

### Title

Refresh-token grace can cross session and organization boundaries

### Category

Security

### Severity

HIGH

### Confidence

HIGH

### Status

CONFIRMED

### Evidence

- `backend/src/auth/auth.service.ts:274-321` — refresh-token lookup and revoked-token grace flow.
- `backend/src/auth/auth.service.ts:289-304` — replacement selects any recent active token for the same `userId`, without organization or lineage.
- `backend/src/auth/auth.service.ts:329-391` — selected row determines organization context and is rotated.
- `backend/prisma/schema.prisma:89-104` — rows have `organizationId`, but no session-family/replacement-chain identifier.
- `backend/src/auth/auth.constants.ts:15-24` — 60-second reuse grace.

### Facts

- **FACT:** A revoked token can be recovered through an unrelated recent active row for the same user.
- **FACT:** Recovery does not require equal `organizationId` or direct replacement lineage.
- **FACT:** The replacement row's organization becomes the newly issued access-token scope.

### Problem

Possession of a revoked refresh token may be exchanged through a different browser session or organization during the grace window.

### Root Cause

Refresh-token rotation is modeled as user-wide recent-token recovery rather than a session-family, organization-bound chain.

### Impact

A stolen token for organization A can potentially yield credentials scoped to organization B and revoke a legitimate unrelated session.

### Scope

All multi-session users; cross-organization risk for users with multiple memberships.

### Related Findings

AUDIT-FINDING-002, AUDIT-FINDING-003.

### Recommendation

Bind rotation/reuse recovery to an explicit session family, direct replacement lineage, and organization scope.

---

## AUDIT-FINDING-002

### Title

Password changes do not invalidate existing sessions

### Category

Security

### Severity

HIGH

### Confidence

HIGH

### Status

CONFIRMED

### Evidence

- `backend/src/auth/auth.controller.ts:157-165` — change-password route.
- `backend/src/auth/auth.service.ts:528-555` — updates only the password hash.
- `backend/src/auth/auth.service.ts:415-426` — existing centralized token revocation is separate and unused by password change.
- `backend/src/auth/jwt.strategy.ts:40-42` — access-token invalidation depends on `tokenVersion`.

### Facts

- **FACT:** Password change neither increments `tokenVersion` nor revokes refresh-token rows.
- **FACT:** The baseline claim that change-password rotates `tokenVersion` is false.

### Problem

Changing a password does not terminate sessions that may already be compromised.

### Root Cause

Credential mutation and session-revocation responsibilities are disconnected.

### Impact

Stolen access tokens remain usable for their lifetime; stolen refresh tokens can continue extending access until expiry or separate revocation.

### Scope

All accounts, including SuperAdmin.

### Related Findings

AUDIT-FINDING-001.

### Recommendation

Treat successful password replacement as a session-security event and invalidate existing sessions.

---

## AUDIT-FINDING-003

### Title

Organization suspension enforcement has incompatible global and tenant scopes

### Category

Security

### Severity

HIGH

### Confidence

HIGH

### Status

CONFIRMED

### Evidence

- `backend/src/app.module.ts:73-90` — `OrganizationStatusGuard` runs globally before route authentication.
- `backend/src/common/guards/organization-status.guard.ts:10-39` — allows requests when `request.user.orgStatus` is absent.
- `backend/src/auth/jwt.strategy.ts:77-91` — authenticated org status is attached later by route-level JWT auth.
- `backend/src/admin/admin.service.ts:177-193` — suspension invokes organization token revocation.
- `backend/src/auth/auth.service.ts:478-496` — revokes all active refresh tokens and increments global `User.tokenVersion` for every member, without filtering the suspended organization.

### Facts

- **FACT:** The status guard normally executes before authenticated organization context exists, so it does not enforce the advertised suspended-write boundary.
- **FACT:** The compensating suspension path invalidates every session of each member, including sessions for other organizations.

### Problem

The request-level boundary is ineffective in its declared placement, while the compensating revocation crosses tenant boundaries.

### Root Cause

Organization authorization is placed before authentication and suspension is implemented through global-user session state.

### Impact

Residual valid tokens could retain write access to a suspended organization, while ordinary suspension disrupts unrelated tenant sessions for multi-organization users.

### Scope

All tenant-scoped routes and multi-organization users.

### Related Findings

AUDIT-FINDING-001, AUDIT-FINDING-005.

### Recommendation

Evaluate suspension after verified organization context exists and scope session invalidation to the affected organization.

---

## AUDIT-FINDING-004

### Title

Declared audit events are silently skipped

### Category

Security

### Severity

HIGH

### Confidence

HIGH

### Status

CONFIRMED

### Evidence

- `backend/src/common/interfaces/request-user.interface.ts:3-10` — canonical actor field is `userId`.
- `backend/src/auth/jwt.strategy.ts:56-63,83-91` — request user exposes `userId`.
- `backend/src/common/interceptors/audit.interceptor.ts:142-153` — interceptor expects `user.sub` and skips when absent.
- `backend/src/common/interceptors/audit.interceptor.ts:159-176` — durable rows also use `user.sub`.
- Examples of declared events: `backend/src/products/products.controller.ts:138-177`, `backend/src/users/users.controller.ts:43-109`.

### Facts

- **FACT:** Normal authenticated requests carry `userId`, not `sub`.
- **FACT:** `AuditInterceptor` deterministically follows its skip branch for those requests.
- **FACT:** Login audit is also skipped because no authenticated request user exists yet.

### Problem

Operations advertised through `@AuditAction` do not create durable `AuditLog` records.

### Root Cause

Authentication and auditing use incompatible actor contracts, with no integration test proving emitted events.

### Impact

Security investigations, accountability, anomaly detection, and incident evidence are incomplete for product and user-management mutations.

### Scope

Every route relying on `AuditInterceptor`; service-authored audit rows are separate.

### Related Findings

AUDIT-FINDING-014.

### Recommendation

Use the canonical request-user contract and prove that each declared security event yields a durable tenant/actor-scoped record.

---

## AUDIT-FINDING-005

### Title

Import jobs are non-durable and retain stale cross-organization authority

### Category

Backend

### Severity

HIGH

### Confidence

HIGH

### Status

CONFIRMED

### Evidence

- `backend/src/imports/imports.service.ts:71-99,115-131` — process-local job state and 30-minute TTL.
- `backend/src/imports/imports.service.ts:216-220` — unawaited in-process execution.
- `backend/src/imports/multi-sheet-import.service.ts:80-111,625-645` — second process-local implementation.
- `backend/src/imports/imports.controller.ts:139-178` — status/retry pass `jobId` and `userId`, not current organization.
- `backend/src/imports/imports.service.ts:984-997` and `multi-sheet-import.service.ts:625-635` — ownership checks ignore active organization.

### Facts

- **FACT:** Restart, redeploy, or another instance loses job status, row errors, and retry data while already-written domain rows remain.
- **FACT:** A user can switch organizations and still inspect/retry an earlier job because continuation is user-scoped only.
- **FACT:** Retry writes using the job's stored organization without fresh membership/status verification.

### Problem

The API exposes an asynchronous job contract that is neither durable nor continuously authorized against tenant scope.

### Root Cause

Import lifecycle and authorization were modeled as singleton process memory, duplicated across two engines.

### Impact

Ambiguous partial imports, lost recovery data, incompatibility with scaling/redeployment, cross-context error disclosure, and writes to an organization that is no longer active in the user's session.

### Scope

Product and multi-sheet imports, status polling, row retry, operations support.

### Related Findings

AUDIT-FINDING-003, AUDIT-FINDING-006, AUDIT-FINDING-007.

### Recommendation

Establish one durable import lifecycle with tenant-scoped continuation authorization, idempotent row processing, and explicit recovery semantics.

---

## AUDIT-FINDING-006

### Title

Inventory and billing invariants span non-atomic writes

### Category

Database

### Severity

HIGH

### Confidence

HIGH

### Status

CONFIRMED

### Evidence

- `backend/src/products/products.service.ts:180-203` — product creation precedes initial inventory movement.
- `backend/src/products/products.service.ts:369-407` — stock update precedes adjustment movement.
- `backend/src/cash-registers/cash-registers.service.ts:35-48,114-124` — current default is cleared before replacement creation/update.
- `backend/src/billing/payment-records.service.ts:23-45` — payment record and organization billing transition are separate writes.

### Facts

- **FACT:** Failure of a later write does not roll back an earlier write in these paths.
- **FACT:** Each path represents one logical business action through multiple commits.

### Problem

Persisted state can violate its ledger, default-register, or billing-transition invariant after partial failure.

### Root Cause

Transaction policy is established ad hoc per service rather than at invariant-bearing use-case boundaries.

### Impact

Stock can diverge from movement history; no register may remain default; billing payments can persist without the associated organization transition.

### Scope

Products, inventory movements, cash registers, and billing records.

### Related Findings

AUDIT-FINDING-005, AUDIT-FINDING-007.

### Recommendation

Define atomic units of work for every invariant-bearing multi-write operation.

---

## AUDIT-FINDING-007

### Title

Expense payments and sale cancellation have concurrency races

### Category

Database

### Severity

HIGH

### Confidence

HIGH

### Status

CONFIRMED

### Evidence

- `backend/src/expenses/expenses.service.ts:392-416` — existing payments are read and validated before the transaction.
- `backend/src/expenses/expenses.service.ts:418-455` — insert/status update use a later default-isolation transaction.
- `backend/prisma/schema.prisma:454-489` — no cumulative-payment constraint.
- `backend/src/sales/sales.service.ts:454-472` — cancellation eligibility is read before transaction.
- `backend/src/sales/sales.service.ts:473-515` — final update is not conditional on expected status; no explicit serializable isolation or sale-row lock.

### Facts

- **FACT:** Two concurrent expense-payment requests can validate against the same old sum.
- **INFERENCE:** Both can commit and exceed `Expense.total`, leaving status derived from stale sums.
- **FACT:** Product stock and movement restoration are coupled to sale cancellation.
- **INFERENCE:** Concurrent cancellation schedules can create duplicate returns/restock because transition ownership is unguarded.

### Problem

Read-before-transaction checks do not protect financial totals or one-time state transitions under contention.

### Root Cause

Concurrency-sensitive validation occurs outside the mutation's locking/isolation boundary.

### Impact

Overpaid expenses, inconsistent payment status, duplicated inventory restoration, and duplicate return movements.

### Scope

Expense payment and sale cancellation workflows.

### Related Findings

AUDIT-FINDING-006, AUDIT-FINDING-009.

### Recommendation

Make validation and mutation one concurrency-controlled operation and guard transitions against their expected persisted state.

---

## AUDIT-FINDING-008

### Title

Cross-table tenant ownership is not enforced by the database

### Category

Database

### Severity

HIGH

### Confidence

HIGH

### Status

CONFIRMED

### Evidence

- `backend/prisma/schema.prisma:164-176` — Product's organization and category relations are independent.
- `backend/prisma/schema.prisma:260-290` — Payment/SaleItem organization and parent relations are independent.
- `backend/prisma/schema.prisma:359-405` — purchase-order supplier/product tenant ownership is independent.
- `backend/prisma/schema.prisma:454-491` — expense category/supplier/order/payment tenant ownership is independent.
- `backend/prisma/migrations/20260423020000_multi_tenant_fase0/migration.sql:324-373` — single-column FKs reproduce this model.

### Facts

- **FACT:** Required `organizationId` columns and service filters exist.
- **FACT:** Current FKs do not prove that referenced parent rows belong to the same organization as the child row.

### Problem

Cross-tenant relational consistency is an application convention rather than a database invariant.

### Root Cause

Tenant discriminator columns were added beside globally unique entity IDs without tenant-aware relationship constraints.

### Impact

Maintenance scripts, imports, raw SQL, future services, or application defects can persist cross-tenant relationships without violating current FKs.

### Scope

Inventory, sales, payments, purchasing, expenses, and task/audit relations.

### Related Findings

AUDIT-FINDING-005, AUDIT-FINDING-009.

### Recommendation

Define database-enforced tenant ownership invariants, prioritizing financial and inventory relationships.

---

## AUDIT-FINDING-009

### Title

Financial and inventory row invariants are not database-enforced

### Category

Database

### Severity

HIGH

### Confidence

HIGH

### Status

CONFIRMED

### Evidence

- `backend/prisma/schema.prisma:157-170` — product price/tax/stock/promotion fields.
- `backend/prisma/schema.prisma:186-200` — inventory movement fields.
- `backend/prisma/schema.prisma:231-283` — sale/payment/item amounts and quantities.
- `backend/prisma/schema.prisma:388-401` — ordered/received quantities and PO amounts.
- `backend/prisma/schema.prisma:454-489` — expense/payment amounts.
- Targeted search of `backend/prisma/migrations/**/*.sql` found no database `CHECK` constraints.

### Facts

- **FACT:** Basic positivity, range, and equality rules are implemented mainly in services/DTOs.
- **FACT:** The database permits row-local states such as negative values, received quantity over ordered quantity, or a movement whose arithmetic does not balance.

### Problem

Critical domain invariants can be bypassed by direct Prisma usage, scripts, imports, or new write paths.

### Root Cause

The database schema models types and relations, but not the row-level domain constraints relied upon by financial/inventory logic.

### Impact

Persisted financial and stock data can become internally inconsistent even while satisfying the schema.

### Scope

Products, inventory, sales/payments, purchase orders, and expenses.

### Related Findings

AUDIT-FINDING-006, AUDIT-FINDING-007, AUDIT-FINDING-008.

### Recommendation

Identify authoritative invariants and enforce appropriate row-local bounds/equalities at the database layer, with transactional enforcement for aggregate rules.

---

## AUDIT-FINDING-010

### Title

Production migration and provisioning procedures contradict executable scripts

### Category

DevOps

### Severity

HIGH

### Confidence

HIGH

### Status

CONFIRMED

### Evidence

- `docs/runbooks/runbook-despliegue-produccion.md:25-28,330-389` — claims backend prebuild applies migrations.
- `backend/package.json:9-15` — prebuild only runs `prisma generate`; start does not migrate.
- `backend/package.json:28-29` — migrations require a separate script.
- `.github/workflows/ci.yml:53-63` — CI explicitly migrates because build does not.
- `docs/runbooks/runbook-despliegue-produccion.md:69-83` — production setup runs `npm run seed` and checks a removed `Settings` table.
- `backend/package.json:22` and `backend/prisma/seed.ts:403-439` — that command loads development mode, refuses non-development execution, and creates demo organizations/predictable bootstrap credentials if allowed.

### Facts

- **FACT:** The runbook's automatic-migration claim is false for versioned scripts.
- **FACT:** The documented production seed command conflicts with its hard environment guard and represents demo seeding.
- **UNKNOWN:** Railway may contain an unversioned pre-deploy migration command, but repository evidence cannot verify it.

### Problem

Operators cannot follow the documented production contract safely or verify who owns schema migration and initial provisioning.

### Root Cause

Deployment behavior lives partly in stale documentation and partly in an unversioned platform control plane.

### Impact

Code may deploy against an older schema; initial provisioning can fail or introduce demo data and predictable credentials.

### Scope

Railway deployment, Supabase schema, production bootstrap, rollback/readiness operations.

### Related Findings

AUDIT-FINDING-011, AUDIT-FINDING-019.

### Recommendation

Establish one verifiable owner for production migrations and a production-safe provisioning contract; align scripts, platform evidence, and runbook.

---

## AUDIT-FINDING-011

### Title

Committed migration history does not fully represent the current schema

### Category

Database

### Severity

HIGH

### Confidence

HIGH

### Status

REQUIRES INVESTIGATION

### Evidence

- `backend/prisma/schema.prisma:424-438` — `PaymentRecord.method` is `PaymentMethod` enum.
- `backend/prisma/migrations/20260501195935_add_payment_record_and_org_index/migration.sql:5-15` — creates `method TEXT NOT NULL`.
- No later committed migration converts this column.
- `backend/prisma/migrations/20260423020000_multi_tenant_fase0/migration.sql:82-126` — adds required organization columns directly to existing tables without an in-script backfill/default.
- `.github/workflows/ci.yml:57-63` — clean migration replay is intended, but runtime execution was outside this audit.

### Facts

- **FACT:** A database constructed strictly from migrations has a TEXT column where current Prisma metadata expects an enum.
- **FACT:** The multi-tenant migration assumes affected tables are empty or externally prepared when adding NOT NULL columns.
- **UNKNOWN:** Clean-chain deployability and live dev/prod drift were not tested; no deployed-drift claim is made.

### Problem

The canonical migration chain and schema are not self-consistent and encode undocumented upgrade assumptions.

### Root Cause

Schema evolution was reconciled in current Prisma declarations without fully reconciling historical DDL and supported upgrade paths.

### Impact

Fresh or legacy database upgrades can differ from generated Prisma expectations or fail on populated pre-multi-tenant databases.

### Scope

Database bootstrap, upgrades, CI migration evidence, PaymentRecord/billing.

### Related Findings

AUDIT-FINDING-010, AUDIT-FINDING-020.

### Recommendation

Reconcile canonical migration history with the current schema and explicitly define supported upgrade assumptions.

---

## Medium Findings

## AUDIT-FINDING-012

### Title

POS cashier search is tested against an unregistered controller

### Category

Backend

### Severity

MEDIUM

### Confidence

HIGH

### Status

CONFIRMED

### Evidence

- `backend/src/products/products.module.ts:9-13` — only `ProductsController` is registered.
- `backend/src/products/products-search.controller.ts:19-149` — dead duplicate permits CASHIER and emits different response contracts.
- `backend/src/products/products.controller.ts:107-129` — live search/quick-search permit ADMIN/MEMBER only.
- `backend/src/products/products-search.controller.spec.ts:32-46` — tests cashier access on the unregistered class.
- `frontend/src/hooks/useProducts.ts:62-79` and `frontend/src/app/pos/page.tsx:196-206` — POS calls the live quick-search endpoint.

### Facts

- **FACT:** Decorators/tests on the dead controller do not prove runtime registration.
- **FACT:** A CASHIER reaches a live route that does not authorize CASHIER.
- **INFERENCE:** Exact scan/search from POS returns HTTP 403 for cashier sessions.

### Problem

Runtime route ownership, role intent, contract shape, and tests disagree for a POS-critical endpoint.

### Root Cause

Search was implemented in parallel without consolidating or registering one authoritative controller.

### Impact

Cashier barcode/SKU quick search can fail, while detached tests provide false confidence.

### Scope

Product search, POS, authorization matrix, Swagger/tests.

### Related Findings

AUDIT-FINDING-015, AUDIT-FINDING-018.

### Recommendation

Establish one registered search contract and align role requirements, consumers, tests, and documentation.

---

## AUDIT-FINDING-013

### Title

Frontend API contracts have multiple authorities and known runtime drift

### Category

Monorepo

### Severity

MEDIUM

### Confidence

HIGH

### Status

CONFIRMED

### Evidence

- `frontend/src/types/index.ts:1-681` — manually maintained API/domain types.
- `frontend/src/types/index.ts:450-458`, `frontend/src/contexts/AuthContext.tsx:23-40`, `frontend/src/hooks/useAdmin.ts:6-42`, `frontend/src/lib/auth.ts:1-7` — overlapping user/org/role authorities.
- `frontend/src/types/index.ts:7-15` — monetary fields typed as numbers.
- `frontend/src/app/pos/page.tsx:302-307` — runtime code compensates for Decimal strings.
- `frontend/src/hooks/useProducts.ts:82-100` — request bodies use `Partial<Product>`, admitting response-only fields.

### Facts

- **FACT:** No shared/generated package owns request/response contracts.
- **FACT:** TypeScript declarations already disagree with wire-level decimal behavior and each other.

### Problem

Contract changes can remain type-correct in each application while failing at runtime or being rejected by backend validation.

### Root Cause

API truth is manually reconstructed in domain types, contexts, hooks, and backend DTOs.

### Impact

Runtime coercion, broad request types, drift-prone role/session models, and higher cross-app change cost.

### Scope

Frontend/backend seam across products, auth, admin, billing, and other resources.

### Related Findings

AUDIT-FINDING-012, AUDIT-FINDING-014.

### Recommendation

Assign contract ownership to one source and distinguish wire-level request and response shapes.

---

## AUDIT-FINDING-014

### Title

Global error handling exposes unexpected exception text and emits inconsistent contracts

### Category

Security

### Severity

MEDIUM

### Confidence

HIGH

### Status

CONFIRMED

### Evidence

- `backend/src/common/filters/http-exception.filter.ts:11-26` — public interface says message is a string.
- `backend/src/common/filters/http-exception.filter.ts:42-55` — validation arrays pass through without normalization.
- `backend/src/common/filters/http-exception.filter.ts:79-93` — arbitrary `Error.message` replaces the generic 500 message and is returned.
- `backend/src/common/filters/http-exception.filter.ts:96-99` — every exception is error-logged through the same path.
- `backend/src/imports/imports.service.ts:861-869,1042-1045` — parser/library errors provide attacker-reachable unexpected messages.

### Facts

- **FACT:** `message` may be `string[]` despite the declared string contract.
- **FACT:** Non-HTTP internal/library messages cross the API boundary.

### Problem

Public error policy, transport normalization, and diagnostic logging are conflated.

### Root Cause

A catch-all filter performs shallow extraction without a canonical public/diagnostic error model.

### Impact

Client contract drift, possible disclosure of internal paths/infrastructure/parser details, noisy logs, and weak correlation.

### Scope

All backend endpoints, with an additional import-job leakage path.

### Related Findings

AUDIT-FINDING-004, AUDIT-FINDING-016.

### Recommendation

Normalize one truthful public schema and retain sanitized diagnostic context only in protected logs.

---

## AUDIT-FINDING-015

### Title

Quarantine suppresses valid frontend proof and includes obsolete security expectations

### Category

Testing

### Severity

MEDIUM

### Confidence

HIGH

### Status

CONFIRMED

### Evidence

- `frontend/vitest.config.ts:4-28` — four whole files are globally excluded from every configured run.
- `.github/workflows/ci.yml:86-92` — CI runs the same default configuration and no quarantine job.
- `frontend/src/app/admin/organizations/[id]/page.test.tsx:124-425` — broad behavior suite quarantined for one stale spinner assertion documented in `docs/design-system/KNOWN_TEST_FAILURES.md:51-62`.
- `frontend/src/components/dashboard/CategoryStackedChart.test.tsx:19-137` — ten tests quarantined for one tooltip class drift.
- `frontend/src/contexts/AuthContext.switch.test.tsx:50-90` — expects tokens in localStorage, contradicting current `AuthContext.tsx:47-61,93-99` and active `AuthContext.session.test.tsx:233-275`.

### Facts

- **FACT:** Sales, admin organizations, org switching, and dashboard chart files cannot fail CI through Vitest.
- **FACT:** Some failures are test defects or obsolete assertions, not product regressions.
- **UNKNOWN:** Current runtime status of all four files was not executed in this audit.

### Problem

Whole-file quarantine removes valid assertions and preserves retired behavior without an executable revalidation lifecycle.

### Root Cause

Quarantine is an unconditional exclusion list rather than governed, granular test debt.

### Impact

Regressions can merge in unaffected assertions, and re-enabling obsolete tests could pressure the code toward an insecure retired contract.

### Scope

Frontend CI, auth switching, organization administration, sales filters, dashboard charts.

### Related Findings

AUDIT-FINDING-012, AUDIT-FINDING-018.

### Recommendation

Classify each quarantined failure, keep unaffected assertions blocking, and make quarantine ownership/expiry/revalidation observable.

---

## AUDIT-FINDING-016

### Title

Settings query failures masquerade as loading or valid business state

### Category

Frontend

### Severity

MEDIUM

### Confidence

HIGH

### Status

CONFIRMED

### Evidence

- `frontend/src/app/settings/(locale)/locale/page.tsx:9-17` — failed/missing data remains “loading”.
- `frontend/src/app/settings/(advanced)/advanced/page.tsx:20-41` — same state collapse.
- `frontend/src/app/settings/(billing)/billing/page.tsx:66-79` — three queries but incomplete loading/error handling.
- `frontend/src/app/settings/(billing)/billing/page.tsx:134-145` — fallback plan/status displayed when billing response is absent.
- `frontend/src/app/settings/(billing)/billing/page.tsx:322-367` — payment failure becomes empty history.

### Facts

- **FACT:** Query error, absent data, loading, and empty business state are not consistently distinguished.
- **FACT:** Billing can render “Basic”/“Active” without a successful authoritative response.

### Problem

Users receive permanent loading screens or fabricated fallback state after API failure.

### Root Cause

No shared query-state contract separates loading, error, empty, and authoritative success.

### Impact

Operational/support decisions may rely on false subscription state; failures have no recovery path.

### Scope

Locale, advanced, billing/payment settings; pattern may exist elsewhere but was confirmed only here.

### Related Findings

AUDIT-FINDING-013, AUDIT-FINDING-014.

### Recommendation

Establish explicit query-state behavior; never substitute business defaults for failed API responses.

---

## AUDIT-FINDING-017

### Title

Reports combine unbounded workloads, process-local cache, and broad responsibilities

### Category

Performance

### Severity

MEDIUM

### Confidence

HIGH

### Status

CONFIRMED

### Evidence

- `backend/src/reports/reports.service.ts:406-1313` — one service owns financial, cash, inventory, dashboard, category, customer, user, and daily reports.
- `backend/src/reports/reports.service.ts:565-621,915-981,1118-1179,1269-1311` — broad ranges materialize and aggregate matching history in Node.
- `backend/src/reports/reports.service.ts:679-763` — dashboard runs twelve DB operations on cache miss.
- `backend/src/common/services/cache.service.ts:9-51` — cache is process-local.
- `backend/src/sales/sales.service.ts:278,578` — sales mutation clears only dashboard cache.
- `backend/src/products/products.service.ts:230-235,475-488` — substring search lacks corresponding specialized indexes in committed migrations.

### Facts

- **FACT:** Several report endpoints lack row/range bounds and use in-memory aggregation.
- **FACT:** Financial and dashboard cache ownership/invalidation differs and is process-local.
- **INFERENCE:** Memory, transfer, and latency scale with tenant history; multiple instances can disagree until TTL.
- **UNKNOWN:** Production cardinalities and query plans.

### Problem

Reporting query, accounting, response, and cache responsibilities share one volume-sensitive boundary.

### Root Cause

Reports accumulated endpoint-specific strategies without explicit cost/range and cache-coherence ownership.

### Impact

Volume-dependent latency/memory growth, potentially stale financial responses, and large change blast radius.

### Scope

Reports, dashboard, economic exports, sales/expense mutation invalidation.

### Related Findings

AUDIT-FINDING-014, AUDIT-FINDING-019.

### Recommendation

Define cohesive read models, explicit query-cost/range policy, representative query-plan evidence, and tenant-aware cache ownership.

---

## AUDIT-FINDING-018

### Title

Critical business flows are not proven at the deployed application seam

### Category

Testing

### Severity

MEDIUM

### Confidence

HIGH

### Status

CONFIRMED

### Evidence

- `backend/package.json:17,21,102-104` — E2E uses a separate command outside default Jest project.
- `.github/workflows/ci.yml:61-63` — CI runs only default backend tests.
- `backend/test/tax-precedence.e2e-spec.ts:23-49,89-112` and `categories-taxrate.e2e-spec.ts:15-49` — partial applications with mocked Prisma/guards.
- `backend/test/app.e2e-spec.ts:10-23` — imports AppModule but does not apply shared production bootstrap and tests unprefixed `/`.
- `frontend/src/app/pos/page.behavior.test.tsx:187-253,490-511` — mocks API/domain seams.
- `backend/src/sales/sales.service.int.spec.ts:33-50,145-261` — tests service/DB directly and sequentially.

### Facts

- **FACT:** Existing tests prove useful components/services, but not real `/api` routing, cookies/CSRF/guards/error shape and POS payload as one seam.
- **FACT:** No browser-level runner exists in frontend dependencies/scripts.
- **FACT:** Existing backend E2E suites are not CI-blocking.

### Problem

The primary revenue path and security/runtime composition can drift between individually tested layers without one test failing.

### Root Cause

Test layers stop below the deployed composition boundary and are routed inconsistently through CI commands.

### Impact

POS payload, authentication, CSRF, DTO, route, and transactional behavior can become mutually incompatible; database concurrency guarantees remain mainly sequentially tested.

### Scope

POS sale, authentication, product search, backend bootstrap, critical transaction behavior.

### Related Findings

AUDIT-FINDING-001 through 004, AUDIT-FINDING-012, AUDIT-FINDING-015.

### Recommendation

Prioritize a small set of real-composition tests for critical journeys and make explicit which unit/integration/E2E layers block CI.

---

## Low Findings

## AUDIT-FINDING-019

### Title

Operational policy, release branch, and observability have no repository authority

### Category

DevOps

### Severity

LOW

### Confidence

HIGH

### Status

REQUIRES INVESTIGATION

### Evidence

- `.github/workflows/ci.yml:3-7` and `.git/refs/remotes/origin/HEAD:1` — automation/repository target `master`.
- `docs/guias/03-flujo-git-y-convenciones.md:5-20,68-69` — contributor policy targets `main`.
- `docs/runbooks/runbook-despliegue-produccion.md:119-124,307-328` — uses ambiguous `main/master`.
- `.github/workflows/ci.yml:45-63,78-102` — no lint or backend E2E despite documented “Linters, Tests y Build”.
- `backend/docker-compose.yml:1-5` vs `.github/workflows/ci.yml:14-19` — PostgreSQL 15 locally, 17 in CI; production major unknown.
- `backend/src/app.controller.ts:17-31` and `docs/runbooks/runbook-despliegue-produccion.md:407-413,488-493` — health only checks DB; operations depend on manual platform-log review.
- No versioned Railway/Vercel deployment configuration exists.

### Facts

- **FACT:** Written release/quality policy and automation disagree.
- **FACT:** Effective platform migration hook, branch, Node/Postgres version, alerts, and rollback settings are not auditable from the repo.
- **UNKNOWN:** Hosted branch protection and platform configuration.

### Problem

Release and operational behavior depends on undocumented or stale external state.

### Root Cause

The production control plane and documentation evolved independently from repository automation.

### Impact

Contributor mistakes, checks bypassed by branch mismatch, environment-specific migration behavior, and delayed incident detection.

### Scope

GitHub, CI, Railway, Vercel, Supabase, local development and operations.

### Related Findings

AUDIT-FINDING-010, AUDIT-FINDING-017, AUDIT-FINDING-020.

### Recommendation

Declare one release/quality/runtime policy and preserve reviewable non-secret evidence of effective platform configuration and observability ownership.

---

## AUDIT-FINDING-020

### Title

Repository guidance and retired capabilities remain active-looking

### Category

Documentation

### Severity

LOW

### Confidence

HIGH

### Status

CONFIRMED

### Evidence

- `AGENTS.md:55-83` and identical `CLAUDE.md` — describe localStorage JWT, three roles, Settings model, Manrope/256px sidebar, live registration and two products controllers.
- `frontend/src/lib/session.ts:1-21`, `frontend/src/lib/auth.ts:1-7`, `backend/src/products/products.module.ts:9-13` — current code contradicts those claims.
- `frontend/src/app/register/page.tsx:26-39`, `backend/src/auth/auth.controller.ts:91-241` — self-registration is intentionally absent.
- `backend/src/auth/auth.service.ts:32-56`, `backend/src/auth/dto/auth.dto.ts:33-52`, `backend/src/common/guards/cookie-csrf.guard.ts:19` — residual register service/DTO/CSRF policy remains.
- `docs/runbooks/runbook-despliegue-produccion.md:108-110,409-413` vs `backend/src/main.ts:49-64` — production runbook requires Swagger while production disables it.

### Facts

- **FACT:** Multiple active-looking guides contradict executable behavior.
- **FACT:** Public registration absence is intentional; treating it as a missing feature is a false positive.
- **FACT:** Dead register/search artifacts preserve retired contracts.

### Problem

Humans and coding agents are given incorrect architecture, security, and operational instructions.

### Root Cause

There is no maintained documentation authority or complete capability-retirement process.

### Impact

Incorrect changes, false audit conclusions, unsafe runbook actions, and accidental re-exposure of retired behavior.

### Scope

Agent instructions, READMEs, architecture docs, auth/search residual code, deployment runbook.

### Related Findings

AUDIT-FINDING-010, AUDIT-FINDING-012, AUDIT-FINDING-019.

### Recommendation

Establish one current guidance source, clearly mark historical documents, and retire capabilities across code, policy, tests, and docs as one unit.

## Requires Investigation

The following findings are counted in the 20 findings above and must not be stated as confirmed production failures:

1. **AUDIT-FINDING-011 — migration deployability/live drift.** The committed PaymentRecord mismatch is confirmed, but clean-chain execution and deployed `_prisma_migrations` state are UNKNOWN. Verification requires a disposable clean database plus read-only inspection of deployed migration metadata under explicit operational authorization.
2. **AUDIT-FINDING-019 — effective hosted control plane.** Branch protection, Railway/Vercel production branches, migration hooks, runtime versions, rollback policy, and alerting are UNKNOWN because they are not versioned.

Not promoted without evidence:

- Dependency CVEs (no advisory report was available and no audit command was run).
- Production database drift or data corruption.
- Exploitable SQL injection/XSS.
- Current runtime failures of all quarantined tests.
- Production performance severity without cardinalities and query plans.

## Findings Relationships

| Root-cause cluster | Findings | Consolidated symptoms |
|---|---|---|
| Session/tenant scope mismatch | 001, 002, 003, 005 | Refresh crossover, password sessions, suspension behavior, stale import authority |
| Missing invariant ownership | 006, 007, 008, 009 | Partial writes, concurrency races, tenant FK gaps, weak row constraints |
| Contract/runtime split | 004, 012, 013, 014, 016, 020 | Audit actor mismatch, dead controller tests, type drift, errors, misleading UI/docs |
| Proof below production seam | 015, 018 | Whole-file quarantine, obsolete tests, E2E not blocking/full composition absent |
| Deployment/control-plane drift | 010, 011, 019, 020 | Migration owner, seed/runbook, branch/policy/platform unknowns |
| Single-process/volume assumptions | 005, 017, 019 | Ephemeral jobs, process-local cache, broad reporting, weak operations telemetry |

## SDD Candidates

Recommended independent future change candidates (not started):

1. **Session and tenant authorization lifecycle** — findings 001–003; include password revocation, session families, org-scoped suspension/revocation.
2. **Durable tenant-authorized import lifecycle** — finding 005; findings 006/008/009 are constraints, not necessarily the same change.
3. **Financial and inventory invariant boundaries** — findings 006–009, sliced by invariant if forecast exceeds review capacity.
4. **Production migration/provisioning authority** — findings 010–011; first prove clean-chain/deployed state.
5. **Product-search runtime contract** — finding 012; focused route/role/test reconciliation.
6. **API contract authority and error model** — findings 013–014; may require separate slices.
7. **Critical-path test architecture** — findings 015 and 018.
8. **Reporting read-model/cost/cache contract** — finding 017 after representative performance evidence.

## Non-SDD Improvements

- Remove or formally adopt unused RHF/Zod/resolver dependencies as one cleanup item; no browser-bundle impact was proven.
- Declare direct ownership of `uuid` or use an existing platform primitive; current resolution relies on ExcelJS's transitive dependency (`backend/src/cloudinary/cloudinary.service.ts:1-7`, `backend/package-lock.json:6047-6062,11496-11503`).
- Complete the intentional retirement of public registration after confirming no external consumer.
- Decide and document settings navigation intent for `/settings/billing`, `/settings/locale`, and `/settings/advanced`; current tests deliberately keep them hidden (`frontend/src/app/settings/sections.ts:16-40`, `layout.behavior.test.tsx:44-57`).
- Align Swagger/runbook wording and root agent guidance without treating every stale sentence as an independent finding.
- Add consistent upload limits/type validation to organization logo upload (`backend/src/settings/settings.controller.ts:66-75`); this can be grouped with upload-policy cleanup unless operational evidence raises severity.

## Summary Matrix

| ID | Finding | Category | Severity | Confidence | Root Cause | SDD Candidate |
|---|---|---|---|---|---|---|
| 001 | Refresh grace crosses session/org boundaries | Security | HIGH | HIGH | User-wide token recovery | YES |
| 002 | Password change leaves sessions valid | Security | HIGH | HIGH | Credential/session lifecycle split | YES |
| 003 | Suspension guard/revocation scope mismatch | Security | HIGH | HIGH | Auth order + global user state | YES |
| 004 | Declared audit events are skipped | Security | HIGH | HIGH | Request-user contract mismatch | YES |
| 005 | Import jobs non-durable and stale-authorized | Backend | HIGH | HIGH | Process-local duplicated job model | YES |
| 006 | Inventory/billing multi-writes non-atomic | Database | HIGH | HIGH | Ad hoc transaction boundaries | YES |
| 007 | Expense/cancellation concurrency races | Database | HIGH | HIGH | Validation outside lock/isolation | YES |
| 008 | Cross-table tenant ownership not DB-enforced | Database | HIGH | HIGH | Independent tenant/entity FKs | MAYBE |
| 009 | Financial/inventory checks absent in DB | Database | HIGH | HIGH | Invariants live only in services | MAYBE |
| 010 | Production migration/provisioning contradiction | DevOps | HIGH | HIGH | Stale runbook + unversioned platform | YES |
| 011 | Migration history differs from schema | Database | HIGH | HIGH | Historical DDL not reconciled | YES |
| 012 | Cashier POS search hits wrong live contract | Backend | MEDIUM | HIGH | Dead parallel controller | YES |
| 013 | API contract authorities drift | Monorepo | MEDIUM | HIGH | Manual duplicated contracts | YES |
| 014 | Error model leaks/inconsistent shape | Security | MEDIUM | HIGH | Catch-all shallow normalization | YES |
| 015 | Quarantine suppresses valid proof | Testing | MEDIUM | HIGH | Whole-file unmanaged exclusion | NO |
| 016 | Settings failures show false state/loading | Frontend | MEDIUM | HIGH | Missing query-state contract | MAYBE |
| 017 | Reports are unbounded/process-local cached | Performance | MEDIUM | HIGH | Mixed read-model/cost ownership | MAYBE |
| 018 | Critical flow lacks deployed-seam proof | Testing | MEDIUM | HIGH | Test layers stop below composition | YES |
| 019 | Release/ops policy lacks repo authority | DevOps | LOW | HIGH | External/stale control-plane truth | MAYBE |
| 020 | Active guidance preserves retired truth | Documentation | LOW | HIGH | No documentation/retirement authority | NO |
