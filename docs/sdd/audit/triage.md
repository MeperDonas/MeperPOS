# Audit Findings Triage

> **Scope:** final technical triage of `docs/sdd/audit/audit-findings.md`, using `docs/sdd/project-baseline.md` as architectural context and targeted verification against current source.  
> **Date:** 2026-09-02.  
> No code, configuration, dependency, GitHub Issue, proposal, specification, design, or task was created or modified by this triage.

## Confirmed Findings

### AUDIT-FINDING-001 — CONFIRMED

- **Severity:** HIGH
- **Impact:** During the 60-second reuse grace window, a revoked refresh token for a user with multiple sessions can select an unrelated active token, potentially changing the resulting organization scope and revoking an unrelated session.
- **Root cause:** Recovery selects any recent active token by `userId`, without session-family, direct-replacement, or organization lineage.
- **Scope:** Multi-session users; cross-organization impact requires multi-organization membership.
- **Independent GitHub Issue:** **No** — group into the session/tenant authorization lifecycle issue with 002 and 003.
- **Grouping:** Same issue cluster as 002 and 003; distinct failure mode within that issue.
- **Evidence:** `backend/src/auth/auth.service.ts:289-310,329-391`; `backend/prisma/schema.prisma:89-104`; `backend/src/auth/auth.constants.ts:15-24`.

### AUDIT-FINDING-002 — CONFIRMED

- **Severity:** HIGH
- **Impact:** A password change does not terminate already-issued access or refresh sessions; a stolen token can remain usable after the user changes the password.
- **Root cause:** Password mutation is disconnected from the centralized token-revocation path.
- **Scope:** All accounts using `POST /auth/change-password`, including SuperAdmin.
- **Independent GitHub Issue:** **No** — group with 001 and 003 under session/tenant authorization lifecycle.
- **Grouping:** Same issue as 001/003 at GitHub level; keep as a separately named acceptance slice.
- **Evidence:** `backend/src/auth/auth.controller.ts:157-165`; `backend/src/auth/auth.service.ts:415-426,528-555`; `backend/src/auth/jwt.strategy.ts:40-42`.

### AUDIT-FINDING-003 — CONFIRMED

- **Severity:** HIGH, with one impact qualifier below.
- **Impact:** The global organization-status guard runs before route-level authentication and therefore does not evaluate authenticated organization status in its declared position. Separately, suspension increments global `User.tokenVersion`, invalidating sessions for other organizations. The possibility of a residual write window after suspension is **not** confirmed and requires investigation.
- **Root cause:** Organization status enforcement depends on `request.user` before it exists, while suspension revocation is global-user scoped.
- **Scope:** Tenant write routes and multi-organization users.
- **Independent GitHub Issue:** **No** — group with 001 and 002.
- **Grouping:** Session/tenant authorization lifecycle. Do not merge with import authorization (005).
- **Evidence:** `backend/src/app.module.ts:73-90`; `backend/src/common/guards/organization-status.guard.ts:10-39`; `backend/src/auth/jwt.strategy.ts:77-91`; `backend/src/admin/admin.service.ts:177-193`; `backend/src/auth/auth.service.ts:478-496`.

### AUDIT-FINDING-004 — CONFIRMED

- **Severity:** HIGH
- **Impact:** Live routes marked with `@AuditAction` do not produce durable audit records when authenticated requests expose `userId` but the interceptor requires `sub`. This reduces accountability and incident evidence.
- **Root cause:** Authentication and audit layers use incompatible request-user contracts.
- **Scope:** Routes using `AuditInterceptor`; login's actor-availability path is also not covered by this interceptor.
- **Independent GitHub Issue:** **Yes** — audit event persistence and actor contract.
- **Grouping:** Related to API contracts (013) and error handling (014), but not a duplicate.
- **Evidence:** `backend/src/common/interfaces/request-user.interface.ts:3-10`; `backend/src/auth/jwt.strategy.ts:56-63,83-91`; `backend/src/common/interceptors/audit.interceptor.ts:142-176`; `backend/src/products/products.controller.ts:138-177`; `backend/src/users/users.controller.ts:43-109`.

### AUDIT-FINDING-005 — CONFIRMED

