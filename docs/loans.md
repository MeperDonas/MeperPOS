# Monetary obligations: money and performed-service tracking

The L1–L3A backend slices of issue #209 track interest-free MONEY and SERVICE obligations independently
of POS, sales, inventory and financial reports. Partial/full collections update a
backend-derived balance; full payment does **not** close a loan. An administrator
must explicitly confirm closure. Corrections preserve original payments through
separate reversal events, never destructive edits.

## API quick path

Use the existing authenticated cookie session and CSRF protection for mutations.
All routes are under `/api/loans` and require an organization scope.

| Method and path | Permission | Result |
| --- | --- | --- |
| `POST /api/loans` | OWNER, ADMIN | Create a standalone MONEY or SERVICE obligation |
| `GET /api/loans` | OWNER, ADMIN, MEMBER, CASHIER | Paginated loans |
| `GET /api/loans/:id` | OWNER, ADMIN, MEMBER, CASHIER | One scoped loan |
| `GET /api/loans/:id/history` | OWNER, ADMIN, MEMBER, CASHIER | Paginated history of all transitions |
| `POST /api/loans/:id/collections` | OWNER, ADMIN, MEMBER, CASHIER | Partial/full abono |
| `POST /api/loans/:id/collections/:paymentId/reverse` | OWNER, ADMIN | Reverse one collection, with a reason |
| `POST /api/loans/:id/close` | OWNER, ADMIN | Confirm closure only when balance is zero |
| `POST /api/loans/:id/cancel` | OWNER, ADMIN | Cancel only when net collections are zero |

INVENTORY_USER cannot use these routes. Permissions come from the existing
backend role hierarchy, not a frontend check. SUPER_ADMIN retains the existing
role-guard bypass and organization-selection interceptor; select a tenant with
`x-organization-id` (or the existing `organizationId` query selector). Missing
scope fails closed, never producing a cross-organization list. Ordinary operators
cannot change their authenticated organization using that selector or the body.

### Create request

```json
{
  "amount": 120.25,
  "issuedAt": "2026-10-09",
  "dueAt": "2026-11-09",
  "reason": "Anticipo acordado",
  "counterpartyType": "CUSTOMER",
  "counterpartyId": "00000000-0000-4000-8000-000000000001"
}
```

| Field | Contract |
| --- | --- |
| `type` | Optional `MONEY` or `SERVICE`; omission defaults to `MONEY`; null, booleans and inventory types reject |
| `amount` | JSON number, 0.01–99,999,999.99; at most two fractional digits; no numeric-string coercion |
| `issuedAt` | Required valid calendar date, exactly `YYYY-MM-DD` |
| `dueAt` | Optional calendar date; cannot precede `issuedAt`; omission/null means no due date |
| `reason` | Required string, trimmed, 1–500 characters after trimming |
| `counterpartyType` | Exactly `CUSTOMER`, `SUPPLIER` or `EMPLOYEE` |
| `counterpartyId` | One UUID matching that type; no additional counterparty fields |

Customer and supplier records must be active and belong to the selected
organization. An employee is an existing active User with an OrganizationUser
membership in that organization; there is no separate employee directory.
Tenant and actor fields are not accepted in the create body.

### Performed services (tracking only)

Send `type: "SERVICE"` with the same create fields. `reason` describes the
performed service, `issuedAt` is its performance date, `amount` is the agreed
monetary debt, and `dueAt` is its optional payment deadline. The same validated
same-organization customer/supplier/employee is the counterparty. For example,
use `reason: "Reparación realizada"` with the service date and agreed amount.
There is no service catalog, quantity, interest or automatic price calculation.

SERVICE uses the identical collection, reversal, explicit zero-balance closure,
cancellation and authenticated history pipeline as MONEY. Neither creation nor
collection creates a Sale, sale Payment, stock movement, POS operation, revenue
or financial report entry. This is debt tracking, not invoicing or recognition of
service revenue; conversion to a sale is not supported.

### Read responses

Creation, list and detail return `type` (`MONEY` or `SERVICE`) and `status` (`OPEN`, `CLOSED`, `CANCELLED`),
`paymentStatus` (`UNPAID`, `PARTIAL`, `PAID`), `collected` and `balance`.
The two totals are fixed-two-decimal strings derived from collection events minus
reversal events; the client must not compute authoritative money. A cancelled
loan keeps its original unpaid balance as historical evidence, not a write-off.

