# Server price within override tolerance

## Intent and scope

A client unit price within the existing 0.01 override tolerance must not become the charged price. If the request is not classified as an override, SalesService must use serverUnitPrice. Real overrides keep their existing permission and transactional audit behavior.

Branch: `fix/server-price-within-tolerance`.
Base: `251aa2c28efb0882efac73c839c7cead7048dfc7`.
Authorized surfaces: `backend/src/sales/sales.service.ts`, `backend/src/sales/sales.service.spec.ts`, this document.
Non-goals: changing tolerance, rounding rules, override roles, DTOs, frontend pricing or database schema.

## Execution plan

Route: delegated direct, one bounded writer for source and regression tests. Multi-file implementation trigger applies. No SDD lifecycle selected.
TDD: enabled by `openspec/config.yaml` (`strict_tdd: true`, `rules.apply.tdd: true`); no separate session override observed. Runner: Jest 30.
Delivery strategy: ask-on-risk; forecast 100 authored changed lines including tests and this document, one coherent PR slice.

- [x] Strengthen the float-noise test to assert persisted server price; cover an upward and downward request within tolerance and no audit. Observe RED before implementation.
- [x] Select serverUnitPrice when !isOverride; preserve real override behavior. Observe GREEN.
- [ ] Run focused unit suites, typecheck, non-mutating touched-file lint, and build; record exact evidence.
- [ ] Commit one work unit, assess candidate and follow native review plan.
- [ ] Create issue, await owner approval, then publish PR and verify CI. Owner merges.

## Verification commands

From backend:

- `npm.cmd run test -- --runInBand --testPathPatterns=sales.service.spec.ts`
- `npm.cmd run test -- --runInBand --testPathPatterns=sales.service.selling-services.spec.ts`
- `npx.cmd tsc --noEmit`
- `npx.cmd eslint src/sales/sales.service.ts src/sales/sales.service.spec.ts`
- `npm.cmd run build`

The unit suites mock Prisma and do not require PostgreSQL. Full database integration coverage requires PostgreSQL; do not report it passed without executing it. Backend lint must not use the auto-fixing npm lint script.

Runtime harness: the create-sale unit scenario checks persisted unitPrice, totals where covered, and audit calls through mocked transaction dependencies. No live database or authenticated endpoint smoke has been performed.
Rollback boundary: revert the single price-selection change and associated regression tests/document; no migrations or unrelated behavior.

## Evidence

Exploration confirmed the current mismatch: isOverride uses abs(delta) > 0.01, while unitPrice selects requestedUnitPrice even when isOverride is false. Existing tests cover authorized and unauthorized real overrides, omitted/matching price, and promotional overrides.

R3-001a bounded attempt: strengthened the existing float-noise regression with parameterized requests at 100000 + 0.005 and 100000 - 0.005, asserting persisted server unitPrice/subtotal/total and no audit. Payment is 100001 in both cases to isolate pricing from underpayment validation.

RED observed by the parent via PowerShell on the unchanged service: `npm.cmd run test -- --runInBand --testPathPatterns=sales.service.spec.ts` exited 1; 2 failed, 41 passed, 43 total. Both +/-0.005 regressions failed because persisted unitPrice/subtotal/total used the requested price rather than the server price. This parent-provided evidence preceded the service fix.

Implemented the single price-selection change: `const unitPrice = isOverride ? requestedUnitPrice : serverUnitPrice;`. Override classification, permission checks and transactional audit logic remain unchanged. Non-overrides now use serverUnitPrice for persistence and downstream calculations; real overrides retain requestedUnitPrice.

Parent PowerShell verification after the worker returned:

| Command (from backend) | Observed result |
| --- | --- |
| `npm.cmd run test -- --runInBand --testPathPatterns=sales.service.spec.ts` | GREEN: 43/43 passed, exit 0 |
| `npm.cmd run test -- --runInBand --testPathPatterns=sales.service.selling-services.spec.ts` | 6/6 passed, exit 0 |
| `npx.cmd tsc --noEmit` | Exit 2; 16 diagnostics reproduced on the base commit, including unchanged test fixtures |
| `npx.cmd eslint src/sales/sales.service.ts src/sales/sales.service.spec.ts` | Exit 1; 10 existing formatting errors reproduced on base. Base has 66 warnings; candidate has 67, including one additional unsafe-assignment warning in the new nested matcher. Not reported as clean. |
| `npm.cmd run build` | Passed, exit 0 |

Base comparison used a temporary archive of commit 251aa2c with the same installed node_modules, without editing the active tree. Temporary files were removed. Full PostgreSQL integration tests were not executed locally; remote CI remains pending publication.

The worker could edit but could not execute commands because its runtime had no PowerShell and Bash was unavailable. The parent observed RED and then executed the GREEN/regression commands; no RED/GREEN evidence is inferred.

Native assessment initially returned unassessable due to the untracked task document. This is treated as high risk, not low. Independent verifier completed source-level inspection with no blocking behavioral finding; its runtime was unavailable and it did not independently execute commands or reproduce the base diagnostics. Its stale-document observation predates the parent's GREEN evidence update above. Commit and review remain pending. Final receipt is not recorded here.
