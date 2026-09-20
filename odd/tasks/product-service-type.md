# Feature: product-service-type

Repo: MeperDonas/MeperPOS. Branch: `feat/product-service-type` (from `master` `581936e`).
Trigger: the owner reported that "Lo que vale si vendés todo" counts services as if they were
sellable merchandise.

## Why this exists

Services (mano de obra, sincronización, mantenimiento) are registered as ordinary `Product`
rows because there is no other way to invoice them. Two code facts force fake stock onto them:

- `backend/src/sales/sales.service.ts:212-227` requires `stock >= quantity` to sell, and
  decrements `stock`.
- `frontend/src/app/pos/page.tsx:276,487` blocks adding to cart when `stock <= 0`.

There is no product/service or non-stock concept anywhere in the repository (no `isService`,
`tracksStock`, `intangible`, `nonStock`; no such enum). Confirmed by exhaustive grep.

### Measured impact on the real production data (Motors Club, `FMC-001`, Supabase)

Read-only inspection performed during exploration, no writes.

| Metric | Report says today | Real magnitude |
|---|---|---|
| Units in stock | 28,822 | ~1,900 |
| "Lo que vale si vendés todo" (`retailValue`) | $584,402,000 | ~$68,500,000 |
| "Lo que costó tu inventario" (`stockValue`) | $167,161,600 | ~$60,000,000 |

Eight items concentrate **26,928 of 28,822 units (93%)** and **$515.9M of $584.4M (88%)**:

| Item | SKU | Category | Stock | Sale price | Contribution |
|---|---|---|---:|---:|---:|
| MANO DE OBRA | `SERV` | Filtros | 9,996 | 10,000 | $99,960,000 |
| SCANNER | `SERVICIO` | Filtros | 999 | 100,000 | $99,900,000 |
| LIQUIDO | `SERV 3` | Mecánica | 9,991 | 10,000 | $99,910,000 |
| Sincronizacion General | `MEC-001` | Mecánica | 996 | 100,000 | $99,600,000 |
| BATERIA | `SERV 7` | Mecánica | 999 | 80,000 | $79,920,000 |
| MANTENIMIENTO | `SERV 4` | Mecánica | 986 | 20,000 | $19,720,000 |
| GUAYA | `1234` | Frenos | 998 | 15,000 | $14,970,000 |
| SERVICIO | `SERVICIO` | Accesorios | 963 | 2,000 | $1,926,000 |

Two consequences that shaped the decisions below:

1. **Neither category nor SKU prefix is a reliable discriminator.** Category `Mecánica` mixes
   labour (`MANTENIMIENTO`, `Sincronizacion General`) with physical parts (`BATERIA`, `DISCOS`,
   `RIATA`, `DEPOSITO`, `KIT MANIGU`). Category `Filtros` hides two services (`MANO DE OBRA`,
   `SCANNER`) next to real goods (`ACEITES`, `FILTROS`, `FILTRO DEL AIRE XRF-U28`). Category
   `Accesorios` contains one service (`SERVICIO`, stock 963). And SKU `SERV n` covers both
   labour (`SERV 4` MANTENIMIENTO, `SERV 11` RETIRO CALCAS) and parts (`SERV 7` BATERIA,
   `SERV 2` DISCOS, `SERV 8` RIATA). `SERV` means "things I charge for in the workshop", not
   "service".
2. **A second, independent defect exists**: real products carry invented non-stock pricing
   workarounds (`BATERIA` 999, `GUAYA` 998, `LIQUIDO` 9,991) worth $194.8M, and the kárdex holds
   165 `PURCHASE` movements summing 26,951 units that were never physically purchased (one
   initial-stock movement per created item, including services).

## Decisions taken (human-owned, this session)

1. **Model**: option A — a `ProductType` enum (`PRODUCT` | `SERVICE`) on `Product`, not a
   `Category.isService` flag and not a bare `tracksStock` boolean. Rejected B because a category
   cannot hold both a physical good and a service, and the data proves categories are already
   mixed. Rejected C as the primary model because the domain concept is the item's nature.
2. **Scope**: full behaviour, not just the report. The valuation, the POS stock requirement, the
   kárdex, the low-stock alerts and the purchase-order path are all in scope.
3. **Backfill target**: an **explicit confirmed list of 6 services**, not a category filter:
   `MANO DE OBRA` (sku `SERV`), `SCANNER` (sku `SERVICIO`), `Sincronizacion General`
   (sku `MEC-001`), `MANTENIMIENTO` (sku `SERV 4`), `SERVICIO` (sku `SERVICIO`),
   `RETIRO CALCAS` (sku `SERV 11`). Physical parts stay `PRODUCT` even though they live in the
   same categories. `ONRIS` and `LIQUIDO` are deliberately **not** in the list: the owner left
   them undecided and they must not be guessed.
4. **Service stock handling on backfill**: set `stock = 0` **and** write an `ADJUSTMENT_OUT`
   `InventoryMovement` so the kárdex explains the correction instead of silently diverging.
5. **Invented stock on real products** (`BATERIA`, `GUAYA`, `LIQUIDO`, and the 165 phantom
   `PURCHASE` movements): **out of scope**, documented as a separate issue. It is a distinct
   defect (missing "no stock control" mode) and it needs the owner to count real physical stock.
6. **Workflow**: ODD with tasks, strict TDD (repo `strict_tdd: true`), reviewable work units.

## Verified current state (evidence, not assumption)

### Schema and migration state

- `backend/prisma/schema.prisma:147-178` — `Product` has `stock`/`minStock`/`costPrice`/
  `salePrice`, no type discriminator. `enum PromotionType` (537) and `enum MovementType` are the
  only related enums.
