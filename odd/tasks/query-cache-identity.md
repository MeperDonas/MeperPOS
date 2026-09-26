# Feature: query-cache-identity

Reported by the owner (no issue number): after logging out of account A and logging into account B,
some views still render account A's data until a manual page refresh (F5). Inventory always does.

Branch: `fix/query-cache-identity` (from `master` at `e24e60e`)
Supersedes nothing. Depends on nothing.

## Why this exists

A user who logs out and logs into a different account on the same browser keeps seeing the previous
account's data. On a shared POS terminal that is a cross-tenant data exposure to a different
logged-in user, not a cosmetic glitch. The backend is not at fault: it scopes every read by the
`organizationId` carried in the JWT. The leak is entirely client-side.

The defect is a **session-boundary defect in the client cache**, not an inventory bug. Inventory is
merely its most reliable victim, which is what made the report point at the wrong module.

## Verified current state (evidence, not assumption)

Every claim below was read from source in this session. Two independent passes (parent and a
read-only scout) agree.

- **`logout` never touches the query cache.** `frontend/src/contexts/AuthContext.tsx:246-256` calls
  `api.post("/auth/logout")`, `clearAccessToken()`, `safeRemoveItem(USER_DISPLAY_CACHE_KEY)`,
  `setUser(null)`, `setPendingSelection(null)` and `router.push("/login")`. No `queryClient.clear()`,
  `removeQueries`, `resetQueries` or `invalidateQueries`. The component already holds
  `const queryClient = useQueryClient()` (`:49`) and uses it only in `switchOrganization` (`:228`).
- **The `QueryClient` is a singleton that survives the navigation.**
  `frontend/src/components/providers/QueryProvider.tsx:8-16` creates it once via `useState`, mounted
  in the root layout (`frontend/src/app/layout.tsx:48`). A client-side `router.push` never recreates
  it; only a real page load does. This is exactly why F5 "fixes" the symptom.
- **No query key is identity-scoped.** `["products", rest]` (`hooks/useProducts.ts:24`),
  `["customers", params]` (`useCustomers.ts:30`), `["dashboard", start, end]`
  (`hooks/useReports.ts:41`), and every other key carries resource + params only. Account B reads
  account A's entries.
- **Defaults that make it invisible:** `staleTime: 60_000` and `refetchOnWindowFocus: false`
  (`QueryProvider.tsx:12-13`), with the v5 defaults `gcTime` 5 min and `refetchOnMount` true. An
  entry younger than 60 s is served with **no network request and no loading state**.
- **`useProducts` is the only products hook carrying `placeholderData: keepPreviousData`**
  (`hooks/useProducts.ts:30`) — the single occurrence in the whole frontend. It keeps the previous
  account's rows rendered even when a refetch does fire.
- **Two logout entry points, both funneling into the same function:** `components/layout/Sidebar.tsx:268`
  and `app/admin/layout.tsx:69`. A fix inside `AuthContext` covers both; a fix per call site would not.
- **The hard-navigation path is safe:** `lib/api.ts:52` does `window.location.href = LOGIN_PATH` when
  the refresh fails, which wipes the cache. That is why the leak is reachable only through a
  voluntary logout (soft navigation), never through an expired session.
- **Residual identity-scoped client state survives logout:** `logout` removes only the `"user"` key,
  leaving `selectedOrganizationId` in localStorage, which `lib/api.ts:135-137` injects as the
  `X-Organization-Id` header on every request.
- **That header is SuperAdmin-only:** `backend/src/common/interceptors/admin-organization.interceptor.ts`
  applies it under `if (user?.isSuperAdmin)`. So the residual selection is a SuperAdmin staleness
  problem, **not** a cross-tenant leak for ordinary users. Scope decided accordingly.
- `frontend/src/hooks/useSelectedOrganization.ts` **does not exist** in this tree (ENOENT); the
  SuperAdmin selection is held ad hoc in `Sidebar.tsx:141-145`. Earlier memory records claiming this
  hook exists are stale.
- `lib/prefetch.ts` only warms lazily-imported modal *chunks*; it never prefetches data, and neither
  the `DashboardLayout` nor the `Sidebar` prefetches products. Not a contributor.

## Mechanism

1. `logout` leaves the entire cache intact.
2. The singleton client survives the soft navigation.
3. Keys are not identity-scoped, so account B hits account A's entries.
4. An entry younger than `staleTime` is served silently; an older one refetches on mount and merely
   *looks* like it recovers.

Point 4 explains the per-page intermittency that made the report confusing: the page most recently
browsed as account A (usually inventory, right before logging out) is still fresh and leaks **every
time**, while a page last visited more than 60 s before logout refetches and appears to self-heal.
This is a code-derived inference, not a runtime measurement; the ACs below do not depend on it.

## Design

