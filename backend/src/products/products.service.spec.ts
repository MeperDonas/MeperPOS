import { NotFoundException, ConflictException } from '@nestjs/common';
import { ProductsService } from './products.service';

describe('ProductsService — Tax Precedence', () => {
  let service: ProductsService;

  // ── Mocks ──────────────────────────────────────────────────────────
  const prismaMock = {
    category: {
      findFirst: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    inventoryMovement: {
      create: jest.fn(),
    },
  };

  const settingsServiceMock = {
    find: jest.fn(),
  };

  const cloudinaryServiceMock = {};

  const planLimitServiceMock = {
    invalidateCache: jest.fn(),
  };

  const USER_ID = 'user-1';
  const ORG_ID = 'org-1';

  // ── Shared fixtures ────────────────────────────────────────────────
  const categoryWithDefault = (defaultTaxRate: number | null) => ({
    id: 'cat-1',
    name: 'Electrónica',
    description: null,
    defaultTaxRate,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const buildProduct = (overrides: Record<string, unknown> = {}) => ({
    id: 'prod-1',
    name: 'Test Product',
    sku: 'SKU-001',
    barcode: null,
    description: null,
    costPrice: 100,
    salePrice: 150,
    taxRate: overrides.taxRate ?? 0,
    stock: 10,
    minStock: 5,
    imageUrl: null,
    categoryId: overrides.categoryId ?? 'cat-1',
    active: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: overrides.category ?? categoryWithDefault(16),
    ...overrides,
  });

  // ── Lifecycle ──────────────────────────────────────────────────────
  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductsService(
      prismaMock as never,
      cloudinaryServiceMock as never,
      settingsServiceMock as never,
      planLimitServiceMock as never,
    );
  });

  // ════════════════════════════════════════════════════════════════════
  // Product Creation
  // ════════════════════════════════════════════════════════════════════
  describe('Product Creation', () => {
    const baseDto = {
      name: 'Test Product',
      sku: 'SKU-001',
      costPrice: 100,
      salePrice: 150,
      stock: 10,
      minStock: 5,
      categoryId: 'cat-1',
    };

    it('uses explicit taxRate when provided — ignores category default and settings', async () => {
      prismaMock.category.findFirst.mockResolvedValue(categoryWithDefault(16));
      prismaMock.product.findUnique.mockResolvedValue(null); // no SKU/barcode conflict
      prismaMock.product.create.mockResolvedValue(
        buildProduct({ taxRate: 8, category: categoryWithDefault(16) }),
      );
      prismaMock.inventoryMovement.create.mockResolvedValue({});

      const result = await service.create(
        { ...baseDto, taxRate: 8 },
        USER_ID,
        ORG_ID,
      );

      // The create call should receive the explicit taxRate, NOT the category default
      expect(prismaMock.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ taxRate: 8 }),
        }),
      );
      // Settings should NOT be fetched when taxRate is explicit
      expect(settingsServiceMock.find).not.toHaveBeenCalled();
      expect(result.taxRate).toBe(8);
      expect(result.effectiveTaxRate).toBe(8);
    });

    it('falls back to category defaultTaxRate when product has no override', async () => {
      prismaMock.category.findFirst.mockResolvedValue(categoryWithDefault(16));
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.product.create.mockResolvedValue(
        buildProduct({ taxRate: 16, category: categoryWithDefault(16) }),
      );
      prismaMock.inventoryMovement.create.mockResolvedValue({});
      settingsServiceMock.find.mockResolvedValue({ taxRate: 19 });

      // No taxRate in the DTO
      const result = await service.create(
        {
          name: 'Test',
          sku: 'SKU-002',
          costPrice: 100,
          salePrice: 150,
          stock: 10,
          minStock: 5,
          categoryId: 'cat-1',
        },
        USER_ID,
        ORG_ID,
      );

      expect(prismaMock.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ taxRate: 16 }),
        }),
      );
      expect(settingsServiceMock.find).toHaveBeenCalled();
      expect(result.taxRate).toBe(16);
    });

    it('falls back to settings taxRate when category has no defaultTaxRate', async () => {
      prismaMock.category.findFirst.mockResolvedValue(
        categoryWithDefault(null),
      );
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.product.create.mockResolvedValue(
        buildProduct({ taxRate: 19, category: categoryWithDefault(null) }),
      );
      prismaMock.inventoryMovement.create.mockResolvedValue({});
      settingsServiceMock.find.mockResolvedValue({ taxRate: 19 });

      const result = await service.create(
        {
          name: 'Test',
          sku: 'SKU-003',
          costPrice: 100,
          salePrice: 150,
          stock: 10,
          minStock: 5,
          categoryId: 'cat-1',
        },
        USER_ID,
        ORG_ID,
      );

      expect(prismaMock.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ taxRate: 19 }),
        }),
      );
      expect(result.taxRate).toBe(19);
    });

    it('falls back to settings when category defaultTaxRate is zero', async () => {
      prismaMock.category.findFirst.mockResolvedValue(categoryWithDefault(0));
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.product.create.mockResolvedValue(
        buildProduct({ taxRate: 19, category: categoryWithDefault(0) }),
      );
      prismaMock.inventoryMovement.create.mockResolvedValue({});
      settingsServiceMock.find.mockResolvedValue({ taxRate: 19 });

      await service.create(
        {
          name: 'Test',
          sku: 'SKU-004',
          costPrice: 100,
          salePrice: 150,
          stock: 10,
          minStock: 5,
          categoryId: 'cat-1',
        },
        USER_ID,
        ORG_ID,
      );

      expect(prismaMock.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ taxRate: 19 }),
        }),
      );
    });

    it('throws NotFoundException when category does not exist', async () => {
      prismaMock.category.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          {
            name: 'Test',
            sku: 'SKU-005',
            costPrice: 100,
            salePrice: 150,
            stock: 10,
            minStock: 5,
            categoryId: 'non-existent',
          },
          USER_ID,
          ORG_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when SKU already exists', async () => {
      prismaMock.category.findFirst.mockResolvedValue(categoryWithDefault(16));
      prismaMock.product.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create(
          {
            name: 'Test',
            sku: 'DUPLICATE-SKU',
            costPrice: 100,
            salePrice: 150,
            stock: 10,
            minStock: 5,
            categoryId: 'cat-1',
          },
          USER_ID,
          ORG_ID,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Product Update — tax behavior
  // ════════════════════════════════════════════════════════════════════
  describe('Product Update', () => {
    it('preserves explicit override when category changes — update does not recalculate tax', async () => {
      const existing = buildProduct({
        id: 'prod-1',
        taxRate: 8,
        categoryId: 'cat-1',
        category: categoryWithDefault(16),
        version: 1,
      });
      prismaMock.product.findFirst.mockResolvedValue(existing);
      prismaMock.product.updateMany.mockResolvedValue({ count: 1 });

      const newCategory = { ...categoryWithDefault(20), id: 'cat-2' };
      const updated = buildProduct({
        id: 'prod-1',
        taxRate: 8, // explicit override preserved
        categoryId: 'cat-2',
        category: newCategory,
        version: 2,
      });
      // After updateMany, the service does findFirst again
      prismaMock.product.findFirst.mockResolvedValueOnce(existing);
      prismaMock.product.findFirst.mockResolvedValueOnce(updated);
      prismaMock.inventoryMovement.create.mockResolvedValue({});

      const result = await service.update(
        'prod-1',
        { categoryId: 'cat-2' }, // changing category, no taxRate in DTO
        USER_ID,
        ORG_ID,
      );

      // The updateMany should NOT have changed the taxRate
      expect(prismaMock.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ taxRate: expect.any(Number) }),
        }),
      );
      expect(result.taxRate).toBe(8);
      expect(result.effectiveTaxRate).toBe(8);
    });

    it('updates effective tax when explicitly providing a new taxRate', async () => {
      const existing = buildProduct({
        id: 'prod-1',
        taxRate: 16,
        version: 1,
      });
      prismaMock.product.findFirst.mockResolvedValueOnce(existing);
      prismaMock.product.updateMany.mockResolvedValue({ count: 1 });

      const updated = buildProduct({
        id: 'prod-1',
        taxRate: 5,
        version: 2,
      });
      prismaMock.product.findFirst.mockResolvedValueOnce(updated);
      prismaMock.inventoryMovement.create.mockResolvedValue({});

      const result = await service.update(
        'prod-1',
        { taxRate: 5 },
        USER_ID,
        ORG_ID,
      );

      expect(prismaMock.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ taxRate: 5 }),
        }),
      );
      expect(result.taxRate).toBe(5);
      expect(result.effectiveTaxRate).toBe(5);
    });

    it('does not change taxRate when update has no taxRate or categoryId fields', async () => {
      const existing = buildProduct({
        id: 'prod-1',
        taxRate: 16,
        version: 1,
      });
      prismaMock.product.findFirst.mockResolvedValue(existing);
      prismaMock.product.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.inventoryMovement.create.mockResolvedValue({});

      await service.update(
        'prod-1',
        { name: 'Renamed Product' },
        USER_ID,
        ORG_ID,
      );

      // updateMany data should only contain the name, not taxRate
      const updateCall = prismaMock.product.updateMany.mock.calls[0][0];
      expect(updateCall.data.name).toBe('Renamed Product');
      expect(updateCall.data.taxRate).toBeUndefined();
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Category Reassignment
  // ════════════════════════════════════════════════════════════════════
  describe('Category Reassignment', () => {
    it('applies new category default when product has no override — via create', async () => {
      // Product created without explicit taxRate in category with default 10
      prismaMock.category.findFirst.mockResolvedValue(categoryWithDefault(10));
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.product.create.mockResolvedValue(
        buildProduct({ taxRate: 10, category: categoryWithDefault(10) }),
      );
      prismaMock.inventoryMovement.create.mockResolvedValue({});
      settingsServiceMock.find.mockResolvedValue({ taxRate: 19 });

      const result = await service.create(
        {
          name: 'Test',
          sku: 'SKU-REASSIGN-1',
          costPrice: 100,
          salePrice: 150,
          stock: 10,
          minStock: 5,
          categoryId: 'cat-1',
        },
        USER_ID,
        ORG_ID,
      );

      expect(result.taxRate).toBe(10); // category default, not settings 19
    });

    it('preserves product override regardless of category during update', async () => {
      // Product has explicit taxRate 5, moving to category with default 20
      const existing = buildProduct({
        taxRate: 5,
        categoryId: 'cat-1',
        category: categoryWithDefault(10),
        version: 1,
      });
      prismaMock.product.findFirst.mockResolvedValueOnce(existing);
      prismaMock.product.updateMany.mockResolvedValue({ count: 1 });

      const newCategory = { ...categoryWithDefault(20), id: 'cat-2' };
      const updated = buildProduct({
        taxRate: 5, // override preserved
        categoryId: 'cat-2',
        category: newCategory,
        version: 2,
      });
      prismaMock.product.findFirst.mockResolvedValueOnce(updated);
      prismaMock.inventoryMovement.create.mockResolvedValue({});

      const result = await service.update(
        'prod-1',
        { categoryId: 'cat-2' },
        USER_ID,
        ORG_ID,
      );

      expect(result.taxRate).toBe(5); // override, not new category's 20
      expect(result.effectiveTaxRate).toBe(5);
    });

    it('drops override when explicitly setting taxRate to 0 on update', async () => {
      const existing = buildProduct({
        taxRate: 8,
        version: 1,
      });
      prismaMock.product.findFirst.mockResolvedValueOnce(existing);
      prismaMock.product.updateMany.mockResolvedValue({ count: 1 });

      const updated = buildProduct({
        taxRate: 0,
        version: 2,
      });
      prismaMock.product.findFirst.mockResolvedValueOnce(updated);
      prismaMock.inventoryMovement.create.mockResolvedValue({});

      const result = await service.update(
        'prod-1',
        { taxRate: 0 }, // explicitly clearing the override
        USER_ID,
        ORG_ID,
      );

      expect(prismaMock.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ taxRate: 0 }),
        }),
      );
      expect(result.taxRate).toBe(0);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Precedence consistency — creation vs enrichment
  // ════════════════════════════════════════════════════════════════════
  describe('Precedence consistency', () => {
    it('enrichWithEffectiveTax returns stored taxRate as effectiveTaxRate (create+read match)', async () => {
      prismaMock.category.findFirst.mockResolvedValue(categoryWithDefault(16));
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.product.create.mockResolvedValue(
        buildProduct({ taxRate: 16, category: categoryWithDefault(16) }),
      );
      prismaMock.inventoryMovement.create.mockResolvedValue({});
      settingsServiceMock.find.mockResolvedValue({ taxRate: 19 });

      const created = await service.create(
        {
          name: 'Test',
          sku: 'SKU-CONSISTENCY',
          costPrice: 100,
          salePrice: 150,
          stock: 10,
          minStock: 5,
          categoryId: 'cat-1',
        },
        USER_ID,
        ORG_ID,
      );

      // Now simulate a read (findOne)
      prismaMock.product.findFirst.mockResolvedValue(
        buildProduct({
          id: 'prod-1',
          taxRate: 16,
          category: categoryWithDefault(16),
          movements: [],
        }),
      );

      const read = await service.findOne('prod-1', ORG_ID);

      // The effectiveTaxRate from create and findOne must match
      expect(created.effectiveTaxRate).toBe(read.effectiveTaxRate);
      expect(created.taxRate).toBe(read.taxRate);
    });

    it('findAll enriches all products with effectiveTaxRate', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        buildProduct({ id: 'p1', taxRate: 8 }),
        buildProduct({ id: 'p2', taxRate: 16 }),
        buildProduct({ id: 'p3', taxRate: 19 }),
      ]);
      prismaMock.product.count.mockResolvedValue(3);

      const result = await service.findAll(ORG_ID, 1, 10);

      expect(result.data[0].effectiveTaxRate).toBe(8);
      expect(result.data[1].effectiveTaxRate).toBe(16);
      expect(result.data[2].effectiveTaxRate).toBe(19);
    });
  });

  describe('Quick search', () => {
    it('returns null when code is blank after trimming', async () => {
      const result = await service.quickSearch('   ', ORG_ID);

      expect(result).toBeNull();
      expect(prismaMock.product.findFirst).not.toHaveBeenCalled();
    });

    it('trims the incoming code before searching by barcode or SKU', async () => {
      prismaMock.product.findFirst.mockResolvedValue(
        buildProduct({
          id: 'prod-scan-1',
          sku: 'SCAN-001',
          barcode: '7701234567890',
        }),
      );

      const result = await service.quickSearch('  7701234567890  ', ORG_ID);

      expect(prismaMock.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: ORG_ID,
            active: true,
            OR: [
              {
                barcode: {
                  equals: '7701234567890',
                  mode: 'insensitive',
                },
              },
              {
                sku: {
                  equals: '7701234567890',
                  mode: 'insensitive',
                },
              },
            ],
          },
        }),
      );
      expect(result?.barcode).toBe('7701234567890');
    });
  });

  describe('Organization-scoped queries', () => {
    it('findAll filters by organizationId', async () => {
      prismaMock.product.findMany.mockResolvedValue([]);
      prismaMock.product.count.mockResolvedValue(0);

      await service.findAll(ORG_ID, 1, 10);

      expect(prismaMock.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_ID }),
        }),
      );
      expect(prismaMock.product.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_ID }),
        }),
      );
    });

    it('findOne filters by organizationId', async () => {
      prismaMock.product.findFirst.mockResolvedValue(
        buildProduct({ id: 'prod-1' }),
      );

      await service.findOne('prod-1', ORG_ID);

      expect(prismaMock.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prod-1', organizationId: ORG_ID, active: true },
        }),
      );
    });

    it('deactivate validates organizationId', async () => {
      prismaMock.product.findFirst.mockResolvedValue(
        buildProduct({ id: 'prod-1' }),
      );
      prismaMock.product.update.mockResolvedValue({});

      await service.deactivate('prod-1', ORG_ID);

      expect(prismaMock.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prod-1', organizationId: ORG_ID, active: true },
        }),
      );
    });

    it('reactivate validates organizationId', async () => {
      prismaMock.product.findFirst.mockResolvedValue(
        buildProduct({ id: 'prod-1', active: false }),
      );
      prismaMock.product.update.mockResolvedValue({});

      await service.reactivate('prod-1', ORG_ID);

      expect(prismaMock.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prod-1', organizationId: ORG_ID },
        }),
      );
    });

    it('remove validates organizationId', async () => {
      prismaMock.product.findFirst.mockResolvedValue(
        buildProduct({ id: 'prod-1' }),
      );
      prismaMock.product.delete.mockResolvedValue({});

      await service.remove('prod-1', ORG_ID);

      expect(prismaMock.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prod-1', organizationId: ORG_ID },
        }),
      );
    });

    it('searchProducts filters by organizationId', async () => {
      prismaMock.product.findMany.mockResolvedValue([]);

      await service.searchProducts('query', 20, ORG_ID);

      expect(prismaMock.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: ORG_ID }),
        }),
      );
    });
  });
});
