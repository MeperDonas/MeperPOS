import { Prisma } from '@prisma/client';
import { ReportsService } from './reports.service';

const decimal = (value: string | number) => new Prisma.Decimal(value);

describe('ReportsService financial read model', () => {
  const prismaMock = {
    sale: { findMany: jest.fn() },
  };
  const cacheMock = { get: jest.fn(), set: jest.fn() };
  const expensesMock = { findForReports: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries completed sales and expenses by the organization and equivalent ranges', async () => {
    prismaMock.sale.findMany.mockResolvedValue([]);
    expensesMock.findForReports.mockResolvedValue([]);
    const service = new ReportsService(
      prismaMock as never,
      cacheMock as never,
      expensesMock as never,
    );

    const result = await service.getFinancialOverview(
      'org-a',
      '2026-03-10',
      '2026-03-12',
    );

    expect(prismaMock.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-a',
          status: 'COMPLETED',
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        },
      }),
    );
    expect(expensesMock.findForReports).toHaveBeenCalledWith(
      'org-a',
      expect.any(Date),
      expect.any(Date),
    );
    expect(result.comparisonRange).toEqual({
      startDate: '2026-03-07',
      endDate: '2026-03-09',
      timezone: 'America/Bogota',
    });
  });

  it('returns decimal strings and keeps previous-period comparison separate', async () => {
    prismaMock.sale.findMany
      .mockResolvedValueOnce([
        {
          subtotal: decimal('100.00'),
          discountAmount: decimal('0.00'),
          taxAmount: decimal('19.00'),
          items: [
            {
              quantity: 1,
              subtotal: decimal('100.00'),
              discountAmount: decimal('0.00'),
              costPriceSnapshot: decimal('40.00'),
              productId: 'p-1',
              product: { name: 'A', category: { name: 'General' } },
            },
          ],
        },
      ])
      .mockResolvedValueOnce([]);
    expensesMock.findForReports.mockResolvedValue([
      { total: decimal('10.00'), purchaseOrderId: null },
    ]);
    const service = new ReportsService(
      prismaMock as never,
      cacheMock as never,
      expensesMock as never,
    );

    const result = await service.getFinancialOverview(
      'org-a',
      '2026-03-10',
      '2026-03-12',
    );

    expect(result.current.netIncome).toBe('100.00');
    expect(result.current.cogs).toBe('40.00');
    expect(result.current.netProfit).toBe('50.00');
    expect(result.previous.netIncome).toBe('0.00');
    expect(result.deltas.netIncome).toEqual({ absolute: '100.00', percentage: 100 });
    expect(result.current.netIncome).toEqual(expect.any(String));
  });

  it('never builds a financial query without the requested organization', async () => {
    const service = new ReportsService(
      prismaMock as never,
      cacheMock as never,
      expensesMock as never,
    );

    await expect(service.getFinancialOverview(undefined)).rejects.toThrow(
      'Organization ID is required for reports',
    );
    expect(prismaMock.sale.findMany).not.toHaveBeenCalled();
  });
});
