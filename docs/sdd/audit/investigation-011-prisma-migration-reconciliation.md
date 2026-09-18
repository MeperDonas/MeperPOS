# Investigation: Prisma migration/schema reconciliation

**Issue:** MeperPOS #117 — "Investigate Prisma migration/schema reconciliation"
**Audit finding:** AUDIT-FINDING-011 (`docs/sdd/audit/triage.md`, "Needs Investigation" — "potentially HIGH, but conditional until this evidence exists")
**Date:** 2026-09-18
**Repository state:** `master` at `581936e`
**Nature:** read-only investigation. No schema, migration, source, or configuration change was made.

---

## 1. Verdict

The repository inconsistency recorded by the audit is real, and it is larger and more
consequential than the audit reported. The audit described one drifted column; the committed
chain actually leaves **four** differences behind, and one of them produces a **hard runtime
failure** rather than a cosmetic catalog mismatch.

| # | Question the issue asks | Result |
|---|---|---|
| AC1 | Do all committed migrations replay on a disposable empty PostgreSQL? | **PASS** — 30/30, exit 0, on PostgreSQL 17.11 *and* 15.18 |
| AC2 | What is the resulting `PaymentRecord.method` type, versus generated Prisma metadata? | **DRIFT CONFIRMED** — column is `text`; the client's schema copy declares `PaymentMethod` |
| AC3 | Do representative Prisma `PaymentRecord` reads/writes work against the clean replay? | **PARTIAL FAILURE** — reads and writes succeed; **every predicate on `method` fails** with Postgres `42883` |
| AC4 | Can the multi-tenant migration be applied to a populated pre-multi-tenant database? | **NO** — `P3018` / `23502`; fails on all 13 altered tables. Empty-table control passes |
| AC5 | Inspect deployed migration records and catalog types | **BLOCKED** — deferred by explicit decision; procedure in §9 |
| AC6 | Is a corrective migration needed? | **YES** for the schema drift. **NO** retroactive backfill proposed (§8) |

Three consequence statements that the evidence supports, and one it does not:

- **Supported:** on any database created by this chain, `prisma migrate deploy` can never make the
  database match the committed schema, because `deploy` only applies committed migrations.
- **Supported:** `prisma migrate status` reports **"Database schema is up to date!"** on such a
  database. The project's own verification tool cannot detect this condition.
- **Supported:** a populated pre-multi-tenant database cannot be upgraded by the committed chain.
- **NOT supported:** that production is currently broken. The deployed database was not inspected
  (AC5). Every consequence below is conditional on how the target database was created. No
  production incident is claimed.

---

## 2. How the evidence was produced

Disposable and isolated by construction, so that nothing here depends on the developer's data:

- Two ephemeral engines, started with `--tmpfs` and **no named volumes**:
  PostgreSQL **17.11** on port `55432` (parity with CI) and PostgreSQL **15.18** on port `55433`
  (parity with `backend/docker-compose.yml`). The developer's `backend_postgres_data` volume was
  never mounted and never touched.
- Prisma CLI **6.19.2**, the project-local version, always invoked as
  `node node_modules/prisma/build/index.js`. Note: a bare `npx prisma` inside `backend/` resolves
  to `prisma@8.0.0-rc.15` from the npx cache and must not be used.
- Every claim below was produced by executing the committed artifacts. Where a result is an
  inference rather than an execution, it is labelled as such.
- All fixtures, logs, and throwaway scripts live outside the repository (`%TEMP%\meperpos-117`)
  and are not deliverables.

Evidence databases: `ac1_clean` (full replay), `ac4_populated` / `ac4_empty` (upgrade A/B),
`shadow_e4` (diff shadow). All were dropped at the end of the investigation.

---

## 3. AC1 — Clean replay: PASS on both engines

`prisma migrate deploy` against an empty database:

| Engine | Chain length | Applied | Failed | Exit code |
|---|---|---|---|---|
| PostgreSQL 17.11 | 30 | 30 | 0 | 0 |
| PostgreSQL 15.18 | 30 | 30 | 0 | 0 |

`_prisma_migrations` on both engines: `count = 30`, every row `finished_at IS NOT NULL` and
`rolled_back_at IS NULL`.

Version-specific syntax was a real risk worth testing, because CI only ever exercises
PostgreSQL 17 (`.github/workflows/ci.yml:18`) while `backend/docker-compose.yml` pins
`postgres:15-alpine`. The chain is portable across both.

