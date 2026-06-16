## Exploration: Multi-tenant completion (POS, multi-org, SuperAdmin, manual billing, physical invoice printing)

### Current State

The project already has a multi-tenant data model and partial implementation:

- **Schema**: `Organization`, `OrganizationUser`, `OrgRole`, `OrgStatus`, `PlanType`, `BillingStatus`, and `organizationId` on all business entities. Unique constraints are scoped by organization (`organizationId_sku`, `organizationId_barcode`, `organizationId_saleNumber`, etc.).
- **Authentication**: `AuthService.login` detects users with multiple organizations and returns a pre-auth token plus an organization list. `POST /auth/select-organization` and `POST /auth/select-org` issue a new JWT scoped to the chosen organization. The JWT carries `organizationId` and `role`; guards reject tokens without an organization scope for non-SuperAdmin users.
- **Tenant isolation**: Most service methods filter by `user.organizationId`. `SalesService` uses an organization-scoped sequence for `saleNumber`. `OrganizationStatusGuard` blocks write operations when an organization is `SUSPENDED`.
- **POS**: `frontend/src/app/pos/page.tsx` has a working cart, product grid, barcode scanner, paused sales, multi-payment split, and a post-sale PDF receipt download. The receipt is generated in `SalesService.generateReceipt` using `jsPDF` (80 mm × 300 mm thermal format).
- **SuperAdmin panel**: `backend/src/admin` and `frontend/src/app/admin` allow a SuperAdmin to create organizations, list them, change `status`/`plan`, transfer primary ownership, and view organization details with members.
- **Billing**: `BillingScheduler` runs a daily cron that transitions `TRIAL` → `PAST_DUE` and `PAST_DUE` → `SUSPENDED`. `PaymentRecordsService` lets a SuperAdmin register a manual payment and reactivate the organization. The billing UI lives at `/settings/billing` and is only visible to SuperAdmins for payment registration.

However, several gaps prevent the five target goals from being complete.

### Affected Areas

- `backend/src/sales/sales.controller.ts` — `CASHIER` is not allowed to create or read sales, so the POS cannot work for the role that is supposed to use it.
- `backend/src/products/products-search.controller.ts` — `CASHIER` is not allowed on `GET /products/search` and `GET /products/quick-search`, breaking the POS scanner and live search.
- `backend/src/customers/customers.controller.ts` — `CASHIER` is not allowed on `GET /customers`, breaking the customer selector in the POS.
- `backend/src/auth/auth.service.ts` / `backend/src/auth/auth.controller.ts` — no endpoint returns the list of organizations for an already-authenticated user, and `validateUser` only exposes the first organization.
- `frontend/src/contexts/AuthContext.tsx` / `frontend/src/components/layout/Sidebar.tsx` — organization selection only happens at login; there is no in-app switcher.
- `backend/src/admin/admin.service.ts` / `backend/src/admin/admin.controller.ts` — SuperAdmin cannot edit organization details, add/remove organization members, change member roles, or delete organizations.
- `backend/src/billing/billing.scheduler.ts` — still automatically transitions billing statuses and suspends organizations, contradicting the manual-only billing requirement.
- `backend/src/sales/sales.service.ts` (`generateReceipt`) / `frontend/src/hooks/useReceipt.ts` — receipts are PDF downloads; there is no physical-printer integration.
- `frontend/src/app/pos/page.tsx` — the print button downloads a PDF instead of sending a receipt to a physical printer.

### Approaches

#### 1. POS role alignment (minimal fix)
Add `OrgRole.CASHIER` to the `@Roles()` decorators on the endpoints the POS actually calls: `POST /sales`, `GET /sales`, `GET /products/search`, `GET /products/quick-search`, and `GET /customers`. Keep the existing role hierarchy otherwise.

- **Pros**: Fast, low risk, makes the POS functional for cashiers immediately.
- **Cons**: Does not address multi-org switching or cashier-specific UI restrictions; still leaves `RolesGuard` inheritance a bit inconsistent with the frontend route map.
- **Effort**: Low (~100–200 changed lines including tests).

#### 2. True multi-org support
Add `GET /auth/organizations` to return the current user’s organizations, expose `POST /auth/select-org` in the UI, add an organization switcher to the sidebar/header, and update `AuthContext` to switch tokens and invalidate TanStack Query caches without forcing a logout.