- **Severity:** HIGH
- **Impact:** Restart, redeploy, or another instance loses import status/errors/retry state while prior row writes remain. A user changing organizations can continue a job using only global `userId`, and retry writes use the stored organization without fresh membership/status verification.
- **Root cause:** Two duplicated process-local job lifecycles combine ephemeral state with user-only continuation authorization.
- **Scope:** Product and multi-sheet imports, polling, row retries, and operational recovery.
- **Independent GitHub Issue:** **Yes** — durable, tenant-authorized import lifecycle.
- **Grouping:** Related to runtime/control-plane investigation (019), but not merged; the defect is in application behavior.
- **Evidence:** `backend/src/imports/imports.service.ts:71-99,115-131,216-220,984-997`; `backend/src/imports/multi-sheet-import.service.ts:80-111,625-645`; `backend/src/imports/imports.controller.ts:139-178`.

### AUDIT-FINDING-006 — CONFIRMED

- **Severity:** HIGH
- **Impact:** Partial failure can leave product stock without its inventory movement, remove all default cash registers before replacement succeeds, or persist a billing payment without the associated organization transition.
- **Root cause:** Invariant-bearing multi-write actions are not consistently enclosed in one transaction.
- **Scope:** Products/inventory, cash registers, and billing payment records.
- **Independent GitHub Issue:** **Yes**, as the atomicity slice of the financial/inventory invariant cluster.
- **Grouping:** Cluster with 007, 008, and 009; do not merge into one unbounded issue.
- **Evidence:** `backend/src/products/products.service.ts:180-203,369-407`; `backend/src/cash-registers/cash-registers.service.ts:35-48,114-124`; `backend/src/billing/payment-records.service.ts:23-45`.

### AUDIT-FINDING-007 — CONFIRMED

- **Severity:** HIGH
- **Impact:** Concurrent expense-payment requests can validate against the same prior sum; concurrent cancellation requests can both restore stock and create return movements. These outcomes are inferred from the schedule, not runtime-reproduced.
- **Root cause:** Validation and one-time transition ownership occur outside a concurrency-controlled mutation boundary.
- **Scope:** Expense payments and sale cancellation.
- **Independent GitHub Issue:** **Yes**, as the concurrency slice of the financial/inventory invariant cluster.
- **Grouping:** Related to 006 and 009; distinct because its trigger is competing writers.
- **Evidence:** `backend/src/expenses/expenses.service.ts:392-455`; `backend/src/sales/sales.service.ts:454-515`; `backend/prisma/schema.prisma:454-489`.

### AUDIT-FINDING-008 — CONFIRMED

- **Severity:** HIGH risk/design weakness; exploitability is conditional.
- **Impact:** The database permits child and referenced parent rows from different organizations because foreign keys validate IDs independently, not tenant equality. No current bad row or normal API exploit was demonstrated.
- **Root cause:** Tenant discriminator columns were added without tenant-aware composite relationship enforcement.
- **Scope:** Product/category, sales/items/payments, purchasing, expenses, tasks, and audit-related relations.
- **Independent GitHub Issue:** **Yes**, as a tenant-integrity database slice, if constraint scope is approved.
- **Grouping:** Financial/inventory/tenant invariant cluster with 006, 007, and 009; not duplicate of row-local constraints.
- **Evidence:** `backend/prisma/schema.prisma:164-176,260-290,359-405,454-491`; `backend/prisma/migrations/20260423020000_multi_tenant_fase0/migration.sql:324-373`.

### AUDIT-FINDING-009 — CONFIRMED

- **Severity:** HIGH risk/design weakness; current invalid data was not demonstrated.
- **Impact:** Direct, future, script, import, or defective write paths can persist negative or arithmetically inconsistent financial/inventory rows while satisfying the schema.
- **Root cause:** Important row-local domain constraints live mainly in services/DTOs, not in database constraints.
- **Scope:** Product, inventory movement, sales/payments, purchase orders, expenses, and expense payments.
- **Independent GitHub Issue:** **Yes**, as a row-invariant database slice, separate from atomicity and concurrency.
- **Grouping:** Cluster with 006–008; distinct invariant and acceptance evidence.
- **Evidence:** `backend/prisma/schema.prisma:157-170,186-200,231-283,388-401,454-489`; targeted migration search found no committed `CHECK` constraints.

