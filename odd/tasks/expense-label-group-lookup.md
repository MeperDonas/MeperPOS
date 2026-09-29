# Reuse expense label group lookup

Branch: `refactor/expense-label-group-lookup`.
Base: `e3e06814e5f97066bc5dacc9074875d17ef68ba4`.

## Scope

Compute groupIdOfLabel(labelId) once per render and reuse its result for effectiveGroupId and effectiveLabelId in ExpenseFormModal. Preserve all existing loading, mismatch, inactive-label and group-selection behavior. No new memoization, taxonomy logic or UI changes.

Route: one bounded delegated worker for implementation and source preparation; parent coordinates publication. TDD enabled by openspec/config.yaml strict_tdd/rules.apply.tdd. This is a behavior-preserving refactor: observe existing tests GREEN before and after; do not invent a behavioral RED for an optimization that leaves outputs identical.
Runner: frontend Vitest. Exact commands below. Child command runtime has no PowerShell and Bash is unavailable; parent PowerShell fallback may be required.
Delivery: ask-on-risk, one PR slice, forecast 75 authored lines including this document. No SDD lifecycle.

## Tasks

- [x] Observe existing expense-form-modal suite before refactor (parent: 7/7 passed, exit 0).
- [x] Extract one labelGroupId value, reuse it in both effective computations; verify source has exactly one call for labelId.
- [x] Run expense form suite, typecheck, touched-file ESLint and frontend build. Report any failing/pending checks.
- [ ] Commit coherent work unit and follow native assessment/review.
- [ ] Create issue, owner approves, publish PR and verify CI. Owner merges.

## Verification

From frontend:
- `npm.cmd run test -- src/components/expenses/expense-form-modal.test.tsx`
- `npx.cmd tsc --noEmit`
- `npx.cmd eslint src/components/expenses/ExpenseFormModal.tsx`
- `npm.cmd run build`

Runtime harness: existing expense form component suite simulates form interactions; no authenticated browser smoke performed.
Rollback: revert local lookup-result extraction only, restoring original expression; no schema or storage mutations.

## Evidence

Parent observed baseline GREEN before the source edit: from frontend, `npm.cmd run test -- src/components/expenses/expense-form-modal.test.tsx` via PowerShell passed 7/7, exit 0. Behavior-preserving green-to-green refactor; no behavioral RED was introduced.

Extracted `const labelGroupId = groupIdOfLabel(labelId)` and reused it in both effective computations. Literal source search found exactly one `groupIdOfLabel(labelId)` call. Existing seven-test suite inspected read-only; no tests, helpers or memoization added. No claim of measured runtime impact.

Parent post-edit verification via PowerShell: expense form suite 7/7 passed; full frontend suite (`npm.cmd run test`) 510/510 passed in 76 files; typecheck and touched-file ESLint exit 0; production build exit 0 with 30 static pages. Parent source search independently confirmed exactly one lookup call. No authenticated browser smoke performed.

Child Bash was unavailable and not retried, so the parent executed all command verification. Targeted replacements preserved surrounding file content. No commits, issue/PR/push or native review performed by the child. Final review/publication evidence belongs in memory or PR metadata, not a post-review source edit.