- **Pros**: Matches the stated requirement for users in multiple orgs with org selection and full data isolation; reuses existing backend endpoints.
- **Cons**: Requires cache invalidation discipline and a small UX decision about where to place the switcher.
- **Effort**: Medium (~300–450 changed lines).

#### 3. SuperAdmin total organization management
Expand `AdminService`/`AdminController` with: update organization details (name, slug, taxId, phone, address, logoUrl), invite/add an existing user to an organization, remove a membership, change a member’s `OrgRole`, and delete an organization (with cascading cleanup handled by Prisma `onDelete: Cascade`). Build the corresponding UI in `frontend/src/app/admin/organizations/[id]/page.tsx`.

- **Pros**: Gives SuperAdmin full control over orgs as requested.
- **Cons**: Large surface area; deleting orgs is destructive; must ensure SuperAdmin bypass does not leak cross-org data in new endpoints.
- **Effort**: High (~700–900 changed lines across backend, frontend, and tests; should itself be split into 2 PRs if the budget is strict).

#### 4. Disable automatic billing
Remove or feature-flag `BillingScheduler.handleBillingTransitions`. Keep `PaymentRecord` and the manual payment flow. Optionally expose an environment variable such as `AUTO_BILLING_ENABLED=false`.

- **Pros**: Directly satisfies the requirement; low risk; manual payments remain.
- **Cons**: Organizations will no longer auto-suspend for non-payment; status management becomes a SuperAdmin responsibility.
- **Effort**: Low (~50–150 changed lines).

#### 5. Physical invoice printing
Two options for the printer integration:

**5a. Browser-optimized print (recommended for this web stack)**
Create a dedicated 80 mm receipt component/iframe, render the sale data with the existing settings (company name, header/footer, logo), and call `window.print()` with a `@media print` stylesheet that targets a thermal paper size. Keep the PDF endpoint as a fallback download.

- **Pros**: Works with any printer the OS/browser knows (USB, Bluetooth, network thermal printers); no hardware-specific code; easy to test.
- **Cons**: Depends on the browser print dialog and correct driver/paper-size setup; less "automatic" than raw ESC/POS.
- **Effort**: Medium (~250–400 changed lines).

**5b. Raw ESC/POS via backend + local bridge**
Add a backend endpoint that generates ESC/POS commands (e.g., with `node-escpos`), return them as base64, and have the frontend push them to a local service such as QZ Tray or a custom Electron agent.

- **Pros**: True raw thermal-printer control; can open the cash drawer; no browser print dialog.
- **Cons**: Requires an installed local agent and often HTTPS/serial permissions; much higher operational complexity.
- **Effort**: High (~500+ changed lines plus deployment/ops work).

### Recommendation

Proceed with a **chained/stacked PR delivery** because the full change is well above the 400-line review budget:

1. **POS role alignment** — add `CASHIER` to POS-relevant endpoints and add coverage for cashier flows.
2. **Multi-org switcher** — add `/auth/organizations`, in-app org switcher, and cache invalidation.
3. **Disable automatic billing** — guard/remove the billing scheduler while keeping manual payments.
4. **Physical receipt printing** — implement option **5a** (browser-optimized 80 mm print) and keep the existing PDF as fallback.
5. **SuperAdmin org management** — expand backend endpoints and admin detail UI; split into two PRs if it exceeds the budget.

This order keeps the early slices independent and defers the largest slice (SuperAdmin) until multi-org endpoints are in place.

### Risks

- **Role mismatch**: `RolesGuard` does not treat `CASHIER` as a broad role; adding it to many endpoints is safe but must be done consistently with the frontend `DashboardLayout` route map.
- **Cross-org leakage**: New SuperAdmin endpoints must continue to validate that non-SuperAdmin requests are scoped to `user.organizationId`.
- **Billing state drift**: Disabling the scheduler means trial/past-due/suspended states will not advance automatically; SuperAdmin must manage them manually.
- **Cache staleness**: Switching organizations must invalidate TanStack Query keys (`products`, `sales`, `customers`, `dashboard`, `billing`, etc.) or data from the previous org will leak.
- **Printer UX**: Browser printing requires the cashier to select the correct printer and paper size at least once; raw ESC/POS (option 5b) is more robust but significantly more complex.

### Ready for Proposal

Yes. The next recommended phase is **sdd-propose** so the scope, acceptance criteria, and exact chained-PR strategy can be finalized before implementation.
