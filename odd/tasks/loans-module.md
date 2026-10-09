# Loans: reserved inventory and audited settlement

Implement [issue #209](https://github.com/MeperDonas/MeperPOS/issues/209) in coherent checked work units. POS initiates; Loans owns follow-up. L1 standalone money creation/read is committed and reviewed; continue its payment lifecycle before touching sales or inventory.

## Scope and safety

- Interest-free money, existing inventory products/equipment, and services. Exactly one same-org customer/supplier/employee counterparty; employees reuse organization users, other people are customers.
- POS creates pending operations/reservations only. Loans handles payments/returns/closure. Full payment plus explicit authorized confirmation creates the linked final sale.
- Final sale, reservation consumption, linkage, closure and audit are atomic/idempotent: no duplicate payments, sales or stock deductions. Independent money/returnable equipment never auto-create sales; independent services tracking-only unless separately approved.
- OWNER/ADMIN create/administer/modify/cancel/reverse. OWNER/ADMIN/CASHIER/MEMBER collect and finalize paid linked sales; INVENTORY_USER cannot finalize. Independent money administration/closure remains OWNER/ADMIN.
- Append-only authenticated-actor history, organization isolation, backend Decimal money. Preserve immediate sales, stock CAS/version guards, untracked/service semantics and reporting.
- User authorized local verified feature commits with tests/docs only. Preserve unrelated staged `backend/reset-kevin-password.js` unread/unmodified and excluded from commits/review. No dependency updates, database migrations/seeds/resets, push/PR/merge authorized.
- Local node_modules/generated client/build artifacts permitted. Schema-only validate may temporarily set credential-free `postgresql://localhost/schema_validation`, restoring original environment; never use this for DB connections/migrations.

## Work units

| ID | Outcome | Status | Route |
| --- | --- | --- | --- |
| L0 | Restore backend tools without version changes | done (environment-only) | independent verifier/setup |
| L1 | Money-loan create/list/detail, counterparty/tenant guards and creation history | done (offline checks/review; runtime follow-up L7) | writer + independent verifier |
| L2 | Money collections, explicit settlement/closure, admin corrections/reversals and concurrent balance safety | in_progress (implemented; commit/review pending) | writer |
| L3 | Inventory/service loans, reservations/returns and stock-consumer availability guards | pending | writer |
| L4 | POS pending operation and atomic/idempotent final sale | pending | writer |
| L5 | Loans UI/hooks/navigation/history/overdue filters | pending | writer |
| L6 | POS handoff UI, browser/regression checks and user docs | pending | writer + verifier |
| L7 | Safe PostgreSQL migration/append-only history/rollback integration proof before delivery | pending (DB setup authorization needed) | independent verifier |

Multi-file financial/inventory units are delegated. L0 produced no versioned source and needs no separate commit. L7 is required runtime follow-up, not an excuse to claim DB behavior proven by mocks or approval.

## Acceptance and checks

- L1: positive two-decimal amount, valid dates/input, exactly one valid same-org counterparty; creation OWNER/ADMIN; scoped operator reads. Loan/event/AuditLog creation one transaction. No payment/POS/inventory/report side effects.
- L2: backend balance from posted payments; reject overpayment/concurrent overcollection and closed/cancelled mutations. Role restrictions; partial/full collections; fully paid remains pending explicit closure; reversal/correction requires admin/reason and preserves history. Independent closure never creates a sale.
- L3: prevent over-reservation across concurrent sales/loans/manual stock changes; delivered reservations cannot be released before return; honor stock tracking.
- L4: payment/permission/state revalidation; failures/retries/concurrent completion never duplicate sale/payment/stock/audit. Immediate sales unchanged.
- L5/L6: accessible mobile/desktop flows, actual roles and tenant/cache isolation. POS initiates only; Loans follow-up.
- L7: isolated non-production PostgreSQL setup must be authorized first. Prove migration apply, append-only event trigger and transaction rollback/tenant FK constraints; no production mutation.
- Test-first now tools available: observed RED before new behavior, GREEN then refactor/recheck. L1 initial runner-unavailable fallback has no retrospective RED; later formatting-only cleanup has no meaningful behavioral RED.
- Backend focused command: `npm test -- --runInBand --testPathPatterns=src/loans/`; local Prisma validate/generate, scoped read-only eslint, backend build. Never auto-fixing `npm run lint`; no broad DB-mutating suites without approved setup.
- Derive frontend Vitest commands before UI work; run browser checks then.

## Delivery and open decisions

- Branch `worktree-feat-loans-module`. User chose cached `chain_strategy=feature-branch-chain` under `ask-on-risk`; do not repeat shape menu. Push/PR/merge still require instruction.
- Initial boundary `d2c2eae6dc91e8ca3c156c473c73dda4d7e982d6`; next candidate base/last reviewed boundary `8f042b41decf73974a454e9e118b4e1fe2d583ab`.
- L1 authored feature lines +1143/-0; commit +1206 including task document. Full-feature original estimate 1100–1800 now too low; refine next units. ~400-line heuristic advisory: no omitted tests, compression or artificial splits. Keep coherent behavior/review slices.
- RDD on globally, unchanged. Review work-unit/PR-slice candidates, not checkbox or full accumulated branch; committed-only range excludes unrelated staged script.
- Before L4 user must decide creation-time versus finalization-time price/tax/cost snapshots and changes after collections. Before L3/L4 trace all stock mutators/untracked products. Resolve collection/final-sale reporting without double counting or general accounting expansion.

## Evidence

- Durable task file/full mirror/read-back/todo preceded first source writes.
- L0 npm ci --include=dev --ignore-scripts: 892 packages; manifest/lock hashes unchanged; Node24/npm11 local versus CI22. npm reported 76 vulnerabilities, no remediation within scope.
- L1 writer: source/schema/migration/tests/docs. Initial tests blocked by dotenv; tools were absent. No behavioral RED observed; runnable checks followed setup.
- Prisma client generation passed (6.19.2); build passed twice. Final independent recheck: 2 suites/60 tests passed; scoped eslint zero diagnostics/warnings; schema-only Prisma validation passed with temporary environment restored/no DB connection.
- Formatting/mock typing cleanup preserved 60 scenarios; feature +1143/-0 independently counted. Production bounded review confirmed tenant filters, role metadata, Serializable creation/event/audit transaction.
- L1 commit `8f042b41decf73974a454e9e118b4e1fe2d583ab`: feat(loans): add tenant-scoped money loan creation and history. Path-scoped commit preserved unrelated script's staged index entry exactly. No push.
- Native assessment medium; review due slice_budget_reached. Committed-only lineage `review-dada5f7f9cb5a225`, review-reliability, approved. Exact acknowledge-approved returned native-approved-acknowledgement-completed, authority burned. Review ended; no further STATUS.
- Advisory R3-database-invariants-unproved at migration.sql:56-58 is informational/nonblocking. No correction offered; do not reopen that candidate. Track runtime proof in L7. No database migration executed or runtime PostgreSQL proof yet.
- L2 implemented standalone collections/balance/reversal/close/cancel, request replay snapshots and Serializable/version CAS. Writer observed lifecycle RED21 failures then GREEN97, boundary RED9 then GREEN131; final 4 suites/138 tests include all L1 cases. Prisma generation/schema-only validation, scoped clean lint and build passed. Reported authored +1278/-30 including untracked; parent will verify commit scope.
- L2 closed loans reject new reversals; explicit reopen/refund semantics remain a product gap. Large-ledger aggregation remains a later performance concern, not added scope.
- Ambient review reminder target contained only unrelated staged script plus task updates when inspected; no START/consent answer for that mixed target. User clarification unanswered. Preserve original feature-only boundaries and review L2 via committed-only range.

## Next step

Create path-scoped authorized L2 work-unit commit, assess and inspect/start only committed-range review against 8f042b41, and follow native transitions. Run an independent focused spot-check per returned verification plan/parent check; no real DB mutation. L2 remains in progress until exact closure evidence. Keep L7 pending authorization; do not advance inventory/POS/UI or expand mixed-target review.
