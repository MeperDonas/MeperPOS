/**
 * Deterministic fixture seeder for the report golden gate (S5 — perf-refactor
 * #98).
 *
 * Creates the dedicated `reports-golden` organization with FIXED IDs and
 * fixed literal amounts/dates for users, categories, products, customers,
 * sales (items + payments + inventory movements) and expenses (with
 * payments). Previous fixture rows are deleted (organization-scoped, FK-safe
 * order) before recreating, so the dataset is byte-deterministic across runs
 * on ANY migrated database — every id that leaks into a report output (sale
 * ids in dashboard recentSales, userId in user performance, customer/product
 * ids, etc.) is stable by construction. The golden gate must never depend on
 * local seed data: CI runs it against an empty-but-migrated database.
 *
 * Coverage of the workload paths (reports-golden-workload.ts):
 *   - dashboard KPIs: completed sales, active products (one low-stock),
 *     active customers created in both halves of 2026 (trend paths)
 *   - financial overview: sales with items (taxed, zero-tax, discounted),
 *     a cancelled sale (cancelledAt path), a RETURN movement, expenses
 *   - cash flow: payments covering CASH/CARD/TRANSFER + expense payments
 *   - inventory snapshot: products with cost/sale prices + movements
 *   - sales by payment method / category (daily): multi-payment sale,
 *     two categories
 *   - top selling: distinct per-product totals (deterministic ranking)
 *   - customer statistics: three segments, with/without linked sales
 *   - user performance: sales from two distinct users (compare mode)
 *
 * Usage: called by capture-goldens.ts (before capturing) and by
 * reports.golden.spec.ts (in beforeAll). Never imported by production code.
 */
import { PrismaService } from '../../../src/prisma/prisma.service';

export const GOLDEN_ORG_SLUG = 'reports-golden';

// Fixed UUID namespace for this fixture (valid v4-formatted hex). Every row
// that can leak an id into a report output gets one of these so goldens are
// byte-identical on any database.
const id = (n: number): string =>
  `a5f01d00-0000-4000-8000-${n.toString().padStart(12, '0')}`;

const ORG_NAME = 'Reports Golden Fixtures';

const ADMIN_EMAIL = 'reports-golden-admin@example.com';
const CASHIER_EMAIL = 'reports-golden-cashier@example.com';
// Fixture-only hash (not a real credential): the golden workload calls the
// service layer directly and never performs authentication.
const FIXTURE_PASSWORD_HASH =
  '$2a$10$fixture-only-hash-not-a-real-password0123456789abcd';

// ─── Fixed literals (UTC instants inside the year-2026 scenario) ─────────────

const T_S1 = new Date('2026-06-15T14:30:00.000Z'); // admin sale
const T_S2 = new Date('2026-07-05T15:00:00.000Z'); // cashier multi-payment sale
const T_S4 = new Date('2026-07-10T11:00:00.000Z'); // cancelled sale
const T_S4_CANCELLED = new Date('2026-07-10T12:00:00.000Z');
const T_S3 = new Date('2026-08-26T16:45:00.000Z'); // transfer sale + return

const T_C1 = new Date('2026-02-10T12:00:00.000Z'); // customer createdAt
const T_C2 = new Date('2026-07-05T13:00:00.000Z');
const T_C3 = new Date('2026-08-20T13:00:00.000Z');

const T_E1 = new Date('2026-06-20T10:00:00.000Z'); // expense 1
const T_E2 = new Date('2026-07-25T09:00:00.000Z'); // expense 2
const T_E2B = new Date('2026-08-05T09:00:00.000Z'); // expense 2 second payment

/**
 * Seeds the deterministic fixture organization. Idempotent: safe to run any
 * number of times on any database (local seeded or CI empty-but-migrated).
 */
