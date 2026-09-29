# Feature: sale-price-override-gate

Rescue of a fix that never reached `master`. Found during branch housekeeping, not by a failing test.

Branch: `fix/sale-price-override-gate` (from `master` at `0641673`)
Original commit: `26c4119` "fix(sales): gate unit price override to manager roles with audit", authored
2026-09-25 on `feat/product-editor-card-polish`.

## Why this exists

`master` currently resolves a sale line's unit price as the client's value first:

```ts
item.unitPrice ?? computeEffectiveSalePrice(product) ?? product.salePrice,
```

`item.unitPrice` is request-supplied, so any authenticated role decides what a product costs. The
commit this change rescues states the consequence directly: any authenticated `CASHIER` could sell a
300,000 COP product at 1 COP, and the server persisted it, decremented stock and printed a receipt with
that number. A user-supplied price that wins over the server's own calculation is not a UI affordance,
it is a revenue hole.

The fix is written, tested and committed. It is not in `master`.

## How it got stranded (verified)

This is the stacked-PR base error already documented in PR #160's body, repeating:

- PR #160 merged `feat/product-editor-card-polish-pr1` into `master` at 2026-09-26T16:06:20Z.
- PR #161 had base `feat/product-editor-card-polish-pr1`, **not** `master`, and merged at
  2026-09-26T16:15:47Z — nine minutes after that branch was already integrated.
- Its merge commit is `b75374d`, and `git log origin/master --grep="#161"` is empty. Master has no
  merge of #161, so #161's content was stranded by landing in an already-merged stacked branch.

One of the six commits on that branch, `89f5aa5` (decimal prices), was later rescued into `master` by
PR #162 as `f028761`. The other five were not.

## Verified current state (evidence, not assumption)

- `git show origin/master:backend/src/sales/sales.service.ts` still resolves the price with
  `item.unitPrice ?? ...`, so master is vulnerable today.
- `git log origin/master -S canOverridePrice -- backend/src/sales` is **empty**: the guard's symbol
  never existed anywhere in master's history, so no alternative implementation replaced it.
- `git merge-base --is-ancestor 26c4119 origin/master` returns non-zero: the commit is not in master.
- The patch applies cleanly: `git diff --name-only 26c4119~1 origin/master -- <the 7 files>` is empty,
  meaning master never touched any of those files after the commit's parent. This is also independent
  confirmation that the fix never landed, since master still holds the pre-fix version of the very file
  the fix changes.
- The stranded branch is pushed to `origin/feat/product-editor-card-polish`, so the content was never
  at risk of loss; only its delivery was.
- Claim boundary: this is source-level evidence. No live database or HTTP request was used, so the
  vulnerability was not reproduced at runtime.

## What this change is, and is not

This is a **rescue, not new implementation**. The deliverable is the original commit re-landed on
current `master`:

- Re-land `26c4119` with `git cherry-pick`, which preserves the original authorship and keeps the
  original message, including its vulnerability description and its disclosed behaviour change.
- Do not rewrite, reword or "improve" the commit beyond what a conflict or a genuine defect forces.
  Its tests come with it.
- Do not silently absorb the other four stranded commits. They are recorded as out of scope below so
  the review has one concern to read.

## Acceptance criteria

- [ ] `master` no longer lets a client-supplied unit price win over the server-derived price.
- [ ] An override requires ADMIN (or OWNER/SUPER_ADMIN, which inherit it), and a missing user is denied
      by default.
- [ ] An accepted override writes its audit record inside the sale transaction, so a lost audit rolls
      the sale back instead of dropping the trail.
- [ ] The original commit's tests arrive with it and pass on current `master`.
- [ ] The backend builds and the focused sales suites pass.
- [ ] Nothing outside the rescue is changed: no unrelated refactor, no reformatting of untouched lines.

## Tasks

### Work unit 1 — re-land the fix

1. [ ] Cherry-pick `26c4119` onto `fix/sale-price-override-gate` and confirm it applies without
       conflicts (predicted clean; the pre-check above is empty).
2. [ ] Run the focused backend suites carried by the commit
       (`src/sales/sales.service.spec.ts`, `src/sales/sales.controller.spec.ts`).
