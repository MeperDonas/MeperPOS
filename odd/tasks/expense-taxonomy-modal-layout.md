# Expense taxonomy modal responsive layout

Branch: `feat/expense-taxonomy-modal-layout`.
Base: `a6898cd3d81181f6b02557444da3829998078238`.

## Authorized scope

Reintroduce the visual intent of commit 099148a on current code, not the whole retained branch. Widen ExpenseTaxonomyModal from lg to xl; stack the new-group controls on mobile and use a row at sm; display group cards in two columns at md with minimum-width constraints. Preserve ADMIN gating, group/label actions, and the nested new-label row.

Allowed source/test surfaces: `frontend/src/components/expenses/ExpenseTaxonomyModal.tsx` and `frontend/src/components/expenses/ExpenseTaxonomyModal.test.tsx`.
Non-goals: expense deletion, backend/hooks, taxonomy semantics, extra responsive redesign.

## Execution and delivery

Route: delegated direct writer for source and test; parent coordinates runtime verification and publication. Multi-file implementation trigger applies. Strict TDD from openspec/config.yaml strict_tdd/rules.apply.tdd; Vitest runner. Tests first, observe RED against current source, then GREEN; no fabricated outcomes.
Forecast: 100 authored changed lines including this document. Strategy: ask-on-risk, one coherent PR slice, separate from removal of the expense-delete UI.

## Tasks

- [x] Extend Modal mock to expose size and assert intended responsive structure without positional DOM traversal. Observe RED.
- [x] Apply narrow responsive layout changes and observe GREEN; retain existing render test.
- [x] Verify focused/full frontend suites, typecheck, touched-file lint and production build.
- [ ] Check browser rendering at mobile and desktop widths, or explicitly disclose why not performed. Class assertions alone do not establish rendered visual quality.
- [ ] Commit work unit; assess and follow native review plan.
- [ ] Create issue, await owner status:approved, publish PR and verify CI. Owner merges.

## Verification commands

From frontend:
- `npm.cmd run test -- src/components/expenses/ExpenseTaxonomyModal.test.tsx`
- `npm.cmd run test`
- `npx.cmd tsc --noEmit`
- `npx.cmd eslint src/components/expenses/ExpenseTaxonomyModal.tsx src/components/expenses/ExpenseTaxonomyModal.test.tsx`
- `npm.cmd run build`

Runtime scenario: open taxonomy modal as ADMIN at narrow/mobile and wide/desktop widths and inspect new-group controls and group cards. No live authenticated browser execution has been performed yet. Child command runtime has no PowerShell and Bash is missing; parent PowerShell may be required to observe tests.
Rollback: revert modal size/layout classes and related structural assertions/doc only; no database or API changes.

## Evidence

Read-only map confirmed current lg modal, non-stacking group-creation row and vertical group list. Tests-first stage now exposes the Modal size prop and adds separate assertions for xl, mobile stacking/sm row, and single-column/md two-column group cards with min-w-0. Two group fixtures identify the shared card list; containers are selected by semantic contents rather than layout classes or positional parent traversal. The original administrator rendering test is preserved; this file contained no separate action or non-admin role tests.

RED observed by parent via PowerShell: from frontend, `npm.cmd run test -- src/components/expenses/ExpenseTaxonomyModal.test.tsx` exited 1 with 3 failed and 1 passed (4 total), before component changes. Failures matched the intended contracts: size lg instead of xl, new-group controls missing flex-col/sm:flex-row, and group list missing grid/grid-cols-1/md:grid-cols-2.

After parent authorization, the component now requests xl, stacks new-group controls with stretch alignment until sm, wraps the new-group input in min-w-0 flex-1, gives its button w-full shrink-0 sm:w-auto, and uses a single-column/md two-column group grid with md:items-start and min-w-0 cards. ADMIN gating, mutation handlers and the nested new-label row are unchanged. Tests were not changed during this implementation stage.

Parent PowerShell verification observed GREEN 4/4, full frontend suite 513/513 in 76 files, typecheck exit 0, touched-file ESLint exit 0, and production build exit 0. Commands are listed above; no child runtime results are inferred. Child Bash/PowerShell was unavailable and not retried.

Adaptation from the old commit: the new-group Input is wrapped in min-w-0 flex-1 rather than placing flex sizing on its inner input; this preserves correct flex-item sizing for the actual Input component. The grid includes an explicit grid-cols-1 base.

Authenticated browser rendering was not checked: the environment check found no running frontend (3000), backend (3001), or browser debugging endpoint (9222), and no authenticated test session was established. This is a verification limitation, not a claim that a browser harness is impossible. Structural class assertions do not establish visual quality or absence of actual overflow. Browser verification remains pending and must be disclosed in publication.

Final review outcome belongs in memory/PR metadata, not a post-review edit to this file.
