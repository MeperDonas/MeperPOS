# Feature: identity-state-teardown

Closes the two gaps recorded when the cross-account cache leak was fixed. Both are the same class: state
scoped to an identity that outlives the transition that should have ended it.

Branch: `fix/identity-state-teardown` (from `master` at `a03ad14`)

## Why this exists

**Gap 1 — a SuperAdmin scope change leaves the previous scope's rows readable.**
`frontend/src/components/layout/Sidebar.tsx` handles the SuperAdmin organization selector with
`queryClient.invalidateQueries()` in both callbacks (`onSwitch` and `onSelectAll`). Invalidation marks
entries stale; it does not remove them, so a page that reads a cached query keeps rendering the previous
organization's rows until the refetch resolves. That is the same "stale data is displayed while it
refetches" window that made the original leak invisible, just triggered by a scope change instead of a
logout.

**Gap 2 — the session-expiry path does not tear the session down.**
`frontend/src/lib/api.ts` handles a dead session with `safeRemoveItem(USER_DISPLAY_CACHE_KEY)` and then
`onSessionExpired()`, which hard-navigates. It never goes through `logout`, so `selectedOrganizationId`
survives in `localStorage`. After the next login, `lib/api.ts` sends it as the `X-Organization-Id`
header, and the sidebar rehydrates it, so a stale organization scope outlives the session that chose it.
The header is only honoured for SuperAdmin, so the impact is limited to that role, but the state is
wrong regardless.

The cleanup knowledge is also duplicated: the `user` key lives in `AuthContext`, the
`selectedOrganizationId` key is a literal string in `AuthContext`, `Sidebar` and `lib/api.ts`, and the
access token lives in `lib/session.ts`. Three files know the same teardown.

## Design

**One owner for session-scoped client state.** `frontend/src/lib/session.ts` already owns the in-memory
access token and is already imported by both `AuthContext` and `lib/api.ts`, so the keys and a single
teardown live there:

- export `USER_DISPLAY_CACHE_KEY` and `SELECTED_ORGANIZATION_KEY`
- export `clearSessionState()`, which clears the access token and removes both keys

`AuthContext.logout` and the `lib/api.ts` expiry branch both call it, and `Sidebar` imports the key
instead of repeating the literal. `logout` keeps its `queryClient.clear()`, because the cache is the
React Query half of the same boundary and `lib/session.ts` must not depend on React Query.

**A scope change clears, it does not invalidate.** In `Sidebar.tsx`, both SuperAdmin callbacks move from
`invalidateQueries()` to `clear()`. The switcher's own list query (`["admin","organizations"]`, enabled
only for SuperAdmin) is removed by that too, and because its observer stays mounted React Query refetches
it, so the list returns. That is the intended trade: a visible loading state instead of another
organization's data.

## Acceptance criteria

- [ ] Switching the SuperAdmin organization scope removes previously cached data instead of leaving it
      readable while it refetches.
- [ ] The SuperAdmin switcher still renders its organization list after the switch.
- [ ] The session-expiry path removes `selectedOrganizationId` as well as the user display cache and the
      in-memory token.
- [ ] `logout` behaves exactly as before from the outside.
- [ ] The `selectedOrganizationId` key string exists in one place.
- [ ] Nothing else changes: no query-key refactor, no change to what the header means.

## Tasks

### Work unit 1 — one owner for the session teardown

1. [ ] RED: a test that a failed refresh leaves no session-scoped state behind, including
       `selectedOrganizationId`.
2. [ ] GREEN: the keys and `clearSessionState()` in `lib/session.ts`; `AuthContext.logout` and the
       `lib/api.ts` expiry branch both use it; `Sidebar` imports the key.

### Work unit 2 — a scope change clears

3. [ ] RED: a Sidebar test that a SuperAdmin scope change leaves no cached entry readable, and that the
       switcher's list still renders afterwards.
4. [ ] GREEN: `invalidateQueries()` to `clear()` in both SuperAdmin callbacks.

### Verification and closure

5. [ ] Targeted suites, full frontend suite, `tsc --noEmit`, ESLint on touched files, build.
6. [ ] Native review at the deliverable boundary. A first START failure with an instantly-expired
       consent binding has been transient on this project twice; retry once with a fresh idempotency key
       before concluding anything.
7. [ ] Issue and PR by the repository convention. Push, PR and merge remain the owner's decisions.
8. [ ] Do **not** record the review outcome in this document: editing a reviewed path creates a new
       unreviewed candidate. Record it in memory. A remote PR body can be edited safely.

## Out of scope

- Identity-scoped query keys, still the durable invariant behind the original leak.
- Anything that changes what `X-Organization-Id` means or who may send it.
- The remaining local branches and the technical follow-ups `R3-001` (twice).

## Review workload note

Two work units across four frontend files plus tests. One review unit.

## Review finding and the correction it forced

Work unit 2's first fix was `queryClient.clear()`, and the review rejected it with a CRITICAL finding,
`R3-scope-observers`, `causal_disposition: worsened`:

