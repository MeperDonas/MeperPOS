import { PrismaClient, PlanType } from '@prisma/client';
import { CacheService } from '../common/services/cache.service';
import { ReportsService } from './reports.service';

const prisma = new PrismaClient();

describe('ReportsService financial integration', () => {
  let service: ReportsService;
  let orgAId: string;
  let orgBId: string;
  let userId: string;
  let categoryAId: string;
  let categoryBId: string;
  let productAId: string;
  let saleAId: string;
  let saleBId: string;
  let expenseCategoryAId: string;
  let expenseAId: string;
  let purchaseExpenseId: string;
  let supplierId: string;
  let purchaseOrderId: string;

  beforeAll(async () => {
    service = new ReportsService(prisma as never, new CacheService());
    const suffix = Date.now();
    const sequence = suffix % 1_000_000_000;
    const [orgA, orgB] = await Promise.all([
      prisma.organization.create({
        data: { name: 'Reports INT A', slug: `reports-int-a-${suffix}`, plan: PlanType.BASIC },
      }),
      prisma.organization.create({
        data: { name: 'Reports INT B', slug: `reports-int-b-${suffix}`, plan: PlanType.BASIC },
      }),
    ]);
    orgAId = orgA.id;
    orgBId = orgB.id;
    const user = await prisma.user.create({
      data: {
        email: `reports-int-${suffix}@example.com`,
        password: 'hash',
        name: 'Reports Integration',
      },
    });
    userId = user.id;
    const [categoryA, categoryB] = await Promise.all([
      prisma.category.create({ data: { name: 'Reports A', organizationId: orgAId } }),
      prisma.category.create({ data: { name: 'Reports B', organizationId: orgBId } }),
    ]);
    categoryAId = categoryA.id;
    categoryBId = categoryB.id;
    const productA = await prisma.product.create({
      data: {
        name: 'Product A',
        sku: `reports-a-${suffix}`,
        costPrice: 40,
        salePrice: 100,
        categoryId: categoryAId,
        organizationId: orgAId,
      },
    });
    productAId = productA.id;
    const [saleA, saleB] = await Promise.all([
      prisma.sale.create({
        data: {
          saleNumber: sequence,
          subtotal: 100,
          taxAmount: 19,
          discountAmount: 10,
          total: 109,
          amountPaid: 109,
          userId,
          organizationId: orgAId,
          createdAt: new Date('2026-08-15T15:00:00.000Z'),
        },
      }),
      prisma.sale.create({
        data: {
          saleNumber: sequence,
          subtotal: 900,
          taxAmount: 0,
          discountAmount: 0,
          total: 900,
          amountPaid: 900,
          userId,
          organizationId: orgBId,
          createdAt: new Date('2026-08-15T15:00:00.000Z'),
        },
      }),
    ]);
    saleAId = saleA.id;
    saleBId = saleB.id;
    await prisma.saleItem.create({
      data: {
        saleId: saleAId,
        productId: productAId,
        quantity: 1,
        unitPrice: 100,
        costPriceSnapshot: 40,
        taxRate: 19,
        subtotal: 100,
        total: 119,
        organizationId: orgAId,
      },
    });
    const expenseCategory = await prisma.expenseCategory.create({
      data: { name: 'Reports expense', organizationId: orgAId },
    });
    expenseCategoryAId = expenseCategory.id;
    const supplier = await prisma.supplier.create({
      data: {
        name: 'Reports supplier',
        documentNumber: `reports-supplier-${suffix}`,
        organizationId: orgAId,
      },
    });
    supplierId = supplier.id;
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        orderNumber: sequence,
        supplierId,
        createdById: userId,
        organizationId: orgAId,
      },
    });
    purchaseOrderId = purchaseOrder.id;
    const [expense, purchaseExpense] = await Promise.all([
      prisma.expense.create({
        data: {
          organizationId: orgAId,
          categoryId: expenseCategoryAId,
          date: new Date('2026-08-15T15:00:00.000Z'),
          total: 15,
          status: 'PAID',
          createdById: userId,
        },
      }),
      prisma.expense.create({
        data: {
          organizationId: orgAId,
          categoryId: expenseCategoryAId,
          date: new Date('2026-08-15T15:00:00.000Z'),
          total: 999,
          status: 'PAID',
          purchaseOrderId,
          createdById: userId,
        },
      }),
    ]);
    expenseAId = expense.id;
    purchaseExpenseId = purchaseExpense.id;
    void categoryBId;
  });

  afterAll(async () => {
    await prisma.expense.deleteMany({ where: { id: { in: [expenseAId, purchaseExpenseId] } } });
    await prisma.purchaseOrder.delete({ where: { id: purchaseOrderId } });
    await prisma.supplier.delete({ where: { id: supplierId } });
    await prisma.expenseCategory.delete({ where: { id: expenseCategoryAId } });
    await prisma.saleItem.deleteMany({ where: { saleId: { in: [saleAId, saleBId] } } });
    await prisma.sale.deleteMany({ where: { id: { in: [saleAId, saleBId] } } });
    await prisma.product.delete({ where: { id: productAId } });
    await prisma.category.deleteMany({ where: { id: { in: [categoryAId, categoryBId] } } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    await prisma.$disconnect();
  });

  it('isolates organization economics and excludes purchase-linked operating outflows', async () => {
    const reportA = await service.getFinancialOverview(orgAId, '2026-08-01', '2026-08-31');
    const reportB = await service.getFinancialOverview(orgBId, '2026-08-01', '2026-08-31');

    expect(reportA.current.netIncome).toBe('90.00');
    expect(reportA.current.cogs).toBe('40.00');
    expect(reportA.current.operatingExpenses).toBe('15.00');
    expect(reportA.current.netProfit).toBe('35.00');
    expect(reportB.current.netIncome).toBe('900.00');
    expect(reportB.current.cogs).toBe('0.00');
  });
});
