# Loans module — issue #209

Implement [#209](https://github.com/MeperDonas/MeperPOS/issues/209) in verified local feature-branch units. Domain/API details: `docs/loans.md`. This document is mirrored in Engram `odd/loans-module/tasks` (observation1011); historical details remain in feature-scoped observations.

## Authority and invariants

- Interest-free MONEY, physical inventory/equipment and SERVICE obligations; exactly one same-org customer/supplier/employee. Employees reuse `OrganizationUser` membership and users, not a new employee model.
- POS initiates pending operations only; Loans owns collections/returns/closure. Linked sales require explicit authorized atomic/idempotent completion. Independent obligations never automatically create sales/payments.
- OWNER/ADMIN administer; OWNER/ADMIN/CASHIER/MEMBER collect and complete linked sales. INVENTORY_USER excluded; independent money closure OWNER/ADMIN.
- Preserve tenant isolation, append-only actor/timestamp history, Decimal money, backend-derived prices/taxes/availability, immediate sales, CAS/version guards, service/untracked behavior and reports.
- Local verified work-unit commits authorized: `feature-branch-chain`, `ask-on-risk`. No push/PR/merge, dependencies/upgrades or real DB connection/migration/seed/reset.
- Preserve unread unrelated staged `backend/reset-kevin-password.js`, excluded from commits/reviews. Required index entry: `100644 9edba4b79e138b8127fae0e01a387d61be5c819c 0`. Exact ambient-target exclusions are in individual Engram observations, never blanket RDD exemptions. Cancelled746e1cee did not create consent/exclusion; de2f16d7 exclusion1105 applies to its exact hash only.
- Routine local client/dist output permitted. Guarded schema-only Prisma CLI uses temporary credential-free DATABASE_URL and DIRECT_URL, blocks dotenv/.env reads, restores original presence/value in finally. No DB connection. Require actual CLI execution, not require-only no-op.
- Test-first when runnable deterministic behavior exists; never manufacture historical RED. SQL text assertions prove declarations only. Read-only scoped ESLint, explicit DB-free specs and direct TypeScript; no backend `npm run lint` auto-fix or broad integration discovery. Preserve readable tests/docs; ~400-line heuristic advisory, no compression/artificial splitting.

## Tasks

| Unit | Outcome | Status |
| --- | --- | --- |
| L0 | Restore local verification tools | done |
| L1 | Money creation/read/history | done; DB L7 |
| L2 | Collections/reversals/closure/cancellation/replay | done; DB L7 |
| L3A | Independent service debts sharing monetary servicing | done; DB L7 |
| L3B-A | Reserved quantity/product edit guards | done; DB L7 |
| L3B-B | Sale/cancellation/backfill competing-stock safeguards | done; DB L7 |
| L3B-C | Server-derived availability/enrichment/filtering | done; DB L7/UI L6 |
| L3C-A | Physical-loan persistence/pure quantity invariants | done; DB L7 |
| L3C-B | Authorized physical creation/read/history/operation replay | done;878266a combined storage/service approved/acknowledged;467 tests; DB L7 |
| L3C-C | Atomic delivery/returns/cancellation/closure | in_progress; C-C-A vocabulary/pure close policy; explicit closure decisions resolved; rollout OFF |
| L4 | POS pending operations/atomic final linked sale | pending; pricing decision |
| L5 | Loans page/hooks/navigation/history | pending |
| L6 | POS handoff/browser/regressions/docs | pending |
| L7 | Isolated PostgreSQL migration/immutability/FK/rollback/races | pending; explicit authorization |

No operational physical-loan endpoint/module/controller export before L3C-C lifecycle gates. All migrations remain unapplied. Schema/client success and mocked transactions are not database proof.

## Current L3C-B scope and acceptance

1. Immutable completed operation/replay storage plus insert-time event correlation: schema, `20261009050000_inventory_loan_create_operations/migration.sql`, Prisma declaration spec and docs. Checked storage commit e508984; its initial medium review was deferred under budget, then included in the approved/acknowledged combined B slice through878266a. Never edit approved090400 foundation migration.
2. Unwired service/DTO/tests/docs: `backend/src/loans/inventory-loans.service.ts`, `backend/src/loans/dto/create-inventory-loan.dto.ts`, `backend/src/loans/inventory-loans.service.spec.ts`, `docs/loans.md`. Parent owns this task file/mirror. No schema/module/controller/route/POS/frontend/monetary ledger changes in service unit.
- Tenant-wide `(organizationId, requestKey)` uniqueness; CREATE type, authenticated actor and normalized payload must match. Other actor/key payload mismatch conflicts; tenants use independent namespaces.
- Completed immutable operation stores result snapshot atomically BEFORE correlated append-only events, then audit. No mutable pending placeholders/upsert or per-item request-key uniqueness. Correlation binds operation/loan/tenant/author; nullable links preserve foundation history.
- Validate active same-org administrative actor and exactly one active customer/supplier/employee membership. Distinct active tracked PRODUCT items, positive Prisma Int quantities; reject duplicate IDs and insufficient available stock.
- Serializable reservation CAS pins tenant/version/counters; increments reservedStock/version only, never physical stock. Create/read/history projections stay tenant-scoped, deterministic page/count predicates; no private replay payload leakage.
- Valid replay returns stored JSON-safe snapshot despite live changes; malformed snapshot fails closed with Conflict, no live fallback or extra effects. P2002/P2034 reconciliation occurs outside aborted transaction and accepts matching completed evidence only.
- Strict snapshot counterparty cardinality: exactly one NON-NULL nonblank string, other two strictly null. No coercion, stored-result mutation or live fallback. Service remains unwired/OFF.

## Current L3C-C work units and acceptance

- **C-C-A first:** lifecycle vocabulary and pure aggregate close plan only. Exact writer surfaces: `backend/prisma/schema.prisma`; new `backend/prisma/migrations/20261009060000_inventory_loan_lifecycle_vocabulary/migration.sql`; `backend/src/prisma/inventory-loan-migration.spec.ts`; `backend/src/loans/inventory-loan.invariants.ts`; `backend/src/loans/inventory-loan.invariants.spec.ts`; `docs/loans.md`; `backend/src/loans/inventory-loans.service.ts` ONLY the findAll read-status allowlist. Parent alone updates this task file/full mirror. Never edit approved090400/090500, CREATE/transaction/replay behavior or snapshots, DTO, module/controller, financial/POS/frontend code or dependencies. Preserve prior OPEN/CANCELLED read-filter acceptance explicitly instead of deriving it from all generated enum values; CLOSED query support remains deferred.
- Add CLOSED status and CLOSED header event (null item/quantity), operation discriminators DELIVER/RETURN/CANCEL/CLOSE alongside CREATE; preserve correlated operation/loan/tenant/author FKs and immutable history/result guards. Extend event-shape check additively for CLOSED without weakening existing event rules. No migration execution/database connection or runtime writer activation.
- User chose explicit CLOSED with partial fulfillment: require EVERY item outstanding=0 and AT LEAST ONE delivered unit across the loan. Untouched items are allowed when another item was delivered/returned. Zero-delivery loan uses CANCELLED, not CLOSED. Never automatic closure. Release undelivered reservation remainder through cancelledQuantity accounting only; preserve delivered/returned and physical stock. Input counts/Prisma Int bounds validated; nonempty aggregate, no mutation, return fresh planned counts/derived values/release quantities.
- Meaningful pure-policy RED/GREEN before implementation where runnable; a missing-export compile failure alone is not behavioral proof. Retain prior quantity tests, add multi-item partial/complete/all-zero/outstanding/invalid/overflow/input-immutability cases. DDL assertion RED is structural only. Explicit nine DB-free suites, direct tsc, scoped read-only lint, actual guarded credential-free Prisma validate/generate, whitespace/integrity/counts including new files. Do not claim production build, DB triggers/FKs/rollback/races, or historical checks not run. Independent verification follows native ASSESS plan.
- Initial C-C-A writer mv133tml-15-zwji stopped partial after actual guarded Prisma generation: pure-policy RED4 plus structural DDL RED4/34 passes -> GREEN42 -> focused64 after additional bounds/malformed/sparse/nonmutation cases (not individually RED). Nine-suite regression496 passed/1 failed: new generated CLOSED enum broadened unchanged findAll Object.values allowlist, breaking existing B rejection test917. Direct tsc0; scoped ESLint exit0 but seven unsafe-any warnings remain in helper Array.isArray narrowing. Actual guarded CLI validate/generate0/schema-valid/client6.19.2, both temporary credential-free URLs restored; frozen090400/090500 unchanged. Six source surfaces+310/-4; HEAD878266a/script metadata preserved. Unit incomplete, no commit/review or rollout.
- Parent spot confirmed service442-448 and authorizes exactly one compatibility guard in the seventh path above, preserving OPEN/CANCELLED behavior and strict CREATE snapshot. Clean helper warnings with explicit types (no lint suppression), correct docs, and rerun focused/full nine-suite/tsc/scoped lint and integrity. Existing failing regression is observed RED for this guard. This is a new candidate compatibility adjustment, not reopening B's burned approval or a native correction route.
- **C-C-B later:** transactional delivery/return; **C-C-C later:** atomic cancel/close, terminal claim and replay. Vocabulary must precede these writers. Derive narrowed service/DTO/spec surfaces at each boundary, preserve CREATE operation-specific validation. Audit completed operation before correlated events and audit in one Serializable transaction; post-abort reconciliation only. Physical modification policy OWNER/ADMIN, no CASHIER collection-role inheritance.
- Movement integration is a separate follow-on/gate before operational rollout: do not mislabel physical loans as SALE/RETURN. Loan-specific movement types/linkage impact reports/export/frontend/regression and require bounded scope review before expansion. Loan events remain canonical loan audit; no movement/report/frontend edits in C-C-A. Native R3-snapshot-payload-consistency remains separate nonblocking follow-up; never reopen B.

## C-C-A normalized verification

- Continuation mv13hkrw-16-uffh completed seven source surfaces+314/-5 (319 changed lines), including090600. Read guard only+2/-1; compatibility RED135pass/1fail -> GREEN136 unchanged service tests. Focused pure/DDL64; final nine DB-free suites497/497, direct tsc/four-file lint0 errors0 warnings; helper typed callback fixed all seven warnings. Actual guarded Prisma validate/generate earlier0 reused because schema unchanged, not rerun. Rollout OFF, migrations unapplied.
- Independent mv13mxne-17-c1rd repeated497/tsc/lint0, checked aggregate minimum delivery/every-item returned/remainder release/fresh results, actual InventoryLoanEvent_shape constraint/header-only CLOSED/prior positive item shapes, additive vocabulary and sole read-guard compatibility. Frozen090400/090500 and HEAD878266a/script index unchanged. Whitespace tracked0/new-migration difference1 without diagnostics; LF/CRLF advisories only. Parent spot checked pure helper.
- Fresh independent Prisma validation was BLOCKED/NOT ATTEMPTED: safe dotenv/environment isolation was not established. Writer's actual earlier CLI validation/generation remains supplied evidence only, never relabelled independent. Actual SQL execution/PostgreSQL-version/FK/trigger/rollback/race proof remains L7. C-C-A awaits checked scoped commit/normalized native assessment; whole C-C remains incomplete.

## Completed units and evidence

Branch `worktree-feat-loans-module`; initial base `d2c2eae6dc91e8ca3c156c473c73dda4d7e982d6`.

| Unit | Commit | Observed checks / native review |
| --- | --- | --- |
| L0 | tooling only | script-suppressed ci892; lock/manifest unchanged; Node24/npm11 vs CI22;76 vulnerabilities unremediated |
| L1 | 8f042b41decf73974a454e9e118b4e1fe2d583ab |60 tests/schema/client/lint/build; RED unavailable; review-dada5f7f9cb5a225 approved/acknowledged/burned |
| L2 | 923831cba0f1c5bde30b359806c7108837003460 | behavioral RED/GREEN; independent138/schema/client/lint/build; review-52eea385c00a492a approved/acknowledged/burned |
| L3A | dc3c43c6fdbf5e9d1f6e3326f9a895e8939363bc | RED11 ->197 -> independent212; snapshots preserved; review-4d88bb6e3fba0fb2 approved/acknowledged/burned |
| L3B-A | 6ab922e491afb95a54d1f709a1758f2d621f8c6b | RED21 ->137 ->146 product/212 loan; Prisma/tsc/new spec lint0; legacy62 errors76 warnings; review-2162a36fbfbab9af approved/acknowledged/burned |
| L3B-B | 52d31e0b8543d8520214a61820ad91b3c41ac5ed | RED14/24 and cancellationRED3 ->81 -> independent476; tsc0; unchanged lint60 errors75 warnings/no new diagnostics; review-aa266f0c02373be4 approved/acknowledged/burned |
| L3B-C | a428bf8b46c98054e92f6c913f6c91312b105870 | recoveryRED17/159 ->200 ->530; helper46 independently; tsc0/new lint0, legacy53 errors77 warnings; review-df4c2b36a9ec69dc approved/acknowledged/burned |
| L3C-A | 84b0861ae4ac4c9cec1fce516b0d6e6bbcf5b60e | behavioralRED26 ->26 ->29; independent326/tsc/lint/actual guarded Prisma validation, writer generation0; review-d6ea0f090677e40e approved/acknowledged/burned |
| L3C-B storage | e508984873d576e56709e65919465958dd2d317d | structuralRED5/29 ->34 -> independent331/tsc/lint/actual guarded Prisma validation; writer generation0; normalized ASSESS medium306/reviewDue=false/under_budget; inspect ready, no START/lineage; review DEFERRED |

All commits path-scoped; script index preserved, migrations unapplied. Approved review IDs above are burned: never replay. No reported advisories on C-A/B-C approvals; persistent DB-proof advisories remain L7. Full production build not claimed from direct tsc; legacy lint failures not hidden. Original1100–1800 feature estimate was too low.

## L3C-B service: observed implementation and recovery

- Initial writer mv0il00l-w-dugk: meaningful validation RED2 -> GREEN2; expanded87 tests were POST-implementation. Partial tsc0/lint398 failures; docs/regression pending.
- Normalization mv0iu1bp-x-qcd9: approved local Prettier only three new TS files plus enum-typing fixes, no suppressions/test removal. Four-file unit+1549/-2,87 cases; nine explicit DB-free418/tsc/new-file lint0/whitespace clean; docs completed. No wiring/schema changes.
- Independent mv0iyp8q-y-92xp repeated418/tsc/lint0, but found deterministic service165-170 gap: valid customerId plus supplierId="" plus employeeId=null accepted as immutable replay. Commit withheld. Parent spot inspection confirmed; not a native verdict.
- Correction writer mv0j5cen-z-ycwj failed with generic assistant error; cause and historical commands unknown. Preserve partial work, no rollback. Read-only incident mv11vnyf-10-yavn found exact regression saved at spec661-677 and unchanged service. Actual newly observed RED87pass/1fail/88total, lint0; subsequent no-effects assertions were not reached on RED. Unit+1566/-2; HEAD/script metadata unchanged.
- Recovery writer mv120pp0-11-r6eu preserved test, reconfirmed RED87/1, added symmetric cases BEFORE fix: RED126pass/10fail/136total -> GREEN136. Fixed service165-172 strict non-null/nonblank cardinality; correction vs prior completed writer+68/-2, full unit+1615/-2 (service538/spec939/DTO51/docs87/-2). Final nine DB-free467/467, direct tsc/new three-file lint/authorized two-file formatting0, whitespace clean. Valid three-counterparty replays preserved; no effects/store mutation/live fallback.
- Independent final mv126415-12-ib7o repeated nine suites467/tsc/lint0; confirmed exact regression,45 symmetric corruption cases spec678-710,3 valid controls711-724 and reached no-effects/unchanged-store/no-live-fallback assertions.49 new +87 retained =136 service cases; historical retention is count/inspection consistency, not byte comparison. No new deterministic blocker in bounded correction. Parent spot checked strict predicate.
- Native pending-tree ASSESS unassessable due untracked declaration, RDD on/native outcome unknown => HIGH independent verifier required; final independent check above satisfied functional fallback. Scoped commit **878266a8843a6dc43fa91edb96a18acbcd71d755**, `feat(loans): add unwired inventory creation and immutable replay`: five files+1687/-77 including tracking; source four+1615/-2, staged script excluded/preserved.
- Normalized committed slice84b0861..878266a included deferred storage e508984: medium8files2028lines, reviewDue=true/slice_budget_reached. Inspect target sha256:02525b0946f0a977be83f30c4773b96d252b643c8c1f7fa5755bdae824cef5ea excluded the unrelated script. Host handled eligible START consent; no unresolved envelope/model-authored answer. Consolidated reliability review **review-b0e5569397924b64** approved; exact facade acknowledgement returned **burned** authority, consumed revision sha256:1dffdbbc578f5c25467d6926533f030586171d6013eea1a726612fbf748db9e0. No STATUS after burn. One informational nonblocking WARNING **R3-snapshot-payload-consistency** at service165-172 is separate follow-up; receipt stands, no correction transition/re-review offered.
- An initial acknowledgement call with controller-only input was rejected before mutation; the returned continuation required the exact lineage without input and succeeded. Do not reconstruct opaque bindings or replay burned authority. This approval closes B scope, not deployment, delivery or PostgreSQL proof.
- Final HEAD before service commit e508984; unread script metadata unchanged, no extra schema/module/controller/wiring surfaces. DTO/docs line-count consistency is not historical byte-level proof. Whitespace new-file diff exit1 means differences only when diagnostics absent; CRLF warnings only. Schema/client earlier evidence reused, not rerun.
- Mocks prove local staged rollback only. Forced CAS failure is NOT an interleaving test; existing-record reconciliation is NOT a concurrent-winner test. Real PostgreSQL rollback/FK/trigger/race proof remains L7.

## Remaining decisions and gates

- Physical accounting approved: creation reserves without reducing stock; explicit delivery consumes stock AND reservation; return replenishes stock ONLY. Cancel releases undelivered reservations; delivered units need recorded returns before cancellation/closure. Derived reserved remaining=quantity-delivered-cancelled; outstanding=delivered-returned. Strict integer bounds. Explicit CLOSED permits partial fulfillment with atomic remainder release ONLY after at least one unit was delivered and every delivered unit returned; never-delivered loans use CANCELLED (user decisions1126/1129).
- L4 needs creation-time vs completion-time price/tax/cost snapshot decision and rules after collections. Avoid collection/final-sale double counting. Closed monetary reopening/refund unspecified; closed reversal rejected.
- L6 consumes backend availableStock in frontend product types/hooks/POS/inventory/ProductCard. Physical stock/isLowStock/reporting unchanged; service/untracked availability null. Frontend audit/browser checks pending.
- L7 requires explicit isolated non-production PostgreSQL authorization for actual migrations/checks/FKs/triggers/immutability/rollback/reconciliation/locking/races and deployed SERVICE-safe rollback. Never run broad *.int.spec.ts or connect to the real DB.

## Next step

Close the independently checked C-C-A foundation with a path-scoped commit and normalized native assessment, honestly recording blocked independent Prisma revalidation; then map the transactional delivery/return unit. All transactional lifecycle writers/endpoints remain OFF. B is verified/approved/acknowledged; next committed-only review base **878266a8843a6dc43fa91edb96a18acbcd71d755**, NEVER accumulated branch or unrelated staged script. Movement integration and R3-snapshot-payload-consistency are separate follow-ons, not a reopening of B or scope creep into this foundation. RDD on; L4 pricing and L7 isolated DB authorization remain separate. No push/PR/merge or actual PostgreSQL proof claimed.
