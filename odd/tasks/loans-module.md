# Loans module — issue #209

Implement [#209](https://github.com/MeperDonas/MeperPOS/issues/209) in checked local feature-branch units. Detailed API/domain semantics: `docs/loans.md`.

## Authority and invariants

- Interest-free money, registered physical products/equipment, and service obligations. Exactly one same-org customer/supplier/employee; employees reuse users, other people are customers.
- POS initiates pending operations/reservations only; Loans owns collections, returns and closure. Fully paid plus authorized explicit confirmation creates linked sale/consumes reservations/closes/audits atomically and once. Independent money/equipment/service debts never auto-create sales.
- OWNER/ADMIN administer/create/modify/cancel/reverse; OWNER/ADMIN/CASHIER/MEMBER collect and finalize linked sales. INVENTORY_USER excluded; independent monetary closure OWNER/ADMIN.
- Preserve tenant isolation, append-only actor/timestamp history, backend Decimal money, immediate sales, CAS/version, service/untracked semantics and reporting.
- Local verified work-unit commits authorized: feature-branch-chain, ask-on-risk. No push/PR/merge, upgrades, real DB connection/migration/seed/reset.
- Unrelated staged `backend/reset-kevin-password.js` unread/untouched/excluded. Exact-target exclusions live in Engram:9a4470,8a39,54fdb,cbe308 (full hashes in individual observations). No blanket RDD disable or inference for changed targets. User cancelled746e1cee scope choice; no disposition/consent inferred.
- Routine local generated client/dist allowed. Schema-only temporary credential-free DATABASE_URL restored in finally; no database connection.

## Tasks

| Unit | Outcome | Status |
| --- | --- | --- |
| L0 | Restore tools without dependency-version changes | done |
| L1 | Money creation/read/counterparty/history | done; DB L7 |
| L2 | Collections/reversals/closure/cancellation/retries | done; DB L7 |
| L3A | Independent service debts sharing monetary servicing | done; DB L7 |
| L3B-A | Reserved quantity schema/product edit/deactivation guards | done; DB L7 |
| L3B-B | Sale/cancellation/backfill stock-consumer safeguards | done; DB L7 |
| L3B-C | Server-derived availability/enrichment/search/classification | in_progress; checked, commit/review pending |
| L3C | Separate quantity ledger/reservations/delivery/returns | pending |
| L4 | POS pending operations/atomic final sale | pending; pricing decision |
| L5 | Loans page/hooks/navigation/history/overdue filters | pending |
| L6 | POS handoff/browser/regressions/docs | pending |
| L7 | Isolated PostgreSQL migration/immutability/FK/rollback/races | pending; authorization |

Reservation writers/endpoints stay disabled until every L3B consumer/read contract is checked. ~400-line review heuristic advisory; retain tests/docs, no compression/artificial splitting. Multi-file implementation delegated, test-first when meaningful. File/full mirror/todo precede writes and reconcile at transitions.

## Current L3B-C acceptance and surfaces

- Add server-derived availableStock: tracked PRODUCT stock-reservedStock; service/untracked null (no finite inventory). Require actual type/tracksStock/stock/reservedStock, no missing-field fallback.
- Apply through create/update/list/detail enrichment, search, quick-search and low-stock responses. Preserve existing thin response keys/prices/tax normalization; one calculation, no client rederivation.
- available=true retains service/untracked eligibility; tracked branch uses stock > Prisma reservedStock field reference. Same composed tenant-bound where for page/count and combined filters.
- Preserve physical stock, isLowStock/minStock/raw-SQL physical low-stock predicate and reporting; no low-stock policy change or product decision needed.
- Narrow writer surfaces: products.service.ts, product-type.logic.ts/spec.ts, products.service.spec.ts, products.service.service-type.spec.ts, products.controller.spec.ts and docs/loans.md. Add mocked field-reference sentinel/realistic stock-control fixtures.
- No schema, reservation writer/API, sales/backfill, frontend or reporting edits. Frontend Product type/hooks/POS/inventory/ProductCard availability consumption is L6 handoff, not complete audit. No *.int.spec.ts or database setup.

## Later decisions and checks

- L3B-C preserves physical on-hand stock; derive available quantity server-side, preserve service/untracked eligibility. Explicitly preserve/resolve low-stock contract before changing it; no revenue math changes.
- L3C tracked active physical inventory only, no isLoanable invention; separate durable quantity ledger atomically tied to counter, idempotency and consistency/reconciliation. Delivered cancellation needs recorded returns.
- Before L4 ask creation-time vs completion-time price/tax/cost snapshots and changes after collections; avoid collection/final-sale double counting. Closed monetary reopening/refund remains unspecified; closed reversals rejected.
- L5/L6 require accessible desktop/mobile, tenant/role/cache isolation and browser checks.
- L7 needs isolated non-production DB authorization; mocks/schema cannot prove triggers/FKs/rollback/concurrency. Deployed SERVICE data needs data-safe rollback.
- Focused DB-free unit tests only: explicit sales/service-type/product/purchase/import/backfill planner specs plus loans. Never broad integration suites, auto-fixing npm lint, migration or seed. Prisma generate/schema validate, read-only eslint with exact baseline delta, direct tsc and scoped whitespace. Full npm production hook skipped for L3B-A (dotenv/Nest output cleanup), do not claim it passed.

## Commits and observed evidence

Branch `worktree-feat-loans-module`; initial base d2c2eae6dc91e8ca3c156c473c73dda4d7e982d6. Next committed-only native review base **52d31e0b8543d8520214a61820ad91b3c41ac5ed**, never accumulated branch. RDD on; no replay of burned approvals.

- L0: script-suppressed ci892 packages, lock/manifest unchanged; local Node24/npm11 vs CI22;76 vulnerabilities not remediated.
- L1 **8f042b41decf73974a454e9e118b4e1fe2d583ab**:60 tests/schema/client/lint/build pass; initial RED unavailable, not invented. Feature+1143/-0; commit+1206. review-dada5f7f9cb5a225 approved/acknowledged/burned; informational DB proof L7.
- L2 **923831cba0f1c5bde30b359806c7108837003460**: lifecycle RED21->GREEN97, boundary RED9->GREEN131; final/independent4 suites138/138, schema/client/lint/build pass. Feature+1278/-30, commit+1321/-70. review-52eea385c00a492a approved/acknowledged/burned; DB proof L7.
- L3A **dc3c43c6fdbf5e9d1f6e3326f9a895e8939363bc**: RED11fail/186pass->GREEN197->final/independent212/212; schema/client/lint/build pass. Source9files+307/-18; commit10+352/-62. review-4d88bb6e3fba0fb2 approved/acknowledged/burned; ASSESS consumed/closed. Type immutability informational proof L7; old replay snapshots unchanged.
- L3B-A **6ab922e491afb95a54d1f709a1758f2d621f8c6b**: RED21fail/9pass->GREEN137->final146 product/212 loan tests; independent Prisma/schema/directtsc/tests pass. Source7files+512/-8, commit8+556/-54.39 reservation tests retained; typing cleanup no behavioral RED, new spec lint0. Raw other-file lint still62 baseline errors/76 warnings, no new diagnostics. review-2162a36fbfbab9af medium approved/no advisories; exact acknowledgement burned. Initial consent expired before native invocation/no lineage; fresh source-scoped inspect/START succeeded, no unrelated-script review.
- L3B-B **52d31e0b8543d8520214a61820ad91b3c41ac5ed**: commit8 files +514/-110 including tracking; source7 tracked files +464/-61. Observed RED14 failed/24 passed and cancellation RED3 intended failures -> GREEN81 -> final13 DB-free suites476/476; direct TypeScript build0. Scoped raw lint60 errors/75 warnings both exact HEAD/current; changed-line0, no new diagnostics. Schema unchanged/prior validation reused, not rerun. Whitespace clean. Repeated sale lines re-read product versions; losing cancellation claim has no effects, restock conflict aborts transaction. Committed-only medium review-aa266f0c02373be4 approved without reported advisories; exact acknowledgement returned burned authority. Actual DB locking/races/rollback L7.
- L3B-C delegated writer mv0f6z6r-m-in65 completed six source/test/doc files +505/-50. Recovery RED17 failed/159 passed -> focused GREEN200/200 -> final14 DB-free suites530/530; direct tsc0. Read-only exact-HEAD lint81 errors98 warnings -> current53/77, zero new mapped diagnostics; raw lint1 retains legacy failures. Whitespace0; documentation CRLF warning only. Separate parent-command spot check mv0fk06p-n-hqkh: helper46/46, including24 availability cases; HEAD/script metadata unchanged. ASSESS medium/large runtime, unknown native outcome: writer checks stand, no independent full verifier required. Original failed writer cause unknown; preserved helper had no historical RED. Physical low-stock preserved, sentinel-dependent eligibility checked; schema/client validation reused, not rerun. DB L7/UI L6 pending, reservation writers disabled. Commit and source-scoped native review pending; exact ambient exclusions remain memory-only.
- All commits path-scoped, unrelated index entry preserved exactly; migrations unapplied. Original1100–1800 estimate too low, refine units.
- Scout mv0cptvk-h-diza: sales raw-stock CAS/no version increment, cancellation absolute restore and outside-transaction COMPLETED check, backfill stock-zero CAS lacks reserved counter. Purchase versioned increment and imports delegated create already compatible.

## Next step

Create checked path-scoped C work-unit commit excluding the staged script, then assess/inspect/review the committed slice against52d31e0. Record exact commit and native disposition before closing C. L3C quantity ledger follows; L4 pricing decision and L7 isolated DB authorization remain separate. No prior approval replay, real PostgreSQL proof or reservation rollout claimed.
