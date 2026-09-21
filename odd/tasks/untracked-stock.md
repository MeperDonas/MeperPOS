# Feature: untracked-stock

Issue: MeperPOS #150 — "Separate stock control from item meaning: a product can be merchandise
without tracked stock"
Branch: `feat/150-untracked-stock` (from `master` at `0c98792`)
Supersedes nothing. Depends on the `product-service-type` feature, which is merged.

## Why this exists

The POS refuses to sell an item whose stock is zero, so stock gets invented to make an item
sellable. For services that was solved by `ProductType`; real merchandise has the same problem but
no place to express it. Measured on production (`Motors Club`, `FMC-001`):

- Six products carry a round initial stock together with the form's untouched default
  `minStock = 5` and contribute **~$121,237,000** to an inventory valuation of **$183,296,000**:
  `LIQUIDO` `SERV 3` (9,991 units, **54% of the whole report**), `GUAYA` `1234` (998),
  `ACEITES` `LIQUIDO` (91), `CAPUCHON` `SERV 15` (100), `VALBULINA` `SERV 5` (98),
  `BATERIA` `SERV 7` (0, zeroed by hand). The owner later confirmed that `ACEITES` is deliberately
  a single generic product covering motorbike oils rather than one per brand, so it is real stock
  and stays tracked; the other five are untracked.
- **The stock was never accumulated.** Every case traces to a single `PURCHASE … "Initial stock"`
  at creation, except `BATERIA` which was created at 0 and raised with `ADJUSTMENT_IN 0→1000`.
  Sales only ever decrease stock, so these are inputs, not the result of any process.
- **Zeroing makes an item unsellable**, which is the proof that "just set it to 0" is wrong:
  `BATERIA` was zeroed on 2026-09-20 and now has `type = PRODUCT`, `stock = 0`, so the POS filter
  `effectiveStock(p) > 0` removes it from the grid and `addToCart` refuses it.
- **`minStock = 5` alone is not a usable signal**: it returns 20 products, most of them ordinary
  tracked small stock (`PASTILLAS` 46, `SUICH` 43, `PROTECTORES DE TACOMETRO` 39, `ADINIOS BARRAS`
  30, `PORTA PLACA CROMADO` 23, `FILTROS` 23). The real 2026-08-24 load uses non-round numbers with
  considered minimums (`COCUYOS LED` 633/min 50, `MODULOS LED` 154/min 30, `MANILARES` 107/min 15).

The underlying gap: **`ProductType` answers two different questions with one field** — what the item
*is*, and whether its stock is *controlled*. A service is "no" to both, which is why one field
sufficed. A battery is merchandise **yes** and stock-controlled **no**.

## Decisions taken (owner)

1. **`Product.tracksStock: boolean`** orthogonal to `type`. Rejected a third `ProductType` value
   `UNTRACKED` (it puts a policy inside a type; a battery is still merchandise, and it could never
   express a service with tracked consumables). Rejected a category flag (categories are already
   mixed — `Filtros` holds both labour and goods).
2. **An untracked item cannot be added to a purchase order**, consistent with services. Such a
   purchase belongs in the expenses module.

## Verified current state (evidence, not assumption)

- `backend/src/products/product-type.logic.ts` is the single backend authority:
  `tracksStock(type)`, `normalizeStockForType(type, stock)`, `resolveInitialStockMovement(type, stock)`,
  `isLowStock(type, stock, minStock)`, `resolveStockDeltaMovement(type, previousStock, nextStock)`.
  `frontend/src/lib/product-type.ts` is its twin: `isService`, `effectiveStock`, `UNLIMITED_STOCK`.
- **Seven production call sites of `tracksStock`**: `products.service.ts:437` (movement basis),
  `purchase-orders.service.ts:103` (refuse a service) and `:487` (receive guard),
  `sales.service.ts:217` (create loop) and `:489` (cancel guard), plus the four internal uses inside
  the logic module.
- **Three report surfaces filter on the type directly**, not through the rule:
  `reports.service.ts` valuation query (`type: ProductType.PRODUCT`), movement query
  (`product: { type: ProductType.PRODUCT }`), and the dashboard low-stock raw SQL
  (`AND "type" = 'PRODUCT'`).
- `products.service.ts` create/update call `normalizeStockForType`, `resolveInitialStockMovement`
  and `resolveStockDeltaMovement`; the two `isLowStock` mappers are at `:501`-ish and `:546`-ish.