3. [ ] Run the backend build.
4. [ ] Run the frontend suites the commit touches (`src/app/pos/page.behavior.test.tsx`), since the
       commit also changes the POS request shape.
5. [ ] Record the outcome and commit any resolution the cherry-pick required.

### Verification and closure

6. [ ] Full backend suite if the environment allows it; otherwise state plainly that it did not run and
       that CI is the first end-to-end signal.
7. [ ] Native review at the deliverable boundary (RDD is on).
8. [ ] Issue and PR follow the repository convention; push, PR and merge remain the owner's decisions.
9. [ ] Do **not** record the review outcome in this document after the review closes: editing a reviewed
       path creates a new unreviewed candidate. Record it in memory instead.

## Out of scope

- The other four stranded commits on `feat/product-editor-card-polish`: `07939c0` (POS change preview),
  `a23bd8a` (serve `isLowStock` from the backend), `bff5e0f` (correct stale claims in `AGENTS.md`),
  `4e1739b` (typecheck fixes in low-stock fixtures). Each needs its own assessment; folding them in
  would trade one concern for four and inflate the review.
- Branch housekeeping itself. 102 local branches are provably safe to delete and 16 are not; that
  cleanup is tracked outside this change and must never delete `feat/product-editor-card-polish` before
  its content is rescued.
- Any change to how the POS renders or sends prices beyond what the original commit carried.

## Review workload note

One work unit: a single cherry-picked commit touching 7 files (backend sales service, controller and
their specs, plus the POS page, its behavior test and `useSales`). Well inside one review unit.

## Verification evidence

All commands were run by the parent session with PowerShell on `fix/sale-price-override-gate`.

| Check | Command | Result |
|---|---|---|
| Conflict pre-check | `git diff --name-only 26c4119~1 origin/master -- <the 7 files>` | empty, so the patch applies cleanly (and master still holds the pre-fix file) |
| Cherry-pick | `git cherry-pick 26c4119` | clean, no conflicts. New commit `9b76fa3`, 7 files, +767/-30. Original author and message preserved; nothing rewritten. |
| Focused sales suites | `npm run test -- --runInBand --runTestsByPath src/sales/sales.service.spec.ts src/sales/sales.controller.spec.ts` | **PASS 50/50** |
| DB-free regression sweep | same runner with `sales.service.selling-services.spec.ts`, `products.service.spec.ts`, `products.controller.spec.ts`, `receipts.service.spec.ts` | **PASS 136/136 across 6 suites**, so the price-resolution change damages nothing on the DB-free surface |
| Backend build | `npm run build` | clean, exit 0 |
| POS request shape | `cd frontend && npm run test -- src/app/pos/page.behavior.test.tsx` | **PASS 36/36** |
| Full backend suite | `npm run test` in `backend` | **NOT RUN**: no PostgreSQL was reachable on `localhost:5432`, and the integration specs require a real database. CI provisions `postgres:17`, so CI is the first end-to-end signal for this change. |

## Disclosed deviations

1. **This commit is not mine, and it is re-landed verbatim.** It was authored on 2026-09-25 by Santiago
   Villabona on `feat/product-editor-card-polish`. The cherry-pick preserves the original author, the
   original message (including its vulnerability description and its disclosed behaviour change) and
   its tests. Nothing was rewritten, reworded or polished, because the point of a rescue is that the
   reviewed artifact arrives intact. My contribution is the diagnosis, the delivery and the evidence.
2. **The full backend suite did not run locally**, because no database was reachable. The evidence
   above is the DB-free surface plus the focused suites. This is stated in the PR body rather than
   glossed, and CI covers it.
3. **The vulnerability was not reproduced at runtime.** The claim that master honours a client-supplied
   price rests on reading master's current source, on `git log -S` showing the guard never existed
   there, and on the stranded commit's own description. No live request was made.
4. **The other four stranded commits are deliberately not absorbed.** Folding them in would turn one
   reviewable concern into four and hide the security fix inside unrelated diffs.

## Native review outcome

Recorded in memory, not here, by design (see task 9).
