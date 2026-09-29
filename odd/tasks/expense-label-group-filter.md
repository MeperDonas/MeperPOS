# Feature: expense-label-group-filter

Rescue of the last undelivered work in the repository, with one of the two available commits deliberately
discarded.

Branch: `fix/expense-label-group-filter` (from `master` at `ae2e0ab`)
Original commits: `d5b7613` **rescued** and `099148a` **discarded**, both authored 2026-09-04 on
`fix/134-expense-taxonomy-integration`.

## Why this exists

The expense form flattens every label of every group, so a label belonging to one group can be selected
while a different group is chosen.

`master` computes, in `frontend/src/components/expenses/ExpenseFormModal.tsx`:

```ts
const labelOptions = groups.flatMap((group) => [
```

There is no `groupId` state and no cascade, so the two-level taxonomy the expenses module introduced is
not enforced in the form that consumes it. `d5b7613` adds the group to label cascade and its tests pin
the intended behaviour:

- "starts with the label select disabled until a group is selected"
- "filters labels by group and clears the label when the group changes"
- the create payload no longer carries `categoryId`

## How it went undelivered (verified)

A third variant of the delivery failure this repository has produced repeatedly:

- PR #138 had base `master` and merged at 2026-09-04T04:58:53Z, merge commit `7a841dc`, which **is** an
  ancestor of `master`.
- The two commits are dated 2026-09-04T00:10:40-05:00, which is 05:10:40Z: about **twelve minutes after
  the merge**.
- The branch kept receiving commits after its PR had already merged, and nothing re-opened a pull
  request for them.

The other two variants seen in this repository are a stacked PR whose base was never `master` (PR #161,
which stranded five commits) and content that was re-landed by cherry-pick (the other four rescues).

## Verified current state (evidence, not assumption)

- `git grep` on `origin/master` shows `ExpenseFormModal.tsx` computing `labelOptions` by flattening every
  group, and no `groupId` state, so the cascade is genuinely absent.
- `ExpenseTaxonomyModal.tsx` still uses `size="lg"`, confirming the discarded commit's layout is absent
  too, which is what makes the discard a decision rather than an assumption.
- Both commits fail `git apply --check` against current `master`, so a conflict is expected; the
  three-way cherry-pick may still be more forgiving than `git apply` reported.
- Claim boundary: source-level. No browser reproduction of the form's behaviour.

## What this change is, and is not

- It **rescues `d5b7613` only**.
- It **discards `099148a`** ("improve taxonomy modal layout"). Recorded deliberately, not as an
  oversight: that commit is cosmetic (a wider modal and a responsive grid), and its tests assert CSS
  classes through `closest(".grid")`, the brittle-presentation style that has already broken tests in
  this repository when presentation drifted. Adding a presentation assertion that fails on a class
  rename buys nothing for a behaviour that already works.
- Nothing else from the branch is taken.

## Acceptance criteria

- [ ] The label select is disabled until a group is selected.
- [ ] Changing the group clears the selected label.
- [ ] The label options are filtered to the selected group.
- [ ] `categoryId` is no longer sent in the create payload.
- [ ] The change is behavioural; no CSS-class assertion is introduced by it.
- [ ] Nothing outside the rescue changes: no unrelated refactor, no reformatting of untouched lines.

## Tasks

### Work unit 1 — re-land and resolve

1. [ ] Cherry-pick `d5b7613` and record whether it is clean or conflicted, with the exact paths.
2. [ ] Resolve under the policy below; record every hunk dropped as obsolete and why.
3. [ ] Run the expense suites the commit carries and the expenses page suite.
4. [ ] Frontend typecheck and build; ESLint on the touched source files.

### Verification and closure

5. [ ] Full frontend suite if practical; otherwise state what did not run. The backend is untouched.
6. [ ] Native review at the deliverable boundary (RDD is on). On this project a first START failure with
       an instantly-expired consent binding was transient; retry once with a fresh idempotency key
       before concluding anything.
7. [ ] Issue and PR by the repository convention. Push, PR and merge remain the owner's decisions.
8. [ ] Do **not** record the review outcome in this document: editing a reviewed path creates a new
       unreviewed candidate. Record it in memory. A remote PR body can be edited safely.

