# Multi-tenant Completion — Delta Specifications

## Capability 1: pos-cashier-access

### Purpose
Grant the `CASHIER` role access to the POS-related endpoints without exposing administrative operations.

### Requirements

| ID | Requirement | Type |
|----|-------------|------|
| R1.1 | The system MUST allow `CASHIER` to create sales via `POST /sales`. | Functional |
| R1.2 | The system MUST allow `CASHIER` to read sales they created and search by sale number via `GET /sales` and `GET /sales/number/:saleNumber`. | Functional |
| R1.3 | The system MUST allow `CASHIER` to retrieve a sale by ID via `GET /sales/:id`. | Functional |
| R1.4 | The system MUST allow `CASHIER` to generate receipt PDFs via `POST /sales/:id/receipt`. | Functional |
| R1.5 | The system MUST allow `CASHIER` to search products via `GET /products/search` and `GET /products/quick-search`. | Functional |
| R1.6 | The system MUST allow `CASHIER` to list, find by document, and retrieve customers via `GET /customers`, `GET /customers/document/:documentNumber`, and `GET /customers/:id`. | Functional |
| R1.7 | The system SHOULD allow `CASHIER` to create customers via `POST /customers` to support walk-in sales. | Functional |
| R1.8 | The system MUST NOT allow `CASHIER` to update or delete customers, update sales, or force-close sales. | Security |
| R1.9 | The system MUST preserve existing `ADMIN`, `OWNER`, and `MEMBER` access to the same endpoints. | Non-functional |

### Scenarios

#### Scenario: Cashier completes a POS sale
- GIVEN a user authenticated with role `CASHIER` in organization `org-a`
- WHEN the user sends `POST /sales` with valid sale items and payments
- THEN the sale is created under `org-a` and the response returns sale details

#### Scenario: Cashier cannot update a sale
- GIVEN a user authenticated with role `CASHIER`
- WHEN the user sends `PUT /sales/:id`
- THEN the system returns `403 Forbidden`

#### Scenario: Cashier reads only own sales in list
- GIVEN a `CASHIER` who created sale `S1` and another user who created sale `S2` in the same organization
- WHEN the `CASHIER` calls `GET /sales`
- THEN the response includes `S1` and excludes `S2`

### API Contracts

| Endpoint | Method | Allowed Roles (updated) |
|----------|--------|-------------------------|
| `/sales` | POST | ADMIN, MEMBER, CASHIER |
| `/sales` | GET | ADMIN, MEMBER, CASHIER |
| `/sales/number/:saleNumber` | GET | ADMIN, MEMBER, CASHIER |
| `/sales/:id` | GET | ADMIN, MEMBER, CASHIER |
| `/sales/:id` | PUT | ADMIN |
| `/sales/:id/force-close` | POST | ADMIN |
| `/sales/:id/receipt` | POST | ADMIN, MEMBER, CASHIER |
| `/products/search` | GET | ADMIN, MEMBER, CASHIER |
| `/products/quick-search` | GET | ADMIN, MEMBER, CASHIER |
| `/customers` | GET | ADMIN, MEMBER, CASHIER |
| `/customers` | POST | ADMIN, MEMBER, CASHIER |
| `/customers/document/:documentNumber` | GET | ADMIN, MEMBER, CASHIER |
| `/customers/:id` | GET | ADMIN, MEMBER, CASHIER |
| `/customers/:id` | PUT | ADMIN |
| `/customers/:id` | DELETE | ADMIN |

### UI/UX Behavior
- The POS page (`/pos`) remains accessible to `CASHIER`.
- Sidebar links for POS, Inventory, Sales, Customers, and Tasks remain visible.
- No new admin-only routes are exposed to `CASHIER`.

### Security / Tenant Isolation Rules
- All endpoints MUST continue to scope data by `organizationId` from the JWT.
- `CASHIER` MUST inherit no administrative privileges from role hierarchy.
- `MEMBER` and `ADMIN` access MUST remain unchanged.

### Test Scenarios (Strict TDD)

| Test | Fails Before | Passes After |
|------|--------------|--------------|
| `roles.guard` allows `CASHIER` for `/sales` POST | `@Roles` lacks CASHIER | CASHIER added |
| `sales.controller` unit test asserts CASHIER can create sale | controller rejects CASHIER | CASHIER accepted |
| `CASHIER` receives 403 on `PUT /sales/:id` | - | guard denies |
| `CASHIER` list query scopes to own sales | service ignores CASHIER role | service applies `userId` filter |
| `products-search.controller` accepts CASHIER | - | CASHIER added |
| `customers.controller` accepts CASHIER for read/create | - | CASHIER added |
| POS behavior test confirms checkout with CASHIER user | checkout blocked | checkout succeeds |