> Clearing the cache does not establish that mounted page queries stop displaying the previous
> organization's rows. A mounted query observer can retain its last result after its cache entry is
> removed; unlike the former invalidation, clearing does not itself request a refetch.

The refuter corroborated it, so the provider required one bounded correction. **The finding is correct,
and the source explains why:**

- `queryCache.clear()` removes each query from the cache map and calls `query.destroy()`, which is only
  `clearGcTimeout()` plus `cancel({ silent: true })`. It does **not** reset the query state, and `cancel`
  notifies nobody. A mounted observer therefore keeps rendering `state.data`, and nothing requests a
  refetch. That is strictly worse than the `invalidateQueries()` it replaced, which at least refetches
  active queries. Hence "worsened".
- `Query.reset()` is `destroy()` **plus** `setState(this.#initialState)`, and `queryClient.resetQueries()`
  runs `reset()` on every match and then `refetchQueries({ type: 'active' })`. That drops the displayed
  state (so the previous rows cannot remain) **and** refreshes what is mounted.

`applyOrganizationScope` now calls `resetQueries()`. A three-way isolation experiment confirmed the
distinction on a mounted observer, all three calls being made directly against a seeded cache entry:

| Call | Rows the mounted observer displayed afterwards |
| --- | --- |
| `resetQueries()` | `old-row` → **`fresh-row`** |
| `clear()` | `old-row` → **still `old-row` after 500 ms** |
| `invalidateQueries()` | `old-row` → **`fresh-row`** |

The correction also had to give the behaviour a testable seam. The two switcher callbacks duplicated the
localStorage write and the cache call inline, so driving the mounted-observer assertion through the
switcher UI was not reliable: a spy proved the click reached `onSwitch` in the cache-only test
(`resetSpy=1`) but not in the mounted one (`resetSpy=0`). The scope change is now the exported
`applyOrganizationScope(queryClient, organizationId)`, which both callbacks use; the mounted-observer
test calls it directly and cannot be defeated by click plumbing.

## Verification evidence

All commands were run by the parent session with PowerShell on `fix/identity-state-teardown`. Three
commits: `a0bb7cc` (work unit 1), `f361e08` (work unit 2) and the correction commit.

| Check | Command | Result |
|---|---|---|
| WU1 RED | `npm run test -- src/lib/api.test.ts` | **FAIL 1** — `expected 'org-a' to be null`: the organization scope survived a dead session. |
| WU1 GREEN | `npm run test -- src/lib/api.test.ts src/contexts/AuthContext.session.test.tsx` | **PASS 26/26** |
| WU2 test | `npm run test -- src/components/layout/Sidebar.test.tsx` | **PASS 9/9** |
| WU2 mutation check | revert `resetQueries()` to `invalidateQueries()`, same command | **FAIL 1 of 8** with the other seven passing |
| Correction mutation check | revert `resetQueries()` to `clear()`, same command | **FAIL 1 of 9** — the mounted-observer test fails while the cache-only test still passes, which is precisely how the first fix looked sufficient |
| Targeted suites | api + session + Sidebar | **PASS 35/35 across 3 files** |
| Full frontend suite | `npm run test` | **PASS 510/510 across 76 files** |
| Typecheck | `npx tsc --noEmit` | clean, exit 0 |
| Lint | `npx eslint` on the touched files | clean, exit 0 |
| Frontend build | `npm run build` | clean, 30/30 static pages, exit 0 |

All debug instrumentation used to diagnose this was removed: a grep for `DEBUG`, `console.log`,
`DebugProbe` and `resetSpy` across the two files returns nothing.

## Disclosed deviations

1. **The reviewer caught a real defect in my own change, and it was the more severe kind: my fix was worse
   than what it replaced.** Recorded first because it is the most important fact about this change.
2. **The correction overran its declared plan.** The plan said 70 diff lines; the correction is 98 across
   two files. The overrun is the testable seam (extracting `applyOrganizationScope`) plus replacing a
   click-driven assertion with a deterministic one. It stays inside the provider's frozen budget of 147.
3. **Work unit 2's original fix had no RED and was checked by mutation**, because it was applied before its
   test was written. That is the wrong order for this project's convention and it is what let a critical
   defect through the first time: the mutation check I ran then used `invalidateQueries()` as the mutant,
   which the test caught, but nothing tested the case the reviewer later found.
4. **The mounted-observer test observes a React Query behaviour, not the switcher's UI.** It calls
   `applyOrganizationScope` directly. The UI path is covered by the cache-only test, which is verified to
   reach the handler.
5. **`lib/session.ts` now imports `safeRemoveItem` from `lib/utils.ts`**, a new dependency in a module
   whose header promises the token never touches `localStorage`. The promise holds for the token; the
   import exists to remove the two non-credential keys. The header comment is unchanged, which is worth a
   reviewer's eye.
6. **Evidence is source-level plus tests.** No browser check was made of the switcher.
7. **Out of scope and still open**: identity-scoped query keys, the durable invariant behind the original
   leak.

## Native review outcome

Recorded in memory, not here, by design (see task 8).