Creation and detail also return the loan's ID, amount, dates, reason, counterparty
foreign keys and creation actor/timestamp. Exactly one of `customerId`,
`supplierId`, `employeeId` is populated. Related customer/supplier/employee/actor
projections contain only `id` and `name`; no user credentials, email or membership
objects are returned. Prisma Decimal amounts serialize as strings, without
client-side arithmetic or conversion to floating-point response totals. Date
columns serialize as UTC-midnight ISO timestamps.

List and history accept `page` (default 1, maximum 1,000,000) and `limit` (default
20, maximum 100), returning `{ data, total, page, limit, totalPages }`. Loans are
ordered newest-first; history is oldest-first, both with an ID tie-breaker.
List additionally accepts an optional `type=MONEY` or `type=SERVICE` filter;
its rows and count always retain the authenticated tenant scope and pagination
bounds. Omission lists both monetary types; unsupported types reject.
Unknown and foreign-organization IDs both return 404, including on history.
History includes `CREATED`, `COLLECTED`, `REVERSED`, `CLOSED` and `CANCELLED`
events with reason, actor and timestamp. Monetary events expose `amount`, collection
`method`, and reversal `reversesId`; the collection event ID is the `paymentId` used
in a reversal path. Request payloads and internal replay snapshots are not exposed
in read history. There are no principal/counterparty update, delete or history-edit
endpoints.

## Collect, correct and close

1. Send a collection body such as
   `{ "requestKey": "abono-1", "amount": 40.25, "method": "CASH" }`.
2. Read the server's balance; repeat collections until it is `"0.00"`.
3. OWNER/ADMIN sends `{ "requestKey": "close-1" }` to `/close`.

Collection amounts use the same strict JSON-number and two-decimal bounds as
creation. Methods reuse `CASH`, `CARD`, `TRANSFER`; they do not create a sale
`Payment`, cash-register movement, sale, expense or report entry. New mutation results
are `{ type, loanId, eventId, status, paymentStatus, collected, balance }`.
Creation audit metadata and new servicing audit/replay snapshots include `type`.
Pre-L3A stored replay responses remain unchanged on exact retry; their loans are
MONEY by migration default.

To correct an abono on an OPEN loan, send
`{ "requestKey": "reverse-1", "reason": "Corrección de abono" }` to its reversal
path. The reversal negates the original amount, once, while preserving the original
event. It does not execute a bank/cash refund. Cancellation takes the same reason
body and requires no net posted collections; otherwise it returns an actionable
409 asking the administrator to reverse collections first. Reasons are required,
trimmed strings of 1–500 characters. Cross-loan/tenant reversal targets return 404.

### Retries and final states

Every **L2** mutation requires a caller-generated `requestKey`: a nonblank raw
string of 1–100 characters. Keep it unchanged on retry. Keys are scoped to tenant
and loan, shared across operation types, and bound to the authenticated actor and
normalized operation payload. Exact replays return the original stored result,
even after later transitions. Reuse with another payload or actor returns 409;
no extra collection, history event or audit entry is written.

Concurrent conflicts return 409 with instructions to retry the same key. Re-read
the loan when deciding a new amount; never automatically issue a new key after an
uncertain response. L1 loan creation remains non-idempotent.

CLOSED/CANCELLED loans reject all **new** collections, reversals and transitions.
Closure never creates an independent-loan sale. There is no reopen or refund
workflow: correcting a closed loan needs a separate product decision, not a silent
reopen. Principal and counterparty identity remain immutable, including after all
collections are reversed.

## Persistence and review checks

Counterparty validation, loan creation, the append-only creation event and the
existing `AuditLog` entry (`LOAN_CREATED`, resource `MoneyLoan`) use one serializable
Prisma transaction. An event or audit failure must abort creation. Actor IDs are
taken from authentication. Serialization conflicts are surfaced rather than
silently retrying a non-idempotent create request; duplicate submission prevention
is not part of L1.