- 30 migrations in `backend/prisma/migrations/`; newest is
  `20260903210000_expense_taxonomy_groups_labels_issue_134`.
- **`prisma migrate status` prints `Database schema is up to date!` while the live schema does
  not converge to `schema.prisma`.** It only reports pending folders. The real check is
  `prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma --script`.
  Live drift, on both local and (unverified) production:
  | # | Drift | Live | Declared |
  |---|---|---|---|
  | 1 | `PaymentRecord.method` | `text NOT NULL` | enum `PaymentMethod` |
  | 2 | `Sale.userId` | `NOT NULL` | nullable |
  | 3 | `InventoryMovement.userId` | `NOT NULL` | nullable |
  | 4 | `Sale_userId_fkey` / `InventoryMovement_userId_fkey` | no `ON DELETE SET NULL` | `SetNull` |
  | 5 | `Expense_organizationId_labelId_idx` | absent | declared |
- **Destructive landmine**: that diff renders
  `ALTER TABLE "PaymentRecord" DROP COLUMN "method", ADD COLUMN "method" "PaymentMethod" NOT NULL;`.
  Running `npx prisma migrate dev` to generate a migration folds that drop-and-add into the
  generated file and destroys every `PaymentRecord.method` value. This is the §8 warning of
  `docs/sdd/audit/investigation-011-prisma-migration-reconciliation.md`.
  **Therefore: this feature's migration is hand-written SQL applied with `prisma migrate deploy`.
  `migrate dev` must not be run in this repository while that drift is open.**
- The 5 drifts are pre-existing and belong to the #117 follow-ups. **Not fixed here.**

### Environment

- `backend/.env.development` → `localhost:5432/inventario_db`, the docker-compose
  `postgres:15-alpine` scratch database. It contains **only integration-test litter**: 11
  organizations (`Reports INT A/B`, `expenses-int Org A/B`, `Reports Golden Fixtures`), 84 users,
  7 products, 10 sales, 0 `PaymentRecord`. It has no service data and cannot be used to validate
  the backfill.
- `backend/.env.production` → Supabase `aws-1-us-east-1.pooler.supabase.com`, PostgreSQL 17.6.
  Real data: 2 organizations (`Motors Club` `FMC-001`, `Test Org` `test-001`), 16 categories,
  185 products, 50 sales, 336 inventory movements.
- Test commands: backend `npm run test -- --testPathPatterns=<path>` (Jest 30 requires the
  **plural** flag; the singular form in `AGENTS.md` fails). Frontend: `cd frontend && npm run
  test -- <path>` (vitest).

### Confirmed touch points (from an exhaustive read-only impact map)

- **Sales**: `sales.service.ts:96-126` (cost/price snapshot), `:212-228` (stock guard +
  decrement), `:231-253` (SALE movement), `:457-493` (cancel/return restores stock + RETURN
  movement).
- **Products**: `products.service.ts:119-196` (create + initial `PURCHASE` movement at `:195-204`),
  `:343-350` (update stock math), `:389-405` (`ADJUSTMENT_IN`/`ADJUSTMENT_OUT`), `:244-247`
  (low-stock Prisma field reference), `:466-474` (raw low-stock SQL), `:501-520` and `:548-566`
  (`isLowStock` in search/quick-search mappers), `:590-613` (movement helper),
  `dto/product.dto.ts:25-61` (create) and `:105-143` (update).
- **Reports**: `reports.service.ts:495-503` (product query), `:510-512` (the four totals),
  `:502-526` (movement totals by type), `:704-708` (dashboard low-stock `COUNT(*)` raw SQL).
- **Purchase orders**: `purchase-orders.service.ts:70-108` (draft item accepts any product),
  `:476-489` (receive increments stock and may overwrite cost), `:502-514` (`PURCHASE` movement).
- **Exports**: `exports.service.ts:16-60` (movement export), `:208-215` (movement product
  projection), `:359-412` (inventory export columns).
- **Imports**: `imports/engine/handlers/product.handler.ts:27-50,104-112,146-158`,
  `imports/template.service.ts:31-60`. Imported products default to `PRODUCT`.
- **Frontend**: `types/index.ts:1-27` (canonical `Product`), `app/inventory/page.tsx:133-138`
  (client low-stock), `:160-173,303-338` (form defaults/payloads), `:721-735` (stock inputs);
  `app/pos/page.tsx:262-265` (`inStockProducts`), `:276-301` (add to cart), `:328-331`
  (quantity cap), `:487-500` (scan), `:678-684` (paused-sale repricing);
  `components/products/ProductCard.tsx:39-42,89-92,128`;
  `components/categories/CategoryProductsModal.tsx:17-32`;
  `components/dashboard/AlertPanels.tsx:61-85`; `app/reports/page.tsx:285-303`;
  `hooks/useProducts.ts:12-27,43-48,73-92`; `hooks/usePausedSales.ts:121-124`.

## Acceptance criteria

- [ ] AC1 — A product can be declared a service, and that declaration is persisted and returned
      by every product read path (list, detail, search, quick-search, exports).
- [ ] AC2 — A service can be invoiced in the POS with no stock, is never blocked by a stock rule,
      and its sale creates no `InventoryMovement` and changes no `stock`.
- [ ] AC3 — Cancelling or returning a service sale neither restores nor creates stock, and creates
      no `RETURN` movement.
- [ ] AC4 — Inventory valuation (`stockQuantity`, `stockValue`, `retailValue`, `potentialProfit`)
      and the movement totals exclude services.
- [ ] AC5 — Services never appear in low-stock alerts (list filter, dedicated endpoint, dashboard
      count).
