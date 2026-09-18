# Feature: prisma-migration-reconciliation

Issue: MeperPOS #117 — "Investigate Prisma migration/schema reconciliation"
Audit: AUDIT-FINDING-011 (NEEDS INVESTIGATION; potentially HIGH, conditional until evidence exists).
Related and explicitly out of scope: AUDIT-FINDING-010 (issue #116, closed), AUDIT-FINDING-019 (issue #125).

## Why this exists

Triage recorded a confirmed *repository* inconsistency but refused to declare a runtime or
deployment consequence without evidence (`docs/sdd/audit/triage.md`, "Needs Investigation").
AUDIT-FINDING-011 therefore has two committed facts and five missing pieces of evidence. This
feature produces that evidence and the closure verdict. It is an investigation: the expected
output is recorded evidence plus a "corrective migration needed: yes/no" decision, not a
schema change.

This matters now because issue #116 made `start:prod` run `prisma migrate deploy` before the
application boots. If the committed chain cannot converge a database to the committed schema,
that new fail-closed gate stops deploying on a correct repository instead of on an old
database.

## Verified current state (evidence, not assumption)

Static findings, confirmed by reading the committed files before any database work:

- **Positive result, contrary to the audit's framing**: the `"PaymentMethod"` enum **does**
  exist in the chain. It is created by the `init` migration and is used by `Sale`/`SalePayment`.
  All 15 enums declared in `prisma/schema.prisma` have a matching `CREATE TYPE` in the chain
  (verified by enumerating both sets). There is no missing-enum-type drift.
- **Finding A (drift, single column)**: `PaymentRecord.method` is created as `TEXT`
  (`backend/prisma/migrations/20260501195935_add_payment_record_and_org_index/migration.sql:8`)
  while the schema declares `method PaymentMethod` (`backend/prisma/schema.prisma:429`). No
  later committed migration converts the column. The mismatch is isolated to this column.
- **Finding B (populated upgrade)**: `20260423020000_multi_tenant_fase0/migration.sql:82-126`
  adds `"organizationId" TEXT NOT NULL` to 13 tables (`AuditLog`, `Category`, `Customer`,
  `InventoryMovement`, `Payment`, `Product`, `PurchaseOrder`, `PurchaseOrderItem`, `Sale`,
  `SaleItem`, `Supplier`, `Task`, `TaskEvent`) with no default and no in-script backfill.
  The same migration also drops `User.role`, drops table `Settings`, and drops enum `Role`.
- **CI already replays the chain on PostgreSQL 17**: `.github/workflows/ci.yml:61-63` runs
  `npx prisma migrate deploy` against a service container `postgres:17`, and master is green
  (run `35382538485`, commit `581936e`). AC1 on PG17 is therefore already known-green; a green
  `deploy` proves the chain *applies*, and proves nothing about *convergence* to the schema.
- **Two PostgreSQL versions are in play**: CI uses `postgres:17`, `backend/docker-compose.yml`
  uses `postgres:15-alpine`. CI only ever exercises 17.

## Decisions taken (human-owned, this session)

1. **Disposable PostgreSQL source**: start Docker Desktop and use ephemeral containers
   `postgres:17` (port 55432, CI parity) and `postgres:15` (port 55433, docker-compose parity),
   started with `--tmpfs` and **no named volumes**, so `postgres_data` (the developer's real
   dev database) is never touched. Testing both versions is deliberate: version difference is
   the one axis CI cannot cover, and it is cheap once the daemon is up.
2. **AC5 scope**: **blocked and documented**, not executed. Inspecting deployed
   `_prisma_migrations` records and catalog types requires explicit operational authorization
   and production credentials. The report records the exact procedure so it can be executed on
   decision, and states no deployed impact.
3. **Artifact**: `docs/sdd/audit/investigation-011-prisma-migration-reconciliation.md`, next to
   `audit-findings.md` and `triage.md`, so the audit cluster stays together.
4. **Workflow**: ODD. No strict TDD: an investigation produces evidence, not behavior, so there
   is no test-first artifact to write. The equivalent of a red test is the recorded failing
   experiment in E6.

## Acceptance criteria (from issue #117)

- [ ] AC1 All committed migrations replay successfully on a disposable empty PostgreSQL database.
- [ ] AC2 The resulting `PaymentRecord.method` PostgreSQL type is recorded and compared with
      generated Prisma metadata.
- [ ] AC3 Representative Prisma `PaymentRecord` reads/writes are executed against the clean replay.
- [ ] AC4 The multi-tenant migration is applied to a representative populated pre-multi-tenant
      database and the outcome is recorded.
- [ ] AC5 Deployed migration records and catalog types inspected — **BLOCKED, documented**
      (decision 2).
- [ ] AC6 The issue records whether any corrective migration is needed.

## Tasks

### Experiment E1 — disposable engines

Start Docker Desktop; bring up `postgres:17` on 55432 and `postgres:15` on 55433 with `--tmpfs`
and no named volume; confirm both accept connections. Use only
`backend/node_modules/prisma/build/index.js` (6.19.2) — a bare `npx prisma` in `backend/`
resolves to `prisma@8.0.0-rc.15` from the npx cache and must not be used.

### Experiment E2 — AC1, full clean replay on both versions

`migrate deploy` against a fresh database on 17 and on 15. Record exit code, applied count from
`_prisma_migrations`, and any error verbatim.

### Experiment E3 — AC2, actual column type vs generated metadata

Read `information_schema.columns` / `pg_type` for `PaymentRecord.method` on the replayed
database, and establish what the generated Prisma client expects from `schema.prisma`.

### Experiment E4 — drift enumeration (decisive evidence)

`prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma`
with a shadow database. This enumerates every difference the committed chain leaves behind, and
is the evidence that decides AC6.

### Experiment E5 — AC3, runtime reads/writes

Throwaway script using the generated client against the replayed database: create, read,
filter-by-method, and update `PaymentRecord`. Record whether the `TEXT` column is tolerated at
runtime.

### Experiment E6 — AC4, populated pre-multi-tenant upgrade

Third database: deploy the chain up to (excluding) `20260423020000_multi_tenant_fase0`, insert
representative rows into the tables that migration alters, then apply that migration alone.
Record the exact failure. Then apply it to the same pre-state with empty tables to isolate the
cause to row presence rather than to the DDL itself.

### Experiment E7 — AC6 verdict

Decide whether a corrective migration is needed, with the reasoning tied to the E2–E6 evidence.
State separately what would be needed for fresh databases, for populated upgrades, and for the
already-deployed database (which AC5 leaves unverified).

### Closure

- [ ] Write the evidence report at the path in decision 3.
- [ ] Comment the outcome on issue #117.
- [ ] Tear down the disposable containers and databases.

## Out of scope

- Production migration ownership and the runbook (AUDIT-FINDING-010 / issue #116, closed).
- Hosted control-plane configuration (AUDIT-FINDING-019 / issue #125).
- Writing any corrective migration. This issue records whether one is needed; applying a schema
  change is a separate authorized change.
- Inspecting the deployed database (decision 2).

## Review workload note

Expected repo diff: one new evidence document plus this task file. No source, schema, migration,
or configuration change. If any experiment suggests a corrective migration, that becomes a new
issue and a new authorized change — not an expansion of this one.
