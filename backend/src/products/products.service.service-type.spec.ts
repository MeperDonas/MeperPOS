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

  describe('the write boundary', () => {
    it('forces tracksStock to false when a service is created with the flag on', async () => {
      // The invariant is enforced at the write boundary, so no invalid
      // combination can be stored.
      prismaMock.product.create.mockResolvedValue(
        buildProduct({
          type: ProductType.SERVICE,
          stock: 0,
          tracksStock: false,
        }),
      );

      const payload = {
        ...baseCreateDto,
        type: ProductType.SERVICE,
        tracksStock: true,
        stock: 9996,
      };

      await service.create(payload, USER_ID, ORG_ID);

      expect(prismaMock.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: ProductType.SERVICE,
            tracksStock: false,
            stock: 0,
          }),
        }),
      );
      expect(prismaMock.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('normalises the stock of an untracked product to zero and writes no opening movement', async () => {
      prismaMock.product.create.mockResolvedValue(
        buildProduct({
          type: ProductType.PRODUCT,
          stock: 0,
          tracksStock: false,
        }),
      );

      const payload = {
        ...baseCreateDto,
        name: 'PASTILLAS',
        type: ProductType.PRODUCT,
        tracksStock: false,
        stock: 9991,
      };

      await service.create(payload, USER_ID, ORG_ID);

      expect(prismaMock.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: ProductType.PRODUCT,
            tracksStock: false,
            stock: 0,
          }),
        }),
      );
      expect(prismaMock.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('keeps tracked merchandise untouched: stock 10 and one opening PURCHASE movement', async () => {
      // Control: tracked merchandise must be unaffected by the boundary.
      prismaMock.product.create.mockResolvedValue(
        buildProduct({
          type: ProductType.PRODUCT,
          stock: 10,
          tracksStock: true,
        }),
      );

      const payload = {
        ...baseCreateDto,
        name: 'PASTILLAS',
        type: ProductType.PRODUCT,
        tracksStock: true,
        stock: 10,
      };

      await service.create(payload, USER_ID, ORG_ID);

      expect(prismaMock.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: ProductType.PRODUCT,
            tracksStock: true,
            stock: 10,
          }),
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

    it('defaults a missing tracksStock to true, matching the column default', async () => {
      prismaMock.product.create.mockResolvedValue(
        buildProduct({
          type: ProductType.PRODUCT,
          stock: 0,
          tracksStock: true,
        }),
      );

      await service.create(
        { ...baseCreateDto, name: 'PASTILLAS', type: ProductType.PRODUCT },
        USER_ID,
        ORG_ID,
      );

      expect(prismaMock.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tracksStock: true }),
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
      // The flag must now be declared explicitly: converting back into stocked
      // merchandise is no longer derived from the type alone.
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

      const payload = {
        type: ProductType.PRODUCT,
        tracksStock: true,
        stock: 10,
      };

      await service.update('serv-1', payload, USER_ID, ORG_ID);

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

  describe('untracked merchandise in the update path', () => {
    it('zeroes the stock and records where it went when tracking is turned off', async () => {
      const trackedProduct = buildProduct({
        id: 'prod-1',
        type: ProductType.PRODUCT,
        stock: 40,
        tracksStock: true,
      });
      prismaMock.product.findFirst
        .mockResolvedValueOnce(trackedProduct)
        .mockResolvedValueOnce(
          buildProduct({
            type: ProductType.PRODUCT,
            stock: 0,
            tracksStock: false,
          }),
        );
      prismaMock.product.updateMany.mockResolvedValue({ count: 1 });

      const payload = {
        tracksStock: false,
        stock: 500,
      };

      await service.update('prod-1', payload, USER_ID, ORG_ID);

      expect(prismaMock.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tracksStock: false,
            stock: 0,
          }),
        }),
      );
      // Turning tracking off drops the stock to zero, so the kárdex has to say where those units
      // went. This is the counterpart of converting a product into a service, which records the
      // same movement; leaving none would recreate the unexplained-stock defect this feature
      // exists to remove.
      expect(prismaMock.inventoryMovement.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'ADJUSTMENT_OUT',
            quantity: -40,
            previousStock: 40,
            newStock: 0,
          }),
        }),
      );
    });

    it('converts a service into tracked merchandise when the caller declares tracksStock: true', async () => {
      // Counterpart of the conversion test above: converting a service back into
      // merchandise now requires the caller to declare the flag, because it is
      // explicit rather than derived from the type.
      const existingService = buildProduct({
        id: 'serv-1',
        type: ProductType.SERVICE,
        stock: 0,
        tracksStock: false,
      });
      prismaMock.product.findFirst
        .mockResolvedValueOnce(existingService)
        .mockResolvedValueOnce(
          buildProduct({
            type: ProductType.PRODUCT,
            stock: 10,
            tracksStock: true,
          }),
        );
      prismaMock.product.updateMany.mockResolvedValue({ count: 1 });

      const payload = {
        type: ProductType.PRODUCT,
        tracksStock: true,
        stock: 10,
      };

      await service.update('serv-1', payload, USER_ID, ORG_ID);

      expect(prismaMock.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tracksStock: true,
            stock: 10,
          }),
        }),
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

    it('leaves a service untracked when the type changes without the flag', async () => {
      // Intended consequence of making the flag explicit, not an oversight:
      // changing the type alone no longer implies tracked stock.
      const existingService = buildProduct({
        id: 'serv-1',
        type: ProductType.SERVICE,
        stock: 0,
        tracksStock: false,
      });
      prismaMock.product.findFirst
        .mockResolvedValueOnce(existingService)
        .mockResolvedValueOnce(
          buildProduct({
            type: ProductType.PRODUCT,
            stock: 0,
            tracksStock: false,
          }),
        );
      prismaMock.product.updateMany.mockResolvedValue({ count: 1 });

      await service.update(
        'serv-1',
        { type: ProductType.PRODUCT },
        USER_ID,
        ORG_ID,
      );

      expect(prismaMock.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tracksStock: false,
            stock: 0,
          }),
        }),
      );
      expect(prismaMock.inventoryMovement.create).not.toHaveBeenCalled();
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
          tracksStock: true,
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
      expect(sql).toContain('p."tracksStock" = true');
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

    it('never marks an untracked product as low on stock in the search mapper', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        buildProduct({
          type: ProductType.PRODUCT,
          tracksStock: false,
          stock: 0,
          minStock: 5,
        }),
      ]);

      const results = await service.searchProducts('PASTILLAS', 20, ORG_ID);

      expect(results[0].isLowStock).toBe(false);
    });

    it('never marks an untracked product as low on stock in the quick-search mapper', async () => {
      prismaMock.product.findFirst.mockResolvedValue(
        buildProduct({
          type: ProductType.PRODUCT,
          tracksStock: false,
          stock: 0,
          minStock: 5,
        }),
      );

      const result = await service.quickSearch('PASTILLAS', ORG_ID);

      expect(result?.isLowStock).toBe(false);
    });
  });
});