### AUDIT-FINDING-010 — CONFIRMED

- **Severity:** HIGH
- **Impact:** Operators following the runbook may deploy without the documented migration behavior, fail production provisioning, or execute a development/demo seed path in production.
- **Root cause:** Runbook, versioned scripts, CI, and external platform configuration do not have one verified deployment contract.
- **Scope:** Production migration ownership, provisioning, Railway/Supabase deployment, Swagger readiness check, and rollback operations.
- **Independent GitHub Issue:** **Yes** — production migration/provisioning authority.
- **Grouping:** Related to 011, 019, and 020, but keep separate because evidence and closure criteria differ.
- **Evidence:** `docs/runbooks/runbook-despliegue-produccion.md:25-28,69-83,108-110,330-389`; `backend/package.json:9-15,22,28-29`; `backend/prisma/seed.ts:403-439`; `backend/src/main.ts:49-64`; `.github/workflows/ci.yml:53-63`.

### AUDIT-FINDING-012 — CONFIRMED

- **Severity:** MEDIUM
- **Impact:** POS cashier barcode/SKU lookup reaches the registered controller, which excludes CASHIER, while the detached duplicate controller and its tests advertise CASHIER access. The exact HTTP 403 is statically supported but not runtime-executed.
- **Root cause:** Parallel search implementations were retained without one authoritative registered route contract.
- **Scope:** Product search, POS, role authorization, API response shape, and related tests.
- **Independent GitHub Issue:** **Yes** — POS product-search runtime contract.
- **Grouping:** Related to contract drift (013) and stale guidance (020), not merged.
- **Evidence:** `backend/src/products/products.module.ts:9-13`; `backend/src/products/products-search.controller.ts:19-149`; `backend/src/products/products.controller.ts:107-129`; `backend/src/products/products-search.controller.spec.ts:32-46`; `frontend/src/hooks/useProducts.ts:62-79`; `frontend/src/app/pos/page.tsx:206,468`.

### AUDIT-FINDING-013 — CONFIRMED

- **Severity:** MEDIUM
- **Impact:** Multiple frontend representations of users, organizations, roles, decimals, and mutation payloads allow compile-time agreement inside each app while wire behavior drifts or backend validation rejects requests.
- **Root cause:** No single authoritative/generated API contract; request and response types are manually reconstructed.
- **Scope:** Frontend/backend seam, especially products/POS, auth/org switching, billing, admin, and monetary resources.
- **Independent GitHub Issue:** **Yes** — API contract authority and wire-shape governance.
- **Grouping:** Related to 004 and 014, but retain separate acceptance boundaries.
- **Evidence:** `frontend/src/types/index.ts:1-681,450-458`; `frontend/src/contexts/AuthContext.tsx:23-40`; `frontend/src/hooks/useAdmin.ts:6-42`; `frontend/src/lib/auth.ts:1-7`; `frontend/src/app/pos/page.tsx:302-307`; `frontend/src/hooks/useProducts.ts:82-100`.

### AUDIT-FINDING-014 — CONFIRMED

- **Severity:** MEDIUM
- **Impact:** Validation arrays violate the declared error shape, and unexpected library/internal `Error.message` values can cross the API boundary; parser errors create an attacker-reachable example. A specific secret/path disclosure was not proven.
- **Root cause:** Catch-all error handling does not separate canonical public responses from protected diagnostic details.
- **Scope:** All backend endpoints using the global filter, especially imports.
- **Independent GitHub Issue:** **Yes** — canonical public error and diagnostic model.
- **Grouping:** Related to 013; not duplicate. Keep security disclosure scope explicit.
- **Evidence:** `backend/src/common/filters/http-exception.filter.ts:11-26,42-55,79-99`; `backend/src/imports/imports.service.ts:861-869,1042-1045`; `frontend/src/lib/api.ts:25-77`.

### AUDIT-FINDING-015 — CONFIRMED

