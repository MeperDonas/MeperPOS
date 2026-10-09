# Loans: reserved inventory and audited settlement

Implement [issue #209](https://github.com/MeperDonas/MeperPOS/issues/209) in coherent work units. POS initiates; Loans owns follow-up. Start with standalone money loans, without touching existing sales or inventory.

## Scope and safety

- Interest-free money, existing inventory products/equipment, and services. Exactly one same-org customer/supplier/employee counterparty; employees reuse organization users, others are customers.
- POS creates pending operations and reserves units only. Loans handles collections, returns and closure. Fully paid linked operations require explicit authorized confirmation to create the final sale.
- Final sale/reservation consumption/linkage/closure/audit must be atomic/idempotent, without duplicate payments or stock deduction. Independent money and returnable equipment never automatically become sales; independent services remain tracking-only unless separately approved.
- OWNER/ADMIN administer/create/modify/cancel/reverse. OWNER/ADMIN/CASHIER/MEMBER collect/finalize; INVENTORY_USER cannot finalize.
- Append-only authenticated actor history; tenant isolation; backend-owned Decimal money; preserve immediate sales, stock CAS/version guards, service/untracked semantics and report behavior.
- Preserve unrelated staged `backend/reset-kevin-password.js`, unread/unmodified/unstaged by this feature, excluded from commits/review.
- No database migrations/seeds/resets, dependency updates, push/PR/merge. User explicitly authorized local verified work-unit commits for issue #209, with tests/docs and excluding unrelated staged files. Local tools/client/build artifacts are authorized.

## Work units

| ID | Outcome | Status | Route |
| --- | --- | --- | --- |
| L0 | Restore local backend tools without dependency-version changes | done (environment-only) | independent verifier/setup |
| L1 | Money-loan create/list/detail, valid counterparties, tenant guards and creation history | in_progress (checks passed; closure pending) | writer + independent verifier |
| L2 | Collections, settlement/closure, admin corrections/reversals and concurrent balance safety | pending | writer |
| L3 | Inventory/service loans, reservations/returns, all stock-consumer guards | pending | writer |
| L4 | POS pending operation and atomic/idempotent final sale | pending | writer |
| L5 | Loans UI/hooks/navigation/history/overdue filters | pending | writer |
| L6 | POS handoff UI, browser/regression checks and user docs | pending | writer + verifier |

All feature units use delegation because they cross multi-file or financial/inventory boundaries. L0 changed no versioned source: no separate commit applies; environment evidence below is its outcome. L1 cannot be completed without checks, applicable review and authorized work-unit commit evidence.

## Acceptance and checks

- L1: positive two-decimal amount, valid dates/input, exactly one valid same-org counterparty; only OWNER/ADMIN create; permitted operators read only their tenant. Creation/event/AuditLog use one transaction. No payment/POS/inventory/report changes.
- L2: reject overpayment/concurrent overcollection and invalid closed/cancelled actions; role boundaries, audited correction reasons and explicit independent closure without sales.
- L3: no over-reservation in concurrent sales/loans/manual stock changes; no release of delivered units before return; honor stock-tracking conventions.
- L4: full payment/authorized explicit closure, safe retries/failures/concurrent completion; immediate-sale regressions pass.
- L5/L6: responsive accessible flows, tenant/cache isolation, actual role guards; POS initiation only, follow-up in Loans.
- Test-first when runnable: observed RED/GREEN/recheck. L1 initial implementation used runner-unavailable fallback; do not manufacture retrospective RED. Formatting corrections have no behavioral RED and require lint plus focused regression recheck.
- Required from backend: `npm test -- --runInBand --testPathPatterns=src/loans/`; local Prisma validate/generate; file-scoped read-only eslint; `npm run build`.
- Focused mocked loans specs are DB-independent; broader suites can mutate a DB and are not authorized here. Never backend auto-fixing `npm run lint`.
- Schema-only validation may use temporary process DATABASE_URL `postgresql://localhost/schema_validation` with original environment restored. It contains no credentials, is not a real environment configuration, and is allowed only for validate, never migrate/connect.
- Migration remains unapplied. Static schema/SQL and mocked transactions cannot establish PostgreSQL trigger enforcement/rollback. Runtime migration/integration checks remain pending authorization/setup.
- Derive frontend Vitest commands before UI implementation; browser checks required for UI units.

## Delivery and remaining decisions

- Branch `worktree-feat-loans-module`; initial boundary `d2c2eae`; RDD on globally, unchanged. Review only provider-bound normalized work-unit/PR-slice scope, excluding unrelated staged script.
- Delivery strategy `ask-on-risk`; user selected `chain_strategy=feature-branch-chain` (feature/tracker branch chain). Cache this choice for future units; no repeat delivery-shape prompts. Original whole-feature forecast 1,100–1,800 lines is now likely low. Independently confirmed L1 +1,127/-0 before cleanup, excluding task bookkeeping. Committed lines 0; no commits/native review yet.
- ~400 lines advisory only: keep necessary tests/docs, no cosmetic compression or artificial splitting. L1 is one coherent creation/read API unit with schema/migration/permission/tenant tests; subsequent units will be separate slices. Local work-unit commits explicitly authorized; publishing/push/PR/merge remain unauthorized.
- Before L4, user must decide creation-time vs finalization-time prices/taxes/costs and changes after collections. Before L3/L4 trace every stock mutator/untracked behavior. Resolve collection/final-sale reporting to avoid double counting, without general accounting expansion.

## Evidence

- Task file/full mirror/read-back/todo preceded source writes. L1 schema/migration/module/DTO/service/controller/specs/app registration/docs authored; no L2–L6 source yet.
- Initial Jest attempts failed at missing dotenv: no behavioral RED/GREEN. Tools absent, not dependency declaration defects.
- L0 verifier: `npm --prefix backend ci --include=dev --ignore-scripts` exit0, 892 packages; manifest/lock hashes unchanged throughout. Local Node24/npm11 vs CI22. npm reported 76 vulnerabilities; no remediation within feature scope.
- Local Prisma generate exit0 (6.19.2); focused Jest exit0 (2 suites/60 tests); backend build exit0; whitespace check exit0. All local verification binaries restored. Setup is complete.
- Initial direct Prisma validate failed P1012 missing DATABASE_URL; `.env.development` absent. Final schema-only validation passed using temporary credential-free process URL, with original environment restored. No DB connection or runtime migration proof.
- Scoped two-spec cleanup corrected all 6 Prettier errors and 7 unsafe-any warnings without production changes or dropped test cases. Final scoped lint exit0/no warnings; focused Jest 2 suites/60 tests passed again; backend build passed again. This non-behavioral cleanup has no meaningful behavioral RED.
- Independent structural spot-check found no additional behavior defect: actual role metadata, tenant/active counterparty filters, Serializable creation+event+audit transaction, scoped list/detail/history.
- Migration unapplied, DB behavior unverified, unrelated staged script untouched/unread. No verified baseline check failures, no commits or database mutation.

## Next step

Await settled final independent focused L1 recheck. Delivery shape and local commit authorization are now granted. After successful checks, create a path-scoped work-unit commit preserving the unrelated staged script, then inspect/assess/review the committed-only candidate against d2c2eae. Record exact provider review outcome, commit identity and pending runtime checks before closure. Runtime PostgreSQL migration checks require separate safe setup/authorization; do not claim them passed. Do not advance L2 while L1 remains unclosed.
