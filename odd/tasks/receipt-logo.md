# Receipt logo repair

## Objective and scope
Include the configured organization logo in POS thermal printing and downloaded receipt PDFs. Preserve sale calculations, upload/settings behavior, and no-logo receipt layout. Support trusted Cloudinary originals and local PNG/JPEG/GIF/WebP/SVG logos.

## Authorization and constraints
User authorized implementation, full SVG compatibility with dependencies, and one draft PR with a size exception rather than a chain. Publication targets `MeperDonas/MeperPOS`, `fix/receipt-logo` -> `master`. Merge remains unauthorized. Preserve unrelated `.pi/` and `.codegraph/` files and supplied PDFs. No global tooling repair or production deployment changes.

## Tasks
- [x] T1: Implement both logo paths with test-first regression coverage. Work-unit commits: `c5f8de1` (POS) and `7663e6e` (backend PDF).
- [x] T2: Independently verify focused tests, typing, real filesystem behavior and PDF image embedding. Tests are included with their behavior commits; evidence below.
- [ ] T3 (blocked): Complete native review after authorized tooling repair; validate live Cloudinary, production bindings/process permissions/memory limits and physical printing.
- [x] T4: Published draft PR #201 linked to approved issue #200, with `type:bug`, size rationale and all verification limits disclosed. Exact GitHub title/body/base/head/draft/label readback confirmed.

## Implementation and decisions
- POS passes and renders a safe escaped logo and waits for load/error or a bounded timeout before one automatic print.
- Backend awaits trusted image bytes before jsPDF rendering; consumers await receipt generation.
- Cloudinary original image URLs are normalized to controlled bounded PNG delivery on the configured cloud and logos path.
- Local loading is rooted in configured upload storage, limited to generated UUID logo basenames, and rejects traversal/symlinks with guarded file reads.
- PNG/JPEG/GIF/WebP/SVG handling is bounded and native rasterization runs in a terminable isolated process. SVG external resources are rejected and system fonts disabled; SVG text must be outlined.
- Direct production dependencies: `@resvg/resvg-js` 2.6.2 and `saxes` 5.0.1. The latter was already installed transitively; explicit declaration prevents parser dependency drift.
- Limits: 1 MiB input/output, four-million input pixels, 4096 SVG elements, 600x300 SVG output, three-second rasterizer deadline. JavaScript heap limits do not hard-bound native RSS; process isolation is not filesystem sandboxing.

## Test-first evidence
- Initial thermal/POS regressions failed before the fix; focused frontend final run: 55 passing tests across three files.
- Initial backend remote-logo/async regressions failed before the fix. Compatibility correction RED: seven failures with 51 passes; GREEN: 107 passes, 41 unrelated skips, three suites.
- Six no-logo golden fixtures preserved; real PNG/JPEG/GIF/WebP/SVG PDF image embedding covered.

## Independent verification
- Frontend focused Vitest: 55 passed, three files.
- Backend focused Jest: 107 passed, 41 skipped, three suites.
- Frontend no-emit and targeted receipt backend TypeScript checks: exit 0.
- Targeted nonfixing lint: zero errors, five backend test warnings; frontend clean.
- Actual OS-temp filesystem/process/PDF harness: 15 assertions passed without filesystem/process mocks; all five local formats embed, unsafe symlinks/traversal and hostile SVG references rejected; temporary fixtures cleaned.
- Chromium synthetic actual popup: one print after PNG readiness; invalid logo hidden; no-logo path prints once.
- Parent post-manifest spot check: receipt-logo suite 77/77 passed; direct saxes resolution and resvg native PNG smoke passed; whitespace check clean.

## Failed, skipped and pending checks
- Broader backend TypeScript has unchanged Prisma/generated-client and test-type issues. Earlier broader test failures included unavailable database configuration and stale Prisma types; database failures were not independently reproduced.
- Full database suite, production builds, live Cloudinary, physical printer and deployed artifact were not verified.
- Native review unavailable: inspect stopped at `managed_assets_outdated`; exact offered `gentle-ai sync --agent pi` failed because the CodeGraph mise shim has no configured version. No lineage or approval claimed. ASSESS unavailable treated candidate as high/unassessable, requiring the completed independent verifier.

## Delivery evidence
- Linked issue: https://github.com/MeperDonas/MeperPOS/issues/200. Fresh GitHub readback: CLOSED with `status:approved`; closed state preserved, no automated approval/reopen.
- POS commit: `c5f8de1`, `fix(pos): include organization logo when printing receipts` (106 additions, 5 deletions).
- Backend commit: `7663e6e`, `fix(receipts): embed trusted remote and local logos in PDFs` (1504 additions, 43 deletions).
- Source/dependency review size: 1658 changed lines, before this task document. User accepted one draft PR size exception. POS splits coherently; backend formats, source safety and their tests remain a larger coherent unit, so no artificial slicing or test removal.
- Rollback boundaries: POS commit can be reverted independently; backend commit contains asynchronous PDF logo loading, dependencies and corresponding tests as one unit.

- Draft PR: https://github.com/MeperDonas/MeperPOS/pull/201 (`master` <- `fix/receipt-logo`). Branch pushed; one type label `type:bug`; `Closes #200` in body. Size exception rationale documented; no protected size label was created or applied. No merge performed.

## Next step
Inspect CI without claiming pending checks passed. Before merge, validate actual organization logo on target deployment and physical printer; native review/tooling remains blocked.
