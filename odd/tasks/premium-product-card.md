# ODD: Premium product card

## Objective
Redesign the shared product card used by inventory and POS so the photo owns the whole card frame, the price and its category stand out together, stock stays visible, status chips sit inside the content sheet instead of covering the photo, and the remaining actions stay compact and quiet. Click-to-edit (inventory) and add-to-cart (POS) must keep working exactly as today.

## Scope and decisions
- Branch `feat/premium-product-card` from local `master` f666f4e; do not touch master, do not push, do not merge.
- Only `frontend/src/components/products/ProductCard.tsx` and its test file change. No page, hook, API, or backend change: the card contract (props, server-owned derived fields) is untouched.
- Preserve every existing card contract: status chain and server `isLowStock` flag, service/untracked semantics, promotion price + strikethrough, full-card overlay click target, non-nested buttons, 44px management hit targets, POS add/favorite behavior, disabled states, keyboard operation, and the responsive grid behavior in both pages.
- Media becomes a single absolute full-bleed layer; content is a translucent (glass) sheet docked at the card bottom so the photo remains visible behind it and text contrast stays theme-safe in light and dark.
- Price panel groups the category pill, the `Precio` eyebrow, the effective/list prices and the promo badge; the stock pill stays outside that panel so the "stock apart from the price panel" contract still holds.
- TDD ON (`openspec/config.yaml` strict_tdd true): focused runner `cd frontend && npm run test -- <filter>`; Windows PowerShell with bash unavailable, so `npm.cmd`/`npx.cmd`.
- Route: single file, small and understood; parent implements inline (no 2+ non-trivial file write to delegate). Forecast well under the 400-line review budget.

## Tasks
- [x] **CARD-1** — RED: add layout-contract tests for the redesign (full-bleed media layer, chips inside the sheet, price+category panel, stock outside it, compact icon-only POS add). Run the focused suite and record the failing count.
- [x] **CARD-2** — GREEN: implement the premium layout in `ProductCard.tsx`, keeping all 44 pre-existing card tests green and adding no new props.
- [x] **VERIFY-3** — Full frontend Vitest suite, TypeScript check, scoped ESLint on the changed files, and a visual check of light/dark at mobile and desktop widths, or an explicit statement of why it could not be run.

## Acceptance
- The product photo (or its placeholder) fills the card frame edge to edge; no inset sub-frame around the media.
- Category and price read as one highlighted unit; stock is visible and never merged into the price panel.
- Status chips render inside the content sheet, not over the photo.
- Existing management actions stay 44px hit targets but read as quiet ghost controls; POS keeps an add affordance that is compact and accessible by name.
- Full-card edit (inventory) and full-card add (POS) still work by mouse and keyboard; no nested buttons.
- Every pre-existing ProductCard test passes unchanged; exact test/typecheck/lint outcomes are recorded, including any check that could not be run.

## Progress
- Baseline before any edit: `npx vitest run src/components/products/ProductCard.inventory.test.tsx` → 44/44 passed. Branch created from `f666f4e`.
- CARD-1: five layout-contract tests added → RED 5 failed / 44 passed.
- CARD-2: card rebuilt → GREEN 49/49 focused. Structure: full-bleed absolute media layer; a photo-reserve spacer keeps the picture's share proportional to card width and lets a grid-stretched card show more photo instead of a gap; glass sheet as a separate non-interactive layer plus a relative content block, so the blur never becomes a stacking context above the card click surface and every sheet pixel still clicks through to edit/add; `Precio` panel holds the category pill, the label and both prices, with the stock pill as a sibling after it; one quiet control rail in the photo's top-right (44px hit target wrapping a 32px glass disc).
- VERIFY-3: full frontend `npm run test` → 518/518 passed (76 files); `npx tsc --noEmit` exit 0; `npx eslint` on both changed files exit 0.
- Visual check (ran, not pending): rendered the real component with the project's real Tailwind v4 pipeline and screenshotted it in headless Edge at POS-mobile 375px/2 columns, inventory 1180px/4 columns, and dark mode. It caught two defects the tests could not: the price breaking mid-number (`$ 84.0 / 00`) and the category pill truncating to two characters at narrow widths, both caused by the price panel sharing its row with the stock pill. Fixed by giving the panel a flex basis plus `min-w-[8.5rem]` so the stock pill wraps to its own right-aligned line, and by making both prices `whitespace-nowrap`. A third defect — the empty-image placeholder centred behind the glass sheet — was fixed by centring it in the photo-reserve band. The temporary preview harness (a throwaway vitest render file and an ESM CSS build script inside `frontend/`) was deleted after the run; no preview artifact remains in the repository.
- Review workload: the unit is 388 insertions + 116 deletions across the component, its test, and this task file — a single cohesive component redesign, but above the 400-line review budget, so it is disclosed as an over-budget unit rather than split.
- Commit `210410f` on `feat/premium-product-card`, three paths (`ProductCard.tsx`, `ProductCard.inventory.test.tsx`, this task file). Rollback: revert that commit; it touches no other file, no prop contract, and no page.

## Next step
Commit the work unit on `feat/premium-product-card`. Push, PR, and merge stay the user's decision; a phone/tablet device smoke on the real pages is still unverified because no authenticated app and API were running.
