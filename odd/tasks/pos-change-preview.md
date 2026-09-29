# Feature: pos-change-preview

Rescue of a second fix stranded by the stacked-PR base error. Found while assessing the leftovers of
`feat/product-editor-card-polish` after the branch cleanup.

Branch: `fix/pos-change-preview` (from `master` at `60680b1`)
Original commit: `07939c0` "fix(pos): align the change preview with the server formula", authored
2026-09-25 on `feat/product-editor-card-polish`.

## Why this exists

The POS previews a change amount that the server does not persist, and the gap is reachable with an
ordinary mixed payment.

Master computes the two values with two different functions that share a name:

| Where | Expression in `master` |
| --- | --- |
| `backend/src/sales/sales.service.ts` (what is persisted) | `const change = cashPaid > total ? cashPaid - total : null;` |
| `frontend/src/components/pos/PaymentConfirmationModal.tsx` (what the cashier sees) | `const nonCashPaid = totalPaid - cashPaid;`<br>`const change = Math.max(0, cashPaid - Math.max(0, total - nonCashPaid));` |

Worked example, total 100,000 with cash 60,000 and card 60,000:

- The modal shows `Math.max(0, 60000 - Math.max(0, 100000 - 60000))` = **20,000**.
- The server persists `60000 > 100000` = false, so **`null`**.

The cashier hands back 20,000 COP on a sale the system records as having no change. The drawer ends
up short and no record accounts for the difference. Change is cash-only and measured against the full
total; it is never netted against a non-cash tender, and under-tendering the cash side yields no
change at all.

## Verified current state (evidence, not assumption)

- Both expressions above were read from `origin/master` with `git show`, not inferred: the defective
  preview is live in master today.
- `git log origin/master --grep="align the change preview with the server formula"` is empty, so no
  equivalent commit ever landed.
- The patch applies cleanly: `git diff --name-only 07939c0~1 origin/master -- <the 4 files>` is empty,
  meaning master never touched those files after the commit's parent. That is also independent
  confirmation that the fix never landed.
- Scope of the defect is the pre-sale preview only. The post-sale display reads the persisted value
  (`lastSale.change` in `app/pos/page.tsx`), and the three post-sale paths are already correct.
- Claim boundary: this is source-level evidence plus arithmetic. No live sale was executed and the
  browser preview was not reproduced.
- The stranded branch is pushed to `origin/feat/product-editor-card-polish`, so the content was never
  at risk of loss; only its delivery was.

## What this change is, and is not

This is a **rescue, not new implementation**. The deliverable is the original commit re-landed on
current `master` with `git cherry-pick`, which preserves authorship and the original message,
including the worked example above. Do not rewrite, reword or polish it beyond what a conflict or a
genuine defect forces. Its tests come with it.

The design the original commit chose is worth preserving deliberately: the preview becomes the *same
expression* as the server, and **no float tolerance is added**, because the server has none. Adding a
tolerance here would reintroduce the divergence this change exists to remove.

## Acceptance criteria

- [ ] The POS preview and the persisted sale record compute change with the same rule.
- [ ] A mixed payment where the cash side does not exceed the total previews no change, matching the
      persisted `null`.
- [ ] The post-sale display and the three post-sale paths keep reading the persisted value.
- [ ] No float tolerance is introduced into the preview.
- [ ] The original commit's tests arrive with it and pass on current `master`.
- [ ] Nothing outside the rescue changes: no unrelated refactor, no reformatting of untouched lines.

## Tasks

### Work unit 1 — re-land the fix

1. [ ] Cherry-pick `07939c0` onto `fix/pos-change-preview` and confirm it applies without conflicts
       (predicted clean; the pre-check above is empty).
2. [ ] Run the suites the commit carries and the POS behaviour suite:
       `PaymentConfirmationModal.test.tsx`, `useReceipt.test.ts`, `ThermalReceipt.test.ts`,
       `app/pos/page.behavior.test.tsx`.
3. [ ] Frontend typecheck and build.
4. [ ] Record the outcome and commit any resolution the cherry-pick required.

