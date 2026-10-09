# Standalone money loans: creation and read-only history

This is the L1 backend slice of issue #209. It records an interest-free MONEY
loan independently of POS, sales, inventory and financial reports. It does **not**
implement collections, balances, settlement, closure, cancellation or reversals.
Those lifecycle operations remain pending.

## API quick path

Use the existing authenticated cookie session and CSRF protection for mutations.
All routes are under `/api/loans` and require an organization scope.

| Method and path | Permission | Result |
| --- | --- | --- |
| `POST /api/loans` | OWNER, ADMIN | Create a standalone money loan |
| `GET /api/loans` | OWNER, ADMIN, MEMBER, CASHIER | Paginated loans |
| `GET /api/loans/:id` | OWNER, ADMIN, MEMBER, CASHIER | One scoped loan |
| `GET /api/loans/:id/history` | OWNER, ADMIN, MEMBER, CASHIER | Paginated creation history |

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

### Read responses

Creation and detail return the loan's ID, amount, dates, reason, counterparty
foreign keys and creation actor/timestamp. Exactly one of `customerId`,
`supplierId`, `employeeId` is populated. Related customer/supplier/employee/actor
projections contain only `id` and `name`; no user credentials, email or membership
objects are returned. Prisma Decimal amounts serialize as strings, without
client-side arithmetic or conversion to floating-point response totals. Date
columns serialize as UTC-midnight ISO timestamps.

List and history accept `page` (default 1, maximum 1,000,000) and `limit` (default
20, maximum 100), returning `{ data, total, page, limit, totalPages }`. Loans are
ordered newest-first; history is oldest-first, both with an ID tie-breaker.
Unknown and foreign-organization IDs both return 404, including on history.
History currently contains only `CREATED` events with reason, actor and timestamp.
There are no update/delete/history-edit endpoints.

## Persistence and review checks

Counterparty validation, loan creation, the append-only creation event and the
existing `AuditLog` entry (`LOAN_CREATED`, resource `MoneyLoan`) use one serializable
Prisma transaction. An event or audit failure must abort creation. Actor IDs are
taken from authentication. Serialization conflicts are surfaced rather than
silently retrying a non-idempotent create request; duplicate submission prevention
is not part of L1.

The migration adds only MoneyLoan and MoneyLoanEvent plus their existing-model
relations. SQL checks enforce a positive amount, date ordering, a nonblank reason
and exactly one counterparty. A composite event foreign key enforces agreement
with the loan's tenant. An SQL trigger rejects history updates/deletes. Restrictive
foreign keys retain loan history when someone tries to hard-delete its referenced
organization, counterparty or actor; existing soft-deactivation remains possible.
Customer/supplier tenant ownership and employee membership are validated by the
service inside the transaction, not by additional directory models.

Review the DTO and real RolesGuard metadata tests first, then the transaction and
tenant-filter tests, and finally the schema/migration pair. SQL checks and the
append-only trigger are migration-owned invariants not expressible in Prisma's
schema. Do not replace this migration with a schema-only database push.

## Verification and next slice

Run from `backend`:

```text
npm test -- --runInBand --testPathPatterns=src/loans
npx prisma validate
npx prisma generate
npm run build
npx eslint src/loans/**/*.ts src/app.module.ts
```

Mocked unit tests check transaction-client use and failure propagation; they do
**not** prove PostgreSQL rollback, trigger execution or runtime migration success.
Before deployment, apply the migration only in an explicitly authorized test
environment and verify real rollback on event/audit failure, constraints and
append-only enforcement. No migration execution is authorized by this unit.

L2 will introduce collections and lifecycle rules with their own concurrency,
idempotency and reversal design. L3–L6 still own inventory/service loans, POS
integration and the frontend. No existing sales or expense report includes loans.