The cache belongs to the identity, so the identity boundary must own the cache. Fix the **class**,
not the reported instance, and do it at the level where identity is owned: `AuthProvider`.

**Work unit 1 — the identity transition is explicit.** `logout` clears the cache before redirecting.
A logout is an identity teardown; leaving identity-scoped data resident contradicts it. Explicit here
rather than only in the watcher, so the clearing does not depend on post-render effect timing.

**Work unit 2 — the invariant, expressed once.** `AuthProvider` derives a stable identity key
(`${user.id}:${user.organizationId ?? "none"}`, `null` when anonymous) and clears the cache whenever
that key changes after the first assignment. This covers every present and future identity
transition — `login`, `switchOrganization`, and any path not yet written — instead of relying on each
one remembering to clean up. The first assignment (boot/restore) is exempt because the cache is empty
then and must not be wiped under a legitimately warmed provider.

`switchOrganization` keeps its existing non-admin `invalidateQueries`. It is now redundant with the
watcher for the cache-clearing concern, but it is a working guard inside a bugfix whose blast radius
is deliberately bounded; removing it is a follow-up, recorded as out of scope rather than done
silently.

The SuperAdmin org selector in `Sidebar.tsx` is deliberately **not** touched: it changes
`X-Organization-Id`, not the authenticated identity, so no identity key changes and it keeps its own
explicit invalidation.

**Work unit 3 — the residual.** `logout` also removes `selectedOrganizationId`, so a SuperAdmin
selection cannot outlive the session that made it. One line, same defect class, SuperAdmin-only
impact per the interceptor evidence above.

## Acceptance criteria

- [ ] AC1 After `logout`, no query cached during the previous session is readable from the client.
- [ ] AC2 A change of authenticated identity (different `user.id` or `organizationId`) clears the
      cache even when no logout happened in between.
- [ ] AC3 The first identity assignment on mount does not clear the cache by itself.
- [ ] AC4 The fix lives in `AuthProvider`, so both logout entry points (`Sidebar`, `admin/layout`)
      are covered without touching either caller.
- [ ] AC5 `logout` removes `selectedOrganizationId` as well as the user display cache.
- [ ] AC6 The `SALE`/inventory/POS behaviour, the session migration contract (tokens in memory only)
      and the `switchOrganization` failure path are all unchanged: the existing session suite passes
      without weakened assertions.

## Tasks

Strict TDD. RED observed before every GREEN. One work-unit commit per unit.

### Work unit 1 — the query cache dies with the session

1. [ ] RED: extend `frontend/src/contexts/AuthContext.session.test.tsx` — seed the harness
       `QueryClient` with an account-A products entry under the real key
       `["products", { page: 1, limit: 10, status: "active", orderBy: "name" }]`, log out, and assert
       the entry is gone.
2. [ ] GREEN: `queryClient.clear()` in `AuthContext.logout` (and add `queryClient` to its deps).

### Work unit 2 — the identity boundary owns the cache

3. [ ] RED: a second test seeds the cache, then changes identity through `switchOrganization` without
       logging out, and asserts the seeded entry is **removed**, not merely marked stale. This
       discriminates the new mechanism from the old one: `invalidateQueries` leaves the data present
       and readable, which is precisely why the invalidate-only approach leaked.
4. [ ] RED: a third test asserts the cache survives the first identity assignment on mount (AC3).
5. [ ] GREEN: derive the identity key in `AuthProvider` and clear on change after the first
       assignment.

### Work unit 3 — the residual SuperAdmin selection

6. [ ] RED/GREEN: `logout` removes `selectedOrganizationId`.

### Verification and closure

7. [ ] Targeted suite, full frontend suite, `tsc --noEmit`, eslint on touched files.
8. [ ] Native review at the deliverable boundary, if the review switch is enabled.
9. [ ] Push and PR remain the owner's decisions.

## Out of scope

- **Identity-scoped query keys** (a factory prefixing every key with `organizationId`). It is the
  durable invariant and was offered as option B; the owner chose the structural single-point fix. The
  watcher closes the class for every transition that flows through `AuthProvider`; the factory would
  additionally make a collision *unrepresentable*. Candidate for a separate change.
- **Removing the now-redundant `invalidateQueries` in `switchOrganization`** — a cleanup that would
  rewrite an existing passing test's contract. Not mixed into a bugfix.
- **`refetchOnWindowFocus: false` / `staleTime: 60_000`** tuning. Orthogonal to the leak.
- Any backend change. The backend scoping was verified correct.

## Review workload note

Three small work units, two files touched in total (`contexts/AuthContext.tsx` and its suite). Well
inside a single review unit; no chaining needed.

## Verification evidence

All commands are run by the parent session with PowerShell. To be filled as the work units close.

| Check | Command | Result |
|---|---|---|
| | | |

## Disclosed deviations

To be filled.

## Native review outcome

To be filled at the deliverable boundary.