- [ ] AC6 — A service cannot be added to a purchase order, and receiving a purchase order never
      moves stock for one.
- [ ] AC7 — The frontend reflects the type: it can be chosen and edited, stock inputs are
      inapplicable for a service, and the POS sells services without a stock cap.
- [ ] AC8 — A parameterised, dry-run-first backfill marks exactly the 6 confirmed services,
      zeroes their stock with an explaining `ADJUSTMENT_OUT` movement, and is idempotent.
- [ ] AC9 — No `prisma migrate dev` is run; the new migration is hand-written and applies with
      `migrate deploy` without altering the 5 pre-existing drifts.

## Tasks

Strict TDD. Each RED step is written and observed failing before its GREEN step. Verification
commands are listed in the evidence table at the end of each work unit.

### Work unit 1 — the type and its single rule

1. [x] RED: add `backend/src/products/product-type.logic.spec.ts` pinning the shared rule module:
       `tracksStock('SERVICE') === false`, `tracksStock('PRODUCT') === true`;
       `normalizeStockForType('SERVICE', n) === 0` and a pass-through for `PRODUCT`;
       `resolveInitialStockMovement('SERVICE', n) === null` and a `PURCHASE` movement for
       `PRODUCT`; `isLowStock('SERVICE', stock, minStock) === false` regardless of numbers;
       `resolveStockDeltaMovement('SERVICE', prev, next) === null`. Must fail against the current
       tree (module absent).
2. [x] GREEN: add `enum ProductType { PRODUCT SERVICE }` and `Product.type ProductType
       @default(PRODUCT)` to `backend/prisma/schema.prisma`, and implement
       `backend/src/products/product-type.logic.ts` as the single authority for every stock
       decision.
3. [x] GREEN: hand-write `backend/prisma/migrations/<timestamp>_add_product_type/migration.sql`
       creating the enum and the column with `DEFAULT 'PRODUCT'`, plus an
       `("organizationId", "type")` index. Apply with `prisma migrate deploy` and prove with
       `prisma migrate diff --from-url --to-schema-datamodel` that the 5 pre-existing drifts are
       unchanged and no new one appeared.
4. [x] GREEN: regenerate the Prisma client and confirm the type is available to consumers.

### Work unit 2 — a service sale touches no stock

5. [x] RED: extend `backend/src/sales/sales.service.spec.ts` — creating a sale containing a
       `SERVICE` item calls neither `product.updateMany` nor `inventoryMovement.create`, and never
       throws `ConflictException` for insufficient stock even with `stock = 0`; a `PRODUCT` item
       in the same sale still guards, decrements and records a movement. Cancelling a service line
       does not increment stock nor write a `RETURN` movement.
6. [x] GREEN: make `sales.service.ts` consult `product-type.logic.ts` for the guard, the
       decrement and the movement on create (`:212-253`) and for restore-and-return on cancel
       (`:457-493`), including selecting `type` in the product query.

### Work unit 3 — products stop treating a service as stocked

7. [x] RED: extend `backend/src/products/products.service.spec.ts` — creating a `SERVICE` forces
       `stock = 0` and writes no initial `PURCHASE` movement; updating a `SERVICE` writes no
       adjustment movement; updating a product from `PRODUCT` to `SERVICE` zeroes the stock and
       records one `ADJUSTMENT_OUT`; the low-stock filter (`findAll` field reference and the
       `$queryRaw` list) excludes services; `isLowStock` is `false` for a service in the search,
       quick-search and detail mappers.
8. [x] GREEN: implement those branches in `products.service.ts` and add `type` to
       `CreateProductDto`/`UpdateProductDto` with `@IsEnum(ProductType)` (optional on update).
9. [x] RED/GREEN: pin the service fields in `dto/product.dto.spec.ts`.

### Work unit 4 — valuation and alerts exclude services

10. [x] RED: extend `backend/src/reports/reports.service.spec.ts` and
        `financial-reports.service.spec.ts` — the inventory snapshot totals count only
        stock-tracked items while a mixed fixture with a service proves the exclusion, and the
        movement totals by type ignore service movements; the dashboard low-stock raw SQL carries
        the service predicate.
11. [x] GREEN: apply the predicate in `reports.service.ts` (`:495-526`, `:704-708`), keeping the
        existing `valuationBasis`, response shape and golden fixtures intact.

### Work unit 5 — purchase orders and exports

12. [x] RED: extend `backend/src/purchase-orders/purchase-orders.service.spec.ts` — adding a
        `SERVICE` item is rejected with a clear error, and receiving a purchase order whose item
        is a service does not increment stock nor write a `PURCHASE` movement (defence in depth
        for rows that predate the guard).
13. [x] GREEN: implement the guard and the receive branch; add `type` to the inventory export
        columns and to the movement export's product projection, with `exports.service.spec.ts`
        updated.

### Work unit 6 — frontend reflects the type

14. [x] RED: extend `frontend/src/types/index.ts` consumers and the characterisation suites —
        `app/inventory/page.characterization.test.tsx` proves a service is excluded from the
        client low-stock filter and renders no stock chip;
        `app/pos/page.behavior.test.tsx` proves a zero-stock service can be added to the cart and
        its quantity is not capped; `components/products/ProductCard.inventory.test.tsx` proves a
        service renders a service state instead of an out-of-stock chip;
        `app/reports/page.evidence.test.tsx` still passes unchanged.
15. [x] GREEN: add `type` to the canonical `Product` type, the inventory form (selector, stock
        inputs hidden or disabled for a service, `type` in the create/update payload), the
        inventory list badge and low-stock filter, `ProductCard`, `CategoryProductsModal`,
        `AlertPanels` and the POS cart/scan/quantity paths.