- **Severity:** MEDIUM
- **Impact:** Four complete frontend test files cannot fail CI through Vitest, suppressing valid assertions in sales, admin organizations, organization switching, and charts. One excluded auth test asserts an obsolete localStorage token contract.
- **Root cause:** Whole-file quarantine is unconditional and lacks current classification/revalidation governance.
- **Scope:** Frontend CI and the four excluded suites.
- **Independent GitHub Issue:** **Yes**, but a testing-governance issue, not a product-regression issue.
- **Grouping:** Same testing cluster as 018; keep separate.
- **Evidence:** `frontend/vitest.config.ts:4-28`; `.github/workflows/ci.yml:86-92`; `frontend/src/contexts/AuthContext.switch.test.tsx:50-90`; `frontend/src/contexts/AuthContext.session.test.tsx:233-275`; `docs/design-system/KNOWN_TEST_FAILURES.md:51-75`.

### AUDIT-FINDING-016 — CONFIRMED

- **Severity:** MEDIUM
- **Impact:** Settings failures can appear as permanent loading, empty payment history, or authoritative `BASIC`/`ACTIVE` billing state without a successful response.
- **Root cause:** Frontend query states do not consistently distinguish loading, error, empty, partial, and authoritative success.
- **Scope:** `/settings/locale`, `/settings/advanced`, and `/settings/billing`; broader generalization is not made.
- **Independent GitHub Issue:** **Yes** — frontend query-state handling.
- **Grouping:** Related to 013 but not merged; hidden navigation is not part of this confirmed problem.
- **Evidence:** `frontend/src/app/settings/(locale)/locale/page.tsx:9-17`; `frontend/src/app/settings/(advanced)/advanced/page.tsx:20-41`; `frontend/src/app/settings/(billing)/billing/page.tsx:66-79,134-145,322-367`.

### AUDIT-FINDING-017 — CONFIRMED

- **Severity:** MEDIUM; production performance severity remains workload-dependent.
- **Impact:** Broad report ranges are materialized and aggregated in Node; caches are process-local, and sales invalidation clears dashboard keys but not cited financial keys. Production cardinalities, plans, and latency are unknown.
- **Root cause:** Reporting query cost, aggregation, response, and cache-coherence ownership accumulated in one boundary.
- **Scope:** Reports, dashboard, economic exports, sales/expense invalidation, and multi-instance behavior.
- **Independent GitHub Issue:** **Yes, conditionally** — create only with a bounded measurement/optimization scope.
- **Grouping:** Reporting read-model/cost/cache cluster; not merged with external observability investigation 019.
- **Evidence:** `backend/src/reports/reports.service.ts:565-621,679-763,915-981,1118-1179,1269-1311`; `backend/src/common/services/cache.service.ts:9-67`; `backend/src/sales/sales.service.ts:278,578`.

### AUDIT-FINDING-018 — CONFIRMED

- **Severity:** MEDIUM
- **Impact:** No CI-blocking test proves the real POS/API/backend composition with `/api` routing, cookies, CSRF, guards, DTOs, error serialization, and transactional behavior together.
- **Root cause:** Test layers stop below the deployed composition boundary and E2E commands are outside default CI.
- **Scope:** POS sale, authentication, CSRF, org authorization, bootstrap, product search, and critical transaction behavior.
- **Independent GitHub Issue:** **Yes** — critical-path composition testing.
- **Grouping:** Testing cluster with 015; separate issue because closure evidence differs.
- **Evidence:** `backend/package.json:17,21,102-104`; `.github/workflows/ci.yml:61-63`; `backend/test/tax-precedence.e2e-spec.ts:23-49,89-112`; `backend/test/app.e2e-spec.ts:10-23`; `frontend/src/app/pos/page.behavior.test.tsx:187-253,490-511`; `backend/src/sales/sales.service.int.spec.ts:33-50,145-261`.

### AUDIT-FINDING-020 — CONFIRMED

