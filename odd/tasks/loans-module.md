# Loans: audited servicing and reserved inventory

Implement [issue #209](https://github.com/MeperDonas/MeperPOS/issues/209) as coherent checked work units. L1/L2 money loans are committed, reviewed and functionally checked. Add services before reservation-wide inventory changes.

## Scope and safety

- Interest-free MONEY, existing inventory PRODUCTS/EQUIPMENT, and SERVICE obligations. Exactly one same-org customer/supplier/employee counterparty. Employees reuse organization users; other people are customers.
- POS creates pending operations/reservations only. Loans owns payments, returns and closure. Full payment plus explicit confirmation creates the linked final sale atomically with reservation consumption, linkage, closure and audit; retries cannot duplicate effects.
- Independent money/returnable equipment never auto-create sales. Independent service debts remain tracking-only unless a conversion path is separately approved.
- OWNER/ADMIN create/administer/modify/cancel/reverse. OWNER/ADMIN/CASHIER/MEMBER collect and finalize paid linked sales; INVENTORY_USER cannot finalize. Independent monetary administration/closure stays OWNER/ADMIN.
- Append-only authenticated actor/timestamp history, tenant isolation and backend-owned Decimal money. Preserve immediate sales, stock CAS/version guards, service/untracked semantics and reporting.
- User authorized local verified feature commits with tests/docs and feature-branch chain. No push/PR/merge, dependency upgrades or real DB migrations/seeds/resets authorized.
- Preserve unrelated staged `backend/reset-kevin-password.js` unread/unmodified/excluded from feature commits/review. Exact ambient target `sha256:9a4470e843e0dc50a6f909df75c6fce07aa242f299e80578cfc339d5af11053d` explicitly left unreviewed by user; this is not blanket RDD disable or a decline of loans commits.
- Local tools/client/build outputs authorized. Schema-only validate may temporarily use credential-free `postgresql://localhost/schema_validation`, restoring prior environment; never for connecting/migrating.

## Work units

| ID | Outcome | Status | Route |
| --- | --- | --- | --- |
| L0 | Restore backend tools without version changes | done (environment-only) | verifier/setup |
| L1 | Money creation/read, tenant/counterparty guards and creation history | done (runtime follow-up L7) | writer + verifier |
| L2 | Money collections, reversal, explicit closure/cancellation and safe retries | done (runtime follow-up L7) | writer + verifier |
| L3A | Tracking-only service debts using shared monetary servicing | in_progress (checks passed; commit/review pending) | writer |
| L3B | Reservation-aware availability/stock-consumer safeguards before lending endpoints | pending | writer |
| L3C | Returnable inventory loans, reservations, deliveries and returns using L3B safeguards | pending | writer |
| L4 | POS pending operation and atomic final sale | pending | writer |
| L5 | Loans UI/hooks/navigation/history/overdue filters | pending | writer |
| L6 | POS handoff UI, browser/regression checks and docs | pending | writer + verifier |
| L7 | Isolated PostgreSQL migration/trigger/FK/rollback/concurrency proof before delivery | pending (DB authorization needed) | verifier |

Units cross financial/multi-file boundaries and are delegated. L0 changed no versioned source. L3 split protects rollout: never expose reservation creation before all authoritative stock consumers honor it.

## Acceptance and checks

- L1: positive two-decimal amount, valid dates/input, exactly one same-org counterparty, real create/read guards; loan/event/AuditLog one transaction; no sales/inventory/report side effects.
- L2: derive balances from posted monetary events; reject overcollection/concurrent races, invalid terminal actions and unauthorized reversal; retain original collection and reasoned reversal; explicit zero-balance closure, no automatic sale.
- L3A: distinguish MONEY/SERVICE, preserve existing default MONEY requests and public contracts, record performed-service description/date/agreed amount using existing validated fields. Reuse monetary collection/reversal/closure without duplicate ledgers; no inventory/POS/sale/report changes. Keep physical table mappings stable; no speculative inventory-money unification.
- L3B/L3C: prevent over-reservation across sales/loans/absolute stock changes; preserve version/CAS; delivered cancellation cannot release units before recorded return. Track products using existing service/untracked rules; decide unresolved loanability policies before implementation.
- L4: fully paid/authorized explicit confirmation; atomic failure/retry/concurrency protections; immediate sale regression unchanged.
- L5/L6: accessible mobile/desktop UI, role/tenant/cache isolation; POS initiation only, Loans follow-up.
- L7: authorize isolated non-production DB first; prove migration apply, immutable history, FKs, rollback and real races. Mocks and schema checks are not runtime proof.
- Test-first now runnable: meaningful RED before new behavior, GREEN/refactor/recheck. L1 initial unavailable runner has no retrospective RED; formatting-only cleanup has no behavioral RED.
- Backend: `npm test -- --runInBand --testPathPatterns=src/loans/`, local Prisma validate/generate, scoped read-only eslint, build. Never auto-fixing backend `npm run lint` or unapproved broad DB suites. Stock work adds focused products/sales/purchase tests as mapped.
- Frontend Vitest commands derived from scripts before UI work; browser checks required.

## Delivery and decisions

- Branch `worktree-feat-loans-module`; cached `chain_strategy=feature-branch-chain`, `ask-on-risk`; do not repeat shape menu. Native review only normalized committed work-unit/slice, not full accumulated feature; RDD on globally unchanged.
- Initial base `d2c2eae6dc91e8ca3c156c473c73dda4d7e982d6`; last reviewed source boundary/next candidate base `923831cba0f1c5bde30b359806c7108837003460`.
- L1 feature +1143/-0 (commit +1206 including tracking). L2 writer +1278/-30 (commit +1321/-70 including tracking). Original total estimate1100–1800 was too low; refine remaining units. ~400-line heuristic advisory: no omitted tests/compression/artificial splitting.
- Before L4 user must choose price/tax/cost snapshot timing and changes after collections. Resolve collection/final-sale reporting without double count/general accounting expansion.
- Closed monetary loan reopening/refund semantics remain undecided; current implementation rejects new reversals after closure. Large-ledger aggregation is later work.

## Evidence

- File/full Engram mirror/read-back/todo preceded source implementation.
- L0 script-suppressed npm ci installed892 packages, lock/manifest hashes unchanged. Node24/npm11 local vs CI22; npm reported76 vulnerabilities, not remediated within feature.
- L1 commit `8f042b41decf73974a454e9e118b4e1fe2d583ab`; 60 focused tests, clean lint, schema-only validate and build pass. Initial RED unavailable. Committed-only lineage `review-dada5f7f9cb5a225` medium/review-reliability approved and exact acknowledgement burned authority. Informational database-invariants advisory deferred L7.
- L2 commit `923831cba0f1c5bde30b359806c7108837003460`; meaningful lifecycle RED21->GREEN97 and boundary RED9->GREEN131; final138 tests, schema/client/lint/build pass. Independent settled verifier mv089fz5-8-b2oz confirmed4 suites138/138 exit0. Lineage `review-52eea385c00a492a` approved/acknowledged/burned; informational lifecycle-database-proof advisory deferred L7, no correction/review replay.
- Both path-scoped commits preserved unrelated staged entry exactly; no push or DB mutations. Pure schema validation restored temporary environment; migrations unapplied.
- Reservation scout: sales decrement stock CAS without bumping version; manual stock edits absolute with version CAS; cancellation absolute stock restoration; purchase receiving stock/version CAS increase; imports create initial stock; service backfill pins stock+version and zeroes service stock. `available=true` includes services/untracked/positive raw stock, not reservations; enforce backend writers. Partial-sale-return status path does not restore stock.
- Current MoneyLoan/event persistence is monetary. L3A adds supported monetary discriminator, retaining mapped tables and existing MONEY semantics, not a duplicate collection engine. Inventory obligations later use quantity semantics separately.
- L3A writer completed9 files +307/-18 including17-line additive migration. Observed RED11 failed/186 passed -> GREEN197 -> final4 suites212/212. Local client generation/schema-only validate/scoped lint/build passed; whitespace checks clean. Old replay snapshots remain unchanged; new snapshots include type. No sales/stock/POS/report effects. SQL trigger runtime proof remains L7; deploying SERVICE records requires a data-safe rollback plan, not blind down-migration.

## Next step

Create scoped authorized L3A commit, assess and inspect/start committed-only candidate against923831cb, follow review transitions and run parent focused spot-check. Keep L3A in progress until settled check/commit/review evidence. Then plan L3B surfaces before writes; no reserve endpoints before authoritative consumers protected. Preserve L7 pending DB authorization and exact-target unreviewed dispositions.
