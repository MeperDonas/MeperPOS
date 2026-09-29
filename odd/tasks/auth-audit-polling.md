# Wait for expected login audit rows

Branch: `test/auth-audit-polling`.
Base: `a6898cd3d81181f6b02557444da3829998078238` (independent of visual PR #187).

## Scope and evidence

The login audit integration spec's stable-count helper returns after two equal counts, including zero, before an asynchronous audit insert may finish. The observed CI failure is compatible with this race but its cause is not proven.

Fix only the three positive audit-row waits to wait for the expected row count within the existing 50 ms interval / 40 polls. Preserve final assertions so timeout or excess rows remain visible failures. The three absence cases already wait 400 ms; preserve them, including the multi-org baseline-count comparison rather than incorrectly demanding zero total historical rows.

No production interceptor, login, database schema, CI workflow, or visual PR changes.
Allowed surfaces: `backend/src/auth/auth-login-audit.int.spec.ts`, `backend/src/testing/wait-for-audit-rows.ts`, `backend/src/testing/wait-for-audit-rows.spec.ts`, this document.

## Execution plan

Delegated direct writer for helper/test/integration spec. Strict TDD enabled in openspec/config.yaml; Jest 30. First extract the current polling algorithm into a DB-free test helper and demonstrate its early-zero failure with fake timers. Only after observed RED change the algorithm and wire the positive integration callsites.
One cohesive PR slice, ask-on-risk strategy, forecast 180 authored changed lines including document. Do not shrink code/tests to satisfy a hard line limit.

- [x] Deterministic RED: parent observed old algorithm returning zero rows before a 100 ms insertion; expected one row (exit 1, one failed / three passed).
- [x] GREEN: parent observed all six DB-free tests passing before and after callback cleanup (exit 0), covering delayed insertion, immediate match, timeout and excess rows.
- [x] Wire three positive integration callsites; leave negative 400 ms/baseline checks intact.
- [x] Run DB-free unit tests, non-mutating lint and build; compare typecheck against base.
- [ ] Run real integration with PostgreSQL locally or explicitly disclose unavailable and require CI verification.
- [ ] Commit, assess, independent verification as required and native review.
- [ ] Issue, owner approval, PR and CI. Owner merges before visual PR base is reconciled.

## Verification

From backend:
- `npm.cmd run test -- --runInBand --testPathPatterns=testing/wait-for-audit-rows.spec.ts`
- `npm.cmd run test -- --runInBand --testPathPatterns=auth/auth-login-audit.int.spec.ts` (requires PostgreSQL)
- `npx.cmd eslint src/testing/wait-for-audit-rows.ts src/testing/wait-for-audit-rows.spec.ts src/auth/auth-login-audit.int.spec.ts`
- `npx.cmd tsc --noEmit`
- `npm.cmd run build`

Parent checked PostgreSQL port 5432 is not listening. Child command tools have no working shell; parent PowerShell fallback must observe RED/GREEN before claims. No local integration success is assumed.
Runtime boundary: fake-timer callback simulates a late database result deterministically; actual HTTP/database proof is the integration spec under CI.
Rollback: revert test-helper extraction and three positive callsites/tests only; production behavior unchanged.

## Evidence and limitations

Preparation inspected helper and all six cases. Existing negative waits already observe 400 ms; preserving them avoids expanding scope or confusing baseline rows with new writes.

Parent-observed RED: from backend, `npm.cmd run test -- --runInBand --testPathPatterns=testing/wait-for-audit-rows.spec.ts` exited 1 via parent PowerShell. One test failed and three passed (four total). The 100 ms late-insert test expected length 1 and received length 0. This was a behavior assertion failure against the extracted original algorithm, not an import/module failure. The RED-stage options object deliberately ignored `expectedCount` without an unused parameter placeholder.

After parent authorization, the DB-free generic helper now checks the initial fetch and each of at most 40 polls at 50 ms for `rows.length >= expectedCount`. It returns excess rows unchanged for caller exact-count assertions and returns the latest rows on timeout. Documentation limits this helper to positive expected counts, not absence checks.

Prepared GREEN tests retain delayed insertion and the changing-count polling bound (expected 100, unreachable within 40 polls). Immediate matching and excess-row cases now await completion without advancing time and assert one fetch/no pending timer. Parameterized constant insufficient-count cases (zero and one, expecting two) assert no settlement at 1999 ms and completion at 2000 ms with 41 total fetches. Tests use `jest.advanceTimersByTimeAsync` and clear timers / restore real timers after each case. Parent subsequently observed GREEN via PowerShell: the focused unit command exited 0 with six of six tests passing.

Only the three positive integration waits now call the generic helper with `expectedCount: 1` and their original Prisma filters/order. The old local stable-count helper and its unused Prisma type import were removed. All three negative 400 ms checks, the multi-org baseline comparison, and final exact-count assertions are unchanged. No production code was modified; integration runtime success is not claimed.

Child shell unavailability is parent-provided evidence; no Bash or PowerShell retry was attempted. Working-tree branch/base/dirty-state inspection could not be performed with the available non-shell file tools. Existing source/document content outside the scoped changes was preserved. Parent also reported `npm.cmd run build` exiting 0 and focused ESLint reporting zero errors / 21 warnings (16 existing integration-spec warnings and five new unit callback `require-await` warnings). The five callbacks were then changed from gratuitous `async` to inferred Promise-returning `Promise.resolve` callbacks, without suppressions or artificial awaits. No helper or integration-spec changes were made during this cleanup. Parent repeated post-refactor unit/lint verification: 6/6 tests passed, ESLint exit 0 with zero errors and 16 warnings (no new warnings). `npx.cmd tsc --noEmit` exited 2 on both candidate and archived base `a6898cd`: 16 diagnostics with exactly matching complete output. Base integration-spec ESLint also reported 16 warnings. Temporary baseline archive and dependency junction were removed. Independent source verifier `mun8fnu9-j-2fl7` found no blocker: expected-count exit, bounded polling, excess-row preservation, timer cleanup and three positive integration callsites match the scope. The verifier executed no runtime checks and does not establish PostgreSQL integration success. Native assessment returned unassessable because the candidate still includes explicitly undeclared untracked files. PostgreSQL integration remains unavailable. Other execution-plan checkboxes remain pending until their checks are observed. Vercel failure in #187 is separate and unexplained; this fix does not claim to resolve it. Final receipt belongs in memory/PR metadata, not post-review source edits.
