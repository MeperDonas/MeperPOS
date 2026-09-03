// Quarantine registry — single source of truth for test files excluded from
// the default Vitest run (`npm run test`).
//
// Policy (spec R3): a test file MUST NOT be excluded from the default run
// without a typed entry here exposing owner, reason, classification, and
// revalidation date. `vitest.config.ts` derives its `exclude` list from this
// registry, so config and registry cannot drift.
//
// A suite belongs here only while it is genuinely broken or its assertions are
// obsolete. When a quarantined suite starts passing again, the CI watchdog
// (`scripts/check-quarantine.mjs`) emits a `::warning::` naming it so it can be
// restored to the blocking surface and its entry removed.
//
// Dependency-free on purpose: imported by vitest config files (config loader)
// and by the watchdog script. No `@/` imports.
//
// Currently EMPTY: all previously quarantined suites (sales page behavior,
// admin org detail, dashboard category chart, auth-switch) were restored to the
// blocking surface. This file exists to govern FUTURE exclusions.

/** Why a suite is quarantined. Governs how maintainers interpret an entry. */
export type QuarantineClassification =
  | "product-defect" // product behavior is broken and the test is right
  | "test-defect" // the test itself is wrong (bad mock, bad setup)
  | "brittle-presentation" // assertion coupled to presentation internals
  | "obsolete-contract"; // assertion tracks a retired contract (e.g. localStorage tokens)

export interface QuarantineEntry {
  /** frontend/-relative path, e.g. "src/app/sales/page.behavior.test.tsx". */
  file: string;
  /** Accountable for revalidation. */
  owner: string;
  /** Why the suite is excluded. */
  reason: string;
  classification: QuarantineClassification;
  /** Tracking issue URL. */
  issue?: string;
  /** ISO date of the last manual re-run. */
  revalidatedAt: string;
}

export const quarantineRegistry: QuarantineEntry[] = [];
