# Known Test Failures (Baseline) — Kinetic Bento

> **Scope note**: This document records pre-existing **baseline** test failures that
> were present before the `kinetic-bento-spec-alignment` change and are **NOT**
> caused by the Kinetic Bento redesign. The change does not fix them; they are
> documented here so anyone running the full suite understands why these tests
> stay red and does not confuse them with redesign regressions.
>
> These are **not** a test artifact and **not** fixed by this change. Each entry
> lists the failing test, its cause, and the note that it is out of scope.

## Count

6 baseline failures, all present at HEAD before this change:

| # | File | Failures |
|---|------|----------|
| 1 | `frontend/src/app/pos/page.behavior.test.tsx` | 2 |
| 2 | `frontend/src/app/sales/page.behavior.test.tsx` | 2 |
| 3 | `frontend/src/app/admin/organizations/[id]/page.test.tsx` | 1 |
| 4 | `frontend/src/contexts/AuthContext.switch.test.tsx` | 1 |

## 1. POS scanner feedback (`src/app/pos/page.behavior.test.tsx`)

- **Failing tests (2)**:
  - `adds a product to the cart from the dedicated scanner input` — expects to
    find the feedback text `Producto Escaneado agregado al carrito.`.
  - `shows scanner feedback when the scanned code is not found` — expects to
    find the feedback text `No encontramos un producto con ese código.`.

- **Cause**: The POS scanner UX was reworked; the scanner feedback toast/text no
  longer renders the exact strings these assertions look for. This drift predates
  the Kinetic Bento change and is unrelated to the redesign task.

- **Status**: **OUT OF SCOPE** — do not treat as a redesign regression.

## 2. Sales deep-link filter (`src/app/sales/page.behavior.test.tsx`)

- **Failing tests (2)**:
  - `shows the customer filter badge and requests sales with customerId`.
  - `clears the customer deep-link filter back to /sales`.

- **Cause**: The test mocks `@/lib/utils` and omits the `cn` export. Vitest throws
  `[vitest] No "cn" export is defined on the "@/lib/utils" mock. Did you forget to
  return it from "vi.mock"?` at render time. This is a **test-setup** error (the
  partial mock must re-expose `cn`), not a business-logic or redesign defect.

- **Status**: **OUT OF SCOPE** — the mock needs a partial-mock fix, unrelated to
  the Kinetic Bento redesign. Not touched by this change.

## 3. Admin org detail loading spinner (`src/app/admin/organizations/[id]/page.test.tsx`)

- **Failing test (1)**: `OrganizationDetailPage > loading state > renders a loading
  spinner` — `document.querySelector(".animate-spin")` returns `null`; the spinner
  assertion fails because `getByText(...).toBeInTheDocument()` receives `null`.

- **Cause**: The loading-state markup no longer yields an element with the
  `.animate-spin` class in the rendered loading branch. The spinner visual was
  updated; the test still queries the old class. Unrelated to the redesign task
  and the admin module is out of this change's audit scope.

- **Status**: **OUT OF SCOPE** — do not treat as a redesign regression.

## 4. AuthContext org switch (`src/contexts/AuthContext.switch.test.tsx`)

- **Failing test (1)**: `AuthContext - switchOrganization > calls POST /auth/select-org,
  stores tokens/user, invalidates non-admin queries, and redirects to /dashboard`.

- **Cause**: This test triggers two pre-existing TypeScript errors
  (`TS2532` / `TS2352`), e.g. accessing a possibly-undefined `result` member in the
  test's own mock. It was failing before the redesign and is independent of it.

- **Status**: **OUT OF SCOPE** — baseline TypeScript/test-fixture issue. The two
  `tsc --noEmit` errors in this file are also the only remaining `tsc` errors in the
  frontend; unrelated to the Kinetic Bento change.

---

## Verification

As of the `kinetic-bento-spec-alignment` change, the full frontend suite reports
exactly **these 6 baseline failures** (no redesign tests stay red):

- POS scanner feedback (2)
- Sales deep-link `cn` mock (2)
- Admin org loading spinner (1)
- AuthContext.switch (1)

Redesign test alignment (settings, expense-detail-modal, dashboard,
expenses-page, tasks-page) is **green**.
