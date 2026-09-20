import { ProductType } from '@prisma/client';
import { ProductsService } from './products.service';

/**
 * A service is not merchandise. It carries no stock, writes no kárdex movement, is
 * never reported as low on stock, and is excluded from the low-stock surfaces.
 *
 * These specs are deliberately separate from `products.service.spec.ts` so the
 * service-specific contract stays reviewable on its own.
 */
describe('ProductsService — product versus service', () => {
  let service: ProductsService;

  // Sentinel standing in for the Prisma field reference used by the low-stock where
  // clause; compared by identity, exactly like the existing products spec does.
  const MIN_STOCK_FIELD_REF = { prismaFieldRef: 'Product.minStock' };

  const prismaMock = {
    category: { findFirst: jest.fn() },
    product: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      fields: { minStock: MIN_STOCK_FIELD_REF },
    },
    inventoryMovement: { create: jest.fn() },
    $queryRaw: jest.fn(),
  };

  const cloudinaryServiceMock = {};
  const planLimitServiceMock = { invalidateCache: jest.fn() };

  const USER_ID = 'user-1';
  const ORG_ID = 'org-1';

  const categoryRow = () => ({
    id: 'cat-1',
    name: 'Mecánica',
    defaultTaxRate: null,
    taxable: false,
    active: true,
  });

  const buildProduct = (overrides: Record<string, unknown> = {}) => ({
    id: 'prod-1',
    name: 'Test Product',
    sku: 'SKU-001',
    barcode: null,
    description: null,
    costPrice: 100,
    salePrice: 150,
    taxable: false,
    taxRate: 0,
    stock: 10,
    minStock: 5,
    type: ProductType.PRODUCT,
    imageUrl: null,
    categoryId: 'cat-1',
    active: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    promotionType: null,
    promotionValue: null,
    category: categoryRow(),
    ...overrides,
  });

  const baseCreateDto = {
    name: 'MANTENIMIENTO',
    sku: 'SERV 4',
    costPrice: 10000,
    salePrice: 20000,
    stock: 0,
    minStock: 0,
    categoryId: 'cat-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductsService(
      prismaMock as never,
      cloudinaryServiceMock as never,
      planLimitServiceMock as never,
    );
    prismaMock.category.findFirst.mockResolvedValue(categoryRow());
    prismaMock.product.findUnique.mockResolvedValue(null);
    prismaMock.inventoryMovement.create.mockResolvedValue({});
  });

  describe('create', () => {
    it('persists a service with zero stock even when the payload invents a stock', async () => {
      prismaMock.product.create.mockResolvedValue(
        buildProduct({ type: ProductType.SERVICE, stock: 0 }),
      );

      await service.create(
        { ...baseCreateDto, type: ProductType.SERVICE, stock: 9996 },
        USER_ID,
        ORG_ID,
      );

      expect(prismaMock.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: ProductType.SERVICE,
            stock: 0,
          }),
        }),
      );
      expect(prismaMock.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('still records the opening PURCHASE movement for a real product', async () => {
      prismaMock.product.create.mockResolvedValue(
        buildProduct({ type: ProductType.PRODUCT, stock: 10 }),
      );

      await service.create(
        {
          ...baseCreateDto,
          name: 'PASTILLAS',
          type: ProductType.PRODUCT,
          stock: 10,
        },
        USER_ID,
        ORG_ID,
      );

      expect(prismaMock.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stock: 10 }),
        }),
      );
      expect(prismaMock.inventoryMovement.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'PURCHASE',
            quantity: 10,
            previousStock: 0,
            newStock: 10,
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('never moves stock or the kárdex when a service stock is edited', async () => {
      const existingService = buildProduct({
        id: 'serv-1',
        type: ProductType.SERVICE,
        stock: 0,
      });
      prismaMock.product.findFirst
        .mockResolvedValueOnce(existingService)
        .mockResolvedValueOnce(existingService);
      prismaMock.product.updateMany.mockResolvedValue({ count: 1 });

      await service.update('serv-1', { stock: 500 }, USER_ID, ORG_ID);

      expect(prismaMock.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stock: 0 }),
        }),
      );
      expect(prismaMock.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('records one ADJUSTMENT_OUT when a stocked product is converted into a service', async () => {
      const stockedProduct = buildProduct({
        id: 'prod-1',
        type: ProductType.PRODUCT,
        stock: 9990,
      });
      prismaMock.product.findFirst
        .mockResolvedValueOnce(stockedProduct)
        .mockResolvedValueOnce(
          buildProduct({ type: ProductType.SERVICE, stock: 0 }),
        );
      prismaMock.product.updateMany.mockResolvedValue({ count: 1 });

      await service.update(
        'prod-1',
        { type: ProductType.SERVICE },
        USER_ID,
        ORG_ID,
      );

      expect(prismaMock.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: ProductType.SERVICE,
            stock: 0,
          }),
        }),
      );
      expect(prismaMock.inventoryMovement.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'ADJUSTMENT_OUT',
            quantity: -9990,
            previousStock: 9990,
            newStock: 0,
          }),
        }),
      );
    });

    it('records one ADJUSTMENT_IN when a service is converted back into a stocked product', async () => {
      const existingService = buildProduct({
        id: 'serv-1',
        type: ProductType.SERVICE,
        stock: 0,
      });
      prismaMock.product.findFirst
        .mockResolvedValueOnce(existingService)
        .mockResolvedValueOnce(
          buildProduct({ type: ProductType.PRODUCT, stock: 10 }),
        );
      prismaMock.product.updateMany.mockResolvedValue({ count: 1 });

      await service.update(
        'serv-1',
        { type: ProductType.PRODUCT, stock: 10 },
        USER_ID,
        ORG_ID,
      );

      expect(prismaMock.inventoryMovement.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'ADJUSTMENT_IN',
            quantity: 10,
            previousStock: 0,
            newStock: 10,
          }),
        }),
      );
    });
  });

  describe('low-stock surfaces', () => {
    it('excludes services from the paginated low-stock filter', async () => {
      prismaMock.product.findMany.mockResolvedValue([]);
      prismaMock.product.count.mockResolvedValue(0);

      await service.findAll(
        ORG_ID,
        1,
        10,
        undefined,
        undefined,
        'active',
        true,
      );

      const findManyArgs = prismaMock.product.findMany.mock.calls[0][0];
      expect(findManyArgs.where).toEqual(
        expect.objectContaining({
          stock: { lte: MIN_STOCK_FIELD_REF },
          type: ProductType.PRODUCT,
        }),
      );
    });

    it('excludes services from the raw low-stock lookup', async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);

      await service.getLowStockProducts(ORG_ID);

      const sql = (
        prismaMock.$queryRaw.mock.calls[0][0] as unknown as string[]
      ).join('?');
      expect(sql).toContain('p."type"');
      expect(sql).toContain('PRODUCT');
    });

    it('never marks a service as low on stock in the search mapper', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        buildProduct({ type: ProductType.SERVICE, stock: 0, minStock: 5 }),
      ]);

      const results = await service.searchProducts('MANTENIMIENTO', 20, ORG_ID);

      expect(results[0].isLowStock).toBe(false);
    });

    it('never marks a service as low on stock in the quick-search mapper', async () => {
      prismaMock.product.findFirst.mockResolvedValue(
        buildProduct({ type: ProductType.SERVICE, stock: 0, minStock: 5 }),
      );

      const result = await service.quickSearch('SERV 4', ORG_ID);

      expect(result?.isLowStock).toBe(false);
    });
  });
});