This result was already *known*-green on PostgreSQL 17: CI replays the same chain on an empty
service container (`.github/workflows/ci.yml:61-63`) and `master` is green. A green `migrate deploy`
proves the chain **applies**. It does not prove the database **converges** to the schema, which is
the entire point of findings 3 and 4 below.

---

## 4. AC2 — The type drift is real, and narrower than the audit described

The audit's framing — "current schema declares an enum while the creating migration declares
`TEXT`" — is accurate for the column, but the surrounding implication (a missing enum type) is not.
The `"PaymentMethod"` enum **is** created by the `init` migration and **is** used by other columns:

```
   table_name   |  data_type   |   udt_name    | is_nullable
----------------+--------------+---------------+-------------
 ExpensePayment | USER-DEFINED | PaymentMethod | NO
 Payment        | USER-DEFINED | PaymentMethod | NO
 PaymentRecord  | text         | text          | NO
```

Identical on PostgreSQL 17 and 15. All 15 enum types a clean replay creates are present, and all 15
enums declared in `prisma/schema.prisma` have a matching `CREATE TYPE` in the chain (verified by
enumerating both sets). The drift is isolated to this single column:

- Chain: `backend/prisma/migrations/20260501195935_add_payment_record_and_org_index/migration.sql:8`
  → `"method" TEXT NOT NULL`
- Schema: `backend/prisma/schema.prisma:429` → `method PaymentMethod`
- Generated client metadata: `backend/node_modules/.prisma/client/schema.prisma` (client 6.19.2)
  also declares `method PaymentMethod`, so the client and the database disagree.

---

## 5. The decisive evidence: the chain leaves four differences behind

`prisma migrate diff --from-migrations` (chain, replayed in a shadow database) `--to-schema-datamodel`
produced this complete diff, verbatim:

```sql
ALTER TABLE "InventoryMovement" DROP CONSTRAINT "InventoryMovement_userId_fkey";
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_userId_fkey";

ALTER TABLE "InventoryMovement" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "PaymentRecord" DROP COLUMN "method",
ADD COLUMN     "method" "PaymentMethod" NOT NULL;
ALTER TABLE "Sale" ALTER COLUMN "userId" DROP NOT NULL;

CREATE INDEX "Expense_organizationId_labelId_idx" ON "Expense"("organizationId", "labelId");

ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

The same diff was produced independently from the **live replayed database**
(`--from-url`, not the shadow replay) and was byte-for-byte equivalent, on both engines. The
chain's output and the database's actual shape are therefore the same, so this is not a
shadow-database artifact.

| # | Object | What the chain leaves | What the schema declares |
|---|---|---|---|
| **D1** | `PaymentRecord.method` | `text NOT NULL` | `"PaymentMethod" NOT NULL` |
| **D2** | `Sale.userId` | `NOT NULL`, FK `ON DELETE RESTRICT` | `String?`, FK `ON DELETE SET NULL` |
| **D3** | `InventoryMovement.userId` | `NOT NULL`, FK `ON DELETE RESTRICT` | `String?`, FK `ON DELETE SET NULL` |
| **D4** | `Expense(organizationId, labelId)` | index absent | `@@index([organizationId, labelId])` |

Note what Prisma's generated repair does for D1: it **drops the column and re-adds it**
(`DROP COLUMN "method", ADD COLUMN "method" "PaymentMethod" NOT NULL`). Applied verbatim, that
destroys every existing payment record's method. D2 and D3 are also not cosmetic: the schema
intends that deleting a user preserves financial and inventory history by nulling the reference,
while the database refuses both the NULL and the delete.

---

## 6. AC3 — Runtime behaviour: the drift is not benign

Executed with the generated client (6.19.2) against `ac1_clean`, a database produced solely by
replaying the committed chain.

**Operations that succeed** (which is why the drift survived unnoticed):

| Operation | Result |
|---|---|
| `findMany()` with no `method` filter | OK — reads use an explicit `::text` cast |
| `findMany({ distinct: ['method'] })` | OK |
| `groupBy({ by: ['method'] })` | OK |
| `create({ data: { method: 'CARD' } })` | OK — the assignment cast enum→text is allowed |
| `update({ data: { method: 'CASH' } })` | OK |
| `$executeRaw` writing arbitrary text | OK — see the observation below |

**Operations that fail.** Every predicate on `method` fails, with Postgres error `42883`,
because the client emits `method = CAST($1::text AS "public"."PaymentMethod")` against a `text`
column:

```
operator does not exist: text = "PaymentMethod"
HINT: No operator matches the given name and argument types. You might need to add explicit type casts.
```

| Predicate shape | Result |
|---|---|
| `where: { method: 'CARD' }` (`findMany`, `findFirst`, `count`, `aggregate`) | FAILED `42883` |
| `where: { method: { in: ['CARD'] } }` | FAILED `42883` |
| `where: { method: { not: 'CARD' } }` | FAILED `42883` (`text <> "PaymentMethod"`) |

**Blast radius in the application today: none observed.** `backend/src/billing/payment-records.service.ts`
filters `PaymentRecord` only by `organizationId` and `id` — never by `method` — and
`CreatePaymentRecordDto` validates the enum at the HTTP boundary. The defect is therefore
**latent**: it triggers on the first `method` predicate anyone adds (a revenue-by-payment-method
report is the obvious next feature), on any ad-hoc query, and on any raw reporting SQL.

**A linked, independent observation.** Because the column is `text`, the database enforces no
domain at all: `$executeRaw` successfully persisted `method = 'NOT_A_PAYMENT_METHOD'`. The
constraint that `schema.prisma` appears to declare does not exist in a chain-created database.
This is a concrete, executed instance of AUDIT-FINDING-009 ("row-local domain constraints live in
services/DTOs, not in the database") and is recorded here rather than claimed as new scope.

**Runtime consequence of D2/D3 — an A/B on the live code path.** `backend/src/users/users.service.ts:305`
performs a hard `prisma.user.delete()`, so this is a real application path. The same call was
executed against the same database in two shapes:

| Database shape | `prisma.user.delete()` (user has an inventory movement) | Movement afterwards |
|---|---|---|
| **A** — as the chain creates it (`NOT NULL` + `RESTRICT`) | **FAILED** — `P2003`, `Foreign key constraint violated on the constraint: InventoryMovement_userId_fkey` | survives, still referencing the user |
| **B** — as the schema declares it (nullable + `SET NULL`) | **OK** — user deleted | survives with `userId = null` |

Shape B was produced by applying exactly the DDL from the section 5 diff. So `DELETE /users/:id`
fails with a foreign-key violation for any user who has sales or inventory movements, on a
database created by this chain, instead of preserving history the way the schema intends.

---

## 7. AC4 — A populated pre-multi-tenant database cannot be upgraded

`20260423020000_multi_tenant_fase0` adds `"organizationId" TEXT NOT NULL` to 13 tables with no
default and no in-script backfill (`migration.sql:82-126`), and in the same migration drops
`User.role`, drops table `Settings`, and drops enum `Role`.

**Method.** The pre-multi-tenant state was produced by Prisma itself, not by hand: a temporary
Prisma config pointed `migrate deploy` at the 15 committed migrations that predate the target, so
the starting point is exactly what the tool would produce. Two databases were built identically;
`ac4_populated` then received one row in each of the 13 altered tables, `ac4_empty` received none.
Both had the same 15 applied migrations.

**Populated result — the upgrade fails:**

```
Applying migration `20260423020000_multi_tenant_fase0`
Error: P3018
Migration name: 20260423020000_multi_tenant_fase0
Database error code: 23502
Database error:
ERROR: column "organizationId" of relation "AuditLog" contains null values
```

Exit code 1, and the failed migration is recorded in `_prisma_migrations` with
`finished_at IS NULL`, `rolled_back_at IS NULL` and a populated `logs` column — the state that
requires operator intervention before any later migration can apply.

**Empty control — the same chain, the same engine, completes:** 30/30 applied, exit 0. The only
difference between the two runs is row presence, which isolates the cause to the DDL's
incompatibility with existing rows rather than to anything else in the chain or the engine.

**Granularity.** Each of the 13 `ADD COLUMN` statements was then executed in isolation against
`ac4_populated`: **13 of 13 failed** with the same `contains null values` error. No table is
exempt, which is expected, because all 13 statements have the identical shape
(`ADD COLUMN ... TEXT NOT NULL` without `DEFAULT`). The mechanism is one defect repeated 13 times,
not 13 independent defects.

**Destructive steps.** On the empty control the migration completed, so `Settings` and `User.role`
are gone and enum `Role` no longer exists. On the populated database the migration aborted at the
first statement, so the fixture's `Settings` row and its two `User.role` values were still present
afterwards. That is worth stating plainly: **an operator who somehow forced this migration through
would also silently discard the `Settings` row and every legacy role assignment, with no
data-preserving step anywhere in the chain.**

---

## 8. Root cause

Three of the four drifts come from a single commit. All four have the same shape: **the schema was
changed without a committed migration to match.**

| Drift | Introduced by | What happened |
|---|---|---|
| D1, D2, D3 | `94d6b25` — "fix(multi-tenant): hardening crítico P0/P1/P2 post-auditoría" (2026-05-03) | Added the `PaymentRecord` migration with `"method" TEXT` while the schema declares the enum, and changed `userId String` → `userId String?` **twice** in `schema.prisma` with no migration relaxing either column or FK |
| D4 | `b0bf559` — "feat(expenses): add two-level expense taxonomy schema" | Added `@@index([organizationId, labelId])` to the schema; no committed migration creates it |

Verified for D2/D3: grepping every migration in the chain for `"userId" DROP NOT NULL` finds only
two unrelated `AuditLog` statements — no migration has ever relaxed `Sale.userId` or
`InventoryMovement.userId`. So the schema's `SetNull` intent was never translated into DDL.

For AC4 the root cause is different and more interesting. The multi-tenant work **was designed
correctly and then implemented incorrectly**:

- `docs/planes/historicos/2026-03-06-multi-tenant-super-admin-design.md:317` prescribes
  "Migracion expand/backfill/contract — 3 pasos para evitar locks en tablas grandes."
- `docs/planes/historicos/2026-03-06-multi-tenant-super-admin-implementation.md:437` is
  "Task 6: Create Backfill Migration", specifying the migration file and the exact
  `UPDATE ... SET "organizationId" = '<default tenant>' WHERE ... IS NULL` statements for every
  business table. Its Task 7 is the contract step that sets `NOT NULL`.
- The committed chain contains **no backfill migration**. `20260423020000_multi_tenant_fase0`
  (commit `da2cdda`) collapsed expand and contract into one step: it creates `Organization` and
  adds `organizationId TEXT NOT NULL` in the same migration, with no default tenant row to point
  at.

So the required backfill was known, specified, and never committed. The chain is missing its own
prerequisite, which is exactly why the populated upgrade fails and why fresh databases succeed.

The project does know how to write a safe data migration: `20260815000000_add_expenses` includes a
guarded backfill that raises an exception if it leaves `NULL` values behind. The capability exists;
it was simply not applied here.

### AC6 — is a corrective migration needed?

**Yes, for the schema drift (D1–D4). No retroactive backfill is proposed.**

- D1-D4 should be repaired by a corrective migration that converts `PaymentRecord.method` to the
  enum, relaxes `Sale.userId` and `InventoryMovement.userId` to nullable and rewrites both FKs to
  `ON DELETE SET NULL`, and creates the missing `Expense` index.
- **Do not apply Prisma's generated repair as-is.** The diff in section 5 repairs D1 by dropping
  and re-adding the column, which discards existing payment-method history. The corrective
  migration must hand-write the conversion:
  `ALTER TABLE "PaymentRecord" ALTER COLUMN "method" SET DATA TYPE "PaymentMethod" USING ("method"::"PaymentMethod");`
- **Never run `prisma migrate dev` to generate it.** The first developer to do so will get a
  generated migration containing the destructive drop-and-add, and may commit it. This is the
  single most likely way this drift causes real data loss.
- The conversion is only safe if the column currently holds valid labels. Because the column is
  `text`, arbitrary values are writable (section 6), so the corrective migration must validate
  before converting, or the conversion will fail and leave a failed migration record. That check
  is cheap: `SELECT DISTINCT method FROM "PaymentRecord";`.
- **No retroactive multi-tenant backfill is proposed.** Writing one now would be engineering for a
  hypothetical database: if the target database was created after the multi-tenant migration, no
  legacy rows exist and there is nothing to backfill. The actionable defect is that the
  *prerequisite is invisible* — the runbook does not warn that a populated pre-multi-tenant
  database cannot be upgraded by this chain. That warning belongs with the deployment-contract
  work, and the actual sequence, if such a database exists, is a separate authorized change.
- Commit or not: this issue asked only that the verdict be recorded, and the fix is a schema
  change with production risk. It should be its own authorized change, not an extension of this
  investigation.

---

## 9. AC5 — Deferred, with the procedure ready

Deferred by explicit human decision: it requires production credentials and explicit operational
authorization, and this investigation is not authorized to touch production. Consequence: whether
the deployed database exhibits D1-D4 or the populated-upgrade failure is **not established**, and
nothing in this document should be read as a claim about production state.

When it is decided, the procedure is read-only:

1. `SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at;`
   — establish whether the deployed history is the committed chain, a superset, or baselined.
   A baseline or a `migrate resolve` entry would explain how a populated database reached the
   multi-tenant migration at all.
2. `SELECT column_name, data_type, udt_name FROM information_schema.columns
   WHERE table_name = 'PaymentRecord' AND column_name = 'method';`
   — `text` means the deployed database was created by this chain and D1 is present.
3. `SELECT conname, confdeltype FROM pg_constraint
   WHERE conname IN ('Sale_userId_fkey', 'InventoryMovement_userId_fkey');`
   — `r` (RESTRICT) means D2/D3 are present and `DELETE /users/:id` has the section 6 failure mode.
4. `SELECT count(*) FROM pg_indexes WHERE indexname = 'Expense_organizationId_labelId_idx';`
   — `0` means D4 is present.
5. `SELECT DISTINCT method FROM "PaymentRecord";` — directly determines whether the section 8
   corrective conversion is safe to apply.
6. Record the Supabase PostgreSQL major version, since the deployed version determines whether the
   PostgreSQL 17 or 15 results are the relevant ones.

---

## 10. What this does not establish

Stated so the report cannot be read as broader than its evidence:

- No production incident is claimed. The deployed database was not inspected (AC5).
- No current application path was shown to fail. `PaymentRecord` is never filtered by `method` in
  `backend/src`, so D1 is latent today; D2/D3 require a user with sales or inventory movements to
  be deleted.
- No bad row was found or claimed in any real database. The `'NOT_A_PAYMENT_METHOD'` value in
  section 6 was written deliberately, by this investigation, into a disposable database.
- Whether the drift is intentional was not investigated as intent; each drift contradicts a
  committed artifact, which is the relevant standard.
- The chain's *content* beyond these four differences was not audited. The diff is complete and
  therefore exhaustive by construction: `prisma migrate diff` reports every remaining difference,
  and it reported four.

---

## 11. Reproduction

Disposable engines (no named volumes, nothing persists):

```bash
docker run -d --name replay17 --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=replay -p 55432:5432 postgres:17
docker run -d --name replay15 --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=replay -p 55433:5432 postgres:15-alpine
```

AC1, from `backend/` (always the project-local CLI):

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:55432/ac1_clean" \
  node node_modules/prisma/build/index.js migrate deploy
```