- **Severity:** LOW
- **Impact:** Humans and agents may make incorrect changes, misclassify tests, follow unsafe runbook instructions, or revive retired behavior.
- **Root cause:** No maintained documentation authority or complete capability-retirement process.
- **Scope:** AGENTS/CLAUDE, READMEs, architecture/runbook docs, auth/search residuals, and policy/test references.
- **Independent GitHub Issue:** **Yes, but low priority** — documentation authority and capability retirement.
- **Grouping:** Related to 010, 012, and 019; do not absorb their runtime or external-control-plane evidence.
- **Evidence:** `AGENTS.md:55-83`; `CLAUDE.md:55-83`; `frontend/src/lib/session.ts:1-21`; `frontend/src/lib/auth.ts:1-7`; `backend/src/products/products.module.ts:9-13`; `backend/src/auth/auth.service.ts:32-56`; `backend/src/auth/dto/auth.dto.ts:33-52`; `backend/src/common/guards/cookie-csrf.guard.ts:19`.

## False Positives

The following interpretations are rejected, while the narrower findings above remain valid:

| Original signal/claim | Classification | Reason |
|---|---|---|
| Missing public `/auth/register` is a current feature defect | FALSE POSITIVE | Current UI says registration is disabled and `AuthController` has no register route. Residual code/docs are covered by 020. |
| `products-search.controller.ts` is live because it has decorators/tests | FALSE POSITIVE | `ProductsModule` registers only `ProductsController`; its live-role mismatch is instead 012. |
| Client-side route guards alone expose tenant data | FALSE POSITIVE | Backend authorization remains enforced; absence of Next middleware is not independently a data-exposure finding. |
| Billing scheduler is accidentally broken | FALSE POSITIVE | The daily scheduler is explicitly a manual-billing no-op by design. |
| All duplicated types are defects | FALSE POSITIVE | The finding is limited to concrete runtime/wire drift, not every view-specific type. |
| All large frontend/backend files are automatically bad | FALSE POSITIVE | Findings use demonstrated state coupling, unbounded work, or proof gaps—not line count alone. |
| Production database is already out of sync | FALSE POSITIVE | No live database or `_prisma_migrations` state was inspected. |
| Dependency versions have confirmed CVEs | FALSE POSITIVE | No advisory evidence was available and no audit command was run. |
| Existing E2E/controller tests are worthless | FALSE POSITIVE | They provide useful partial coverage; 018 identifies the missing production-composition proof. |
| Hidden settings routes are definitely an accidental navigation defect | FALSE POSITIVE | Tests intentionally assert their absence from navigation; intent remains a product-policy question. |

## Needs Investigation

### AUDIT-FINDING-011 — NEEDS INVESTIGATION

The repository inconsistency is confirmed, but its runtime/deployment consequence is not.

**Confirmed facts:**

- `backend/prisma/schema.prisma:424-438` declares `PaymentRecord.method` as `PaymentMethod`.
- `backend/prisma/migrations/20260501195935_add_payment_record_and_org_index/migration.sql:5-15` creates it as `TEXT`.
- No later committed conversion was found.
- `20260423020000_multi_tenant_fase0/migration.sql:82-126` adds required `organizationId` columns without an in-script backfill/default.

**Missing evidence required:**

1. Replay all migrations on a disposable empty PostgreSQL database and record success/failure.
2. Inspect the resulting PostgreSQL type for `PaymentRecord.method` and compare it with generated Prisma metadata.
3. Execute representative Prisma `PaymentRecord` reads/writes against the clean replay.
4. Apply the multi-tenant migration to a representative populated pre-multi-tenant database and record whether it succeeds.
5. Under explicit operational authorization, inspect deployed `_prisma_migrations` records and relevant PostgreSQL catalog types.

**Severity:** Potentially HIGH, but conditional until this evidence exists.  
**GitHub treatment:** Create an investigation issue, not a confirmed production-incident issue.

### AUDIT-FINDING-019 — NEEDS INVESTIGATION

Repository policy drift is confirmed, but hosted behavior is not observable from the repository.

**Confirmed facts:**

- CI targets `master`: `.github/workflows/ci.yml:3-7`.
- Contributor guidance targets `main`: `docs/guias/03-flujo-git-y-convenciones.md:5-20,68-69`.
- CI omits lint and backend E2E despite broader documentation claims.
- Local Docker uses PostgreSQL 15 while CI uses PostgreSQL 17.
- No versioned Railway/Vercel configuration exists.

**Missing evidence required:**

