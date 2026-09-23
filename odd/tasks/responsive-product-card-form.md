# ODD: Responsive product card and form

## Objective and problem
Redesign the shared product card in POS and inventory and rebalance the create/edit product modal. Current cards stack redundant chips and compressed price/stock details in narrow multi-column grids; the form places an oversized image next to a long column of controls and squeezes tax/stock fields on mobile. Deliver a legible, premium-feeling layout at phone, tablet, and desktop widths while keeping existing flows intact.

## Scope and constraints
- Frontend-only; reuse Kinetic Bento theme tokens, `cn()`, existing `ProductCard` mode contract, form state and submission handlers. Do not change API, product schema, or business validation.
- POS: retain add-to-cart, favorite toggle, keyboard interaction, promotion prices, inactive/service/out-of-stock state; inventory: retain edit, deactivate/reactivate, permissions, stock and promotion display.
- Modal: retain barcode focus and Enter behavior, image upload, category/type, prices, tax, conditional stock, promotion, description, inactive save restriction, delete confirmation and cancel/reset behavior.
- Spanish UI copy follows the existing project convention. Responsive layout must not depend on viewport-wide cards; POS can have two narrow columns on phones.
- Worktree: `../MeperPOS-product-card-form`, branch `feat/responsive-product-card-form` from `master` at `0c98792`. The original `feat/150-untracked-stock` tree and its modified `openspec/config.yaml` must remain untouched. The unmerged stock-tracking feature is not part of this branch.
- Issue: pending; the GitHub default branch has no YAML Issue Form, and user authorized implementation without issue publication. No push or PR until separately requested.

## Design direction
A common visual skeleton (4:3 media, overlaid status, category/title/SKU, prominent COP price, quiet stock information) with mode-specific actions. In the POS's two-column phone grid favor readable price and one large add target; inventory gets a distinct management footer. Use intrinsic wrapping/min-width guards, consistent vertical rhythm, theme-aware contrast, and 44px-ish interactive targets. For the modal use a compact image/identity area followed by grouped pricing, inventory and promotion sections; single column on phone, balanced columns at larger widths and reachable actions at bottom. Avoid changing the global Modal used by unrelated screens unless proven necessary.

## Delivery and testing
- Route: delegated direct. Mapping trigger: >4 files across POS, inventory, card, modal and tests; writer trigger: each unit changes component/page plus tests. One writer at a time.
- TDD: ON; source `openspec/config.yaml` (`strict_tdd: true`; `rules.apply.test_command_frontend`). Runner: `cd frontend && npm run test` (focused arguments permitted). Require observed RED → GREEN → REFACTOR for behavior changes. `npm run build` and `npm run lint` are additional checks as applicable.
- Forecast: ~500–700 authored changed lines, excluding generated files. Delivery strategy `ask-on-risk`; user chose `stacked-to-main` when slicing above ~400. Plan slices by work-unit commits; do not publish PRs automatically.
- Native review: user-owned RDD on; assess committed work units at previous reviewed boundary and follow provider route, never infer approval from this checklist.

## Tasks
- [x] **CARD-1** — Recompose shared `ProductCard` for both modes and expand direct tests for narrow-width structure, statuses, promotion, actions, favorites and keyboard behavior. Route: delegated writer (component + tests). Check: focused Vitest, build or typecheck, parent readback; record exact checks and commit SHA.
- [ ] **FORM-2** — Restructure the product create/edit modal in inventory around compact responsive sections without changing data semantics; add focused form interaction tests for create/edit/conditional fields and permissions. Route: delegated writer (page + tests, possibly a small scoped form component). Check: focused Vitest, build or typecheck, parent readback; record exact checks and commit SHA.
- [ ] **FLOW-3** — Verify integrated POS/inventory behavior and responsive layouts (phone/tablet/desktop, light/dark where feasible), repair only regressions attributable to this change, and capture validation evidence alongside any necessary tests/docs in a work-unit commit. Route: delegated verification then bounded delegated writer only if repairs are needed. Check: focused POS/inventory suite, frontend build/lint where feasible, runtime browser check or explicit limitation; record commit SHA.

## Acceptance criteria
- Card visual hierarchy remains readable in POS two-column mobile grid and inventory grids without overflow or hidden product state; title, effective/list prices, stock and actions have clear priority.
- Existing POS/inventory interaction and business invariants survive; mobile controls are accessible and do not cause parent action propagation.
- Create/edit modal uses space efficiently on narrow and wide screens, preserves all fields, validations, upload, focus, conditional state, disable/delete and cancel flows.
- Focused tests pass; any existing failures are separated and reported with exact commands. No backend changes, no automatic push/PR.

## Progress and evidence
- `CARD-1`: done. Commit: `ce85862a84092842f32f38dbdf7e3fd63264136b`. Strict TDD RED: 8 failed/22 passed, GREEN: 31 passed/0 failed with `cd frontend && npm.cmd run test -- ProductCard.inventory`; `npx.cmd tsc --noEmit` passed. Writer Bash unavailable in Windows child, so parent PowerShell ran commands after isolated diagnosis. Native risk assessment returned `unassessable` (schema-incompatible); native review lineage `review-28750c0e4a988e88` approved and acknowledged/burned for this committed candidate. Rollback: revert this work-unit commit (card, its tests and initial task file).
- `FORM-2`: in progress. Commit: pending. Tests: pending. Risk/review: pending.
- `FLOW-3`: pending. Commit: pending. Tests: pending. Risk/review: pending.

## Next step
FORM-2 in progress: delegate TDD tests first for the modal composition, then implement after observed RED. CARD-1 commit is the reviewed boundary.