### Work unit 7 — the backfill (dry-run first, authorisation gated)

16. [x] RED: add `backend/src/backfill/services-backfill.plan.spec.ts` pinning a pure planner:
        given the target list and the loaded products it returns exactly the matched rows, refuses
        a target that matches zero or more than one row, is idempotent for an already-marked
        service, and produces the `ADJUSTMENT_OUT` quantity equal to the previous stock.
17. [x] GREEN: implement the pure planner plus the thin CLI `backend/prisma/backfill-services.ts`
        wired as `backfill:services`: `--dry-run` is the default, `--apply` is required to write,
        production requires an explicit `BACKFILL_ALLOW_PRODUCTION=true` gate (mirroring
        `seed-org.ts`), and every write happens in one transaction.
18. [ ] Prove the dry run against the local scratch database and against production read-only,
        recording the exact 6 rows, their previous stock and their previous contributions.

### Verification and closure

19. [ ] Run the full backend suite and the frontend suite; record pass/fail, and state honestly
        that the `*.int.spec.ts` suites need a live database.
20. [ ] Run `prisma migrate diff` before and after and prove the drift set is unchanged.
21. [ ] Native review at the deliverable boundary under the user-owned review switch.
22. [ ] Run the backfill against production **only** after explicit human authorisation and a
        backup; this is a separate, destructive step and is not covered by any commit.

## Out of scope