The L1 migration adds only MoneyLoan and MoneyLoanEvent plus their existing-model
relations. SQL checks enforce a positive amount, date ordering, a nonblank reason
and exactly one counterparty. A composite event foreign key enforces agreement
with the loan's tenant. An SQL trigger rejects history updates/deletes. Restrictive
foreign keys retain loan history when someone tries to hard-delete its referenced
organization, counterparty or actor; existing soft-deactivation remains possible.
Customer/supplier tenant ownership and employee membership are validated by the
service inside the transaction, not by additional directory models.

L2 uses the existing append-only MoneyLoanEvent table as its monetary ledger. A
single Serializable transaction reads the scoped ledger, checks balance/state,
compares-and-swaps the loan's `version` and OPEN status, appends the event/replay
snapshot, and appends `AuditLog` (`LOAN_COLLECTED`, `LOAN_REVERSED`, `LOAN_CLOSED`,
`LOAN_CANCELLED`). All competing mutations contend on the same loan row. There is
no separately stored balance to drift from history. Event/audit failure propagates
and must roll back the entire transaction in PostgreSQL.

The additive L2 migration adds status/version and event money/replay columns;
unique keys prevent duplicate requests and multiple reversals. A composite self-FK
keeps reversal evidence in the same loan and tenant. Shape checks distinguish
creation, collection, reversal and transition records. The L1 append-only trigger
remains unchanged; an additional trigger protects principal/counterparty identity.
Balance/state enforcement and reversal target type/amount validation are service
invariants, not claimed as general SQL protection against arbitrary direct writes.

Review the DTO and real RolesGuard metadata tests first, then the transaction and
tenant-filter tests, and finally the schema/migration pair. SQL checks and the
append-only trigger are migration-owned invariants not expressible in Prisma's
schema. Do not replace this migration with a schema-only database push.

L3A adds only the supported monetary enum and a default-MONEY discriminator to
MoneyLoan, plus an independent immutable-type trigger. MoneyLoan/MoneyLoanEvent
names and ORM mappings stay stable; reviewed migrations, existing identity and
append-only constraints remain unchanged. Existing rows become MONEY without
rewriting history or audit. Decimal totals are valid for both monetary types;
future quantity-based inventory obligations must not use this presenter/ledger.

## Reservation foundation (L3B-A; not operational)

`Product.stock` still means physical on-hand units. The additive migration adds
`reservedStock Int @default(0)` with SQL checks requiring
`0 <= reservedStock <= stock`; positive reservations require an active, tracked
`PRODUCT` (the physical product enum also covers equipment). SERVICE, untracked
and inactive rows must have zero reservations. Existing rows receive zero; a
negative existing stock fails migration validation instead of being rewritten.
Deployment preflight and actual constraint enforcement remain L7 checks.

Product edits retain version CAS and additionally compare the read reservation
quantity and tenant in the conditional write. With reservations, stock equal to
or above the counter and unrelated edits remain allowed; reductions below it,
service/untracked conversion, `update(active: false)`, dedicated deactivation and
hard deletion return 409. Deactivation/deletion also guard version and reservation
quantity; a stale snapshot conflicts before any inventory movement is written.
Missing or inconsistent reservation counters fail closed, never default to zero.
Product create/update reject caller-supplied `reservedStock`; no DTO accepts it.

**Reservation writes remain disabled.** There is no reserve/release/consume API,
operational quantity ledger or inventory-loan API. L3B-B protects stock consumers
and L3B-C adds server availability as described below; neither enables reservation
creation or changes POS or reporting.
Later L3C owns a separate per-loan quantity ledger updated atomically with this
counter, not the monetary ledger or a generic inventory/accounting engine.

Review the additive schema/migration pair and the product reservation tests with
the existing product/service semantics suites. SQL text assertions and mocked
conditional writes do not prove deployed constraints or PostgreSQL concurrency.
Before deployment, L7 must prove migration preflight, invalid writes, real races
and rollback. This unapplied slice can be rolled back as one schema/migration,
product guards/tests and documentation unit; once deployed, removing a populated
counter requires a separately approved data-safe rollback plan.

## Stock-consumer safeguards (L3B-B; reservations still disabled)

Immediate sales can consume only `stock - reservedStock` for tracked physical
products. Inside the existing Serializable transaction, each line reads the live
counter/version and conditionally decrements stock while incrementing version.
The predicate pins tenant, active tracked PRODUCT eligibility, observed version,
observed reserved quantity and `stock >= reservedStock + quantity`. A stale or
insufficient snapshot returns a conflict; reservations are never consumed here.
Prices, tax, cost snapshots, payments and override audits keep their existing
semantics. SERVICE and untracked lines still have no inventory effects.

