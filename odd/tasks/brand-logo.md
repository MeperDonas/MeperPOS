# Brand logo across the app shell and auth screens

## Objective and scope
Use the MeperPOS brand logo as the single visible brand mark in the app shell (desktop and mobile sidebar headers) and the authentication screens, and ship the logo as the Next.js app metadata icons. Preserve the existing sidebar/auth behavior and tests. Non-goals: the organization logo on receipts/PDFs (handled in #200), theme tokens, typography.

## Authorization and constraints
User authorized finishing the branding work and opening one PR for review. Publication targets `MeperDonas/MeperPOS`, `feat/brand-logo` -> `master`. No merge performed. Preserve the staged `backend/reset-kevin-password.js` and unrelated `.pi/`, `odd/prs/` and `odd/tasks/` files; the dev preview sheet `_preview-sizes.png` is intentionally left untracked.

## Tasks
- [x] T1: Add the brand assets (512px master, 64px and 128px UI variants) as commit `9384900`.
- [x] T2: Wire the logo into the sidebar (desktop + mobile) and the auth card as commit `b2a3421`.
- [x] T3: Repair the app icons and favicon as commit `31d9fac` (the generated ICO was not buildable).
- [x] T4: Published PR #211 linked to approved issue #210 with `type:feature`.

## Implementation and decisions
- `next/image` is used for consistency with the codebase. The configured loader (`src/lib/image-loader.ts`) only rewrites Cloudinary URLs and returns local paths untouched, so local assets are shipped pre-sized rather than optimized at request time. The UI consumes 64px (sidebar) and 128px (auth) variants; the 354KB master stays as the brand source.
- The mark is a rounded dark tile with a baked-in background, so a subtle `ring-1 ring-border/60` keeps it defined on dark cards.
- `favicon.ico` must contain RGBA PNG payloads: Turbopack fails the build otherwise (`Format error decoding Ico: The PNG is not in RGBA format!`). It is regenerated as a multi-size 16/32/48 ICO with 32bpp ARGB payloads.
- Dropped the pre-existing dead `cn` import in `AuthCard`.

## Verification evidence
- `npx tsc --noEmit` — exit 0.
- Targeted non-fixing ESLint on `Sidebar.tsx` and `AuthCard.tsx` — exit 0.
- Vitest `Sidebar.test.tsx` — 9/9 passed.
- `npm run build` — succeeded, 32 static routes, `/icon.png` and `/apple-icon.png` emitted.

## Failed, skipped and pending checks
- Native receipt-driven review unavailable: the provider returned `immutable_review_transport_unsupported` (OpenCode is not an eligible immutable-review runtime; supported: claude-code, codex). No native lineage or approval claimed.
- Not verified: real-device/browser visual check and dark/light appearance on a deployed build; CI result was pending at authoring time.

## Delivery evidence
- Linked issue: https://github.com/MeperDonas/MeperPOS/issues/210 (OPEN, `enhancement`, `status:approved`, `type:feature`).
- Commit `31d9fac`: `fix(frontend): ship a buildable RGBA favicon and app icons` (3 files).
- Commit `9384900`: `feat(frontend): add MeperPOS brand logo assets` (3 files).
- Commit `b2a3421`: `feat(frontend): use the brand logo in the sidebar and auth screens` (2 files, +24/-12).
- Review size: well under the 400-line budget — binary assets plus 24 insertions in two components. No split needed.
- Rollback: revert `b2a3421` to restore the placeholder mark; `9384900` for the assets; `31d9fac` for the previous icons.
- PR: https://github.com/MeperDonas/MeperPOS/pull/211 (`master` <- `feat/brand-logo`), one `type:feature` label, `Closes #210`, not a draft. No merge performed.

## Next step
Watch CI to green, then eyeball light/dark on the preview deployment before merging.