---

## Capability 2: multi-org-switcher

### Purpose
Allow an authenticated user who belongs to multiple organizations to switch active organization in-app without logging out.

### Requirements

| ID | Requirement | Type |
|----|-------------|------|
| R2.1 | The system MUST expose `GET /auth/organizations` returning all organizations the authenticated user belongs to. | Functional |
| R2.2 | The system MUST allow switching active organization via the existing `POST /auth/select-org` endpoint. | Functional |
| R2.3 | The system MUST re-issue a new access token and refresh token after a successful switch. | Functional |
| R2.4 | The system MUST reject a switch to an organization the user does not belong to with `401 Unauthorized`. | Security |
| R2.5 | The system MUST reject a switch to a `SUSPENDED` organization. | Security |
| R2.6 | The frontend MUST invalidate all organization-scoped TanStack Query keys after switching. | Functional |
| R2.7 | The frontend MUST redirect to `/dashboard` after a successful switch. | Functional |
| R2.8 | The frontend MUST hide or disable the switcher when the user belongs to only one organization. | UI/UX |

### Scenarios

#### Scenario: User switches organization in-app
- GIVEN a user belongs to `org-a` and `org-b` and is currently active in `org-a`
- WHEN the user selects `org-b` from the organization switcher
- THEN the system issues new tokens for `org-b`, invalidates cached queries, and redirects to `/dashboard`

#### Scenario: User attempts to switch to a suspended organization
- GIVEN a user belongs to `org-suspended` with status `SUSPENDED`
- WHEN the user selects `org-suspended`
- THEN the system returns an error and remains in the current organization

#### Scenario: Single-organization user sees no switcher
- GIVEN a user belongs to exactly one organization
- WHEN the sidebar renders
- THEN no organization switcher is displayed

### API Contracts

#### GET /auth/organizations
**Response 200:**
```json
{
  "organizations": [
    {
      "id": "uuid",
      "name": "Org One",
      "role": "ADMIN",
      "plan": "BASIC",
      "status": "ACTIVE"
    }
  ]
}
```

#### POST /auth/select-org
**Request:**
```json
{ "organizationId": "uuid" }
```
**Response 200:** same shape as login — `{ accessToken, refreshToken, user }`.

### UI/UX Behavior
- Add an organization switcher to the sidebar below the user card.
- Display current organization name and role.
- Open a dropdown/modal listing available organizations on click.
- Show loading state while switching.
- On error, show toast and keep current session.

### Security / Tenant Isolation Rules
- `GET /auth/organizations` MUST only return organizations linked to the authenticated user via `OrganizationUser`.
- The new token MUST encode the selected `organizationId` and role.
- Old refresh tokens SHOULD be revoked on switch.
- Query cache invalidation MUST prevent cross-organization data leakage.

### Test Scenarios (Strict TDD)

| Test | Fails Before | Passes After |
|------|--------------|--------------|
| `GET /auth/organizations` returns user's orgs | endpoint missing | endpoint implemented |
| `GET /auth/organizations` excludes foreign orgs | - | scoping enforced |
| `POST /auth/select-org` rejects non-member org | - | returns 401 |
| `POST /auth/select-org` rejects suspended org | - | returns 401/403 |
| Sidebar renders switcher for multi-org user | switcher absent | switcher present |
| Switch invalidates `['products']`, `['sales']`, `['customers']` query keys | cache retained | cache cleared |
| Switch redirects to `/dashboard` | stays on current page | redirects |

---

## Capability 3: manual-billing-only

### Purpose
Disable automatic billing status transitions so organization statuses are only changed by manual admin action or payment recording.

### Requirements

| ID | Requirement | Type |
|----|-------------|------|
| R3.1 | The system MUST NOT transition `TRIAL` organizations to `PAST_DUE` automatically when `trialEndsAt` passes. | Functional |
| R3.2 | The system MUST NOT transition `PAST_DUE` organizations to `SUSPENDED` automatically after 15 days. | Functional |
| R3.3 | The system MUST NOT revoke tokens as a result of automatic billing transitions. | Functional |
| R3.4 | The system MUST preserve manual status updates via `PATCH /admin/organizations/:id/status`. | Functional |
| R3.5 | The billing scheduler MAY remain registered but MUST execute as a no-op. | Non-functional |

### Scenarios

#### Scenario: Trial expires without automatic downgrade
- GIVEN organization `org-trial` has `trialEndsAt` in the past and status `TRIAL`
- WHEN the billing scheduler runs
- THEN `org-trial` remains `TRIAL` and no status update occurs