Cancellation first conditionally claims the same-tenant COMPLETED sale inside
its effect transaction. A losing/repeated cancellation retains the existing
completed-sale error and cannot restock. Each tracked line uses an atomic stock
increment plus version increment, guarded by tenant, observed version and
reservation quantity. A failed restock aborts the transaction, including the
status claim and any earlier movements; no stale absolute stock write remains.
RETURNED_PARTIAL continues to change status without restocking. This does not
introduce a refund, reopen or inventory-loan cancellation policy.

The service backfill pins live tenant/stock/version and requires exactly zero
reservations before conversion to SERVICE/stock zero. Positive or missing
counters refuse conversion; a changed counter fails the tested CAS predicate.
It performs no reservation repair. Purchase receiving already uses versioned
atomic increments, and product imports delegate to product creation.

Review sale CAS predicates, cancellation claim-before-effects tests, then the
pure backfill guard consumed by the CLI. DB-free mocks prove predicate structure
and transaction failure propagation, **not** real concurrent locking or database
rollback. No backfill CLI or PostgreSQL operation was run for this slice. L7
still owns those proofs. Rollback boundary: sale safeguards/tests, the backfill
guard/CLI wiring/tests and this documentation; retain the L3B-A schema/product
guards and keep all reservation writers disabled.

## Server-owned availability (L3B-C; reservations still disabled)

Product create/update/list/detail, search, quick-search and low-stock responses
add `availableStock: number | null`. One backend helper derives tracked PRODUCT
availability as `stock - reservedStock`; SERVICE and untracked merchandise return
`null` (no finite inventory), not zero. Actual persisted type, tracking flag,
physical stock and reservation counter are required. Missing, non-integer,
negative or over-reserved inputs fail closed, never default or clamp.

`available=true` filters tracked rows with the Prisma field-reference predicate
`stock > reservedStock`; SERVICE and untracked rows remain eligible even at zero
physical stock. Tenant, search, category, type, IDs and physical low-stock filters
are composed before both paging and count. Omitting availability or passing false
keeps the previous list eligibility.

This is additive: physical `stock`, `isLowStock`/`minStock`, the raw SQL physical
low-stock predicate, prices, effective tax/promotion fields and Decimal handling
are unchanged. Thin search payloads keep their prior keys; raw low-stock rows keep
`categoryName` and all stored fields. Revenue reports are not modified.

**L6 frontend handoff:** update Product types/hooks and POS, inventory and
ProductCard consumers to read the server field, distinguish null from zero, and
avoid client subtraction. No frontend or complete UI availability audit is part
of L3B-C. Reservation writers stay disabled pending L3C and checked consumers.

DB-free tests cover all seven response paths, helper validation, field-reference
selection and pagination/count parity. They do not prove PostgreSQL field-reference
execution, locking or constraints; L7 retains those proofs. Rollback boundary:
this availability helper/wiring, its product contract tests/fixtures and this
section; preserve the L3B-A/B guards and keep reservation writers disabled.

## Physical-loan foundation (L3C-A; UNEXPOSED)

InventoryLoan, InventoryLoanItem and InventoryLoanEvent are separate from the
MONEY/SERVICE monetary ledger. This slice adds persistence declarations and pure
quantity rules only: **reservation writers remain OFF**, with no inventory-loan
endpoint, module wiring, transaction writer, sale, Payment, report or POS change.
Existing monetary servicing and stored replay snapshots are unchanged.

### Approved accounting: reserve, then explicitly deliver

| Operation | Physical stock | Reservation | Item evidence |
| --- | --- | --- | --- |
| Create | Unchanged | Increase by item quantity | Positive quantity; counters start at zero |
| Explicit delivery | Decrease by delivered units | Decrease by the same units | Increase deliveredQuantity |
| Recorded return | Increase by returned units | Unchanged; never release twice | Increase returnedQuantity |
| Undelivered cancellation | Unchanged | Release remaining undelivered units | Increase cancelledQuantity |

