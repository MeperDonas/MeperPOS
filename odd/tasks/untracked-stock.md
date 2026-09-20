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
  `BATERIA` `SERV 7` (0, zeroed by hand).
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

1. [ ] RED: rewrite `backend/src/products/product-type.logic.spec.ts` for the new `StockSubject`
       contract: `tracksStock({ type: PRODUCT, tracksStock: true })` true;
       `({ type: SERVICE, tracksStock: false })` false; **`({ type: SERVICE, tracksStock: true })`
       false** (the invariant clause); and the same product/untracked mirror for
       `normalizeStockForType`, `resolveInitialStockMovement`, `isLowStock` and
       `resolveStockDeltaMovement`, keeping every existing behavioural assertion.
2. [ ] GREEN: add `tracksStock` to `backend/prisma/schema.prisma`, hand-write
       `backend/prisma/migrations/<timestamp>_add_product_tracks_stock/migration.sql`, and extend
       the logic module to the new contract.
3. [ ] GREEN: apply with `prisma migrate deploy` against the local database and prove with
       `prisma migrate diff` that the pre-existing drift set is unchanged.
4. [ ] GREEN: mirror the contract in `frontend/src/lib/product-type.ts` + its spec.

### Work unit 2 — products owns the invariant

5. [ ] RED: extend `backend/src/products/products.service.service-type.spec.ts` — a `SERVICE`
       forces `tracksStock = false`; an untracked product persists stock 0 with no opening movement
       and no adjustment movement; the low-stock query excludes it; `isLowStock` is false.
6. [ ] GREEN: implement in `products.service.ts` and add `tracksStock` to both DTOs.

### Work unit 3 — sales

7. [ ] RED/GREEN: the sale line carries `tracksStock`, and the create loop and the cancel guard ask
       the rule with it, so an untracked product is billed without stock and restored without it.

### Work unit 4 — reports

8. [ ] RED/GREEN: the valuation query, the movement query and the dashboard raw SQL exclude
       untracked rows, expressed through the flag rather than the type.

### Work unit 5 — purchase orders

9. [ ] RED/GREEN: an untracked product is refused like a service, and receiving one moves no stock.

### Work unit 6 — frontend

10. [ ] RED/GREEN: the form declares the flag for a product and forces it off for a service, hiding
        the stock fields; the POS treats an untracked product like a service; the cards show no
        stock chip for it.

### Work unit 7 — the data correction (BLOCKED on the owner's list)

11. [ ] BLOCKED: the candidate list in issue #150 needs the owner's confirmation, particularly
        `ACEITES` (actively sold) and `BATERIA` (already zero). Same mechanics as the services
        backfill. Expected effect if all six are marked: **$183,296,000 → ~$62,059,000**.
12. [ ] Destructive production write: needs explicit authorisation and a backup, and the deploy must
        precede it because production must have the column first.

### Verification and closure

13. [ ] Full backend and frontend suites, typecheck, lint delta against `master`.
14. [ ] Native review at the deliverable boundary.
15. [ ] Push and PR remain the owner's decisions.

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

To be filled as each work unit closes.

## Disclosed deviations

To be filled as they occur.

## Native review outcome

To be filled at the deliverable boundary.