- The sale line carries `productType: ProductType` computed from the outer product lookup, which is
  what the create loop consults. It must carry `tracksStock` too.
- Frontend consumers: `app/pos/page.tsx` (grid predicate, cart caps, scan guards, paused repricing),
  `app/inventory/page.tsx` (client low-stock filter, form, payload), `components/products/ProductCard.tsx`,
  `components/categories/CategoryProductsModal.tsx`, `hooks/usePausedSales.ts`.
- Test commands: backend `npm run test -- --testPathPatterns=<path>` (plural; the singular in
  AGENTS.md fails on Jest 30). Frontend `cd frontend && npm run test -- <path>` (vitest).
- The delegated writers have no working shell in this environment, so the parent runs every command.

## Design

**Schema.** `Product.tracksStock Boolean @default(true)`, plus `@@index([organizationId, tracksStock])`
to match the existing `[organizationId, type]` index if the query shapes need it.

**Hand-written migration**, applied with `migrate deploy`, never `migrate dev` (the repository has
five open drifts, including a `PaymentRecord.method` `DROP COLUMN` landmine):
1. `ALTER TABLE "Product" ADD COLUMN "tracksStock" BOOLEAN NOT NULL DEFAULT true;`
2. `UPDATE "Product" SET "tracksStock" = false WHERE "type" = 'SERVICE';`
3. the index.
Step 2 exists so the **data tells the truth**. Without it, services would keep `tracksStock = true`
and only the rule's defensive clause would save them from becoming low-stock alerts — and every
service has `minStock = 5` with `stock = 0`, so they would fire immediately.

**The rule, extended.** The module takes the item instead of the bare type:
```ts
export type StockSubject = { type: ProductType; tracksStock: boolean };

export function tracksStock(item: StockSubject): boolean {
  // An item is stock-controlled when it declares it AND it is merchandise. The write
  // boundary keeps a service at tracksStock = false, and this clause makes the rule total
  // even if a row ever disagrees.
  return item.tracksStock && item.type !== ProductType.SERVICE;
}
```
Every other function in both modules takes the same `StockSubject`, so a single line per side
changes and the seven call sites become mechanical.

**Invariant at the write boundary.** Creating or updating with `type = SERVICE` forces
`tracksStock = false`. No invalid combination can be stored.

**Behaviour of an untracked item**: sellable from the POS with no ceiling and no stock chip,
excluded from the valuation, the low-stock alerts, the movement totals and the kárdex, and not
orderable. `costPrice` stays meaningful, so profit on a sale is still complete — the real
distinction from a service.

## Acceptance criteria

- [ ] AC1 `Product.tracksStock` exists, defaults to `true`, and is `false` for every existing service.
- [ ] AC2 A `SERVICE` cannot be stored with `tracksStock = true`.
- [ ] AC3 An untracked product is sellable from the POS with no stock and no quantity ceiling.
- [ ] AC4 An untracked product never appears in the valuation, the low-stock alerts, the movement
      totals or the kárdex.
- [ ] AC5 An untracked product cannot be added to a purchase order, and receiving one moves no stock.
- [ ] AC6 Both logic modules read the flag, so the rule cannot diverge between backend and frontend.
- [ ] AC7 The data correction is confirmed-list based, dry-run by default, fail-closed and
      idempotent, and writes one explaining `ADJUSTMENT_OUT` per row.

## Tasks

Strict TDD. RED observed before every GREEN.

### Work unit 1 — the flag and the rule

1. [x] RED: rewrite `backend/src/products/product-type.logic.spec.ts` for the new `StockSubject`
       contract: `tracksStock({ type: PRODUCT, tracksStock: true })` true;
       `({ type: SERVICE, tracksStock: false })` false; **`({ type: SERVICE, tracksStock: true })`
       false** (the invariant clause); and the same product/untracked mirror for
       `normalizeStockForType`, `resolveInitialStockMovement`, `isLowStock` and
       `resolveStockDeltaMovement`, keeping every existing behavioural assertion.
2. [x] GREEN: add `tracksStock` to `backend/prisma/schema.prisma`, hand-write
       `backend/prisma/migrations/<timestamp>_add_product_tracks_stock/migration.sql`, and extend
       the logic module to the new contract.
