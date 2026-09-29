# Feature: low-stock-authority

Rescue of the third stranded fix. Unlike the previous two, this one **does not re-land verbatim**: the
patches conflict with current `master` and require real resolution.

Branch: `fix/low-stock-authority` (from `master` at `f12186a`)
Original commits: `a23bd8a` "fix(products): serve isLowStock from the backend instead of re-deriving
it" (10 files, +419/-31) and its companion `4e1739b` "test(products): fix typecheck errors in low-stock
fixtures" (2 files, +4/-6), both authored 2026-09-25 on `feat/product-editor-card-polish`.

## Why this exists

A product deliberately marked as not tracking stock still shows a low-stock badge.

`frontend/src/components/categories/CategoryProductsModal.tsx` in `master` computes the badge itself:

```ts
const service = isService(product);
const isOutOfStock = !service && product.stock === 0;
const isLowStock = !service && product.stock > 0 && product.stock <= product.minStock;
```

The gate is `isService` where it must be `tracksStock`. A `PRODUCT` created with `tracksStock = false`
(the point of the untracked-stock feature, issue #150) therefore keeps showing a low-stock badge
whenever its stale `stock` is at or below `minStock`, which defaults to 5. That is a user-visible
regression of feature #150, caused by the frontend re-implementing a rule it should not own.

The root cause is a payload gap, and it is also live in `master`:

| Method in `backend/src/products/products.service.ts` | Serves `isLowStock`? |
| --- | --- |
| `create` (line 126) | no |
| `findAll` (line 246) | no |
| `findOne` (line 321) | no |
| `update` (line 334) | no |
| `searchProducts` (line 557, payload at 585) | yes |
| `quickSearch` (line 594, payload at 632) | yes |

Because whole-row reads omit the field, the client re-implemented the rule in three places, and
`CategoryProductsModal` got it wrong. `frontend/src/components/categories/CategoryProductsModal.test.tsx`
**does not exist in `master`**, which is how the wrong gate survived: there was no test to catch it.

## Verified current state (evidence, not assumption)

- The wrong gate was read from `git show origin/master:frontend/src/components/categories/CategoryProductsModal.tsx`.
- The absent field was established by enumerating every `async` method in `products.service.ts` and
  locating each `isLowStock:` occurrence, so the gap is a fact about the current file, not an inference.
- `CategoryProductsModal.test.tsx` returns non-zero from `git show origin/master:...`, so it does not exist.
- The patches conflict: `git show <commit> | git apply --check` fails for both `a23bd8a` and `4e1739b`
  on `frontend/src/components/products/ProductCard.inventory.test.tsx`, which `master` has since changed.
  `git cherry-pick` does a three-way merge and may still succeed or conflict on fewer hunks than
  `git apply` reports; that will be established by attempting it, not by guessing.
- Claim boundary: source-level. No runtime reproduction, and the badge was not reproduced in a browser.

## Resolution policy for this rescue

This is the first rescue in this series that is not verbatim, so the policy is explicit:

1. **Preserve the original intent and authorship.** Use `git cherry-pick` so the original author and
   message survive wherever the commit is preserved.
2. **Resolve conflicts minimally.** In a test fixture, prefer adapting the fixture to the current code
   rather than reverting `master`'s later changes. `master` moving on is not a regression to undo.
3. **Do not silently drop intent.** If a hunk is genuinely obsolete because `master` already does the
   same thing another way, drop it and record it as a disclosed deviation with the reason. If a hunk is
   dropped merely because resolving it is inconvenient, the rescue is wrong and must stop instead.
4. **Do not widen the change.** If the architectural half (the single enrichment funnel that deletes the
   three client re-implementations) cannot be carried without touching unrelated code, prefer stopping
   and reporting over growing the diff.
5. **State plainly in the PR if this becomes a partial rescue.** A reviewer must never believe a
   verbatim re-land happened when it did not.

## Acceptance criteria

- [ ] An untracked product is never badged as low on stock in the category products modal.
- [ ] A tracked product with `stock <= minStock` still is, and a service still carries no stock chip.
- [ ] The field the modal reads is served by the whole-row reads, or the modal evaluates the rule
      through `tracksStock` rather than re-deriving it with `isService`.
- [ ] `CategoryProductsModal` gains tests covering the untracked case, since the absence of tests is
      what let the wrong gate survive.
- [ ] The backend rule stays in `product-type.logic.ts`; no second implementation of it is introduced.
- [ ] Nothing outside the rescue changes: no unrelated refactor, no reformatting of untouched lines.

## Tasks

### Work unit 1 — re-land and resolve

1. [ ] Attempt `git cherry-pick a23bd8a` and record whether it is clean, partially conflicted, or
       heavily conflicted, with the exact conflicted paths.
2. [ ] Resolve under the policy above; record every hunk dropped as obsolete and why.
3. [ ] Cherry-pick `4e1739b` on top, or explain why it is obsolete on current `master`.
4. [ ] Run the affected backend suites (`products.service.spec.ts`, `products.service.service-type.spec.ts`),
       the frontend `CategoryProductsModal` and `ProductCard.inventory` suites, and the inventory page
       suites the commit touches.
5. [ ] Backend build and frontend typecheck and build.

### Verification and closure

6. [ ] Full suites if practical; otherwise state what did not run. CI is the signal.
7. [ ] Native review at the deliverable boundary (RDD is on). On this project a first START failure
       with an instantly-expired consent binding was transient; retry once with a fresh idempotency key
       before concluding anything.
8. [ ] Issue and PR by the repository convention. Push, PR and merge remain the owner's decisions.
9. [ ] Do **not** record the review outcome in this document: editing a reviewed path creates a new
       unreviewed candidate. Record it in memory. A remote PR body can be edited safely.

## Out of scope

- The last stranded commit, `bff5e0f` (stale architecture, roles and auth claims in `AGENTS.md`),
  assessed separately.
- Any behaviour change to the low-stock rule itself; it stays in `product-type.logic.ts`.
- The three other client re-implementations, unless the original commit already deletes them.

## Review workload note

Up to 12 files across backend products, the inventory page, shared product components, types and tests.
If conflict resolution pushes this past one reviewable unit, stop and report rather than chaining
silently.

## Verification evidence

All commands were run by the parent session with PowerShell on `fix/low-stock-authority`.

| Check | Command | Result |
|---|---|---|
| Conflict pre-check | `git show a23bd8a \| git apply --check` | FAIL on `frontend/src/components/products/ProductCard.inventory.test.tsx`. `git apply` needs exact context; the three-way cherry-pick is more capable and the real conflict was smaller. |
| Cherry-pick `a23bd8a` | `git cherry-pick a23bd8a` | **ONE conflicted file** of ten: `frontend/src/app/inventory/page.tsx`, import lines only. Resolved. New commit `99c1f6f`, 10 files, +419/-31, original author and message preserved. |
| Cherry-pick `4e1739b` | `git cherry-pick 4e1739b --no-edit` | clean. New commit `dac08c8`, 2 files, +4/-6. |
| The wrong gate is gone | inspected `CategoryProductsModal.tsx` after the apply | now `const isLowStock = product.isLowStock === true;` and no `isService`-based re-derivation remains |
| Backend acceptance | enumerated methods and the enrichment funnel | all four whole-row reads return `this.enrichProduct(...)` (`create` 244, `findAll` 310, `findOne` 330, `update` 490), which composes `enrichWithLowStock` at 710; the rule is still evaluated only by `product-type.logic.ts` |
| Backend suites | `npm run test -- --runInBand --runTestsByPath src/products/products.service.spec.ts src/products/products.service.service-type.spec.ts src/products/product-type.logic.spec.ts` | **PASS 101/101 across 3 suites** |
| Frontend suites | `npm run test -- src/components/categories/CategoryProductsModal.test.tsx src/components/products/ProductCard.inventory.test.tsx src/app/inventory/page.characterization.test.tsx src/app/inventory/page.product-form.test.tsx` | **PASS 78/78 across 4 files** |
| Backend build | `npm run build` | clean, exit 0 |
| Frontend typecheck | `npx tsc --noEmit` | clean, exit 0 |
| Frontend lint (touched sources) | `npx eslint src/components/categories/CategoryProductsModal.tsx src/components/products/ProductCard.tsx src/app/inventory/page.tsx` | clean, exit 0 |
| Frontend build | `npm run build` | `Compiled successfully in 8.2s`, 30/30 static pages, exit 0 |
| Full suites | not run locally | CI covers them. |

## Disclosed deviations

**This rescue is NOT verbatim, unlike the previous two in this series.** Recorded first because a
reviewer must not be led to believe otherwise.

1. **One conflict, resolved by hand.** `git cherry-pick a23bd8a` conflicted in exactly one file,
   `frontend/src/app/inventory/page.tsx`, and only in its import block:

   | Side | Imports |
   | --- | --- |
   | `HEAD` (current master) | `{ cn, resolveTaxFields, toFiniteNumber } from "@/lib/utils"` and `{ isService, tracksStock } from "@/lib/product-type"` |
   | `a23bd8a` (based on an older master) | `{ cn, resolveTaxFields } from "@/lib/utils"` and `{ isService } from "@/lib/product-type"` |

   Master was the superset, because later commits added `toFiniteNumber` and `tracksStock`. Taking the
   commit's side would have reverted both additions, so master's lines were kept, per the policy that
   master moving on is not a regression to undo.

2. **The `tracksStock` import was then dropped, and this is the one line that is mine rather than the
   commit's.** With the rescue applied, the page no longer calls the function: the commit deletes the
   client-side low-stock re-implementation that was its only caller. Every remaining occurrence of the
   identifier in the file is a *property name* (`formData.tracksStock`, `tracksStock: true`) or an
   element id and label, not a call, so the import became unused. It was removed rather than left to
   trip the lint gate, and `toFiniteNumber` was kept because master's later decimal-normalisation work
   uses it at lines 169-174. Lint, typecheck and build all pass with this resolution, which is the
   evidence that the removal was correct rather than merely convenient.
3. **Nothing else was dropped or adapted.** The other nine files of `a23bd8a` and both files of
   `4e1739b` applied as the commits wrote them.
4. **Companion commit**: `4e1739b` applied cleanly on top of the resolved commit, so it stays in the
   change as its own commit rather than being folded in.
5. **Evidence is source-level.** The badge was not reproduced in a browser and no runtime check was
   made; the fix is established by reading the resulting gate, the enrichment funnel and the passing
   suites.

## Native review outcome

Recorded in memory, not here, by design (see task 9).