Derive `reservedRemaining = quantity - deliveredQuantity - cancelledQuantity`
and `outstanding = deliveredQuantity - returnedQuantity`; neither is stored.
Counts must be finite integers within Prisma Int (0–2,147,483,647), with positive
item quantity, `returnedQuantity <= deliveredQuantity`, and
`deliveredQuantity <= quantity - cancelledQuantity`. Pure transitions return new
counts and stock/reservation deltas without mutating inputs or writing anything.
A return does not reopen the reservation or permit a second delivery of those
units. Stock capacity, availability and transaction policy belong to later writers.

Cancellation must resolve delivered outstanding units through recorded returns,
not by pretending they were undelivered. The item helper only proposes an
undelivered release; it does not authorize header cancellation. L3C-C owns that
atomic policy and explicit closure. Inventory status currently has only OPEN and
CANCELLED; CLOSED and its policy are deliberately deferred, not copied from money.

### Tenant and evidence boundary

Exactly one nullable customer/supplier/employee is selected. Composite foreign
keys bind customers and suppliers to the loan organization; employeeId references
the existing OrganizationUser `[userId, organizationId]` membership. Default SQL
MATCH SIMPLE permits the unselected nullable counterparties. Item foreign keys
bind both loan and Product to the same tenant. An event's optional item references
`[id, loanId, organizationId]`, preventing cross-loan history even within one org.
Existing primary-key relations remain intact; additive directory/product unique
indexes support these foreign keys. Creator/event actors reference User; role and
active-entity eligibility checks remain later service responsibilities. No
isLoanable field, new employee directory or database active-entity guarantee exists.

CREATED is a header event with null item/quantity. DELIVERED and RETURNED require
an item and positive quantity. CANCELLED supports a null-item/null-quantity header
plus positive per-item undelivered reservation releases. A zero-release item gets
no item cancellation event; the header can still record cancellation. L3C-B must
store immutable actor/payload/result and idempotency at **operation level**, since
one operation can append multiple item events. No per-item unique request key is
introduced here.

SQL checks enforce quantity bounds/event shapes. Triggers reject event updates or
deletes, loan/item deletion, identity changes (including item loan/product/quantity)
and decreasing accumulated item counters. They do not prove ledger/counter/stock
agreement against arbitrary direct writes. L3C-B creation/read/history/replay and
L3C-C atomic delivery/return/cancellation must enforce that agreement with tenant,
role, active tracked PRODUCT, version/CAS, audit and replay checks before rollout.

### Review, proof and rollback

Review pure accounting tests first, then schema/FK/event-shape declarations and
immutable-evidence triggers. Text assertions prove declarations only; schema
validation/client generation do not execute PostgreSQL. L7 still needs authorized
isolated migration execution, FK/check/trigger rejection, atomic rollback and real
race/reconciliation proof. No migration has been applied by this unit.

Before application, the rollback boundary is these three models, their required
reverse relations/composite indexes, the inventory foundation migration, pure
rules/tests, structural spec and this section. Preserve all monetary and L3B
reservation guards. After deployment/population, require a separately authorized
data-safe rollback plan; never discard loan evidence or reset reservations.

## Physical-loan replay storage (L3C-B first unit; UNEXPOSED)

This additive DDL-only unit introduces `InventoryLoanOperation` and an optional
`InventoryLoanEvent.operationId`. **Reservation writers remain OFF.** No service,
DTO, route, module wiring or runtime replay matcher is added. Monetary models,
replay snapshots and the approved L3C-A migration remain unchanged.

### Completed immutable evidence

| Declaration | Contract |
| --- | --- |
| `organizationId, requestKey` unique | One tenant-wide namespace, independent of loan and actor; another tenant may reuse the key |
| `loanId, organizationId` FK | Operation belongs to a loan in the same tenant |
| `actorId, organizationId` FK | Authenticated actor reuses the existing OrganizationUser membership |
| `type` | CREATE only; later L3C-C discriminators require an additive migration, not monetary enum changes |
| `requestPayload, resultSnapshot` | Required nonempty JSON objects, no pending/null placeholders |
| `requestKey` | Stored normalized text, 1–100 characters, without leading/trailing SQL spaces; future DTO must trim and reject blank/oversized keys |
| `createdAt` | Required creation timestamp; all operation columns are immutable |

