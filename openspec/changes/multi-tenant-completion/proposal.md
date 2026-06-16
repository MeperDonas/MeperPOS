# Proposal: Multi-tenant completion

## Intent

Close the remaining gaps in the multi-tenant system so cashiers can operate the POS, users can switch organizations in-app, billing is manual-only, receipts can print to physical thermal printers, and SuperAdmins can fully manage organizations.

## Scope

### In Scope

- **POS role alignment**: allow `CASHIER` on the endpoints the POS uses.
- **Multi-org switcher**: endpoint to list user organizations and in-app UI switcher with cache invalidation.
- **Disable automatic billing**: stop the daily scheduler from transitioning billing statuses while keeping manual payments.
- **Physical receipt printing**: browser-optimized 80 mm `window.print()` thermal receipt; PDF remains fallback.
- **SuperAdmin org management**: edit organization details, invite/add members, change roles, remove members, and delete organizations.

### Out of Scope

- New subscription plans, payment gateways, or invoicing integrations.
- Raw ESC/POS printer drivers or local bridge software.
- Mobile app or offline POS capabilities.
- Changing the role hierarchy beyond the POS-relevant endpoints.

## Capabilities

### New Capabilities

- `pos-cashier-access`: grant `CASHIER` access to POS endpoints.
- `multi-org-switcher`: list organizations for the current user and switch active organization in-app.
- `manual-billing-only`: disable automatic billing status transitions.
- `physical-receipt-print`: browser-optimized 80 mm thermal receipt printing.
- `superadmin-org-management`: full organization CRUD and membership management.

### Modified Capabilities

- `auth`: add `/auth/organizations` endpoint and switch-organization flow.
- `sales`: allow `CASHIER` role and add physical print path alongside PDF.
- `billing`: remove scheduled automatic transitions.

## Approach

- Backend: add `CASHIER` to `@Roles()` decorators on POS endpoints, add `/auth/organizations`, expand `AdminService`/`AdminController`, and guard/remove the billing scheduler transition logic.
- Frontend: add an organization switcher to the sidebar/header, invalidate TanStack Query keys on switch, build a dedicated 80 mm print receipt component, and extend the admin organization detail page.
- Keep the existing PDF receipt endpoint untouched as a fallback.
- Rely on Prisma `onDelete: Cascade` for organization deletion cleanup.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/sales/sales.controller.ts` | Modified | Add `CASHIER` to sales endpoints |
| `backend/src/products/products-search.controller.ts` | Modified | Add `CASHIER` to search/quick-search |
| `backend/src/customers/customers.controller.ts` | Modified | Add `CASHIER` to customer list |
| `backend/src/auth/auth.controller.ts` / `auth.service.ts` | Modified | Add `/auth/organizations` |
| `frontend/src/contexts/AuthContext.tsx` | Modified | Switch token and invalidate caches |
| `frontend/src/components/layout/Sidebar.tsx` | Modified | Add organization switcher |
| `backend/src/admin/admin.service.ts` / `admin.controller.ts` | Modified | Full org and membership management |
| `frontend/src/app/admin/organizations/[id]/page.tsx` | New | Organization detail management UI |
| `backend/src/billing/billing.scheduler.ts` | Modified | Disable automatic transitions |
| `frontend/src/app/pos/page.tsx` / `hooks/useReceipt.ts` | Modified | Browser print + PDF fallback |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cross-org data leakage in new SuperAdmin endpoints | Med | Enforce `organizationId` scoping and test with non-SuperAdmin users |
| Cache staleness after org switch | Med | Invalidate all TanStack Query org-scoped keys on switch |
| Cashier over-permission | Low | Only add `CASHIER` to POS-specific read/create endpoints |
| Browser print misalignment | Med | Provide `@media print` 80 mm × auto stylesheet and test physical output |
| Accidental org deletion | Med | Require explicit confirmation; rely on Prisma cascade delete |

## Rollback Plan

- Revert individual PRs in reverse order.
- For billing, re-enable the scheduler by reverting the guard/commit.
- For roles, revert the `@Roles()` decorator changes.
- For deleted organizations, restore from database backup; cascade deletes are destructive.

## Dependencies

- Existing `Organization`, `OrganizationUser`, and `BillingRecord` Prisma models.
- Existing JWT auth, role guard, and multi-tenant scoping infrastructure.
- Existing PDF receipt endpoint remains operational as fallback.

## Success Criteria

- [ ] A `CASHIER` can log in and complete a full POS sale end-to-end.
- [ ] A user in multiple organizations can switch org without logging out and sees isolated data.
- [ ] The billing scheduler no longer auto-advances `TRIAL`/`PAST_DUE`/`SUSPENDED` states.
- [ ] The POS prints an 80 mm receipt via the browser and can still download the PDF fallback.
- [ ] A SuperAdmin can edit an organization, add/remove members, change member roles, and delete an organization.
