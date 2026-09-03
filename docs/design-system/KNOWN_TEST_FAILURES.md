# Known Test Failures & Quarantine Policy — MeperPOS Frontend

> **Scope**: This document records how the frontend governs test files that are
> excluded from the default Vitest run (`npm run test`, the blocking CI step),
> and the policy for restoring them. It replaces the earlier "baseline
> failures" ledger, whose entries were resolved by the
> `frontend-quarantine` change (issue #121).

## Status: no quarantined suites

The quarantine registry (`frontend/quarantine.ts`) is **currently EMPTY**. All
four suites that were previously excluded from the default run have been
restored to the blocking surface and their assertions pass:

| Suite | Prior defect (classification) | Fix |
|---|---|---|
| `src/app/sales/page.behavior.test.tsx` | `vi.mock("@/lib/utils")` omitted the `cn` export (`test-defect`) | reworked mock to `vi.importActual` spread + stubs |
| `src/app/admin/organizations/[id]/page.test.tsx` | asserted `.animate-spin`, but the real `LoadingState` renders `.animate-pulse` (`brittle-presentation`) | assert `"Cargando organización..."` text + `.animate-pulse` |
| `src/components/dashboard/CategoryStackedChart.test.tsx` | tooltip projection expectation/comment drifted 12px → 20px (`brittle-presentation`) | expectation + comment aligned to `calc(100%+20px)` |
| `src/contexts/AuthContext.switch.test.tsx` | obsolete `localStorage` token contract (`obsolete-contract`) | distinct coverage merged into `AuthContext.session.test.tsx`; file deleted |

The POS scanner-feedback entries that previously appeared in this document are
gone because those tests were already passing; the auth-switch entry is gone
because its TypeScript errors were resolved by the merge.

## Quarantine registry policy

A test file MUST NOT be excluded from the default run without a typed entry in
`frontend/quarantine.ts`. The registry is the **single source of truth**:

- `frontend/vitest.config.ts` derives its `exclude` additions from
  `quarantineRegistry` file paths, so config and registry cannot drift.
- `frontend/vitest.quarantine.config.ts` derives its `include` list from the
  same registry, so the watchdog runs exactly the quarantined set.

Each entry exposes governance metadata:

| Field | Meaning |
|---|---|
| `file` | `frontend/`-relative path of the excluded suite |
| `owner` | accountable for revalidation |
| `reason` | why the suite is excluded |
| `classification` | `product-defect` · `test-defect` · `brittle-presentation` · `obsolete-contract` |
| `issue?` | tracking issue URL (optional) |
| `revalidatedAt` | ISO date of the last manual re-run |

A suite belongs in the registry only while it is genuinely broken or its
assertions are obsolete (`tsc --noEmit` must stay green for quarantined files).
When a quarantined suite starts passing again, remove its entry and let the
default run execute it — the registry is meant to stay empty.

## CI watchdog

CI runs a **non-blocking** watchdog step (`npm run check:quarantine` →
`scripts/check-quarantine.mjs`) right after the blocking `Test (Vitest)` step.
It runs every quarantined suite through `vitest.quarantine.config.ts` and emits
a GitHub Actions `::warning::` naming any suite that **passes**, so it can be
restored to the blocking surface. Suite outcomes never fail the step; only an
infrastructure crash (missing config, spawn failure, unreadable report) emits a
`::error::` and exits non-zero. With an empty registry the step is a silent
no-op (`passWithNoTests: true`).

## Verification

As of the `frontend-quarantine` change: `npm run test` executes **67 test files
/ 378 tests** green (including the four restored suites and the watchdog parser
tests), `npx tsc --noEmit` is green, and `npm run check:quarantine` exits 0
silently against the empty registry.
