# ODD: Product editor and card polish

## Objective
Restore a welcoming, compact product editor and simplify inventory cards while fixing image changes appearing on cards before Save. User supplied mobile/desktop screenshots and requested centered larger media, minimal scrolling, visually distinct price/units, full-card edit access excluding controls, and compact management actions.

## Scope and decisions
- Branch `feat/product-editor-card-polish` from `origin/master` fe5569b (merged responsive redesign); do not change local master or publish/merge.
- Preserve POS add/favorite, inventory permissions, statuses, promotions, stock semantics, barcode capture, destructive confirmations, and accessibility. Spanish UI text follows existing convention.
- Selected files remain local until Save; Cancel discards pending selection; removal on an existing product must persist only on Save. Prefer editing through existing product update contract and generic upload; avoid mutating upload-by-ID during selection. Physical Cloudinary deletion is a separate storage concern unless safely supported by existing service.
- Minimize structural vertical chrome; fields still need labels and scrolling on short viewports. Avoid changing shared Modal globally.
- TDD ON: `openspec/config.yaml` strict_tdd true; focused `cd frontend && npm run test -- <filter>` and backend Jest if changed; observe RED/GREEN. Windows runner `npm.cmd` under PowerShell where bash is unavailable.
- Route: delegated writer for 2+ files and >4-file mapping already completed; one writer at a time. Forecast ~450–650 authored changed lines including tests; delivery strategy ask-on-risk. User subsequently requested PR publication and chose `stacked-to-main` (card PR against master, form/image PR against card branch). PR publication requires approved issue #157.

## Tasks
- [x] **CARD-1** — Simplify shared card media, make inventory card click target accessible without stealing buttons, compact management actions, visually separate price and units. Preserve POS behavior. Tests: focused ProductCard.inventory, typecheck and scoped lint; check keyboard/mouse actions.
- [ ] **FORM-2** — Compact editor hierarchy and center/enlarge image picker on mobile; stage selection/removal until Save with reliable preview reset on Cancel/reopen, persist cleared image. Add focused interaction tests; backend support only if contract demands it. Tests: focused page form plus image tests, backend if changed, typecheck, scoped lint; attempt runtime visual check or report unavailable.
- [ ] **VERIFY-3** — Run integrated relevant frontend suite/build and assess whether a browser smoke is available, record exact outcomes and remaining limitations.

## Acceptance
- Card edit target covers empty/content region; action buttons keep their own exclusive clicks and labels.
- Uploader is centered at narrow width; no tiny fixed left-side panel; modal consumes less vertical whitespace while keeping every existing field.
- Selecting/removing image does not mutate inventory card or persisted product until Save; Cancel leaves original product unchanged.
- Tests and checks report exact outcomes, including failures and untested viewport visuals.

## Progress
- Read-only exploration mapped modal/card and traced edit upload-by-ID mutation to immediate query invalidation. Current merged remote base confirmed via Git ancestry and fetch.
- CARD-1 implementation complete in worktree: RED 3 failures/40 passes; GREEN 43/43 focused tests, TypeScript and scoped ESLint passed. Inventory overlay and compact controls, single-frame media, differentiated price/units. Commit `eba1d7f31511d3bae7c0f7c9c7095604a7f5f2e8` on `feat/product-editor-card-polish`, isolated PR1 branch `feat/product-editor-card-polish-pr1`; native review `review-4ffe7745100e642f` approved and acknowledged for committed base `fe5569b..eba1d7f` (142 lines, one informational warning). Rollback: revert this card/test commit without touching modal work.
- FORM-2 implementation complete in worktree: RED 3 failures/12 passes; GREEN 29/29 focused tests (form, ImageUpload, characterization). Independent read-only verification found a save/cancel race; new RED 1 failure/18 passes, corrected synchronous save lock, final focused 73/73 passed. Selection is local until Save; removal persists an empty URL. Physical Cloudinary cleanup remains out of scope. At implementation time no commit was requested; work unit remains unchecked pending publication preparation.
- VERIFY-3: frontend full Vitest `npm.cmd run test` 471/471 passed (74 files); `npm.cmd run build` compiled, typechecked and generated 30 routes; changed-file ESLint exited 0 without warnings; `git diff --check` clean. Independent verifier inspected relevant code but could not execute shell commands (Windows child lacks Bash); parent ran exact commands in PowerShell. `gentle_review assess` was unassessable because untracked paths require explicit declaration; it requested independent verification. No authenticated app/API/CDP listener at 3000/3001/9222, so mobile/desktop browser smoke remains pending. Cloudinary uploaded asset deletion/failed-save orphan cleanup not implemented; URL removal from product is supported. Current code diff is about 500 authored changed lines plus new test/task files, above ~400 review heuristic.
- Publication requested: `github.com/MeperDonas/MeperPOS` issue #157 was created from the Feature request YAML form. Fresh GitHub readback confirms it is CLOSED and has `enhancement,status:approved,type:feature`. The old #153 covers the merged redesign, not this follow-up. No PR or push yet; CARD-1 is committed. One private temp ACL setup failed before any GitHub write, was diagnosed/cleaned, then the issue create succeeded once.

## Next step
Prepare reviewable commits and publish stacked PRs (card → form/image) against approved #157; any cohesive slice above 400 requires a separately authorized `size:exception` on the actual PR. Browser smoke remains pending before merge.