The operation trigger rejects every UPDATE and DELETE, including no-op updates,
identity/actor/key changes and payload/result/timestamp rewrites. No overwritable
conflict upsert is permitted. JSON shape checks do not validate business payloads
or presentation content; the future service owns normalization and safe snapshots.
Restrictive FKs retain membership and loan evidence against hard deletion; active
membership and role authorization remain service responsibilities.

A linked event references operation `[id, loanId, organizationId, actorId]` through
`[operationId, loanId, organizationId, createdById]`, binding the same loan, tenant
and author. Many header/item events may share one operation; there is no unique
request key on events. MATCH SIMPLE intentionally permits old events with null
operationId. All other FK components are required, so a nonnull operationId cannot
skip loan/tenant/actor checks through a nullable companion. Correlation is supplied
at event INSERT; the existing append-only event trigger stays intact. This unit
neither rewrites the foundation migration nor updates historical events.

### Handoff to the unwired L3C-B service unit

1. Normalize the accepted request and key; derive actor/tenant from authentication.
   Look up the tenant-wide key and require stored actor, operation type and
   normalized payload to match. Return the stored snapshot on an exact replay;
   reject a mismatched actor/payload without creating another reservation. Do not
   re-present a replay from live counts or later history.
2. In one future Serializable transaction, create header/items and apply guarded
   reservations, then build a safe presentation snapshot from those created rows.
3. Insert the completed immutable operation **before** inserting linked append-only
   events; append audit in the same transaction. Failure at any step must abort
   header/items, reservations, operation, events and audit together. Handle key/
   serialization conflicts without overwriting the stored operation.

L3C-C will reuse the operation-to-many-events plan for multi-item delivery, return
and cancellation requests, with separately reviewed payload/result/state rules.
No close semantics or lifecycle writer is introduced here. Future read/history
presenters must not expose internal request payloads or replay records.

### Proof and rollback boundary

SQL/schema assertions verify declarations and alignment only; they do **not**
execute invalid writes or prove FK, check, trigger, rollback or race enforcement.
Prisma validation/generation likewise provides no real PostgreSQL proof. L7 still
requires separately authorized isolated database execution; this migration is
unapplied. Before application, remove this operation model/reverse relations,
event link, new 090500 migration, operation declaration tests and this section as
one unit; retain L3C-A and all monetary/reservation safeguards. After population,
require an authorized data-safe rollback plan, never a table wipe or evidence edit.

## Physical-loan creation and reads (L3C-B second unit; UNWIRED)

`InventoryLoansService` and its nested DTO are implemented for direct test
instantiation only. **Operational rollout remains OFF.** The service is not
registered or exported by a Nest module, controller, route or application.
The foundation/storage sections above describe their earlier isolated units;
this section adds the unwired writer, not an inventory-loan HTTP API.

### Create contract and reservation

| Input or boundary | Contract |
| --- | --- |
| `requestKey` | Raw string trimmed to 1–100 characters; tenant-wide namespace |
| `counterpartyType`, `counterpartyId` | CUSTOMER, SUPPLIER or EMPLOYEE and one UUID; active same-tenant entity; employees reuse User plus OrganizationUser membership |
| `items` | 1–100 nested items, each with registered product UUID and raw positive integer quantity up to 2,147,483,647 |
| Duplicate products | Reject rather than merge; item order is nonsemantic and normalized by product ID |
| Unknown fields | Reject at header and item level, including prices, tax, cost, stock, reservations, version, actor and tenant; no due-date or notes persistence is claimed |
| Actor | Authenticated RequestUser, separate from the DTO; OWNER/ADMIN and an active administrative same-tenant membership required |
| SUPER_ADMIN | No global bypass: also requires an active OWNER/ADMIN OrganizationUser membership in the selected tenant |

Service-side validation also protects direct callers that bypass a future HTTP
validation pipe. Missing organization fails closed. MEMBER, CASHIER and
INVENTORY_USER cannot create these obligations. This is service authorization,
**not implemented HTTP role metadata**; future controllers must enforce their
own guards and organization selection.

One Serializable transaction validates the actor, counterparty and each active,
tracked PRODUCT. Sequential product-ID ordering gives a stable reservation lock
order. Each reservation update pins tenant, eligibility, observed version,
reservedStock and physical stock, and requires enough stock minus reservations.
It increments only reservedStock and version; physical stock is unchanged.
Missing/inconsistent controls, insufficient availability or a lost CAS return
409. There is no InventoryMovement OUT, Sale, Payment or MoneyLoan write.