1. Actual GitHub default branch, branch protection, required checks, and merge rules.
2. Railway production branch, build/start command, migration/pre-deploy hook, Node version, health check, and rollback settings.
3. Vercel production branch/build settings and environment scoping.
4. Supabase PostgreSQL major version and migration state.
5. Alerting, retention, correlation, and ownership for production observability.

**Severity:** LOW with potential escalation only if missing controls are proven.  
**GitHub treatment:** Create an investigation/governance issue; do not claim production failure yet.

## Duplicate / Merge

No finding is a complete duplicate that should be closed. The following are **related clusters**, not automatic merges:

### Session and tenant authorization lifecycle

- 001 refresh-token recovery lineage
- 002 password-change session invalidation
- 003 suspension guard and revocation scope

Recommended GitHub boundary: one issue with three explicit acceptance slices. They share session/tenant lifecycle ownership and should be addressed together to avoid fixing one scope while leaving the others inconsistent.

### Financial, inventory, and tenant invariant ownership

- 006 partial-write atomicity
- 007 concurrent-write protection
- 008 cross-table tenant ownership
- 009 row-level value constraints

Recommended GitHub boundary: one umbrella program or four bounded issues/slices. Do not collapse them into one issue if reviewability or migration risk requires separate ownership; fixing one does not prove the others.

### Contract/runtime truth

- 004 audit actor contract
- 012 live POS search contract
- 013 API contract authority
- 014 public error contract
- 020 documentation/capability retirement

Recommended treatment: keep concrete runtime defects separate from governance. A documentation update cannot prove audit persistence or cashier POS behavior.

### Testing proof

- 015 excessive/unmanaged quarantine
- 018 missing deployed-composition proof

Recommended treatment: related testing program, separate issues and closure criteria.

### Deployment and migration authority

- 010 confirmed runbook/script contradiction
- 011 migration-chain investigation
- 019 hosted control-plane investigation
- 020 stale guidance

Recommended treatment: link, do not merge. Each requires a different evidence source and owner.

## Recommended GitHub Issues

The following issue set represents **independent trackable problems**, not necessarily one issue per original finding.

### Issue

#### Session and tenant authorization lifecycle is not consistently scoped

**Finding(s):** 001, 002, 003  
**Problem:** Refresh reuse recovery is user-wide, password changes do not revoke sessions, and organization suspension combines pre-auth status enforcement with global-user revocation.  
**Impact:** Cross-session/organization crossover risk, persistent compromised sessions, and unrelated-organization logout/availability impact.  
**Evidence:** `backend/src/auth/auth.service.ts:289-391,415-426,478-496,528-555`; `backend/src/common/guards/organization-status.guard.ts:10-39`; `backend/src/app.module.ts:73-90`.  
**Suggested Labels:** `security`, `bug`, `architecture`  
**SDD Candidate:** YES

### Issue

#### Restore durable tenant-authorized import jobs

**Finding(s):** 005  
**Problem:** Import job state is process-local and continuation checks user identity without current organization membership/status.  
**Impact:** Lost recovery state after restart/scaling, ambiguous partial imports, and stale cross-organization continuation.  
**Evidence:** `backend/src/imports/imports.service.ts:71-99,216-220,984-997`; `backend/src/imports/multi-sheet-import.service.ts:80-111,625-645`; `backend/src/imports/imports.controller.ts:139-178`.  
**Suggested Labels:** `bug`, `security`, `architecture`, `technical-debt`  
**SDD Candidate:** YES

### Issue

#### Ensure audit-decorated mutations produce durable actor-scoped records

**Finding(s):** 004  
**Problem:** `AuditInterceptor` expects `request.user.sub`, while authenticated requests expose `userId`, causing the interceptor to skip audit writes.  
**Impact:** Missing accountability and incident evidence for security-relevant mutations.  
**Evidence:** `backend/src/common/interfaces/request-user.interface.ts:3-10`; `backend/src/auth/jwt.strategy.ts:56-63,83-91`; `backend/src/common/interceptors/audit.interceptor.ts:142-176`.  
**Suggested Labels:** `security`, `bug`, `audit`  
**SDD Candidate:** YES

### Issue

#### Make financial and inventory invariants atomic, concurrent-safe, and tenant-consistent

