import { Prisma } from '@prisma/client';
import { ExportsService } from './exports.service';
import { ExportQueryDto } from './dto/export.dto';
import * as csv from '@fast-csv/format';

jest.mock('@fast-csv/format', () => ({
  write: jest.fn(() => ({ pipe: jest.fn() })),
}));

describe('ExportsService', () => {
  let service: ExportsService;

  const prismaMock = {
    inventoryMovement: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    sale: {
      findMany: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
    },
    customer: {
      findMany: jest.fn(),
    },
    expense: {
      findMany: jest.fn(),
    },
  };
  const reportsMock = { getEconomicExport: jest.fn() };

  const ORG_ID = 'org-1';

  const buildResMock = () => ({
    setHeader: jest.fn(),
    end: jest.fn(),
    write: jest.fn(),
    flushHeaders: jest.fn(),
    pipe: jest.fn(),
    send: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExportsService(prismaMock as never, reportsMock as never);
  });

  it('getInventoryMovements filters by organizationId', async () => {
    prismaMock.inventoryMovement.findMany.mockResolvedValue([]);
    prismaMock.inventoryMovement.count.mockResolvedValue(0);

    await service.getInventoryMovements(ORG_ID, {});

    expect(prismaMock.inventoryMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG_ID }),
      }),
    );
    expect(prismaMock.inventoryMovement.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG_ID }),
      }),
    );
  });

  it('exportSales filters by organizationId', async () => {
    prismaMock.sale.findMany.mockResolvedValue([]);
    const res = {
      setHeader: jest.fn(),
      end: jest.fn(),
      write: jest.fn(),
      flushHeaders: jest.fn(),
      pipe: jest.fn(),
      send: jest.fn(),
    };

    await service.exportSales(
      ORG_ID,
      { format: 'pdf', type: 'sales' } as ExportQueryDto,
      res,
    );

    expect(prismaMock.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG_ID }),
      }),
    );
  });

  it('exportProducts filters by organizationId', async () => {
    prismaMock.product.findMany.mockResolvedValue([]);
    const res = {
      setHeader: jest.fn(),
      end: jest.fn(),
      write: jest.fn(),
      flushHeaders: jest.fn(),
      pipe: jest.fn(),
      send: jest.fn(),
    };

    await service.exportProducts(
      ORG_ID,
      { format: 'pdf', type: 'products' } as ExportQueryDto,
      res,
    );

    expect(prismaMock.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG_ID,
          active: true,
        }),
      }),
    );
  });

  it('exportCustomers filters by organizationId', async () => {
    prismaMock.customer.findMany.mockResolvedValue([]);
    const res = {
      setHeader: jest.fn(),
      end: jest.fn(),
      write: jest.fn(),
      flushHeaders: jest.fn(),
      pipe: jest.fn(),
      send: jest.fn(),
    };

    await service.exportCustomers(
      ORG_ID,
      { format: 'pdf', type: 'customers' } as ExportQueryDto,
      res,
    );

    expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG_ID,
          active: true,
        }),
      }),
    );
  });

  it('exportInventory filters by organizationId', async () => {
    prismaMock.inventoryMovement.findMany.mockResolvedValue([]);
    const res = {
      setHeader: jest.fn(),
      end: jest.fn(),
      write: jest.fn(),
      flushHeaders: jest.fn(),
      pipe: jest.fn(),
      send: jest.fn(),
    };

    await service.exportInventory(
      ORG_ID,
      { format: 'pdf', type: 'inventory' } as ExportQueryDto,
      res,
    );

    expect(prismaMock.inventoryMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG_ID }),
      }),
    );
  });

  it('exportExpenses filters by organizationId, active and the expense date range', async () => {
    prismaMock.expense.findMany.mockResolvedValue([]);
    const expectedEnd = new Date('2026-08-31');
    expectedEnd.setHours(23, 59, 59, 999);

    await service.exportExpenses(
      ORG_ID,
      {
        format: 'pdf',
        type: 'expenses',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      } as ExportQueryDto,
      buildResMock(),
    );

    expect(prismaMock.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: ORG_ID,
          active: true,
          date: {
            gte: new Date('2026-08-01'),
            lte: expectedEnd,
          },
        },
        orderBy: { date: 'desc' },
        include: { category: { select: { name: true } } },
      }),
    );
  });

  it('exportExpenses writes CSV headers and rows with date, category, description, total and status', async () => {
    const expenseDate = new Date('2026-08-15T00:00:00.000Z');
    prismaMock.expense.findMany.mockResolvedValue([
      {
        date: expenseDate,
        category: { name: 'Arriendo' },
        description: 'Arriendo agosto',
        total: new Prisma.Decimal(500000),
        status: 'PAID',
      },
    ]);

    await service.exportExpenses(
      ORG_ID,
      { format: 'csv', type: 'expenses' } as ExportQueryDto,
      buildResMock(),
    );

    expect(csv.write).toHaveBeenCalledWith(
      [
        ['Date', 'Category', 'Description', 'Total', 'Status'],
        [
          expenseDate.toLocaleDateString(),
          'Arriendo',
          'Arriendo agosto',
          '500000.00',
          'PAID',
        ],
      ],
      { headers: false },
    );
  });

  it('exportExpenses exports an empty result with headers only', async () => {
    prismaMock.expense.findMany.mockResolvedValue([]);

    await service.exportExpenses(
      ORG_ID,
      { format: 'csv', type: 'expenses' } as ExportQueryDto,
      buildResMock(),
    );

    expect(csv.write).toHaveBeenCalledWith(
      [['Date', 'Category', 'Description', 'Total', 'Status']],
      { headers: false },
    );
  });

  it('exports the Reports financial contract without converting decimal strings to numbers', async () => {
    reportsMock.getEconomicExport.mockResolvedValue({
      financial: { current: { netIncome: '100.10', grossProfit: '40.05', netProfit: '30.05' } },
      cash: { collections: { total: '120.10' }, expensePayments: { total: '10.00' } },
      inventory: { current: { stockValue: '50.00', retailValue: '80.00', potentialProfit: '30.00' } },
    });

    await service.exportEconomic(
      ORG_ID,
      { format: 'csv', type: 'economic', startDate: '2026-03-01', endDate: '2026-03-31' } as ExportQueryDto,
      buildResMock(),
    );

    expect(reportsMock.getEconomicExport).toHaveBeenCalledWith(
      ORG_ID,
      '2026-03-01',
      '2026-03-31',
    );
    expect(csv.write).toHaveBeenCalledWith(
      expect.arrayContaining([
        ['financial', 'netIncome', '100.10'],
        ['inventory', 'potentialProfit', '30.00'],
      ]),
      { headers: false },
    );
  });
});