## Resolution policy

1. Preserve the original intent and authorship via `git cherry-pick` wherever the commit is preserved.
2. Resolve conflicts minimally; in a test file adapt the fixture to the current code rather than
   reverting `master`'s later work. `master` moving on is not a regression to undo.
3. Do not silently drop intent. If a hunk is obsolete because `master` already does the same thing,
   drop it and record it as a disclosed deviation with the reason. If it is dropped only because
   resolving it is inconvenient, stop instead.
4. Do not widen the change.

## Out of scope

- `099148a`, discarded with the reason above.
- The remaining 13 local branches and the remaining 3 worktrees, which are separate decisions.
- Any change to the taxonomy data model or the groups/labels endpoints.

## Review workload note

One work unit: the component and its test, two files. Well inside one review unit.

## Verification evidence

All commands were run by the parent session with PowerShell on `fix/expense-label-group-filter`.

| Check | Command | Result |
|---|---|---|
| Conflict pre-check | `git show d5b7613 \| git apply --check` | FAIL on `expense-form-modal.test.tsx` |
| Cherry-pick | `git cherry-pick d5b7613` | **clean, no conflicts**, despite the pre-check. New commit `ca01169`, 2 files, +94/-15, original author and message preserved. |
| Lint of the rescued file | `npx eslint src/components/expenses/ExpenseFormModal.tsx` | **FAIL at first**: 1 error `react-hooks/set-state-in-effect` at 96:7 plus 1 warning `react-hooks/exhaustive-deps` at 66:9, both from the effect the commit adds. It was the only violation of that rule in the codebase. |
| The refactor | `ba428d7` | The effect is gone; the group and label are derived. **Lint now exits 0**, so both the error and the warning are cleared. |
| Expense suites | `npm run test -- src/components/expenses/expense-form-modal.test.tsx src/components/expenses/expense-detail-modal.test.tsx src/components/expenses/expense-taxonomy-modal.test.tsx src/app/expenses/expenses-page.evidence.test.tsx` | **PASS 26/26 across 3 files**, the same count before and after the refactor |
| Typecheck | `npx tsc --noEmit` | clean, exit 0 |
| Frontend build | `npm run build` | `Compiled successfully in 8.7s`, 30/30 static pages, exit 0 |
| Full frontend suite | not run locally | CI covers it. The backend is untouched. |

## Disclosed deviations

1. **This rescue is not a full re-land: `099148a` is discarded.** It is "improve taxonomy modal layout", which is cosmetic (a wider modal and a responsive grid), and its tests assert CSS classes through `closest(".grid")`, the brittle-presentation style that has already broken tests in this repository when presentation drifted. Its absence from master was verified (`ExpenseTaxonomyModal.tsx` still uses `size="lg"`), so this is a decision rather than an assumption.
2. **`ba428d7` is my change, not the original commit's**, and it is the substantive one. The rescued commit's effect called `setState` synchronously in its body, which the repository lints as an error and which was the only occurrence of that rule in the codebase. The effect was not doing anything an effect is for: clearing the label when the group changes was already handled by the group select's `onChange`, so what remained was consistency with the incoming expense and with asynchronously loaded groups, and that is now derived through `effectiveGroupId` and `effectiveLabelId`. State keeps the operator's choice; the effective values keep it consistent, and they feed both selects, the validation and both submit payloads.
3. **Two behaviours are deliberately preserved by that refactor.** While the groups are still loading nothing is dropped, because an edit form must not blank a label it cannot validate yet; and the label lookup is not filtered by `active`, so editing an expense that carries a now-inactive label does not silently clear it. Both were properties of the effect being replaced.
4. **`git apply --check` was stricter than the cherry-pick, for the second time in this session.** The pre-check failed and the three-way merge applied cleanly. Do not conclude "conflicted" from `git apply` alone.
5. **Evidence is source-level plus the suites.** No browser check of the form was made; the behaviour is established by the 26 tests and by reading the resulting select values, validation and payloads.

## Native review outcome

Recorded in memory, not here, by design (see task 8).