**Finding(s):** 006, 007, 008, 009  
**Problem:** Related writes can commit partially, competing writers validate stale state, and the database does not enforce key tenant/value invariants.  
**Impact:** Possible stock/ledger divergence, overpaid expenses, duplicate returns, cross-tenant relationships, and invalid persisted financial values.  
**Evidence:** `backend/src/products/products.service.ts:180-203,369-407`; `backend/src/expenses/expenses.service.ts:392-455`; `backend/src/sales/sales.service.ts:454-515`; `backend/prisma/schema.prisma:157-200,231-291,359-405,454-491`.  
**Suggested Labels:** `bug`, `security`, `database`, `architecture`  
**SDD Candidate:** YES

### Issue

#### Establish one production migration and provisioning authority

**Finding(s):** 010  
**Problem:** The runbook claims migrations occur in prebuild and directs production toward a development/demo seed, while versioned scripts do neither safely.  
**Impact:** Schema/application mismatch, failed provisioning, demo data, or unsafe bootstrap behavior.  
**Evidence:** `docs/runbooks/runbook-despliegue-produccion.md:25-28,69-83,330-389`; `backend/package.json:9-15,22,28-29`; `backend/prisma/seed.ts:403-439`.  
**Suggested Labels:** `bug`, `devops`, `documentation`, `technical-debt`  
**SDD Candidate:** YES

### Issue

#### Reconcile Prisma migration history with the current schema

**Finding(s):** 011  
**Problem:** Current Prisma metadata declares an enum while the committed creation migration declares TEXT, and populated upgrade assumptions are undocumented.  
**Impact:** Potential clean-replay or upgrade failure; live impact remains unverified.  
**Evidence:** `backend/prisma/schema.prisma:424-438`; `backend/prisma/migrations/20260501195935_add_payment_record_and_org_index/migration.sql:5-15`; `backend/prisma/migrations/20260423020000_multi_tenant_fase0/migration.sql:82-126`.  
**Suggested Labels:** `database`, `devops`, `investigation`  
**SDD Candidate:** MAYBE — first complete the explicit investigation.

### Issue

#### Align POS cashier product search with the registered API contract

**Finding(s):** 012  
**Problem:** POS calls a registered search route that excludes CASHIER, while detached tests cover an unregistered cashier-enabled controller.  
**Impact:** Cashier barcode/SKU lookup may be rejected during checkout and tests provide false confidence.  
**Evidence:** `backend/src/products/products.module.ts:9-13`; `backend/src/products/products.controller.ts:107-129`; `backend/src/products/products-search.controller.ts:19-149`; `frontend/src/hooks/useProducts.ts:62-79`.  
**Suggested Labels:** `bug`, `backend`, `security`, `testing`  
**SDD Candidate:** YES

### Issue

#### Establish authoritative frontend/backend API contracts

**Finding(s):** 013  
**Problem:** Request/response types, roles, organizations, and decimal wire shapes are manually duplicated across applications and already disagree.  
**Impact:** Runtime contract drift, broad invalid payloads, and costly cross-application changes.  
**Evidence:** `frontend/src/types/index.ts:1-681`; `frontend/src/contexts/AuthContext.tsx:23-40`; `frontend/src/hooks/useAdmin.ts:6-42`; `frontend/src/hooks/useProducts.ts:82-100`; `frontend/src/app/pos/page.tsx:302-307`.  
**Suggested Labels:** `architecture`, `technical-debt`, `monorepo`  
**SDD Candidate:** YES

### Issue

#### Define a canonical public error and diagnostic model

**Finding(s):** 014  
**Problem:** Public errors expose inconsistent message types and arbitrary unexpected exception text.  
**Impact:** Client incompatibility and possible disclosure of parser/internal details.  
**Evidence:** `backend/src/common/filters/http-exception.filter.ts:11-26,42-55,79-99`; `backend/src/imports/imports.service.ts:861-869,1042-1045`; `frontend/src/lib/api.ts:25-77`.  
**Suggested Labels:** `security`, `bug`, `backend`, `api`  
**SDD Candidate:** YES

### Issue

#### Govern frontend test quarantine and restore suppressed proof

