# ODD: 3D MP brand artwork

## Objective
Replace the flat MP monogram currently shipped as the MeperPOS brand (PR #211 / #213) with the new glossy 3D MP artwork, keeping the same three brand positions: the full lockup on the auth screens, the monogram in the desktop sidebar brand and the mobile header, and the mark as the browser tab / app icon. The artwork arrives as AI mockups with a decorative dark background, so it must be cut out, cropped with no leftover frame, and delivered on transparency.

## Scope and decisions
- Branch `feat/brand-logo-3d` cut from `origin/master` (`639b101`), not from the local `master`, which is diverged and cannot fast-forward to the remote (PR #196 exists locally as `b7f4ca2` and remotely as `5970fe4`; merge base `c20892c`). Work happens in a separate worktree so the operator's checkout is untouched.
- Only the brand assets and the three existing brand call sites change. No page, hook, API, receipt or theme-token change. The organization logo on receipts/PDFs (issue #200) is untouched.
- **Alpha extraction.** The background is not a flat colour: bright blue waves share the logo's hue and an orange glow sits behind the artwork, so a colour or luminance key fails. The alpha is derived from the **max-RGB (value) channel**, which separates the logo's dark-blue bevel (~47% value) from the dark-navy background (~9%). The keyed mask is multiplied by a component-cleaned hard mask (`connected-components` area threshold) so the stray orange speck to the right of the mark is dropped without eating the mark.
- **Light theme.** The `Meper` wordmark is white and disappears on the light theme (`--card: #FFFFFF`). A second lockup variant recolours the wordmark band to `#131B2E` while `POS` stays cyan; the recolour is spatially safe because the wordmark sits below the mark. The two variants swap with Tailwind `dark:hidden` / `hidden dark:block`.
- **No frame.** The previous artwork was a tile with a baked rounded frame, so the call sites compensated with `rounded-* ring-1 ring-border/60 shadow-*`. The new artwork is transparent with no baked frame, so that compensation is removed: a ring around a transparent cut-out would render exactly the frame the artwork no longer has.
- **Favicon.** Must stay buildable: `app/favicon.ico` is a 16/32/48 multi-size ICO, plus `app/icon.png` (256) and `app/apple-icon.png` (180), all RGBA.
- Route: assets produced inline with ImageMagick; the three JSX swaps are mechanical and understood, so they stay inline rather than delegated. No research left.
- Publicity: the branch is published as one PR linked to an approved issue, per repository policy.

## Tasks
- [x] **LOGO-1** — Produce the transparent assets (`meperpos-lockup-on-light-384.png`, `meperpos-lockup-on-dark-384.png`, `meperpos-mark-160.png`) and delete the superseded flat-asset files.
- [x] **LOGO-2** — Rebuild `favicon.ico`, `icon.png` and `apple-icon.png` from the mark.
- [x] **LOGO-3** — Swap the three call sites in `AuthCard` and `Sidebar`, dropping the now-unnecessary ring/rounded/shadow compensation.
- [x] **VERIFY-4** — Production build, TypeScript check, scoped ESLint, focused tests, and a real browser render in both themes.

## Acceptance
- The lockup renders transparent on both themes with no visible frame, and the wordmark is legible on light and dark.
- The sidebar and mobile header show the 3D monogram; the browser tab shows the mark.
- No superseded flat asset remains in `public/brand/`.
- Existing tests, typecheck and lint pass, or the exact failing/unavailable checks are recorded.

## Progress
- Assets built inline from the two raw mockups; both lockup variants verified over their target backgrounds at display size; all three cut-outs verified free of background specks via connected-component inspection.
- LOGO-1 / LOGO-2 / LOGO-3 complete.
- VERIFY-4: `npm run build` exit 0 (routes `/icon.png` and `/apple-icon.png` emitted, favicon accepted by Turbopack); `npx tsc --noEmit` exit 0; `npx eslint` on both changed components exit 0; `DashboardLayout.test.tsx` 5/5 passed.
- `Sidebar.test.tsx` reports 9 failed before and after the change, including with the change stashed: the suite dies at `Sidebar.tsx:156` with `Cannot read properties of undefined (reading 'setItem')` because the test environment has no `localStorage`. Recorded as a pre-existing environment failure, not caused by this change.
- Visual check (real production build, not pending): headless Chromium against `next start` on `/login`, light and dark. Both variants render correctly, transparent, with no frame.

## Next step
Publish `feat/brand-logo-3d` as a PR linked to the approved brand-artwork issue.