#### Scenario: Past-due organization is not auto-suspended
- GIVEN organization `org-pastdue` has status `PAST_DUE` and `pastDueAt` more than 15 days ago
- WHEN the billing scheduler runs
- THEN `org-pastdue` remains `PAST_DUE` and no tokens are revoked

#### Scenario: Manual suspension still works
- GIVEN a SuperAdmin calls `PATCH /admin/organizations/:id/status` with `SUSPENDED`
- WHEN the request is processed
- THEN the organization status changes to `SUSPENDED` and tokens are revoked

### API Contracts
- No new endpoints. Existing `PATCH /admin/organizations/:id/status` remains the only status transition path.

### UI/UX Behavior
- No UI changes required.
- Admin organization status dropdown continues to work.

### Security / Tenant Isolation Rules
- Manual status changes remain restricted to `SUPER_ADMIN`.

### Test Scenarios (Strict TDD)

| Test | Fails Before | Passes After |
|------|--------------|--------------|
| `BillingScheduler.handleBillingTransitions()` does not update expired trial | scheduler updates status | no update call |
| Scheduler does not suspend overdue org | scheduler suspends | no suspend call |
| Scheduler does not revoke tokens on run | tokens revoked | no revoke call |
| Manual `PATCH /admin/organizations/:id/status` still suspends | - | still works |

---

## Capability 4: physical-receipt-print

### Purpose
Provide a browser-optimized 80 mm thermal receipt print path from the POS while keeping the existing PDF fallback.

### Requirements

| ID | Requirement | Type |
|----|-------------|------|
| R4.1 | The system MUST render a print-optimized 80 mm receipt view in the browser. | Functional |
| R4.2 | The system MUST trigger the browser print dialog via `window.print()` for the receipt view. | Functional |
| R4.3 | The receipt view MUST use `@media print` CSS sized to 80 mm width with auto height. | Functional |
| R4.4 | The receipt MUST display organization name, sale number, date, items, subtotal, tax, discount, total, payment methods, change, and a thank-you message. | Functional |
| R4.5 | The system MUST keep the existing `POST /sales/:id/receipt` PDF endpoint unchanged. | Non-functional |
| R4.6 | The print view SHOULD work on common thermal printers (80 mm roll). | Non-functional |

### Scenarios

#### Scenario: Cashier prints receipt after sale
- GIVEN a sale was just completed and the receipt modal is open
- WHEN the user clicks the print button
- THEN a print-optimized receipt opens and the browser print dialog appears

#### Scenario: PDF fallback remains available
- GIVEN a completed sale
- WHEN the user clicks the PDF download button
- THEN the existing `POST /sales/:id/receipt` endpoint returns the PDF

#### Scenario: Print on a non-thermal printer
- GIVEN the user prints to a standard A4 printer
- WHEN the print dialog renders
- THEN the receipt is still legible but optimized for 80 mm width

### API Contracts
- No new backend endpoints. Existing `POST /sales/:id/receipt` remains PDF fallback.
- Frontend route/component: `/pos/receipt/:saleId` or inline `ThermalReceipt` component.

### UI/UX Behavior
- Add a "Print Receipt" button to the POS sale success modal alongside the existing PDF action.
- Open the thermal receipt in a new minimal window or a print-specific hidden layer.
- Include a "Download PDF" button that continues to call `printReceipt()`.
- Ensure print styles hide navigation, sidebars, and buttons.

### Security / Tenant Isolation Rules
- The receipt MUST only display data from the sale's own organization.
- A `CASHIER` MUST only print receipts for sales they created or have access to via existing sale scoping.

### Test Scenarios (Strict TDD)

| Test | Fails Before | Passes After |
|------|--------------|--------------|
| POS success modal shows "Print Receipt" button | button absent | button present |
| Clicking print triggers `window.print()` | no call | `window.print()` called |
| Thermal receipt component renders sale items | component missing | renders items |
| `@media print` CSS sets width to 80 mm | no print styles | styles applied |
| PDF fallback still calls `/sales/:id/receipt` | - | endpoint unchanged |
| Print button hidden/limited by role | - | respects existing sale access |

---

## Capability 5: superadmin-org-management

### Purpose
Allow SuperAdmins to fully manage organizations and their memberships from the admin UI.

### Requirements

| ID | Requirement | Type |
|----|-------------|------|
| R5.1 | The system MUST allow `SUPER_ADMIN` to edit organization details: name, slug, taxId, phone, address, logoUrl, active. | Functional |
| R5.2 | The system MUST allow `SUPER_ADMIN` to invite or add a member to an organization by email, creating a user if needed. | Functional |
| R5.3 | The system MUST allow `SUPER_ADMIN` to change a member's role within an organization. | Functional |
| R5.4 | The system MUST allow `SUPER_ADMIN` to remove a member from an organization, except the primary owner. | Functional |
| R5.5 | The system MUST allow `SUPER_ADMIN` to delete an organization, relying on Prisma `onDelete: Cascade` for cleanup. | Functional |
| R5.6 | The system MUST prevent removal of the primary owner without first transferring ownership. | Security |
| R5.7 | The system MUST require explicit confirmation before deleting an organization. | UI/UX |
| R5.8 | All org management endpoints MUST remain `SUPER_ADMIN`-only. | Security |