export async function seedGoldenFixtures(
  prisma: PrismaService,
): Promise<{ orgId: string }> {
  // ── Organization (upsert by slug; its id never leaks into outputs) ─────────
  const org = await prisma.organization.upsert({
    where: { slug: GOLDEN_ORG_SLUG },
    update: { name: ORG_NAME },
    create: { slug: GOLDEN_ORG_SLUG, name: ORG_NAME },
  });
  const orgId = org.id;

  // ── Scoped teardown, FK-safe order (all rows are fixture-only) ─────────────
  await prisma.payment.deleteMany({ where: { organizationId: orgId } });
  await prisma.saleItem.deleteMany({ where: { organizationId: orgId } });
  await prisma.inventoryMovement.deleteMany({
    where: { organizationId: orgId },
  });
  await prisma.sale.deleteMany({ where: { organizationId: orgId } });
  await prisma.expensePayment.deleteMany({ where: { organizationId: orgId } });
  await prisma.expense.deleteMany({ where: { organizationId: orgId } });
  await prisma.product.deleteMany({ where: { organizationId: orgId } });
  await prisma.customer.deleteMany({ where: { organizationId: orgId } });
  await prisma.category.deleteMany({ where: { organizationId: orgId } });
  await prisma.expenseLabel.deleteMany({ where: { organizationId: orgId } });
  await prisma.expenseGroup.deleteMany({ where: { organizationId: orgId } });
  // Fixture users are namespaced by email; sales/expenses referencing them
  // were just deleted (remaining references are SetNull/cascade).
  await prisma.user.deleteMany({
    where: { email: { in: [ADMIN_EMAIL, CASHIER_EMAIL] } },
  });

  // ── Users (fixed ids: userId leaks into user-performance outputs) ──────────
  const admin = await prisma.user.create({
    data: {
      id: id(1),
      email: ADMIN_EMAIL,
      password: FIXTURE_PASSWORD_HASH,
      name: 'Golden Admin',
    },
  });
  const cashier = await prisma.user.create({
    data: {
      id: id(2),
      email: CASHIER_EMAIL,
      password: FIXTURE_PASSWORD_HASH,
      name: 'Golden Cashier',
    },
  });

  await prisma.organizationUser.createMany({
    data: [
      {
        id: id(3),
        userId: admin.id,
        organizationId: orgId,
        role: 'ADMIN',
        isPrimaryOwner: true,
      },
      {
        id: id(4),
        userId: cashier.id,
        organizationId: orgId,
        role: 'CASHIER',
        isPrimaryOwner: false,
      },
    ],
  });

  // ── Catalog (fixed ids) ─────────────────────────────────────────────────────
  const catDrinks = await prisma.category.create({
    data: {
      id: id(5),
      organizationId: orgId,
      name: 'Golden Bebidas',
      active: true,
      taxable: true,
    },
  });
  const catSnacks = await prisma.category.create({
    data: {
      id: id(6),
      organizationId: orgId,
      name: 'Golden Snacks',
      active: true,
      taxable: false,
    },
  });

  const p1 = await prisma.product.create({
    data: {
      id: id(7),
      organizationId: orgId,
      sku: 'RG-001',
      name: 'Golden Dona Clasica',
      costPrice: 2000,
      salePrice: 3500,
      taxRate: 0,
      taxable: false,
      stock: 50,
      minStock: 10,
      categoryId: catSnacks.id,
      barcode: null,
    },
  });
  // Low-stock branch of the dashboard KPI query (stock <= minStock).
  const p2 = await prisma.product.create({
    data: {
      id: id(8),
      organizationId: orgId,
      sku: 'RG-002',
      name: 'Golden Cafe',
      costPrice: 1500,
      salePrice: 3000,
      taxRate: 0,
      taxable: false,
      stock: 8,
      minStock: 10,
      categoryId: catDrinks.id,
      barcode: null,
    },
  });
  const p3 = await prisma.product.create({
    data: {
      id: id(9),
      organizationId: orgId,
      sku: 'RG-003',
      name: 'Golden Chocolate',
      costPrice: 2500,
      salePrice: 4500,
      taxRate: 0,
      taxable: false,
      stock: 30,
      minStock: 5,
      categoryId: catDrinks.id,
      barcode: null,
    },
  });
  const p4 = await prisma.product.create({
    data: {
      id: id(10),
      organizationId: orgId,
      sku: 'RG-004',
      name: 'Golden Combo',
      costPrice: 5000,
      salePrice: 8000,
      taxRate: 19,
      taxable: true,
      stock: 12,
      minStock: 3,
      categoryId: catSnacks.id,
      barcode: null,
    },
  });

  // ── Customers (fixed ids: customerId leaks into dashboard recentSales) ─────
  const c1 = await prisma.customer.create({
    data: {
      id: id(11),
      organizationId: orgId,
      name: 'Golden Cliente Uno',
      documentType: 'CC',
      documentNumber: '111111111111',
      segment: 'VIP',
      active: true,
      createdAt: T_C1,
      updatedAt: T_C1,
    },
  });
  const c2 = await prisma.customer.create({
    data: {
      id: id(12),
      organizationId: orgId,
      name: 'Golden Cliente Dos',
      documentType: 'CC',
      documentNumber: '222222222222',
      segment: 'FREQUENT',
      active: true,
      createdAt: T_C2,
      updatedAt: T_C2,
    },
  });
  await prisma.customer.create({
    data: {
      id: id(13),
      organizationId: orgId,
      name: 'Golden Cliente Tres',
      documentType: 'CC',
      documentNumber: '333333333333',
      segment: 'OCCASIONAL',
      active: true,
      createdAt: T_C3,
      updatedAt: T_C3,
    },
  });

  // ── Sales + items + payments + movements (all fixed ids) ───────────────────
  const s1 = { id: id(14), createdAt: T_S1 };
  const s2 = { id: id(15), createdAt: T_S2 };
  const s3 = { id: id(16), createdAt: T_S3 };
  const s4 = { id: id(17), createdAt: T_S4 };

  await prisma.sale.createMany({
    data: [
      {
        id: s1.id,
        saleNumber: 1,
        status: 'COMPLETED',
        createdAt: T_S1,
        updatedAt: T_S1,
        userId: admin.id,
        customerId: c1.id,
        subtotal: 11500,
        taxAmount: 0,
        discountAmount: 500,
        total: 11000,
        amountPaid: 11000,
        organizationId: orgId,
      },
      {
        id: s2.id,
        saleNumber: 2,
        status: 'COMPLETED',
        createdAt: T_S2,
        updatedAt: T_S2,
        userId: cashier.id,
        customerId: c2.id,
        subtotal: 8000,
        taxAmount: 1520,
        discountAmount: 0,
        total: 9520,
        amountPaid: 9520,
        organizationId: orgId,
      },
      {
        id: s3.id,
        saleNumber: 3,
        status: 'COMPLETED',
        createdAt: T_S3,
        updatedAt: T_S3,
        userId: admin.id,
        subtotal: 9000,
        taxAmount: 0,
        discountAmount: 0,
        total: 9000,
        amountPaid: 9000,
        organizationId: orgId,
      },
      {
        id: s4.id,
        saleNumber: 4,
        status: 'CANCELLED',
        createdAt: T_S4,
        updatedAt: T_S4,
        cancelledAt: T_S4_CANCELLED,
        cancelReason: 'Golden fixture cancellation',
        userId: cashier.id,
        customerId: c1.id,
        subtotal: 3500,
        taxAmount: 0,
        discountAmount: 0,
        total: 3500,
        amountPaid: 3500,
        organizationId: orgId,
      },
    ],
  });

  await prisma.saleItem.createMany({
    data: [
      // Sale 1 (admin, VIP customer): discounted item + zero-tax item.
      {
        id: id(18),
        saleId: s1.id,
        organizationId: orgId,
        productId: p1.id,
        quantity: 2,
        unitPrice: 3500,
        taxRate: 0,
        discountAmount: 500,
        subtotal: 7000,
        total: 6500,
        costPriceSnapshot: 2000,
      },
      {
        id: id(19),
        saleId: s1.id,
        organizationId: orgId,
        productId: p3.id,
        quantity: 1,
        unitPrice: 4500,
        taxRate: 0,
        discountAmount: 0,
        subtotal: 4500,
        total: 4500,
        costPriceSnapshot: 2500,
      },
      // Sale 2 (cashier, multi-payment): taxed item.
      {
        id: id(20),
        saleId: s2.id,
        organizationId: orgId,
        productId: p4.id,
        quantity: 1,
        unitPrice: 8000,
        taxRate: 19,
        discountAmount: 0,
        subtotal: 8000,
        total: 9520,
        costPriceSnapshot: 5000,
      },
      // Sale 3 (admin, no customer): TRANSFER payment.
      {
        id: id(21),
        saleId: s3.id,
        organizationId: orgId,
        productId: p2.id,
        quantity: 3,
        unitPrice: 3000,
        taxRate: 0,
        discountAmount: 0,
        subtotal: 9000,
        total: 9000,
        costPriceSnapshot: 1500,
      },
      // Sale 4 (cancelled): exercises cancelledAt paths.
      {
        id: id(22),
        saleId: s4.id,
        organizationId: orgId,
        productId: p1.id,
        quantity: 1,
        unitPrice: 3500,
        taxRate: 0,
        discountAmount: 0,
        subtotal: 3500,
        total: 3500,
        costPriceSnapshot: 2000,
      },
    ],
  });

  await prisma.payment.createMany({
    data: [
      { id: id(23), saleId: s1.id, organizationId: orgId, method: 'CASH', amount: 11000, createdAt: T_S1 },
      { id: id(24), saleId: s2.id, organizationId: orgId, method: 'CASH', amount: 5000, createdAt: T_S2 },
      { id: id(25), saleId: s2.id, organizationId: orgId, method: 'CARD', amount: 4520, createdAt: T_S2 },
      { id: id(26), saleId: s3.id, organizationId: orgId, method: 'TRANSFER', amount: 9000, createdAt: T_S3 },
      { id: id(27), saleId: s4.id, organizationId: orgId, method: 'CARD', amount: 3500, createdAt: T_S4 },
    ],
  });

  await prisma.inventoryMovement.createMany({
    data: [
      { id: id(28), productId: p1.id, organizationId: orgId, type: 'SALE', quantity: -2, previousStock: 50, newStock: 48, reason: 'Golden fixture sale', userId: admin.id, saleId: s1.id, createdAt: T_S1 },
      { id: id(29), productId: p3.id, organizationId: orgId, type: 'SALE', quantity: -1, previousStock: 30, newStock: 29, reason: 'Golden fixture sale', userId: admin.id, saleId: s1.id, createdAt: T_S1 },
      { id: id(30), productId: p4.id, organizationId: orgId, type: 'SALE', quantity: -1, previousStock: 12, newStock: 11, reason: 'Golden fixture sale', userId: cashier.id, saleId: s2.id, createdAt: T_S2 },
      { id: id(31), productId: p2.id, organizationId: orgId, type: 'SALE', quantity: -3, previousStock: 8, newStock: 5, reason: 'Golden fixture sale', userId: admin.id, saleId: s3.id, createdAt: T_S3 },
      // RETURN movement (financial-overview return path), linked to sale 3.
      { id: id(32), productId: p2.id, organizationId: orgId, type: 'RETURN', quantity: 1, previousStock: 5, newStock: 6, reason: 'Golden fixture return', userId: admin.id, saleId: s3.id, createdAt: T_S3 },
    ],
  });

  // ── Expenses + payments (cash-flow expense side) ───────────────────────────
  const expenseGroup = await prisma.expenseGroup.create({
    data: { id: id(33), organizationId: orgId, name: 'Golden Servicios', active: true },
  });
  const expenseLabel = await prisma.expenseLabel.create({
    data: {
      id: id(39),
      organizationId: orgId,
      groupId: expenseGroup.id,
      name: 'Servicios',
      active: true,
    },
  });

  const e1 = await prisma.expense.create({
    data: {
      id: id(34),
      organizationId: orgId,
      labelId: expenseLabel.id,
      description: 'Golden fixture expense one',
      date: T_E1,
      total: 200000,
      status: 'PAID',
      createdById: admin.id,
    },
  });
  const e2 = await prisma.expense.create({
    data: {
      id: id(35),
      organizationId: orgId,
      labelId: expenseLabel.id,
      description: 'Golden fixture expense two',
      date: T_E2,
      total: 50000,
      status: 'PARTIAL',
      createdById: admin.id,
    },
  });
  await prisma.expensePayment.createMany({
    data: [
      { id: id(36), expenseId: e1.id, organizationId: orgId, amount: 200000, method: 'TRANSFER', date: T_E1 },
      { id: id(37), expenseId: e2.id, organizationId: orgId, amount: 30000, method: 'CASH', date: T_E2 },
      { id: id(38), expenseId: e2.id, organizationId: orgId, amount: 20000, method: 'CARD', date: T_E2B },
    ],
  });

  return { orgId };
}