### Verification and closure

5. [ ] Full frontend suite if practical; otherwise state plainly what did not run and that CI is the
       signal. The backend is untouched by this change.
6. [ ] Native review at the deliverable boundary (RDD is on). The previous candidate's review START
       failed twice with an instantly-expired consent binding and then succeeded on a third attempt
       with a fresh idempotency key, so a first failure is not proof of a blocker; retry once with a
       new key before concluding anything.
7. [ ] Issue and PR follow the repository convention; push, PR and merge remain the owner's decisions.
8. [ ] Do **not** record the review outcome in this document after the review closes: editing a
       reviewed path creates a new unreviewed candidate. Record it in memory instead, and note that a
       remote PR body can be edited safely because it is not part of the candidate.

## Out of scope

- The other stranded commits on the same branch, kept separate so each review reads one concern:
  `a23bd8a` (untracked products badged as low on stock, plus serving `isLowStock` from the backend),
  `4e1739b` (typecheck fixes in low-stock fixtures, likely travelling with `a23bd8a`), and `bff5e0f`
  (stale claims in `AGENTS.md`).
- Any change to how change is *stored* or displayed post-sale. This change aligns the preview to the
  server, not the server to the preview.

## Review workload note

One work unit: a single cherry-picked commit touching 4 frontend files, two of them tests. Well
inside one review unit.

## Verification evidence

All commands were run by the parent session with PowerShell on `fix/pos-change-preview`.

| Check | Command | Result |
|---|---|---|
| Conflict pre-check | `git diff --name-only 07939c0~1 origin/master -- <the 4 files>` | empty, so the patch applies cleanly and master still holds the pre-fix file |
| Cherry-pick | `git cherry-pick 07939c0` | clean, no conflicts. New commit `0392cfd`, 4 files, +197/-2. Original author and message preserved; nothing rewritten. |
| The divergence is actually closed | compared both expressions after the apply | preview is now `const change = cashPaid > total ? cashPaid - total : 0;` against the server's `const change = cashPaid > total ? cashPaid - total : null;`. Identical predicate and arithmetic, no tolerance. |
| Target suites | `npm run test -- src/components/pos/PaymentConfirmationModal.test.tsx src/hooks/useReceipt.test.ts src/components/pos/ThermalReceipt.test.tsx src/app/pos/page.behavior.test.tsx` | **PASS 55/55 across 4 files** |
| Typecheck | `npx tsc --noEmit` | clean, exit 0 |
| Lint (touched source files) | `npx eslint src/components/pos/PaymentConfirmationModal.tsx src/hooks/useReceipt.ts` | clean, exit 0 |
| Frontend build | `npm run build` | `Compiled successfully in 10.4s`, 30/30 static pages, exit 0 |
| Full frontend suite | not run locally | CI runs it. The backend is untouched by this change, so its full suite has no bearing here. |

## Disclosed deviations

1. **This commit is not mine, and it is re-landed verbatim.** Authored on 2026-09-25 by Santiago Villabona
   on `feat/product-editor-card-polish`. The cherry-pick preserves the original author, the original
   message (including the worked example) and its tests. Nothing was rewritten. My contribution is the
   diagnosis, the delivery and the evidence.
2. **`0` on the client versus `null` on the server is intentional, not a new divergence.** The server
   stores `null` to mean "no change"; the client uses `0`, which is falsy for the modal's existing
   `change > 0` render guard, so nothing is displayed in either case. Recorded here so a reviewer does
   not read the difference as the same class of bug this change removes.
3. **Evidence is source-level plus arithmetic.** No live sale was executed and the browser preview was
   not reproduced. The worked example is computed from the two expressions as they appear in master.
4. **Only the pre-sale preview changed.** The post-sale display and the three post-sale paths already
   read the persisted value, and the commit adds tests pinning that they keep doing so.
5. **The full frontend suite did not run locally**, to keep the loop short; CI runs it and the build,
   typecheck and the four target suites are green here. The backend is untouched.

## Native review outcome

Recorded in memory, not here, by design (see task 8).
