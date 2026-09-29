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

## Verification evidence

All commands were run by the parent session with PowerShell on `fix/identity-state-teardown`. Two commits:
`a0bb7cc` (work unit 1) and `f361e08` (work unit 2).

| Check | Command | Result |
|---|---|---|
| WU1 RED | `npm run test -- src/lib/api.test.ts` | **FAIL 1 of 13** — `expected 'org-a' to be null`: the organization scope survived a dead session. |
| WU1 GREEN | `npm run test -- src/lib/api.test.ts src/contexts/AuthContext.session.test.tsx` | **PASS 26/26 across 2 files** |
| WU2 test | `npm run test -- src/components/layout/Sidebar.test.tsx` | **PASS 8/8** (the other seven were already there) |
| WU2 mutation check | revert `clear()` to `invalidateQueries()`, same command | **FAIL 1 of 8** with the other seven passing, which is the discrimination a RED would have shown |
| Targeted suites | api + session + Sidebar together | **PASS 34/34 across 3 files** |
| Full frontend suite | `npm run test` | **PASS 509/509 across 76 files**, with no failure at all, so the known `tasks/page.evidence.test.tsx` flake did not appear either |
| Typecheck | `npx tsc --noEmit` | clean, exit 0 |
| Lint | `npx eslint` on the six touched files | clean, exit 0 |
| Frontend build | `npm run build` | `Compiled successfully in 9.3s`, 30/30 static pages, exit 0 |

## Disclosed deviations

1. **Work unit 2's fix was applied before its test, so it has no RED.** The `clear()` change went in while I
   was still reading the switcher to write the test, which is the wrong order for this project's strict TDD
   convention. Rather than pretend otherwise or revert and redo it for ceremony, the test was checked by
   **mutation**: reverting `clear()` to `invalidateQueries()` makes exactly that test fail while the other
   seven pass. A mutation check proves the same thing a RED proves, so the evidence is equivalent, but the
   order was still wrong and is recorded as such.
2. **I broke `Sidebar.tsx` mid-mutation and repaired it in the same step.** The edit that introduced the
   mutation listed `}}` and `isSuperAdmin` in the text it replaced and did not put them back, which deleted
   the arrow function's closing brace and the prop. It was caught immediately by reading the region, repaired
   with the mutation preserved, and afterwards verified: no `MUTATION-CHECK` string remains anywhere in the
   tree and the block is well formed. Recorded because a silently broken file would have made the mutation
   result meaningless.
3. **The `selectedOrganizationId` key now exists in one place.** `Sidebar`, `lib/api.ts` and
   `AuthContext` all import it from `lib/session.ts`; the duplication this feature inherited is gone. The
   `user` key was duplicated the same way and is also consolidated.
4. **`lib/session.ts` now imports `safeRemoveItem` from `lib/utils.ts`**, which it did not before. That is a
   new dependency in a module whose header comment promises the token never touches `localStorage`; the
   promise still holds for the token, and the import exists to remove the two non-credential keys. The
   header comment was not changed, which is worth a reviewer's eye.
5. **Evidence is source-level plus tests.** No browser check was made of the switcher, so the claim that its
   own list returns after the clear rests on the test asserting the refetch and on the fact that its observer
   stays mounted.
6. **Out of scope and still open**: identity-scoped query keys, the durable invariant behind the original
   leak. This change removes the data on a transition; it does not make a cross-identity key collision
   unrepresentable.

## Native review outcome

Recorded in memory, not here, by design (see task 8).
