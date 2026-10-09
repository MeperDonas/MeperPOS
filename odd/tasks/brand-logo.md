# Brand logo across the app shell and auth screens

## Objective and scope
Use the MeperPOS brand mark as the single visible brand identity in the app shell (desktop and mobile sidebar headers) and the authentication screens, and ship the logo as the Next.js app metadata icons. Preserve the existing sidebar/auth behavior and tests.

Non-goals: the organization logo on receipts/PDFs (handled in #200), theme tokens, typography.

## Authorization and constraints
User authorized finishing the branding work and opening one PR, then supplied replacement artwork mid-review and asked to (a) adjust it so the artwork's built-in rounded frame does not render as a double border, and (b) keep the icon visually large. Publication targets `MeperDonas/MeperPOS`, `feat/brand-logo` -> `master`. No merge performed. The staged `backend/reset-kevin-password.js` and unrelated `.pi/`, `odd/prs/` and `odd/tasks/` files are preserved and untouched.

## Tasks
- [x] T1: Repair the app icons and favicon (the generated ICO was not buildable).
- [x] T2: First logo artwork wired into the sidebar and auth card.
- [x] T3: Replace the artwork with the MP monogram + lockup and remove the double border.
- [x] T4: Published PR #211 linked to approved issue #210 with `type:feature`.

## Implementation and decisions
- **Double border.** The supplied artwork is an app-icon style tile with a rounded frame and glow baked into the bitmap. Rendering it inside the app's bordered container produced two visible borders. Every asset is now cropped **inside** that baked frame, so the app's own `rounded-* + ring-1 ring-border/60` is the only border. The same crop is applied to the tab icons, which are additionally masked to a rounded RGBA silhouette (no baked stroke either).
- **Large, visible mark.** The monogram is stored width-preserving (≈2:1) instead of forced into a square, so it stays legible at sidebar size rather than floating in padding. Bounding boxes were measured by row/column projection (stable across thresholds) to ignore the panel's glow when cropping.
- **Placement.** The sidebar uses the monogram plus the `MeperPOS` wordmark text; the full lockup does not fit the header and its wordmark would duplicate the text. The auth card uses the full lockup and drops the now-redundant `MeperPOS` subtitle on login and register.
- **Assets.** `next/image` is used for consistency. The configured loader (`src/lib/image-loader.ts`) only rewrites Cloudinary URLs and returns local paths untouched, so local assets are pre-sized rather than optimized at request time.
- **Favicon.** Must contain RGBA PNG payloads: Turbopack fails the build otherwise (`Format error decoding Ico: The PNG is not in RGBA format!`). It is a multi-size 16/32/48 ICO with 32bpp ARGB payloads.

## Assets
| File | Use |
| --- | --- |
| `frontend/public/brand/meperpos-mark.png` (512x247) | Monogram master |
| `frontend/public/brand/meperpos-mark-160.png` (160x77) | Sidebar, desktop and mobile |
| `frontend/public/brand/meperpos-lockup.png` (512x362) | Lockup master |
| `frontend/public/brand/meperpos-lockup-384.png` (384x271) | Auth card |
| `frontend/src/app/icon.png` / `apple-icon.png` / `favicon.ico` | Rounded RGBA app and tab icons from the mark |

Superseded: the previous `meperpos-logo*.png` box/POS artwork is removed.

## Verification evidence
- `npx tsc --noEmit` — exit 0.
- Targeted non-fixing ESLint on the four changed components/pages — exit 0.
- Vitest `Sidebar.test.tsx` — 9/9 passed.
- `npm run build` — succeeded, 32 static routes, `/icon.png` and `/apple-icon.png` emitted.

## Failed, skipped and pending checks
- Native receipt-driven review unavailable: the provider returned `immutable_review_transport_unsupported` (OpenCode is not an eligible immutable-review runtime; supported: claude-code, codex). No native lineage or approval claimed.
- Not verified: real-device/browser visual check, and the light/dark appearance of the mark on a deployed build.

## Delivery evidence
- Linked issue: https://github.com/MeperDonas/MeperPOS/issues/210 (OPEN, `enhancement`, `status:approved`, `type:feature`).
- `31d9fac` — `fix(frontend): ship a buildable RGBA favicon and app icons`.
- `9384900` — `feat(frontend): add MeperPOS brand logo assets` (first artwork, now superseded).
- `b2a3421` — `feat(frontend): use the brand logo in the sidebar and auth screens` (first artwork, now superseded).
- `2e3800a` — `feat(frontend): add the new MP brand assets and app icons`.
- `eeb0af4` — `feat(frontend): use the new MP logo in the sidebar and auth screens` (+ retires the superseded assets).
- Rollback: revert `eeb0af4` and `2e3800a` to return to the previous artwork; `31d9fac` for the earlier icons.
- PR: https://github.com/MeperDonas/MeperPOS/pull/211 (`master` <- `feat/brand-logo`), one `type:feature` label, `Closes #210`, not a draft. No merge performed.

## Next step
Watch CI to green, then eyeball light/dark on the preview deployment before merging.
