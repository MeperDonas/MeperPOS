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
  let expenseLabelAId: string;
  let expenseAId: string;
  let purchaseExpenseId: string;
  let supplierId: string;
  let purchaseOrderId: string;
  let saleNumberSequence: number;
  const eventSaleIds: string[] = [];

  beforeAll(async () => {
    service = new ReportsService(prisma as never, new CacheService());
    const suffix = Date.now();
    const sequence = suffix % 1_000_000_000;
    saleNumberSequence = sequence;
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
    const expenseGroup = await prisma.expenseGroup.create({
      data: { name: 'Reports group', organizationId: orgAId },
    });
    const expenseLabel = await prisma.expenseLabel.create({
      data: { name: 'Reports expense', organizationId: orgAId, groupId: expenseGroup.id },
    });
    expenseLabelAId = expenseLabel.id;
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
          labelId: expenseLabelAId,
          date: new Date('2026-08-15T15:00:00.000Z'),
          total: 15,
          status: 'PAID',
          createdById: userId,
        },
      }),
      prisma.expense.create({
        data: {
          organizationId: orgAId,
          labelId: expenseLabelAId,
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
    await prisma.inventoryMovement.deleteMany({ where: { saleId: { in: eventSaleIds } } });
    await prisma.saleItem.deleteMany({ where: { saleId: { in: eventSaleIds } } });
    await prisma.sale.deleteMany({ where: { id: { in: eventSaleIds } } });
    await prisma.expense.deleteMany({ where: { id: { in: [expenseAId, purchaseExpenseId] } } });
    await prisma.purchaseOrder.delete({ where: { id: purchaseOrderId } });
    await prisma.supplier.delete({ where: { id: supplierId } });
    await prisma.expenseLabel.delete({ where: { id: expenseLabelAId } });
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

  it('applies cancellation and partial return adjustments by event date when sales predate the range', async () => {
    const cancellation = await prisma.sale.create({
      data: {
        saleNumber: saleNumberSequence + 1,
        subtotal: 200,
        taxAmount: 0,
        discountAmount: 0,
        total: 200,
        amountPaid: 200,
        status: 'CANCELLED',
        cancelledAt: new Date('2026-08-20T15:00:00.000Z'),
        userId,
        organizationId: orgAId,
        createdAt: new Date('2026-07-20T15:00:00.000Z'),
      },
    });
    const partial = await prisma.sale.create({
      data: {
        saleNumber: saleNumberSequence + 2,
        subtotal: 200,
        taxAmount: 0,
        discountAmount: 0,
        total: 200,
        amountPaid: 200,
        status: 'RETURNED_PARTIAL',
        userId,
        organizationId: orgAId,
        createdAt: new Date('2026-07-20T15:00:00.000Z'),
      },
    });
    const cancelledLater = await prisma.sale.create({
      data: {
        saleNumber: saleNumberSequence + 3,
        subtotal: 200,
        taxAmount: 0,
        discountAmount: 0,
        total: 200,
        amountPaid: 200,
        status: 'CANCELLED',
        cancelledAt: new Date('2026-08-30T15:00:00.000Z'),
        userId,
        organizationId: orgAId,
        createdAt: new Date('2026-08-20T15:00:00.000Z'),
      },
    });
    eventSaleIds.push(cancellation.id, partial.id, cancelledLater.id);

    for (const sale of [cancellation, partial, cancelledLater]) {
      await prisma.saleItem.create({
        data: {
          saleId: sale.id,
          productId: productAId,
          quantity: 2,
          unitPrice: 100,
          costPriceSnapshot: 40,
          taxRate: 0,
          subtotal: 200,
          total: 200,
          organizationId: orgAId,
        },
      });
    }
    await prisma.inventoryMovement.create({
      data: {
        productId: productAId,
        type: 'RETURN',
        quantity: 1,
        previousStock: 0,
        newStock: 1,
        reason: 'Partial return',
        userId,
        saleId: partial.id,
        organizationId: orgAId,
        createdAt: new Date('2026-08-21T15:00:00.000Z'),
      },
    });
    await prisma.inventoryMovement.create({
      data: {
        productId: productAId,
        type: 'RETURN',
        quantity: 2,
        previousStock: 0,
        newStock: 2,
        reason: 'Sale cancelled',
        userId,
        saleId: cancelledLater.id,
        organizationId: orgAId,
        createdAt: new Date('2026-08-21T15:00:00.000Z'),
      },
    });

    const report = await service.getFinancialOverview(orgAId, '2026-08-20', '2026-08-21');

    expect(report.current.netIncome).toBe('-100.00');
    expect(report.current.cogs).toBe('-40.00');
    expect(report.current.grossProfit).toBe('-60.00');
  });
});