3. [x] GREEN: apply with `prisma migrate deploy` against the local database and prove with
       `prisma migrate diff` that the pre-existing drift set is unchanged.
4. [x] GREEN: mirror the contract in `frontend/src/lib/product-type.ts` + its spec.

### Work unit 2 — products owns the invariant

5. [x] RED: extend `backend/src/products/products.service.service-type.spec.ts` — a `SERVICE`
       forces `tracksStock = false`; an untracked product persists stock 0 with no opening movement
       and no adjustment movement; the low-stock query excludes it; `isLowStock` is false.
6. [x] GREEN: implement in `products.service.ts` and add `tracksStock` to both DTOs.

### Work unit 3 — sales

7. [x] RED/GREEN: the sale line carries `tracksStock`, and the create loop and the cancel guard ask
       the rule with it, so an untracked product is billed without stock and restored without it.

### Work unit 4 — reports

8. [x] RED/GREEN: the valuation query, the movement query and the dashboard raw SQL exclude
       untracked rows, expressed through the flag rather than the type.

### Work unit 5 — purchase orders

9. [x] RED/GREEN: an untracked product is refused like a service, and receiving one moves no stock.

### Work unit 6 — frontend

10. [x] RED/GREEN: the form declares the flag for a product and forces it off for a service, hiding
        the stock fields; the POS treats an untracked product like a service; the cards show no
        stock chip for it.

### Work unit 7 — the data correction (owner decision recorded)

11. [x] The owner confirmed the list on 2026-09-20. It is **five items, not six**: `LIQUIDO`
        (`SERV 3`, 9,991), `GUAYA` (`1234`, 998), `CAPUCHON` (`SERV 15`, 100), `VALBULINA`
        (`SERV 5`, 98) and `BATERIA` (`SERV 7`, 0) become untracked. **`ACEITES` stays tracked**: the
        owner explained that "Aceites" is deliberately one generic product covering motorbike oils
        rather than one per brand, so its 91 units are real stock. Expected effect on the inventory
        report: **$183,296,000 → ~$65,426,000**.
12. [x] **No second backfill script is written.** The `Maneja inventario` checkbox from work unit 6
        performs this correction through the already-reviewed write boundary: unticking it writes
        `tracksStock = false` and `stock = 0` and records the `ADJUSTMENT_OUT` from the stock the row
        actually held, so the kárdex explains the change exactly as a script would. `BATERIA` already
        sits at zero, so it receives the flag and no movement. At five items this is also the safer
        route: each one is visible to the operator, against a purpose-built script needing its own
        review.
13. [ ] Destructive production write, still owed: **merge and deploy first**, because production does
        not yet have the `tracksStock` column and the migration is what creates it; then **back up**;
        then untick the five items.

### Verification and closure

14. [ ] Full backend and frontend suites, typecheck, lint delta against `master`.
15. [ ] Native review at the deliverable boundary.
16. [ ] Push and PR remain the owner's decisions.

## Out of scope

- Re-counting any product's real stock. The owner's manual work.
- The 165 historical `PURCHASE` movements summing 26,951 units, which are the record of those
  initial loads.
- The four pre-existing schema drifts and the missing `Expense` index.
- `getDashboardKPIs.totalProducts`, which counts services on purpose.

## Review workload note

Seven work units across schema, both logic modules and six consumer areas, plus a data correction.
Expect three chained review units like the previous feature: the flag plus the rule, the backend
consumers, and the frontend.

## Verification evidence

All commands were run by the parent session with PowerShell. The delegated writers have no working
shell in this environment (`execvpe(/bin/bash) failed`, in their `bash` tool), so they produced files
and the parent produced every execution claim. Branch `feat/150-untracked-stock`, four commits.

