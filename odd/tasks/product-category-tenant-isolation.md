# Product category tenant isolation

## Objective
Prevent an organization member from attaching another organization's category to an owned product through `PUT /api/products/:id`.

## Scope and constraints
- Only the product update behavior and focused regression tests. User-performance report metadata exposure and database-level composite foreign keys are separate work.
- Preserve valid same-organization category changes and existing error conventions. Do not access a real/user database; use mocked Jest tests.
- Work on `fix/product-category-tenant-isolation`, branched from `origin/master` because the prior `fix/query-cache-identity` branch contains unrelated changes.
- Strict TDD: **on**, from `openspec/config.yaml` (`strict_tdd: true`, `rules.apply.tdd: true`). Backend runner: `cd backend && npm run test` (`dotenv -e .env.development -- jest`), with focused `--runInBand --runTestsByPath` arguments. Observe RED before GREEN; never claim unrun checks.
- Delivery: ask-on-risk; forecast under 120 authored changed lines, one work-unit commit. Review candidate is that commit, not this checklist. Rollback boundary: the product-update category validation and its associated regression tests only.

## Task checklist
- [x] **CAT-1 — Block cross-organization product category updates.** Route: delegated `gentle-ai-worker` (nontrivial changes to service and test file; preparation and multi-file write triggers). Add a mocked regression for foreign `categoryId` rejection and same-org acceptance, observe RED, implement matching lookup before update, observe GREEN and applicable backend checks. Acceptance: foreign category ID cannot persist or expose a foreign category; valid same-org update still works; no test connects to real DB. Commit behavior and tests together with a Conventional Commit message, record hash and exact check results here.

## Progress and evidence
- Before implementation: read-only code trace confirmed `products.service.ts` checks ownership of the product but spreads `UpdateProductDto.categoryId` into `updateMany` without checking category ownership; read paths include category. No HTTP/DB reproduction. No source files changed yet.
- Current status: CAT-1 implementation and focused verification complete; work-unit commit created, native review and push pending. Delegated writer added two mock tests, then after observed RED added an organization-scoped category lookup before product update. Child shell could not launch `/bin/bash`; parent PowerShell fallback executed exact Jest runner via `npm.cmd`.
- TDD: RED `cd backend && npm.cmd run test -- --runInBand --runTestsByPath src/products/products.service.spec.ts` — 49 passed, 3 failed (both new tests failed for missing lookup; an existing promotion-create test also failed in that run but passed on later rerun). GREEN same command — 52 passed, 0 failed. Targeted new tests — 2 passed, 50 skipped.
- Verification: `cd backend && npm.cmd run build` passed (Prisma client generation and Nest build). `git diff --check` passed. Independent verifier read both changed files and confirmed rejection before `updateMany`, valid same-org path and unchanged-category path; it could not execute Jest because its bash is unavailable. Full backend suite and HTTP/DB integration skipped: integration fixtures require a disposable isolated DB. Runtime harness: N/A because this is a service-level tenant-ownership check whose end-to-end exercise needs an isolated database; mocked Jest checks the service boundary. Rollback boundary: revert the two source/test changes and the task artifact as one unit.
- Work-unit commit: `bb072a9b37e2beaa2da522b11ab9f17105380b50` (`fix(products): enforce category organization on update`). Native review and branch push pending; no PR requested.
