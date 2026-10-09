# Loans: audited servicing and reserved inventory

Implement [issue #209](https://github.com/MeperDonas/MeperPOS/issues/209) through checked feature-branch work units. Money and independent service servicing are complete; inventory/POS/UI remain pending.

## Scope and safety

- Interest-free MONEY, registered physical inventory PRODUCTS/EQUIPMENT, and SERVICE obligations. Exactly one same-org customer/supplier/employee counterparty; employees reuse organization users, other people are customers.
- POS initiates pending operations/reservations only. Loans owns collections, returns and closure. Fully paid plus explicit confirmation creates the linked final sale, consumes reservations once, closes and audits atomically/idempotently. Independent money/equipment never auto-create sales; independent service debts are tracking-only.
- OWNER/ADMIN create/administer/modify/cancel/reverse. OWNER/ADMIN/CASHIER/MEMBER collect and finalize paid linked sales; INVENTORY_USER excluded. Independent monetary closure remains OWNER/ADMIN.
- Tenant isolation, actor/timestamp-attributed append-only history and backend-owned Decimal money. Preserve immediate sales, stock CAS/version, service/untracked semantics and reporting.
- User authorized local verified work-unit commits and `chain_strategy=feature-branch-chain`, `ask-on-risk`. No push/PR/merge, dependency upgrades, real DB connection/migration/seed/reset authorized.
- Preserve unrelated staged `backend/reset-kevin-password.js` unread/unmodified/excluded from commits/reviews. Exact ambient targets explicitly left unreviewed: `sha256:9a4470e843e0dc50a6f909df75c6fce07aa242f299e80578cfc339d5af11053d`, `sha256:8a39c025148f1a42877f6e48f5d8583c35f7d95a2921a183030f58e4ab0bcd5c`, `sha256:54fdb2d6f72bf1e2837a2716129e109075e56d66db1a956e1f36cb9f56dc695c`. Not blanket RDD disable/consent decline; no exclusion inferred for changed hashes.
- Local tools/client/build outputs allowed. Schema-only validation may temporarily use credential-free `postgresql://localhost/schema_validation`, restoring prior environment; never connect/migrate.

## Work units

| ID | Outcome | Status | Route |
| --- | --- | --- | --- |
| L0 | Restore tools without version changes | done | verifier/setup |
| L1 | Money creation/read/counterparty guards/history | done; runtime L7 | writer + verifier |
| L2 | Collections/reversals/explicit closure/cancellation/retries | done; runtime L7 | writer + verifier |
| L3A | Independent service debts using monetary servicing | done; runtime L7 | writer + verifier |
| L3B-A | Reserved quantity schema and product edit/deactivation safeguards | in_progress; checks settled, commit/review pending | writer + verifier |
| L3B-B | Protect sales/cancellation and remaining stock writers | pending | writer |
| L3B-C | Reservation-aware enrichment/search/availability classification | pending | writer |
| L3C | Inventory quantity ledger/reservations/delivery/returns | pending | writer |
| L4 | POS pending operations and atomic linked final sale | pending | writer |
| L5 | Loans UI/hooks/navigation/history/overdue filters | pending | writer |
| L6 | POS handoff UI/browser/regression checks/docs | pending | writer + verifier |
| L7 | Isolated PostgreSQL migration/trigger/FK/rollback/concurrency proof | pending; authorization needed | verifier |

Keep reservation creation disabled until all L3B units are checked. Split implementation, never trim necessary tests or compress code to satisfy the advisory ~400-line review heuristic.

## Acceptance and decisions

- L1/L2: validated positive two-decimal amounts/dates/counterparty; loan/event/AuditLog transactional; guards, Decimal balances, overcollection/concurrent-race rejection, original posted collections retained with reasoned reversals, explicit zero-balance closure. Closed-loan reopening/refund semantics undecided; reject new closed reversals.
- L3A: strict MONEY/SERVICE discriminator; omission defaults MONEY; reason/issuedAt/amount represent performed-service description/date/agreed debt. Reuse monetary lifecycle, stable physical MoneyLoan/event mappings. New audit/replay snapshots include type; existing snapshots unchanged. No sale/Payment/stock/POS/revenue/report effects.
- L3B-A: `Product.reservedStock` default zero with DB nonnegative/bounded constraints. Product absolute stock edits retain version CAS and reject stock below reserved; reject service/untracked conversion and deactivation while reserved. Preserve increases. No reservation endpoints or unapproved consumer/frontend/report changes.
- L3B-B: sales subtract only unreserved stock and increment version; cancellation restoration must be transactional/version-safe, not overwrite edits. Audit purchase/import/backfill writers, modifying only where needed. Preserve partial-return no-restock behavior. No reservation writers yet.
- L3B-C: physical on-hand `stock` remains unchanged in meaning; server derives available quantity through enrichment/search. Preserve service/untracked eligibility. Explicitly preserve or decide low-stock classification contract before changes; no revenue/report math changes.
- L3C: tracked active physical inventory only, no speculative `isLoanable`; durable per-loan quantity ledger separate from monetary tables, updated atomically with counter. Idempotent reserve/release/consume; consistency/reconciliation checks. Delivered cancellation cannot release units without recorded return.
- Before L4 user must choose creation-time versus completion-time price/tax/cost snapshots and handling changes after collections. Prevent collection/final-sale reporting double count; no general accounting expansion.
- L5/L6: accessible mobile/desktop UI, authorization/tenant/cache isolation, POS initiation only; browser checks required.
- L7: authorize isolated non-production DB first. Prove migrations, immutable history/type, FKs, rollback and actual races; mocks/schema checks are not runtime proof. Deployed SERVICE rows require a data-safe rollback plan.

## Checks and commit evidence

Branch `worktree-feat-loans-module`; initial base `d2c2eae6dc91e8ca3c156c473c73dda4d7e982d6`. Next source review base `dc3c43c6fdbf5e9d1f6e3326f9a895e8939363bc`, not accumulated feature branch. Native RDD remains on; approved/burned candidates are not reopened.

- Tracking file/full Engram mirror/read-back/todo precede source writes. Delegated multi-file work uses test-first now runnable. L1 initial runner unavailable; no retrospective RED. Formatting-only edits have no meaningful behavioral RED.
- L0 script-suppressed npm ci installed892 packages; manifest/lockfile hashes unchanged. Node24/npm11 local vs CI22;76 vulnerabilities reported, no remediation attempted.
- L1 `8f042b41decf73974a454e9e118b4e1fe2d583ab`:60 tests, schema/client/lint/build pass; feature +1143/-0, commit +1206 including tracking. `review-dada5f7f9cb5a225` approved/acknowledged/burned. Informational database-invariants proof pending L7.
- L2 `923831cba0f1c5bde30b359806c7108837003460`: observed lifecycle RED21->GREEN97, boundary RED9->GREEN131; final138 tests plus independent4/4 suites138/138 exit0. Schema/client/lint/build pass; feature +1278/-30, commit +1321/-70. `review-52eea385c00a492a` approved/acknowledged/burned; informational lifecycle database proof pending L7.
- L3A `dc3c43c6fdbf5e9d1f6e3326f9a895e8939363bc`:9 source/docs files +307/-18 including17-line migration, commit10 files +352/-62. Observed RED11 failed/186 passed -> GREEN197 -> final212/212; independent verifier mv0b3bzl-b-zvqi4/4 suites212/212 exit0. Schema/client/scoped lint/build/whitespace pass. `review-4d88bb6e3fba0fb2` medium/review-reliability approved; exact acknowledgement returned burned authority. ASSESS derives closed/consumed/already_reviewed. Informational `R3-type-immutability-proof` at migration16-17 pending L7, no correction offered.
- L3B-A source7 files +512/-8, including372-line reservation spec and9-line migration. Observed RED21 failed/9 passed -> GREEN137 -> final4 product suites146/146 plus4 loans suites212/212. Independent verifier mv0bpth6-f-a25o confirmed Prisma generate/schema validate/direct TypeScript compile and both test groups pass. Type-only cleanup mv0bxj86-g-p3jo removed10 new warnings, retained39 assertions/tests; spec eslint0 errors/warnings and tests/compile re-passed. Other-file raw lint still fails with62 pre-existing errors/76 warnings, exact-HEAD delta verified; no new diagnostics. Full npm production build intentionally skipped (dotenv prebuild/Nest output cleanup), direct TypeScript build passed. SQL bounds/eligibility only structurally checked; runtime proof L7. Reservation writes remain disabled.
- All scoped commits excluded/preserved unrelated staged entry exactly. Migrations unapplied. Original1100–1800-line feature estimate too low; refine each unit.
- Scout mv0b3rdd-c-4yo8: choose guarded reservedStock counter operational boundary, later separate ledger/reconciliation. Sales stock CAS currently no version increment; cancellation absolute restoration; manual edits version CAS; purchase receiving versioned increment; imports initial create; service backfill zeroes stock/version CAS. Availability/low-stock/search currently raw stock; all authoritative consumers must be safe first.

## Verification commands

Backend focused `npm test -- --runInBand --testPathPatterns=src/loans/`; L3B adds only mapped DB-free products/sales/purchase/import/backfill specs. Local Prisma generate/schema-only validate, scoped read-only eslint, build and whitespace checks. Never backend auto-fixing `npm run lint` or unapproved broad DB suites. Derive frontend scripts before UI work.

## Next step

Commit and review normalized L3B-A against dc3c43c6, retaining honest baseline lint/production-hook/runtime caveats. Then map L3B-B exact stock-consumer/test surfaces before writes. No inventory loan/POS/reservation endpoints before all L3B phases protected. Do not replay approved units; no real PostgreSQL proof claimed.