- **The 5 pre-existing schema drifts** (`PaymentRecord.method` type, `Sale.userId` /
  `InventoryMovement.userId` nullability, the two FKs' `ON DELETE`, the missing `Expense` index).
  They belong to the #117 follow-ups and need their own corrective migration. Touching them here
  would fold an unrelated destructive change into this candidate.
- **The invented stock on real products** (`BATERIA` 999, `GUAYA` 998, `LIQUIDO` 9,991) and the
  165 phantom `PURCHASE` movements summing 26,951 units. Separate issue; needs a "no stock
  control" concept and real physical counts.
- **Classifying `ONRIS` (stock 0) and `LIQUIDO` (stock 9,991).** The owner left them undecided
  and the backfill must not guess.
- **Making the import template type-aware.** Imported rows default to `PRODUCT`; a service
  imported with stock remains possible and is documented, not fixed.
- `Test Org` (`test-001`) is left untouched by the backfill: it is not the real business.

## Review workload note

This touches roughly 25 files across two applications, which is far above the ~200-line review
guard. It is therefore proposed as **three chained review units**, plus the backfill:

| Unit | Content | Files |
|---|---|---|
| PR1 | Work units 1-3: schema, migration, shared rule, sales, products, low-stock | ~12 |
| PR2 | Work units 4-5: reports, valuation, dashboard count, purchase orders, exports | ~8 |
| PR3 | Work unit 6: frontend | ~10 |
| separate | Work unit 7: the backfill script, and the authorised production run | ~3 |

No commit, push or PR is created without the user asking. The production backfill is never run
without explicit authorisation and a backup.

## Verification evidence

Every command below was run by the parent session with PowerShell against
`backend/.env.development` (`localhost:5432/inventario_db`, the docker-compose scratch database).
The delegated writers have no working shell in this environment, so they produced files and the
parent produced every execution claim. No command was ever pointed at `.env.production`, and
`npx prisma migrate dev` was never run.

| Check | Command | Result |
|---|---|---|
| Rule module spec (RED) | `npm run test -- --testPathPatterns=product-type.logic` | FAIL — `Cannot find module './product-type.logic' from 'products/product-type.logic.spec.ts'` |
| Rule module spec (GREEN) | same | PASS 18/18 |
| Schema validity | `npx dotenv -e .env.development -- npx prisma validate` | `The schema at prisma\schema.prisma is valid` |
| Client regeneration | `npx prisma generate` | Generated Prisma Client v6.19.2 |
| Migration applied | `npx dotenv -e .env.development -- npx prisma migrate deploy` | `31 migrations found`, applied `20260919181830_add_product_type`, `All migrations have been successfully applied.` |
| Drift unchanged | `npx prisma migrate diff --from-url <dev> --to-schema-datamodel prisma/schema.prisma --script` | Byte-identical to the diff captured before the change: the same five drifts, and **zero** mentions of `Product.type` or `ProductType` |
| Column really exists | direct `pg_enum` / `information_schema.columns` / `pg_indexes` read | enum `PRODUCT, SERVICE`; `type` is `NO` (not nullable) with default `'PRODUCT'::"ProductType"`; index `Product_organizationId_type_idx`; all 7 pre-existing rows read back as `PRODUCT` |
| Sales spec (RED) | `npm run test -- --testPathPatterns=sales.service.selling-services` | FAIL 4 of 5. The service line called `product.updateMany`; the mixed sale called it **twice** instead of once; cancelling a service ran `product.update` with `{"data":{"stock":2},"where":{"id":"serv-1"}}`. The one passing test is the PRODUCT-only control. |
| Sales spec (GREEN) | `npm run test -- --testPathPatterns=sales.service` | PASS 3 suites / 40 tests (includes the pre-existing sales specs) |
| Products spec (RED) | `npm run test -- --testPathPatterns=products.service.service-type` | FAIL 7 of 8. Notably `product.create` received `stock: 9996` for a service, and the service stock edit wrote `{"stock":500}`. The one passing test is the PRODUCT control. |
| Products spec (GREEN) | `npm run test -- --testPathPatterns=products` | PASS 6 suites / 99 tests, after two follow-up fixes (see deviations 5 and 6) |
| Reports spec (RED) | `npm run test -- --testPathPatterns=reports.service.inventory-excludes-services` | FAIL 4 of 4; the valuation returned **10,006** units where the fixture asked for 10 |
| Reports spec (GREEN) | `npm run test -- --testPathPatterns=reports` | PASS 7 suites / 61 tests, after the follow-up fix (see deviation 7) |
| Full backend suite (after work unit 4) | `npm run test` | PASS 100 suites / 973 tests, 0 failures |
| WU5 RED, first attempt | `npm run test -- --testPathPatterns="purchase-orders.service.spec|exports.service.spec"` | 3 of 4 failed — but the purchase-order refusal test **passed**, which is how a vacuous RED was caught (deviation 9) |
| WU5 RED, after fixing the mock | same | FAIL for the right reasons: `Received promise resolved instead of rejected` (the service sailed onto the order) and `Expected number of calls: 0` (receiving moved stock); the two export tests received `product: { select: { name: true, sku: true } }` and the cell `"PURCHASE"` where `"SERVICE"` was expected |
| WU5 GREEN | `npm run test -- --testPathPatterns="purchase-orders|exports"` | PASS 4 suites / 32 tests |
| Final full backend suite | `npm run test` | **PASS 100 suites / 977 tests, 0 failures** |
| Typecheck | `npx tsc --noEmit -p tsconfig.build.json` | clean, no output |
| Lint delta | `npx eslint <each changed file>` compared against the same file at `master` | **no error added anywhere**; `products.service.ts` went 16 → 14 and `reports.service.ts` 19 → 18 (see deviation 10) |
| New-file lint | `npx eslint --fix <the 5 new files>` | 0 errors, 22 warnings; the repo tolerates warnings (`exports.service.ts` alone carries 83 at `master`) |
| WU6 RED (frontend rule) | `cd frontend && npm run test -- src/lib/product-type.test.ts` | FAIL — `Failed to resolve import "./product-type"` |
| WU6 RED (POS) | `... src/app/pos/page.behavior.test.tsx` | FAIL 3 of 4, all `Unable to find an accessible element with the role "button" and name "Mantenimiento"` — the zero-stock service was filtered out of the grid. The passing one is the zero-stock **product** control, which is a guard, not a RED. |
| WU6 RED (inventory) | `... src/app/inventory/page.characterization.test.tsx` | FAIL — `expected document not to contain element, found <h3 ...>`: the service appeared under "Stock Bajo" because `0 <= 5` |
| WU6 GREEN | the same three files | PASS 3 files / 42 tests |
| Full frontend suite | `cd frontend && npm run test` | **PASS 72 files / 417 tests, 0 failures** |
| Frontend typecheck | `npx tsc --noEmit` | clean, no output |
| Frontend lint | `npx eslint <the 8 touched frontend files>` | **zero problems, not even a warning** |
| Quarantine contract | `cd frontend && npm run check:quarantine` | passes |
| Line-ending check | `git diff --numstat frontend/src/types/index.ts` | `4	0` — four insertions, zero deletions, so the CRLF conversion the writer warned about produced no diff noise |
| WU7 RED | `npm run test -- --testPathPatterns=services-backfill` | FAIL — `Cannot find module './services-backfill.plan'` |
| WU7 GREEN | same | PASS 15/15 |
| Local dry run | `npm run backfill:services` | Refuses: `No se encontró la organización con slug "FMC-001"` — exit 1, no writes. Proves the organization scoping that keeps `test-001` out of reach. |
| Production dry run attempt | `BACKFILL_ALLOW_PRODUCTION=true npx dotenv -e .env.production -- npx ts-node prisma/backfill-services.ts`, **no** `--apply` | FAILED at the first read: `The column Product.type does not exist in the current database`. Nothing was written. |
| Production migration state | `npx dotenv -e .env.production -- npx prisma migrate status` | 31 migrations found, and **only** `20260919181830_add_product_type` is pending |
| Production drift | `npx prisma migrate diff --from-url <production> --to-schema-datamodel prisma/schema.prisma --script` | The same five pre-existing drifts as local, plus the expected not-yet-applied `ProductType` statements |
| Final backend suite | `npm run test` | **PASS 101 suites / 992 tests, 0 failures** |
| WU7 new files lint | `npx eslint src/backfill/*.ts` then `--fix` | 0 errors after the fix |

RED evidence is genuinely observed for all five work units; nothing had to be reconstructed by
reverting files, unlike the previous feature in this repository. One RED was vacuous on the first
attempt and only running it revealed that (deviation 9).

### Predicted production effect (not yet measured)

The code change alone does not move the report, because every existing row is still `PRODUCT`:
the migration defaulted them that way. The type filter starts excluding the six columns only once
the backfill marks them. Expected effect on `Motors Club` (`FMC-001`) once it does:

| Metric | Reported today | Contributed by the 6 services | Expected after the backfill |
|---|---:|---:|---:|
| Units in stock | 28,822 | 13,948 | 14,874 |
| "Lo que vale si vendés todo" | $584,402,000 | $321,186,000 | $263,216,000 |
| "Lo que costó tu inventario" | $167,161,600 | $20,827,000 | $146,334,600 |
| "Ganancia posible" | $417,240,400 | $300,359,000 | $116,881,400 |

The remaining ~$194.8M of fiction (`BATERIA` 999, `GUAYA` 998, `LIQUIDO` 9,991) is the second,
separate defect and is untouched by this feature. Subtracting it leaves roughly the $68.4M that the
inventory is actually worth.

## Disclosed deviations

1. **Routing fallback forced by a broken shell.** The mandatory delegation triggers did fire, and
   every file after the first was written by a delegated `gentle-ai-worker`, but no writer in this
   environment can execute anything: their `bash` fails with
   `execvpe(/bin/bash) failed: No such file or directory`, identically for `echo hello`. Writers
   therefore produced files and the parent ran every command. The consequence is honest but worth
   naming: the implementer never observed its own verification, so the parent owns all evidence.
   The parent's own `bash` tool is equally broken; `powershell` works.
2. **After the first direct file write, the ODD multi-file write guard refused further direct
   parent writes** ("ODD multi-file write refused before mutation ... Delegate this additional file
   through subagent_run"). That is why every later file, including the specs, went through a
   delegated writer. It cost one extra round trip per file and is the reason work units are split
   into a spec delegation and a source delegation.
3. **Behaviour change beyond services: a product created with stock 0 no longer gets an opening
   movement.** `create()` previously called `createInventoryMovement(product.id, 'PURCHASE', 0,
   product.stock, 'Initial stock', ...)` unconditionally, which wrote a zero-quantity `PURCHASE`
   row for a zero-stock product. It now routes through `resolveInitialStockMovement`, which returns
   `null` for zero stock, so that row is never written. This is intended and is pinned by the rule
   spec, but it changes the kárdex for ordinary products and applies to every new zero-stock item.
4. **`update()` now always writes `stock: newStock`** into the `updateMany` payload, so an update
   that omits `stock` rewrites the same value back instead of leaving the column untouched. The
   value is unchanged, so this is a no-op in data terms, but it is a changed write payload.
5. **A real asymmetry was found and closed during the unit.** Deciding the movement with
   `resolveStockDeltaMovement(existingProduct.type, ...)` meant a **SERVICE → PRODUCT** conversion
   wrote a real stock value with **no** movement at all: the kárdex gained units it could not
   explain. This was not in the original plan; it was surfaced by the writer tracing the rule by
   hand and was then pinned with its own RED spec (which failed with
   `Expected number of calls: 1 / Received number of calls: 0`) before being fixed. The fix derives
   a `movementBasis` that is stocked as soon as **either** the previous or the resulting side tracks
   stock, which preserves the already-correct PRODUCT → SERVICE direction. The naive fix of passing
   the effective type would have silently broken that direction instead.
6. **Two sets of stale exact-shape expectations were updated**, both as intended additive
   consequences, not as accommodation:
   - `products.service.spec.ts` — `FLAT_PAYLOAD_KEYS` gained `type`, because `searchProducts` and
     `quickSearch` now return the discriminator. Four assertions read that one constant.
   - `financial-reports.service.spec.ts` — the single literal `where: { organizationId, active }`
     assertion gained `type: 'PRODUCT'`. The surrounding valuation numbers were deliberately left
     alone: the fixture rows carry no `type` field, and `normalizeStockForType(undefined, n)`
     returns `n` because `tracksStock` only rejects `SERVICE`. At runtime `Product.type` is
     non-nullable, so `undefined` exists only in mocks.
7. **`type` had to be added to both product DTOs.** Without it `tsc` rejects the new specs with an
   excess-property error while ts-jest stays green (`isolatedModules: true` skips semantic
   diagnostics), so the omission would have broken `npm run build` invisibly.
8. **Declared boundaries that remain open, deliberately:**
   - `getDashboardKPIs.totalProducts` still counts services, because it is a catalog count
     (`product.count({ where: { organizationId, active: true } })`) and services legitimately live
     in the catalog. The valuation is what had to exclude them. This leaves "total products" and
     "low stock products" intentionally disagreeing about services.
   - The import template is not type-aware: an imported row defaults to `PRODUCT`, so a service can
     still be imported with stock.
   - The dashboard low-stock assertion is a raw-SQL text check, not a semantic one. It is honest
     about the predicate and cannot prove counting behaviour; that proof belongs to an integration
     spec, which this feature does not add.
   - The backfill has not been written or run, so the predicted production effect in the evidence
     table is arithmetic, not measurement.
9. **A vacuous RED was caught only because it was actually run.** The first version of
   `it('refuses to put a service on a purchase order')` **passed against the unmodified source**.
   The test mocked the supplier as `{ id: 'supplier-1' }`, so `create()` threw
   `BadRequestException('Proveedor inactivo')` at the supplier guard and returned before
   `computeItems` ever looked at the product, and before any sequence number was consumed. Both
   assertions passed for entirely the wrong reason. Fixed by making the mock supplier
   `active: true`, after which the test failed correctly with `Received promise resolved instead
   of rejected`. It was then strengthened to assert that no order number was consumed and that
   neither `purchaseOrder.create` nor `purchaseOrderItem.create` was called, because
   `rejects.toBeInstanceOf(BadRequestException)` alone would still pass for any bad request
   anywhere in the method. The parent deliberately did not add a message-matching assertion, to
   avoid coupling the spec to the error wording.
10. **Pre-existing lint debt was measured, not assumed, and deliberately not repaired.**
    `master` already fails ESLint on every shared file this feature touches:
    `sales.service.ts` 7 errors, `products.service.ts` 16, `reports.service.ts` 19,
    `purchase-orders.service.ts` 6, `exports.service.ts` 2 errors and 83 warnings. After the
    change the same files report 7, 14, 18, 6 and 2 errors and 84 warnings: **not one error was
    added**, and two files improved by accident. Repo-wide `npm run lint` was deliberately not
    run, because its script carries `--fix` and would reformat unrelated files and bury the
    review; `eslint --fix` ran only on the five new files, which now report 0 errors. Lint is not
    a CI gate: `.github/workflows/ci.yml` contains no lint or format step. Verification used the
    technique of linting `git show master:<path>` written to a temporary file inside `src`, then
    deleting it, so the baseline and the change were measured on the same rules.
11. **A pre-existing export defect was found and deliberately left alone.**
    `getRowData('products', item)` in `backend/src/exports/exports.service.ts` emits **8** cells
    against **7** headers and **7** column widths, and reads `item.label?.group?.name` and
    `item.label?.name` for a model that has no `label` relation at all, so the column headed
    "Category" is permanently `'N/A'` and every cell from index 3 onward is shifted one column
    right of its header. In the PDF path that also reaches `doc.rect(x, y, undefined, ...)`.
    Repairing it would fold an unrelated fix into this candidate, so it needs its own issue. The
    `inventory` export this feature does touch has eight headers, eight cells and eight widths.
12. **Ordering constraint found while preparing the frontend work: the backfill must NOT run
    before the frontend does.** `frontend/src/app/pos/page.tsx:262-265` builds the POS grid with
    `products.filter((p) => p.stock > 0)`; `addToCart` returns early when `p.stock <= 0`; and the
    scan path answers with `${product.name} no tiene stock disponible.` for a zero-stock product.
    The backfill sets the six services to `stock = 0`, so running it first would remove every
    service from the POS and make it impossible to invoice labour. The backend already sells a
    service with zero stock (work unit 2), so the only remaining blocker is that client-side
    gate. **Sequence: work unit 6, then the backfill.**
13. **A visual precedence bug was introduced and then fixed in the same unit.** The service chip in
    `ProductCard`'s `StatusChip` was first placed before the inactive branch, so an **inactive
    service rendered `Servicio` and hid the fact that it had been deactivated**. Reordered so the
    precedence is inactive → service → out of stock → low stock → active. The mistake came from the
    parent's own instruction listing the branches in the wrong order; running the full suite would
    not have caught it, because no test covered an inactive service.
14. **One sketched test assertion was unworkable and the writer caught it.** The POS cart badge
    renders `{cart.length} en carrito`, i.e. the number of distinct cart **lines**, not units, so
    clicking a single service three times shows `1 en carrito` and never `3 en carrito`. Asserting
    the sketch would have produced a test that can never pass in any implementation. It was replaced
    with `getByDisplayValue("3")` on the cart line's Stepper input, which fails for both defect
    branches: with the unfixed early return the cart stays empty, and with only the early return
    fixed the second click is swallowed by the stock cap.
15. **The frontend rule's parameter is deliberately wider than the enum.** `ProductCardData.type`
    is `string | null`, which is not assignable to `{ type?: ProductType }`, so the helper's
    structural parameter accepts `ProductType | string | null` instead of forcing a cast at every
    call site. Only `isService` decides what the value means, so the widening does not weaken the
    rule. Documented in the module itself.
16. **Two declared limitations of the new POS type filter.** The `Servicios` toggle filters only the
    current server-side page, exactly like the pre-existing favourites toggle, but unlike that one
    it does **not** hide the pagination block, so a service on another page is reached by paging.
    The POS empty state is also not type-aware: with the toggle on and no services on the page, the
    copy still falls back to the favourites/search wording. Neither was in the plan's detail and
    neither was changed.
17. **Production does not have the new column yet, so the backfill cannot run before a deploy.**
    The read-only dry run against production failed with
    `The column Product.type does not exist in the current database`, and
    `prisma migrate status` against production reports that **exactly one** migration is pending:
    `20260919181830_add_product_type`. Because `start:prod` chains `migrate:prod` (established in
    issue #116), deploying applies it, and `migrate deploy` never reconciles drift, so it applies
    that one additive migration and nothing else. The order is therefore forced: **frontend (done)
    → commit → deploy (which migrates) → backfill.** Nothing was written in this attempt.
18. **Production carries the same five pre-existing schema drifts as the local database**,
    verified read-only with `migrate diff`: `InventoryMovement_userId_fkey` and `Sale_userId_fkey`
    without `ON DELETE SET NULL`, both `userId` columns `NOT NULL`, `PaymentRecord.method` stored
    as `text` while the schema declares the `PaymentMethod` enum, and the missing
    `Expense_organizationId_labelId_idx`. So the `DROP COLUMN "method"` landmine described in the
    drift table is live in production too, and `prisma migrate dev` must never be pointed at it.
    Measured mitigation, stated so nobody over-reads the risk in either direction: production
    currently holds **0** `PaymentRecord` rows, so that specific destructive statement would
    destroy no data *today*. The other four drifts are real regardless, and all five belong to the
    #117 follow-ups, not to this feature.
19. **The production gate blocks reads as well as writes, which is deliberate but worth knowing.**
    With `NODE_ENV=production` and `BACKFILL_ALLOW_PRODUCTION` unset, the CLI refuses before its
    first database access, so even a dry run against production needs the flag. That mirrors
    `seed-org.ts` and makes the flag an "I am deliberately touching production" acknowledgement
    rather than a pure write switch. The dry run performed here set the flag and passed **no**
    `--apply`; the no-write property was verified by reading the file, not by trusting the flag:
    `applyPlan` — the only write path, lines 215 → 222 → 244 — is reachable only from line 347,
    which sits after the dry-run `return` at line 339. The production gate at line 275 precedes
    every Prisma call.
20. **`backend/prisma/` is outside the repository's lint scope.** The `lint` script globs
    `{src,apps,libs,test}/**/*.ts`, so files under `prisma/` are never linted, and the pre-existing
    scripts there already carry 68 errors between them (`seed.ts`, `seed-org.ts`, `provision.ts`).
    The new CLI's 20 prettier errors were deliberately left alone to stay consistent with its
    neighbours, and they are not a regression. The two new files under `backend/src/backfill/`
    *are* inside the lint scope; they were fixed with `eslint --fix` and now report zero errors.

## Execution order constraint

**The backfill must not be run before the frontend work lands.** With `stock = 0` and the current
client, `frontend/src/app/pos/page.tsx:262-265` drops every service from the POS grid, `addToCart`
refuses it, and the scanner reports it as out of stock — the business would lose the ability to
invoice labour. The backend is already able to sell a zero-stock service, so this is purely a
client-side gate.

Order, now fully determined by the evidence above:

1. frontend work — **done**;
2. commit the feature;
3. **deploy**, which runs `migrate:prod` and applies `20260919181830_add_product_type`; production
   is currently missing `Product.type` entirely, so the backfill cannot even read before this step;
4. run the backfill with `--apply`, after a backup and explicit authorisation, and note that its
   dry run also requires `BACKFILL_ALLOW_PRODUCTION=true`.

Steps 3 and 4 are the operator's, not the agent's. No commit, push, deploy or production write was
performed by this work.

## Native review outcome

Reviewed as four chained candidates, one per work unit, on per-unit branches in this clone
(`feat/product-service-type-u1` through `-u4`). Every candidate used an explicit committed range
(`baseRef` plus `committedOnly: true`) with the lineage id issued by `review.inspect`. A bare
`inspect` projects the working tree, not the commits, and would have reviewed only the unrelated
local `openspec/config.yaml`.

| Unit | Range | Lineage | Files / lines | Outcome |
|---|---|---|---|---|
| 1 | `master..2b9b2be` | `review-67d746e10d0bdf61` | 10 / 994 | **approved**, acknowledged, authority burned |
| 2 | `2b9b2be..05d2c6e` | `review-a735a75880558a65` | 7 / 428 | **approved**, acknowledged, authority burned |
| 3 | `05d2c6e..7315358` | none | 11 / — | **not reviewed** |
| 4 | `7315358..67d1655` | `review-d07fa2154356e9bc` | 5 / 1354 | **stopped terminally**, then superseded |
| 4 corrected | `7315358..HEAD` | `review-7bd70cbe8d0a2907` | 5 / 1385 | **`correction_required`**, fix applied, stopped terminally |

All ran at tier `medium` with the single provider-selected lens `review-reliability` and a
correction budget of 200. Units 1 and 2 opened no correction and closed with exactly one advisory
finding each. Both findings landed on a **spec**, and both matched limitations already disclosed in
this document before the review ran:

- Unit 1, WARNING, informational, `R3-cancel-after-type-change` at
  `backend/src/sales/sales.service.ts:486`: the cancel path decides from the product's current type,
  so a line sold while the item was a PRODUCT is not restored if the item later became a SERVICE,
  leaving its `SALE` movement unexplained.
- Unit 2, WARNING, informational, `R3-SqlMockJoin` at
  `backend/src/reports/reports.service.inventory-excludes-services.spec.ts:140-142`: the dashboard
  low-stock spec asserts the raw SQL **text**, so it cannot prove counting semantics and would
  false-negative on a correct parameterized implementation.

### Unit 4 — three findings, two CRITICAL, all in the only component that writes to production

The provider automatically escalated the first finding to a refuter round because it was
`inferential`. The refuter confirmed it, and the review then demanded one bounded correction.

1. `R3-concurrent-stale-stock` (CRITICAL, refuter-confirmed): the apply path wrote stock and
   recorded the adjustment from a plan computed before the transaction opened, with no version
   guard, so a concurrent sale could be overwritten to zero while the movement claimed the stale
   quantity. Fixed in `0753675`.
2. Self-caught while verifying that fix: **a version-only guard does not see a sale**.
   `backend/src/sales/sales.service.ts` contains zero occurrences of `version` and decrements stock
   without incrementing it, so the version would still match and the row would still be
   overwritten. The guard now pins the stock value as well, which makes the update a
   compare-and-swap on the value itself. Fixed in `67c249f`.
3. `R3-unrecognized-apply-arguments` (CRITICAL, deterministic): an unrecognised argument was only
   warned about and then ignored, so a mistyped scope flag fell back to the default organization
   while `--apply` was present, enabling an unintended write against the wrong organization. The
   parser now throws on anything it does not recognise. Fixed in `5e1b657` and verified by actually
   running the CLI with a mistyped flag together with `--apply`, which aborts before any database
   access.

### The correction route cannot close on the same lineage in this environment

After a correction changes the candidate, bound STATUS returns
`{"action":"stop","next_transition":{"kind":"stop","reason_code":"captured_artifacts_unverifiable"}}`
with `horizon: "terminal"`, and it never offers a re-verification slot. This reproduced identically
on the original unit-4 lineage and on the fresh lineage whose correction plan had been correctly
registered, with the candidate tree moving both times (`a2b47366` to `52633987`, and `16a4aaf3` to
`78f5159a`). Per the reason-code table that stop is terminal and calls for maintainer inspection;
this record is that inspection, and its finding is that the artifacts cannot be re-verified after a
candidate change through this host's route.

The route that does work is to **start a fresh lineage over the corrected candidate**. That is
exactly what produced finding 3: the fresh lineage re-reviewed the whole candidate rather than only
the correction.

### Pending, and how to resume

- Unit 4 has **no approval**. Verifying the corrected backfill needs a fresh lineage over
  `7315358..HEAD`. It re-reviews all five original paths every time, so it can legitimately surface
  another finding; three have already come out of two rounds, two of them CRITICAL.
- Unit 3, the frontend, has **no review at all**.
- The backfill must not be run against production until its review closes, and in any case not
  before the deploy that applies `20260919181830_add_product_type`, because production does not yet
  have the `Product.type` column.
- The three corrections live on `feat/product-service-type-u4`. `feat/product-service-type` was
  fast-forwarded to the same commit so that no branch carries the uncorrected script.