AC2:

```bash
psql "postgresql://postgres:postgres@localhost:55432/ac1_clean" -c \
  "SELECT table_name, data_type, udt_name FROM information_schema.columns WHERE column_name='method';"
```

The four drifts:

```bash
cd backend
node node_modules/prisma/build/index.js migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "postgresql://postgres:postgres@localhost:55432/shadow_e4" \
  --script
```

AC4: build the pre-multi-tenant state with a temporary config whose `migrations.path` points at a
copy of the chain truncated before `20260423020000`, populate the 13 tables, then run
`migrate deploy` with the real config and observe `P3018` / `23502`.

---

## 12. Change to the audit's own record

`docs/sdd/audit/audit-findings.md` and `triage.md` should be read with two corrections, both
established by execution rather than by argument:

1. **Understated.** AUDIT-FINDING-011 lists one drifted artifact. There are four, and one of them
   (`PaymentRecord.method`) has a demonstrated runtime failure mode. Severity should move from
   "potentially HIGH, conditional" to **HIGH, confirmed**, with the runtime failure and the
   populated-upgrade failure as the evidence.
2. **Overstated in one respect.** The finding's implication that the enum type itself is missing is
   not correct: the `"PaymentMethod"` enum exists and is used by three other columns. Recording
   this prevents a future corrective change from attempting to create an enum that already exists.

The audit's instinct to require evidence before declaring impact was correct, and it is what made
these four differences findable: a static reading of the same files had described one.
