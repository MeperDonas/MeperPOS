import { Prisma, ProductType } from '@prisma/client';
import { ReportsService } from './reports.service';

/**
 * A service is not merchandise. It must never contribute to the inventory valuation
 * the reports show, and it must never be counted as a product running low on stock.
 *
 * These specs are deliberately separate from `reports.service.spec.ts` so the
 * service-exclusion contract stays reviewable on its own.
 */
describe('ReportsService — inventory valuation excludes services', () => {
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

  const productRow = (
    overrides: Partial<{
      stock: number;
      costPrice: Prisma.Decimal;
      salePrice: Prisma.Decimal;
      type: ProductType;
    }> = {},
  ) => ({
    stock: 10,
    costPrice: new Prisma.Decimal('2000'),
    salePrice: new Prisma.Decimal('5000'),
    type: ProductType.PRODUCT,
    ...overrides,
  });

  const serviceRow = (overrides: Partial<{ stock: number }> = {}) =>
    productRow({
      // The real production rows carry exactly this kind of invented stock.
      stock: 9996,
      costPrice: new Prisma.Decimal('10000'),
      salePrice: new Prisma.Decimal('20000'),
      type: ProductType.SERVICE,
      ...overrides,
    });

  // An untracked product is merchandise nobody counts: a real PRODUCT row whose
  // stock must stay invisible to the valuation and to the low-stock alert.
  const untrackedRow = (overrides: Partial<{ stock: number }> = {}) => ({
    ...productRow({
      stock: 9991,
      costPrice: new Prisma.Decimal('10000'),
      salePrice: new Prisma.Decimal('20000'),
      type: ProductType.PRODUCT,
      ...overrides,
    }),
    tracksStock: false,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportsService(prismaMock as never, cacheMock as never);
    cacheMock.get.mockReturnValue(undefined);
    prismaMock.inventoryMovement.findMany.mockResolvedValue([]);
    prismaMock.sale.count.mockResolvedValue(0);
    prismaMock.sale.aggregate.mockResolvedValue({
      _sum: { total: new Prisma.Decimal(0) },
    });
    prismaMock.product.count.mockResolvedValue(0);
    prismaMock.customer.count.mockResolvedValue(0);
    prismaMock.saleItem.findMany.mockResolvedValue([]);
    prismaMock.payment.groupBy.mockResolvedValue([]);
    prismaMock.sale.findMany.mockResolvedValue([]);
    prismaMock.$queryRaw.mockResolvedValue([{ count: BigInt(0) }]);
  });

  describe('getInventorySnapshot', () => {
    it('asks only for products when valuing the inventory', async () => {
      prismaMock.product.findMany.mockResolvedValue([]);

      await service.getInventorySnapshot('org-1');

      expect(prismaMock.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            active: true,
            type: ProductType.PRODUCT,
          }),
        }),
      );
    });

    it('lets no service stock reach the valuation even if a service row is returned', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        productRow(),
        serviceRow(),
      ]);

      const result = await service.getInventorySnapshot('org-1');

      expect(result.current.stockQuantity).toBe(10);
      expect(result.current.stockValue).toBe('20000.00');
      expect(result.current.retailValue).toBe('50000.00');
      expect(result.current.potentialProfit).toBe('30000.00');
    });

    it('counts only movements of products in the movement totals', async () => {
      prismaMock.product.findMany.mockResolvedValue([]);

      await service.getInventorySnapshot('org-1');

      expect(prismaMock.inventoryMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            product: { type: ProductType.PRODUCT, tracksStock: true },
          }),
        }),
      );
    });

    it('asks only for tracked items when valuing the inventory', async () => {
      prismaMock.product.findMany.mockResolvedValue([]);

      await service.getInventorySnapshot('org-1');

      expect(prismaMock.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            active: true,
            type: ProductType.PRODUCT,
            tracksStock: true,
          }),
        }),
      );
    });

    it('lets no untracked stock reach the valuation even if an untracked row is returned', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        productRow(),
        untrackedRow(),
      ]);

      const result = await service.getInventorySnapshot('org-1');

      expect(result.current.stockQuantity).toBe(10);
      expect(result.current.stockValue).toBe('20000.00');
      expect(result.current.retailValue).toBe('50000.00');
      expect(result.current.potentialProfit).toBe('30000.00');
    });

    it('counts only movements of tracked items in the movement totals', async () => {
      prismaMock.product.findMany.mockResolvedValue([]);

      await service.getInventorySnapshot('org-1');

      expect(prismaMock.inventoryMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            product: { type: ProductType.PRODUCT, tracksStock: true },
          }),
        }),
      );
    });
  });

  describe('getDashboardKPIs', () => {
    it('never counts a service as a product running low on stock', async () => {
      await service.getDashboardKPIs('org-1');

      const sql = (
        prismaMock.$queryRaw.mock.calls[0][0] as unknown as string[]
      ).join('?');

      expect(sql).toContain('"type"');
      expect(sql).toContain('PRODUCT');
    });

    it('never counts untracked merchandise as running low on stock', async () => {
      await service.getDashboardKPIs('org-1');

      const sql = (
        prismaMock.$queryRaw.mock.calls[0][0] as unknown as string[]
      ).join('?');

      expect(sql).toContain('"type"');
      expect(sql).toContain('PRODUCT');
      expect(sql).toContain('tracksStock');
      expect(sql).toContain('true');
    });
  });
});