**Finding(s):** 015  
**Problem:** Four complete frontend test files are globally excluded, including valid assertions and one obsolete security expectation, without current lifecycle metadata.  
**Impact:** Regressions in critical UI/org/auth surfaces can bypass CI; obsolete tests can misdirect future changes.  
**Evidence:** `frontend/vitest.config.ts:4-28`; `.github/workflows/ci.yml:86-92`; `frontend/src/contexts/AuthContext.switch.test.tsx:50-90`; `docs/design-system/KNOWN_TEST_FAILURES.md:51-75`.  
**Suggested Labels:** `testing`, `technical-debt`, `ci`  
**SDD Candidate:** YES

### Issue

#### Add CI-blocking proof at the critical frontend/API composition seam

**Finding(s):** 018  
**Problem:** Existing tests cover isolated UI/services and partial HTTP modules, but no CI-blocking test proves the real POS/API/bootstrap/security/transaction seam.  
**Impact:** Cross-layer drift can reach merge without detection in the revenue-critical flow.  
**Evidence:** `.github/workflows/ci.yml:61-63`; `backend/test/app.e2e-spec.ts:10-23`; `backend/test/tax-precedence.e2e-spec.ts:23-49,89-112`; `frontend/src/app/pos/page.behavior.test.tsx:187-253,490-511`; `backend/src/sales/sales.service.int.spec.ts:33-50,145-261`.  
**Suggested Labels:** `testing`, `ci`, `architecture`, `reliability`  
**SDD Candidate:** YES

### Issue

#### Fix settings query-state handling for failure and authoritative business data

**Finding(s):** 016  
**Problem:** Settings pages collapse query failures into loading, empty, or default billing states.  
**Impact:** Administrators can see false plan/status/payment information or remain without recovery.  
**Evidence:** `frontend/src/app/settings/(locale)/locale/page.tsx:9-17`; `frontend/src/app/settings/(advanced)/advanced/page.tsx:20-41`; `frontend/src/app/settings/(billing)/billing/page.tsx:66-79,134-145,322-367`.  
**Suggested Labels:** `bug`, `frontend`, `reliability`  
**SDD Candidate:** MAYBE

### Issue

#### Bound report workloads and define cache coherence

**Finding(s):** 017  
**Problem:** Report endpoints materialize broad ranges in Node and use process-local caches with incomplete cited invalidation.  
**Impact:** Volume-dependent latency/memory growth and potentially stale financial responses.  
**Evidence:** `backend/src/reports/reports.service.ts:565-621,679-763,915-981,1118-1179,1269-1311`; `backend/src/common/services/cache.service.ts:9-67`; `backend/src/sales/sales.service.ts:278,578`.  
**Suggested Labels:** `performance`, `backend`, `architecture`  
**SDD Candidate:** MAYBE — measure representative workloads first.

### Issue

#### Verify effective hosted release and operational controls

**Finding(s):** 019  
**Problem:** Repository policy names conflicting branches/checks and cannot establish hosted migration hooks, runtime parity, rollback, protection, or alerting.  
**Impact:** Release and incident behavior may differ from documented expectations; current production failure is not proven.  
**Evidence:** `.github/workflows/ci.yml:3-7,45-63,78-102`; `docs/guias/03-flujo-git-y-convenciones.md:5-20,68-69`; `docs/runbooks/runbook-despliegue-produccion.md:119-124,307-328`; `backend/docker-compose.yml:1-5`.  
**Suggested Labels:** `investigation`, `devops`, `ci`, `documentation`  
**SDD Candidate:** MAYBE — investigation first.

### Issue

#### Establish documentation authority and complete retired-capability cleanup

**Finding(s):** 020  
**Problem:** Active-looking guidance and residual auth/search artifacts preserve retired or incorrect runtime contracts.  
**Impact:** Incorrect engineering changes, false audit conclusions, unsafe operations, and accidental re-exposure of retired behavior.  
**Evidence:** `AGENTS.md:55-83`; `CLAUDE.md:55-83`; `frontend/src/lib/session.ts:1-21`; `backend/src/products/products.module.ts:9-13`; `backend/src/auth/auth.service.ts:32-56`; `docs/runbooks/runbook-despliegue-produccion.md:108-110`.  
**Suggested Labels:** `documentation`, `technical-debt`, `maintenance`  
**SDD Candidate:** NO