### Scenarios

#### Scenario: SuperAdmin edits organization details
- GIVEN a SuperAdmin on the organization detail page
- WHEN they update name and taxId and save
- THEN the organization is updated and the UI reflects the changes

#### Scenario: SuperAdmin invites a new member
- GIVEN a SuperAdmin managing organization `org-a`
- WHEN they submit a new member email and role `CASHIER`
- THEN a user is created or linked, added to `org-a` with role `CASHIER`, and an invitation/temporary password is returned

#### Scenario: SuperAdmin changes a member role
- GIVEN member `U1` in `org-a` with role `MEMBER`
- WHEN a SuperAdmin updates `U1` role to `ADMIN`
- THEN `U1`'s role in `org-a` becomes `ADMIN`

#### Scenario: SuperAdmin cannot remove primary owner
- GIVEN user `U1` is the primary owner of `org-a`
- WHEN a SuperAdmin attempts to remove `U1`
- THEN the system returns `400 Bad Request` and `U1` remains

#### Scenario: SuperAdmin deletes organization
- GIVEN a SuperAdmin confirms deletion of `org-a`
- WHEN the delete request is sent
- THEN `org-a`, its users, products, sales, and related records are removed via cascade

### API Contracts

| Endpoint | Method | Description | DTO |
|----------|--------|-------------|-----|
| `/admin/organizations/:id` | PATCH | Edit organization details | `{ name?, slug?, taxId?, phone?, address?, logoUrl?, active? }` |
| `/admin/organizations/:id/members` | POST | Add/invite member | `{ email, name?, role, password? }` |
| `/admin/organizations/:id/members/:userId/role` | PATCH | Change member role | `{ role }` |
| `/admin/organizations/:id/members/:userId` | DELETE | Remove member | - |
| `/admin/organizations/:id` | DELETE | Delete organization | `{ confirmOrganizationName: string }` |

#### PATCH /admin/organizations/:id
**Response 200:** updated `Organization` object.

#### POST /admin/organizations/:id/members
**Response 201:** `{ user: { id, email, name }, organizationUser: { id, role }, tempPassword?, message }`.

#### DELETE /admin/organizations/:id
**Response 204** on success; **400** if `confirmOrganizationName` does not match.

### UI/UX Behavior
- Extend `/admin/organizations/[id]/page.tsx` with:
  - Editable organization info form.
  - Member list with role dropdown, remove button, and disabled state for primary owner.
  - "Add Member" modal with email, name, role, and optional password.
  - "Delete Organization" button that opens a confirmation modal requiring the organization name to be typed.
- Invalidate `['admin', 'organizations']` and `['admin', 'organization', id]` on mutations.

### Security / Tenant Isolation Rules
- All endpoints MUST be guarded by `SUPER_ADMIN` role.
- Member management MUST only affect the specified organization.
- Slug uniqueness MUST be enforced on edit.
- Organization deletion MUST rely on Prisma cascade deletes; no manual cleanup in application code.

### Test Scenarios (Strict TDD)

| Test | Fails Before | Passes After |
|------|--------------|--------------|
| `PATCH /admin/organizations/:id` updates name | endpoint missing | endpoint implemented |
| Slug uniqueness enforced on edit | duplicate allowed | returns 409 |
| `POST /admin/organizations/:id/members` creates new user and membership | endpoint missing | user + membership created |
| Adding existing user creates membership only | duplicates user | links existing user |
| `PATCH .../role` updates role | endpoint missing | role updated |
| `DELETE .../members/:userId` rejects primary owner | removes owner | returns 400 |
| `DELETE /admin/organizations/:id` requires confirmed name | deletes without confirmation | requires confirmation |
| Cascade delete removes org and related records | manual cleanup | cascade verified |
| Admin detail page renders member management UI | UI absent | UI present |

---

## Cross-Cutting Non-Functional Requirements

- All new backend endpoints MUST use existing `JwtAuthGuard`, `RolesGuard`, and `@Roles()` decorators.
- All database writes MUST continue to scope by `organizationId` from the authenticated JWT.
- Frontend MUST use the existing `api` client and TanStack Query patterns.
- All tests MUST follow the existing Jest (backend) and Vitest (frontend) conventions.
- Strict TDD: write failing tests for each new behavior before implementation.
