import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  const prismaMock = {
    sale: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    product: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    customer: {
      count: jest.fn(),
    },
    saleItem: {
      findMany: jest.fn(),
    },
    payment: {
      groupBy: jest.fn(),
    },
    inventoryMovement: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
  const cacheMock = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportsService(prismaMock as never, cacheMock as never);
  });

  it('rejects invalid ranges where endDate is before startDate', async () => {
    await expect(
      service.getSalesByPaymentMethod('org-1', '2026-03-10', '2026-03-05'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects dashboard KPIs without an organization context', async () => {
    await expect(
      service.getDashboardKPIs(undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('scopes dashboard KPI queries to the requested organization', async () => {
    prismaMock.sale.count.mockResolvedValue(0);
    prismaMock.sale.aggregate.mockResolvedValue({ _sum: { total: null } });
    prismaMock.product.count.mockResolvedValue(0);
    prismaMock.customer.count.mockResolvedValue(0);
    prismaMock.sale.findMany.mockResolvedValue([]);
    prismaMock.$queryRaw.mockResolvedValue([{ count: 3n }]);

    const result = (await service.getDashboardKPIs('org-1')) as {
      lowStockProducts: number;
    };

    expect(result.lowStockProducts).toBe(3);
    expect(prismaMock.product.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', active: true },
    });
    expect(prismaMock.customer.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', active: true },
    });
  });

  it('returns appliedRange metadata with the queried date range', async () => {
    prismaMock.payment.groupBy.mockResolvedValue([
      { method: 'CASH', _sum: { amount: 120000 }, _count: { method: 2 } },
      { method: 'CARD', _sum: { amount: 50000 }, _count: { method: 1 } },
    ]);

    const result = await service.getSalesByPaymentMethod(
      'org-1',
      '2026-03-01',
      '2026-03-31',
    );

    expect(prismaMock.payment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['method'],
        where: expect.objectContaining({
          sale: expect.objectContaining({
            organizationId: 'org-1',
            status: 'COMPLETED',
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
        // Deterministic-by-contract group order (maintainer decision obs #411).
        orderBy: { method: 'asc' },
      }),
    );
    expect(result.appliedRange).toEqual({
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      timezone: 'America/Bogota',
    });
    expect(result.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ paymentMethod: 'CASH', total: 120000, count: 2 }),
        expect.objectContaining({ paymentMethod: 'CARD', total: 50000, count: 1 }),
      ]),
    );
  });

  it('[#16] returns empty-safe metrics for zero-data ranges', async () => {
    prismaMock.payment.groupBy.mockResolvedValue([]);

    const result = await service.getSalesByPaymentMethod(
      'org-1',
      '2026-04-01',
      '2026-04-30',
    );

    expect(result).toEqual({
      data: [],
      appliedRange: {
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        timezone: 'America/Bogota',
      },
    });
    expect(prismaMock.payment.groupBy).toHaveBeenCalledTimes(1);
  });

  it('keeps a selected user subset and shared comparison ranges in user performance analytics', async () => {
    prismaMock.sale.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        userId: 'user-1',
        total: 250000,
        customerId: 'customer-1',
      },
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'user-1', name: 'Ana' },
      { id: 'user-2', name: 'Luis' },
    ]);

    const result = await service.getUserPerformance(
      'org-1',
      '2026-03-10',
      '2026-03-12',
      true,
      ['user-1', 'user-2'],
    );

    expect(prismaMock.sale.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'COMPLETED',
          userId: { in: ['user-1', 'user-2'] },
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      }),
    );
    expect(prismaMock.sale.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'COMPLETED',
          userId: { in: ['user-1', 'user-2'] },
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      }),
    );
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['user-1', 'user-2'],
        },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
    expect(result.appliedRange).toEqual({
      startDate: '2026-03-10',
      endDate: '2026-03-12',
      timezone: 'America/Bogota',
    });
    expect(result.comparisonRange).toEqual({
      startDate: '2026-03-07',
      endDate: '2026-03-09',
      timezone: 'America/Bogota',
    });
    expect(result.data).toEqual([
      {
        userId: 'user-1',
        userName: 'Ana',
        salesCount: 0,
        revenue: 0,
        avgTicket: 0,
        uniqueCustomers: 0,
        comparison: {
          revenuePct: -100,
          salesPct: -100,
        },
      },
      {
        userId: 'user-2',
        userName: 'Luis',
        salesCount: 0,
        revenue: 0,
        avgTicket: 0,
        uniqueCustomers: 0,
        comparison: {
          revenuePct: 0,
          salesPct: 0,
        },
      },
    ]);
  });

  it('groups sale items by Bogotá date and category for the stacked chart', async () => {
    prismaMock.saleItem.findMany.mockResolvedValue([
      {
        total: 50000,
        quantity: 2,
        sale: { createdAt: new Date('2026-08-21T15:00:00.000Z') },
        product: { category: { name: 'Bebidas' } },
      },
      {
        total: 30000,
        quantity: 1,
        sale: { createdAt: new Date('2026-08-21T15:00:00.000Z') },
        product: { category: { name: 'Snacks' } },
      },
      {
        total: 20000,
        quantity: 1,
        sale: { createdAt: new Date('2026-08-22T15:00:00.000Z') },
        product: { category: { name: 'Bebidas' } },
      },
    ]);

    const result = await service.getSalesByCategoryDaily(
      'org-1',
      '2026-08-20',
      '2026-08-26',
    );

    expect(prismaMock.saleItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sale: expect.objectContaining({
            status: 'COMPLETED',
            organizationId: 'org-1',
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      }),
    );

    expect(result.appliedRange).toEqual({
      startDate: '2026-08-20',
      endDate: '2026-08-26',
      timezone: 'America/Bogota',
    });
    expect(result.data).toEqual(
      expect.arrayContaining([
        { date: '2026-08-21', category: 'Bebidas', total: 50000, quantity: 2 },
        { date: '2026-08-21', category: 'Snacks', total: 30000, quantity: 1 },
        { date: '2026-08-22', category: 'Bebidas', total: 20000, quantity: 1 },
      ]),
    );
  });

  it('values inventory at list price, ignoring active promotions', async () => {
    prismaMock.product.findMany.mockResolvedValue([
      {
        stock: 10,
        costPrice: new Prisma.Decimal('2000'),
        salePrice: new Prisma.Decimal('5000'),
        promotionType: 'PERCENTAGE',
        promotionValue: new Prisma.Decimal('20'),
      },
    ]);
    prismaMock.inventoryMovement.findMany.mockResolvedValue([]);

    const result = await service.getInventorySnapshot('org-1');

    expect(result.current.retailValue).toBe('50000.00');
  });
});
