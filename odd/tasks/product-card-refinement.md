# ODD: Product card refinement (v2)

## Objective
Second pass on the shared inventory/POS `ProductCard` (follow-up to `premium-product-card`). The user still finds the card lacking style and order. Goals: a premium card whose photo owns the whole card, price + category highlighted together, stock visible, chips parked where they cover little of the photo, quiet controls, service cards that never change the card shape, and no grey wedge in the card corner.

## Scope and decisions
- Branch `feat/premium-product-card` (continues the unpushed feature branch; HEAD `f71ac74`). No push, no PR, no merge.
- Card work unit (CARD-1): only `frontend/src/components/products/ProductCard.tsx` and `ProductCard.inventory.test.tsx` change. Props, pages, hooks and backend are untouched; the server-owned derived fields (`isLowStock`, `effectiveSalePrice`) stay server-owned.
- Modal work unit (MODAL-2, user approved "modal image-first"): the product create/edit modal in `frontend/src/app/inventory/page.tsx` gives the photo a real presence (today a 192px square with two large buttons below). `ImageUpload` is shared with `ExpenseFormModal`, so the change is an opt-in `variant="hero"` prop; the default variant stays byte-for-byte the same behavior. Hero variant: 4:5 (matches the card) on md+, 4:3 banner on phones, overlay icon buttons (aria-labels `Cambiar` / `Eliminar` kept), same dashed empty state at the same aspect. Identity section columns must balance (move `Descripción` into the identity right column if the image column would leave dead space). Form data, validation, upload staging and save semantics do not change. Surfaces: `frontend/src/components/ui/ImageUpload.tsx`, `ImageUpload.test.tsx`, `frontend/src/app/inventory/page.tsx`, `frontend/src/app/inventory/page.product-form.test.tsx`.
- Photo fills the whole card (absolute full-bleed layer). Info sits directly on a dark bottom scrim (white text). No inner framed sub-boxes.
- Fixed card shape: `aspect-[4/5]` with a min/max height guard. Chips are absolute, top-left, compact, `pointer-events-none`, so no chip (service, offer, status) can reflow or resize the card.
- Grey corner wedge: root cause is the `backdrop-blur` glass layer under `overflow-hidden` + `rounded` + hover transform (Chromium does not clip the backdrop to the radius). Remove every `backdrop-filter` from the card; add `isolate`; child layers inherit the radius.
- Service and untracked goods: the chip already carries the fact, so the stock slot is not repeated for them (no `Servicio`/`Sin inventario` duplicate pill in the price area). Tracked goods keep the count beside the SKU, outside the price panel.
- Inventory: the explicit edit button is removed; the full-card click already edits. Only deactivate/reactivate remains, revealed on hover for pointer devices and always visible on touch. POS keeps favorite + add.
- Chips are not pills: status, offer and category chips use a soft rectangle (`rounded-md`), never `rounded-full`. Only the round icon controls in the rail stay circular.
- Healthy `Activo` chip is shown in inventory only; in POS it is pure noise, other statuses still show.
- TDD ON (`openspec/config.yaml`, strict_tdd true). Runner: `cd frontend; npm.cmd run test -- ProductCard`. Windows PowerShell; child bash is unavailable, so the parent runs the commands.
- Route: 2 non-trivial files (component + tests) → one delegated writer (`gentle-ai-worker`); parent verifies.

## Tasks
- [ ] **CARD-1** — Writer: update the ProductCard tests to the v2 contract (RED), then redesign `ProductCard.tsx` (GREEN). Allowed surfaces: the two files above.
- [ ] **VERIFY-CARD-2** — Parent: focused Vitest, `tsc --noEmit`, scoped ESLint, and a real-pipeline visual check of the card (POS 2-col mobile incl. a service card, inventory desktop, dark) or an explicit limitation.
- [ ] **COMMIT-CARD-3** — Work-unit Conventional Commit for the card with its tests; record the SHA here.
- [ ] **MODAL-4** — Writer (after CARD is committed; writes are single-threaded): opt-in `ImageUpload` hero variant + image-first product modal, tests first (RED) then GREEN.
- [ ] **VERIFY-MODAL-5** — Parent: focused + full frontend Vitest, `tsc --noEmit`, scoped ESLint, visual check of the modal (phone + desktop) or explicit limitation.
- [ ] **COMMIT-MODAL-6** — Work-unit Conventional Commit for the modal with its tests; record the SHA here.

## Acceptance
- Photo/placeholder covers the card edge to edge; no framed inner image box.
- Category and price read as one highlighted unit; stock count visible for tracked goods.
- Chips sit top-left, compact, off the content; a service card has the same size as any other card.
- No `backdrop-filter` anywhere in the card; no grey wedge at the corner.
- No chip (status, offer, category) is `rounded-full`.
- Inventory has no edit button; the whole card still opens edit by mouse and keyboard; deactivate/reactivate still works and never triggers edit. POS add/favorite unchanged.
- Modal: the photo is clearly larger than today (>= 18rem wide on md+, full-width 4:3 banner on phones), 4:5 like the card, with small overlay icon buttons instead of two large buttons; `ExpenseFormModal` renders exactly as before; every existing product-form and ImageUpload test still passes.
- Exact check outcomes recorded, including anything not run.

## Progress
