# Remove the expense delete action from the UI

Branch: `feat/remove-expense-delete-ui`.
Base: `e3a231918a9b7b5b9475118fe16ae1dc499c3d48` (master after #187).

## Scope and evidence

The expenses page still exposes a per-row "Eliminar gasto" action with a confirmation dialog. The owner asked for that affordance to be removed from the interface; the backend endpoint and the `useDeleteExpense` hook stay untouched so the capability remains available to other consumers.

Current state re-verified against merged master:
- `frontend/src/app/expenses/page.tsx`: `useDeleteExpense` import (8), `Trash2` import (37), `deleteTarget` state (117), `deleteExpense` hook (134), `handleDelete` (179-187), the row delete button (662-670), and the delete `ConfirmDialog` (729-735).
- `frontend/src/app/expenses/expenses-page.evidence.test.tsx`: `deleteMutateAsyncMock` declaration (18), mock entry (41), mock setup (157), and the `EXP-5` test (318-330).
- `grep "Eliminar gasto"` matches only those page regions plus the taxonomy group/label confirmations, which are unrelated.

Out of scope: `frontend/src/hooks/useExpenses.ts` and its tests, the backend delete endpoint, `ExpenseTaxonomyModal` group/label deletions, the duplicate flow, and the shared `ConfirmDialog` import (still used by duplicate).

Allowed surfaces: `frontend/src/app/expenses/page.tsx`, `frontend/src/app/expenses/expenses-page.evidence.test.tsx`, this document.

## RED and GREEN records

Strict TDD RED stage, frontend evidence test only. The `EXP-5` deletion test (`deletes an
expense after confirmation`) at the former lines 318-330 was replaced with a behavior-first
absence regression:

- `screen.queryAllByRole("button", { name: "Eliminar gasto" })` expected `toHaveLength(0)`.
- `screen.queryByText("Eliminar gasto")` expected to be `null`.

The assertions target the rendered affordance, not an implementation detail (no import or
class-name checks). At RED time the row button still renders, so the first assertion is the
one expected to fail. `frontend/src/app/expenses/page.tsx` is untouched, and
`deleteMutateAsyncMock` plus its mock entry/setup were left present at RED time because that
cleanup belonged to GREEN; they were removed in the GREEN stage below.

Observed RED evidence (captured by the parent via PowerShell, verbatim):

> npm.cmd run test -- src/app/expenses/expenses-page.evidence.test.tsx exited 1, "does not offer a per-row delete action (EXP-5)" failed with AssertionError: expected [ <button …> ] to have a length of +0 but got 1 at line 326; 12 passed, 13 total.

RED was authored in this child session and observed by the parent; the failing assertion is the
first one (`queryAllByRole` length 0), proving the affordance still rendered before removal.

GREEN was applied in this child session and then observed by the parent through PowerShell. Observed
GREEN evidence, from `frontend`:

- `npm.cmd run test -- src/app/expenses/expenses-page.evidence.test.tsx`: 13/13 passed, exit 0.
- `npm.cmd run test`: 513 passed across 76 files, exit 0.
- `npx.cmd eslint src/app/expenses/page.tsx src/app/expenses/expenses-page.evidence.test.tsx`: exit 0, no findings.
- `npx.cmd tsc --noEmit`: exit 0.
- `npm.cmd run build`: exit 0.

The removal diff touches only the two intended files: 34 deletions in the page (imports, state,
hook, handler, row button, delete dialog) and 8 insertions / 13 deletions in the test (absence
regression replacing the old `EXP-5` test plus the dead delete-only wiring). `ConfirmDialog`, the
duplicate flow, the taxonomy modal and every other row action are still present; the
`useDeleteExpense` hook and the backend endpoint are untouched.

## Execution plan

Strict TDD from `openspec/config.yaml`; Vitest for the frontend. Delegated direct writer, one reviewable slice, `ask-on-risk`, forecast ~60 authored changed lines. Do not shrink the change to satisfy a line budget.

- [x] RED: add an absence regression asserting no "Eliminar gasto" action is rendered, and observe it fail while the button still exists.
- [x] GREEN: remove the row button, its `ConfirmDialog`, the `deleteTarget` state, the `deleteExpense` hook, `handleDelete`, and the now-unused `Trash2`/`useDeleteExpense` imports.
- [x] Clean the test mocks that only existed for the removed action, keeping duplicate/payment/detail/history/receipt coverage intact.
- [x] Run the focused page test, the full frontend suite, typecheck, touched-file ESLint, and the production build.
- [ ] Commit the work unit, assess, run independent verification, and close native review.
- [ ] Issue, owner approval, PR referencing the issue, CI. Owner merges.

## Verification

From `frontend`:
- `npm.cmd run test -- src/app/expenses/expenses-page.evidence.test.tsx`
- `npm.cmd run test`
- `npx.cmd tsc --noEmit`
- `npx.cmd eslint src/app/expenses/page.tsx src/app/expenses/expenses-page.evidence.test.tsx`
- `npm.cmd run build`

Parent PowerShell observes RED before the removal and GREEN after; child command tools have no working shell. Runtime boundary: jsdom render through the existing evidence test; no browser session is established.

Rollback: restore the removed page regions and the pre-existing `EXP-5` test; the hook, endpoint, and every other flow are untouched, so the revert cannot remove unrelated behavior.

## Evidence and limitations

Implementation and verification are complete in the working tree: RED and GREEN were both
observed by the parent, and the focused test, full suite, ESLint, typecheck and build all pass.
Commit, independent verification, native review, issue and PR remain open. Tests assert rendered
affordances, not authenticated browser rendering; the visual verification of the taxonomy modal
from the previous delivery is still a separate open gap. No reviewer may treat the absence
regression as proof about backend deletion or about the API contract.
