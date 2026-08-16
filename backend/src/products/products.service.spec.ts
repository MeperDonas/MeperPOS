import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ProductsService } from './products.service';

describe('ProductsService — Opt-in tax resolution', () => {
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

  const cloudinaryServiceMock = {};

  const planLimitServiceMock = {
    invalidateCache: jest.fn(),
  };

  const USER_ID = 'user-1';
  const ORG_ID = 'org-1';

  // ── Shared fixtures ────────────────────────────────────────────────
  const categoryWithDefault = (
    defaultTaxRate: number | null,
    taxable = false,
  ) => ({
    id: 'cat-1',
    name: 'Electrónica',
    description: null,
    defaultTaxRate,
    taxable,
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
    taxable: overrides.taxable ?? false,
    taxRate: overrides.taxRate ?? 0,
    stock: 10,
    minStock: 5,
    imageUrl: null,
    categoryId: overrides.categoryId ?? 'cat-1',
    active: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: overrides.category ?? categoryWithDefault(null, false),
    ...overrides,
  });

  // ── Lifecycle ──────────────────────────────────────────────────────
  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductsService(
      prismaMock as never,
      cloudinaryServiceMock as never,
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

    it('stores taxable=true with the provided rate', async () => {
      prismaMock.category.findFirst.mockResolvedValue(
        categoryWithDefault(null, false),
      );
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.product.create.mockResolvedValue(
        buildProduct({
          taxable: true,
          taxRate: 8,
          category: categoryWithDefault(null, false),
        }),
      );
      prismaMock.inventoryMovement.create.mockResolvedValue({});

      const result = await service.create(
        { ...baseDto, taxable: true, taxRate: 8 },
        USER_ID,
        ORG_ID,
      );

      expect(prismaMock.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ taxable: true, taxRate: 8 }),
        }),
      );
      expect(result.taxable).toBe(true);
      expect(result.effectiveTaxRate).toBe(8);
    });

    it('forces taxRate to 0 when taxable is false even if a rate is supplied', async () => {
      prismaMock.category.findFirst.mockResolvedValue(
        categoryWithDefault(null, false),
      );
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.product.create.mockResolvedValue(
        buildProduct({
          taxable: false,
          taxRate: 0,
          category: categoryWithDefault(null, false),
        }),
      );
      prismaMock.inventoryMovement.create.mockResolvedValue({});

      await service.create(
        { ...baseDto, taxable: false, taxRate: 8 },
        USER_ID,
        ORG_ID,
      );

      expect(prismaMock.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ taxable: false, taxRate: 0 }),
        }),
      );
    });

    it('defaults to non-taxable (rate 0) when taxable is omitted', async () => {
      prismaMock.category.findFirst.mockResolvedValue(
        categoryWithDefault(null, false),
      );
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.product.create.mockResolvedValue(
        buildProduct({
          taxable: false,
          taxRate: 0,
          category: categoryWithDefault(null, false),
        }),
      );
      prismaMock.inventoryMovement.create.mockResolvedValue({});

      const result = await service.create(baseDto, USER_ID, ORG_ID);

      expect(prismaMock.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ taxable: false, taxRate: 0 }),
        }),
      );
      expect(result.effectiveTaxRate).toBe(0);
    });

    it('throws BadRequestException when taxable is true without a rate', async () => {
      prismaMock.category.findFirst.mockResolvedValue(
        categoryWithDefault(null, false),
      );
      prismaMock.product.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ ...baseDto, taxable: true }, USER_ID, ORG_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when taxable is true with rate 0', async () => {
      prismaMock.category.findFirst.mockResolvedValue(
        categoryWithDefault(null, false),
      );
      prismaMock.product.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ ...baseDto, taxable: true, taxRate: 0 }, USER_ID, ORG_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when category does not exist', async () => {
      prismaMock.category.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ ...baseDto, sku: 'SKU-005' }, USER_ID, ORG_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when SKU already exists', async () => {
      prismaMock.category.findFirst.mockResolvedValue(
        categoryWithDefault(null, false),
      );
      prismaMock.product.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({ ...baseDto, sku: 'DUPLICATE-SKU' }, USER_ID, ORG_ID),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Product Update — tax behavior
  // ════════════════════════════════════════════════════════════════════
  describe('Product Update', () => {
    it('stores taxable + rate when explicitly provided', async () => {
      const existing = buildProduct({ taxRate: 16, version: 1 });
      prismaMock.product.findFirst.mockResolvedValueOnce(existing);
      prismaMock.product.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.product.findFirst.mockResolvedValueOnce(
        buildProduct({ taxable: true, taxRate: 5, version: 2 }),
      );
      prismaMock.inventoryMovement.create.mockResolvedValue({});

      const result = await service.update(
        'prod-1',
        { taxable: true, taxRate: 5 },
        USER_ID,
        ORG_ID,
      );

      expect(prismaMock.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ taxable: true, taxRate: 5 }),
        }),
      );
      expect(result.taxable).toBe(true);
      expect(result.effectiveTaxRate).toBe(5);
    });

    it('forces taxRate to 0 when taxable is set to false', async () => {
      const existing = buildProduct({ taxable: true, taxRate: 8, version: 1 });
      prismaMock.product.findFirst.mockResolvedValueOnce(existing);
      prismaMock.product.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.product.findFirst.mockResolvedValueOnce(
        buildProduct({ taxable: false, taxRate: 0, version: 2 }),
      );
      prismaMock.inventoryMovement.create.mockResolvedValue({});

      await service.update('prod-1', { taxable: false }, USER_ID, ORG_ID);

      expect(prismaMock.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ taxable: false, taxRate: 0 }),
        }),
      );
    });

    it('throws BadRequestException when taxable=true without a valid rate', async () => {
      const existing = buildProduct({ taxable: false, taxRate: 0, version: 1 });
      prismaMock.product.findFirst.mockResolvedValueOnce(existing);

      await expect(
        service.update('prod-1', { taxable: true }, USER_ID, ORG_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('does not change taxable/taxRate when both are omitted', async () => {
      const existing = buildProduct({ taxable: true, taxRate: 16, version: 1 });
      prismaMock.product.findFirst.mockResolvedValueOnce(existing);
      prismaMock.product.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.product.findFirst.mockResolvedValueOnce(
        buildProduct({ name: 'Renamed', version: 2 }),
      );
      prismaMock.inventoryMovement.create.mockResolvedValue({});

      await service.update('prod-1', { name: 'Renamed Product' }, USER_ID, ORG_ID);

      const updateCall = prismaMock.product.updateMany.mock.calls[0][0];
      expect(updateCall.data.name).toBe('Renamed Product');
      expect(updateCall.data.taxable).toBeUndefined();
      expect(updateCall.data.taxRate).toBeUndefined();
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Effective tax resolution (read path)
  // ════════════════════════════════════════════════════════════════════
  describe('Effective tax resolution (read path)', () => {
    it('falls back to the category rate when the product is not opted-in', async () => {
      const product = buildProduct({
        taxable: false,
        taxRate: 0,
        category: categoryWithDefault(16, true),
      });
      prismaMock.product.findFirst.mockResolvedValue(product);

      const result = await service.findOne('prod-1', ORG_ID);

      expect(result.effectiveTaxRate).toBe(16);
    });

    it('uses the product rate when the product is opted-in (overrides category)', async () => {
      const product = buildProduct({
        taxable: true,
        taxRate: 8,
        category: categoryWithDefault(16, true),
      });
      prismaMock.product.findFirst.mockResolvedValue(product);

      const result = await service.findOne('prod-1', ORG_ID);

      expect(result.effectiveTaxRate).toBe(8);
    });

    it('returns 0 when neither product nor category is opted-in', async () => {
      const product = buildProduct({
        taxable: false,
        taxRate: 0,
        category: categoryWithDefault(null, false),
      });
      prismaMock.product.findFirst.mockResolvedValue(product);

      const result = await service.findOne('prod-1', ORG_ID);

      expect(result.effectiveTaxRate).toBe(0);
    });

    it('findAll enriches every product with effectiveTaxRate', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        buildProduct({ id: 'p1', taxable: true, taxRate: 8 }),
        buildProduct({
          id: 'p2',
          taxable: false,
          taxRate: 0,
          category: categoryWithDefault(16, true),
        }),
        buildProduct({
          id: 'p3',
          taxable: false,
          taxRate: 0,
          category: categoryWithDefault(null, false),
        }),
      ]);
      prismaMock.product.count.mockResolvedValue(3);

      const result = await service.findAll(ORG_ID, 1, 10);

      expect(result.data[0].effectiveTaxRate).toBe(8);
      expect(result.data[1].effectiveTaxRate).toBe(16);
      expect(result.data[2].effectiveTaxRate).toBe(0);
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
              { barcode: { equals: '7701234567890', mode: 'insensitive' } },
              { sku: { equals: '7701234567890', mode: 'insensitive' } },
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