| Check | Command | Result |
|---|---|---|
| Rule contract spec (RED) | `npm run test -- --testPathPatterns=product-type.logic` | FAIL **13 of 22** — the spec imports `normalizeStock` and `StockSubject`, neither of which existed, and the item-based calls disagree with the type-based signatures. The 9 passing tests are the tracked-product guards. |
| Rule contract spec (GREEN) | same | PASS 22/22 |
| Client regeneration | `npx prisma generate` | Generated Prisma Client v6.19.2 |
| Migration applied | `npx dotenv -e .env.development -- npx prisma migrate deploy` | Applied `20260920230000_add_product_tracks_stock`, success |
| Drift unchanged | `npx prisma migrate diff --from-url <dev> --to-datamodel` | Zero mentions of `tracksStock`; the same five pre-existing drifts |
| Write-boundary spec (RED) | `npm run test -- --testPathPatterns=products.service.service-type` | FAIL **8 of 18** — the invariant, the DTO field, the two low-stock predicates |
| Write-boundary spec (GREEN) | same | PASS 18/18 |
| Sales, purchase orders, reports (RED) | `npm run test -- --testPathPatterns="sales.service.selling-services\|purchase-orders.service.spec\|reports.service.inventory-excludes-services"` | **3 failed, 25 passed**. The three failures are exactly the report predicates. **Sales and purchase orders passed on the first run**, which is the evidence that the centralised rule already made them correct. |
| Those three (GREEN) | same | PASS 28/28 after the predicates and two stale expectations |
| Full backend suite | `npm run test` | **PASS 101 suites / 1012 tests, 0 failures** |
| Backend typecheck | `npx tsc --noEmit -p tsconfig.build.json` | clean |
| Frontend suite | `cd frontend && npm run test` | **PASS 72 files / 429 tests, 0 failures** |
| Frontend typecheck | `npx tsc --noEmit` | clean |
| Frontend lint | `npx eslint <the five touched frontend files>` | zero problems |
| Backend lint delta | each changed file linted against its `master` version | **no error added**; `products.service.ts` 14 → 14 and `reports.service.ts` 18 → 18, with warnings dropping |

## Disclosed deviations

1. **The flag's semantics were implemented the wrong way round first, and the tests caught it.** The
   rule was first written as `item.tracksStock && item.type !== SERVICE`, which makes an absent flag
   mean *untracked*. That broke **11 tests across 6 suites**, because every existing spec fixture
   builds a product row without the flag, and it also diverged from the frontend twin, which had been
   written as `item.tracksStock !== false` (absent means *tracked*, matching the column default).
   Aligning the backend to `!== false` fixed all 11 at once and removed a backend/frontend
   disagreement that would have been a real defect for any payload that omitted the field. The spec's
   22 assertions hold under either form, so they could not have caught it — the existing suite did.
2. **One test requirement I wrote was wrong, and the code was right.** I specified that turning
   tracking off on a product holding 40 units should write **no** kárdex movement. That recreates the
   unexplained-stock defect this feature exists to remove, and it contradicts the already-approved
   counterpart — converting a product into a service, which does record the `ADJUSTMENT_OUT`. The
   test was corrected to assert the movement, and the test name now says so.
3. **Work units 3 and 5 needed no production change at all.** Because work unit 1 centralised the rule
   and made every call site pass the item, sales and purchase orders already read the flag: an
   untracked product already skips stock on a sale and is already refused on a purchase order. The
   only production edit in that range was the refusal message, which said `El servicio` while it now
   also refuses an untracked battery. What those work units add is the proof, not the behaviour —
   their tests passed on the first run, which is recorded as evidence rather than presented as a RED.
4. **Two older exact-shape assertions in the reports specs gained the additive key.** Both pin a
   `where` object literally rather than with containment, so `tracksStock: true` broke them:
   `reports.service.inventory-excludes-services.spec.ts` and
   `financial-reports.service.spec.ts:257`. Intended additive consequences, not accommodation.
5. **The three report predicates keep the `type` predicate alongside `tracksStock: true`** rather than
   replacing it, so the query mirrors the rule's conjunction and cannot disagree with it even for a
   malformed row. The cost is a clause the data makes redundant; the benefit is that a SQL filter and
   the rule can never drift.
6. **The delegated writers repeatedly returned an RDD review disposition instead of their work**, and
   twice reported that they had made no edits while the edits had in fact landed. Every claim was
   therefore verified by **running** the suite rather than by reading the report, which is how the 11
   broken tests and both stale assertions were found. Their `bash` tool is broken in this
   environment, which is also why the parent ran every command.
7. **Work unit 7 is blocked on the owner**, not on engineering: the six-item candidate list in issue
   #150 needs confirmation, particularly `ACEITES` (actively sold, 10 movements) and `BATERIA`
   (already zeroed by hand). Nothing about the code correction can proceed without that answer.

## Native review outcome

To be filled at the deliverable boundary.