Header/items, completed immutable CREATE operation, linked header CREATED event
and INVENTORY_LOAN_CREATED AuditLog share the transaction. The JSON-safe response
snapshot is built from created rows with ISO creation time and derived quantities.
The operation is inserted before its linked event; neither pending placeholders
nor later event/operation updates are used. Any failure aborts all staged effects.

### Exact replay and public reads

An exact request must match stored actor, CREATE discriminator and the complete
normalized typed-counterparty/item payload. It returns the stored creation
snapshot, even after live status, item counts or counterparty eligibility change;
it never computes a new result from current rows or writes additional evidence.
Mismatched requests return 409 before reservations. Different tenants may reuse
one key without sharing lookups or results. Malformed snapshots fail closed.

P2002/P2034 reconciliation re-reads the tenant key only **outside** the aborted
transaction. A matching completed operation permits replay; missing or mismatched
evidence returns 409. There is no automatic reservation retry, conflict upsert,
or assumption that any unique-key violation means success.

List uses one composed tenant/status/typed-counterparty predicate for page and
count. Supported statuses are OPEN and CANCELLED, never an invented CLOSED.
Counterparty filters require both type and ID. Page/limit are bounded to
1–1,000,000 and 1–100, defaulting to 1 and 20. List ordering is createdAt/id
descending; history is ascending with the same ID tie-breaker. Responses use
`{ data, total, page, limit, totalPages }`.

Detail and related item selectors retain tenant scope. Derived reservedRemaining
and outstanding use the existing quantity invariant helper and live item counters.
History first requires a same-tenant loan, then scopes both page and count to its
tenant/ID. Public reads expose scalar counterparty/actor IDs and immutable event
ID, type, item, quantity, actor and timestamp, not membership credentials, internal
request payloads, operation relations or stored replay records. Wrong-tenant and
missing loans both return 404.

### Proof limits and lifecycle handoff

The predicate-aware DB mock clones working state and commits only a successful
callback. Tests demonstrate local rollback on operation/event/audit/CAS failures,
reservation/read predicates and replay effects; they **do not** prove PostgreSQL
locking, actual rollback, FK/check/trigger enforcement or concurrent races.
Schema/client are unchanged in this unit; prior validation/generation evidence
is reused, not rerun. L7 retains separately authorized isolated database proof.

L3C-C must implement explicit delivery, recorded returns, cancellation and closure,
add any required lifecycle operation discriminators, then define controller guards
and read permissions before considering rollout. No pricing decision, POS,
frontend, financial reporting or monetary replay behavior changes here. The
second-unit rollback boundary is its DTO/service/spec and this documentation;
retain checked storage, pure invariants and all stock-consumer safeguards.

## Verification and next slice

Run the focused suite from `backend`:

```text
node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath src/loans/inventory-loans.service.spec.ts
```

Use locally installed Prisma for generation and schema-only validation; validation
uses temporary credential-free `postgresql://localhost/schema_validation` with the
previous environment restored in `finally`; block dotenv loading, including the
config import, so no real environment file is read. Run direct
`node node_modules/typescript/bin/tsc -p tsconfig.build.json --incremental false`
and read-only ESLint with explicitly enumerated loan TypeScript files, never
backend auto-fix lint or database tests without authorization. This is not the
npm production build (whose prebuild hook loads a production environment file).

Mocked unit tests check transaction-client use and failure propagation; they do
**not** prove PostgreSQL rollback, trigger execution or runtime migration success.
Before deployment, apply the migration only in an explicitly authorized test
environment and verify real rollback on event/audit failure, constraints and
append-only enforcement. No migration execution is authorized by this unit.

L7 still requires explicitly authorized isolated PostgreSQL proof: migration
application, append-only/identity triggers, tenant/reversal FKs, atomic rollback
and real concurrent collection/reversal/closure races. Mock CAS/isolation assertions
are not runtime concurrency proof. List/detail currently load each selected loan's
ledger to compute exact totals; very large histories may need a later bounded
aggregation design without dropping history correctness.

L3C-B now includes unwired creation/read/history and mocked replay checks;
L3C-C still gates operational inventory loans. L4–L6 own POS integration and the
frontend. No existing sales or expense report includes loans.
