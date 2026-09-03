import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { computeEffectiveSalePrice, ProductsService } from './products.service';

describe('ProductsService — Opt-in tax resolution', () => {
  let service: ProductsService;

  // Sentinel standing in for the Prisma field reference (prisma.product
  // .fields.minStock) used by the low-stock where clause; compared by identity.
  const MIN_STOCK_FIELD_REF = { prismaFieldRef: 'Product.minStock' };

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
      fields: { minStock: MIN_STOCK_FIELD_REF },
    },
    inventoryMovement: {
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
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

  describe('Search promotion parity (live service path)', () => {
    it('searchProducts returns promo keys + effectiveSalePrice and keeps every prior field', async () => {
      const promoRow = buildProduct({
        salePrice: 19900,
        promotionType: 'PERCENTAGE',
        promotionValue: 15,
      });
      prismaMock.product.findMany.mockResolvedValue([promoRow]);

      const [result] = await service.searchProducts('donut', 20, ORG_ID);

      expect(result).toEqual({
        id: 'prod-1',
        name: 'Test Product',
        sku: 'SKU-001',
        barcode: null,
        salePrice: 19900,
        stock: 10,
        taxable: false,
        taxRate: 0,
        effectiveTaxRate: 0,
        minStock: 5,
        isLowStock: false,
        category: categoryWithDefault(null, false),
        imageUrl: null,
        promotionType: 'PERCENTAGE',
        promotionValue: 15,
        effectiveSalePrice: 16915,
      });
    });

    it('searchProducts keeps fields intact and nulls effectiveSalePrice without a promotion', async () => {
      const plainRow = buildProduct({
        promotionType: null,
        promotionValue: null,
      });
      prismaMock.product.findMany.mockResolvedValue([plainRow]);

      const [result] = await service.searchProducts('donut', 20, ORG_ID);

      expect(result).toEqual({
        id: 'prod-1',
        name: 'Test Product',
        sku: 'SKU-001',
        barcode: null,
        salePrice: 150,
        stock: 10,
        taxable: false,
        taxRate: 0,
        effectiveTaxRate: 0,
        minStock: 5,
        isLowStock: false,
        category: categoryWithDefault(null, false),
        imageUrl: null,
        promotionType: null,
        promotionValue: null,
        effectiveSalePrice: null,
      });
    });

    it('quickSearch returns promo keys + effectiveSalePrice (FIXED_PRICE branch) and keeps every prior field', async () => {
      const promoRow = buildProduct({
        barcode: '7701234567890',
        salePrice: 19900,
        promotionType: 'FIXED_PRICE',
        promotionValue: 15000,
      });
      prismaMock.product.findFirst.mockResolvedValue(promoRow);

      const result = await service.quickSearch('7701234567890', ORG_ID);

      expect(result).toEqual({
        id: 'prod-1',
        name: 'Test Product',
        sku: 'SKU-001',
        barcode: '7701234567890',
        salePrice: 19900,
        stock: 10,
        taxable: false,
        taxRate: 0,
        effectiveTaxRate: 0,
        minStock: 5,
        isLowStock: false,
        category: categoryWithDefault(null, false),
        imageUrl: null,
        promotionType: 'FIXED_PRICE',
        promotionValue: 15000,
        effectiveSalePrice: 15000,
      });
    });

    it('quickSearch keeps fields intact and nulls effectiveSalePrice without a promotion', async () => {
      const plainRow = buildProduct({
        barcode: '7701234567890',
        promotionType: null,
        promotionValue: null,
      });
      prismaMock.product.findFirst.mockResolvedValue(plainRow);

      const result = await service.quickSearch('7701234567890', ORG_ID);

      expect(result).toEqual({
        id: 'prod-1',
        name: 'Test Product',
        sku: 'SKU-001',
        barcode: '7701234567890',
        salePrice: 150,
        stock: 10,
        taxable: false,
        taxRate: 0,
        effectiveTaxRate: 0,
        minStock: 5,
        isLowStock: false,
        category: categoryWithDefault(null, false),
        imageUrl: null,
        promotionType: null,
        promotionValue: null,
        effectiveSalePrice: null,
      });
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

  // ════════════════════════════════════════════════════════════════════
  // Low stock lookup
  // ════════════════════════════════════════════════════════════════════
  describe('Low stock lookup', () => {
    it('rejects low-stock lookups without an organization context', async () => {
      await expect(
        service.getLowStockProducts(undefined),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('filters low-stock products by organization', async () => {
      prismaMock.$queryRaw.mockResolvedValue([
        { id: 'prod-1', name: 'Panela' },
      ]);

      const result = await service.getLowStockProducts(ORG_ID);

      expect(result).toEqual([{ id: 'prod-1', name: 'Panela' }]);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Effective sale price derivation (promotions)
  // ════════════════════════════════════════════════════════════════════
  describe('computeEffectiveSalePrice', () => {
    it('derives a percentage promo from the list price', () => {
      expect(
        computeEffectiveSalePrice({
          salePrice: 19900,
          promotionType: 'PERCENTAGE',
          promotionValue: 15,
        }),
      ).toBe(16915);
    });

    it('returns the promotion value for a fixed-price promo', () => {
      expect(
        computeEffectiveSalePrice({
          salePrice: 10000,
          promotionType: 'FIXED_PRICE',
          promotionValue: 8000,
        }),
      ).toBe(8000);
    });

    it('returns null when the product has no active promotion', () => {
      expect(
        computeEffectiveSalePrice({
          salePrice: 19900,
          promotionType: null,
          promotionValue: null,
        }),
      ).toBeNull();
      expect(computeEffectiveSalePrice({ salePrice: 19900 })).toBeNull();
    });

    it('rounds half-up to two decimals', () => {
      expect(
        computeEffectiveSalePrice({
          salePrice: 999,
          promotionType: 'PERCENTAGE',
          promotionValue: 12.5,
        }),
      ).toBe(874.13);
    });

    it('accepts Prisma Decimal inputs', () => {
      expect(
        computeEffectiveSalePrice({
          salePrice: new Prisma.Decimal('19900'),
          promotionType: 'PERCENTAGE',
          promotionValue: new Prisma.Decimal('15'),
        }),
      ).toBe(16915);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Promotion enrichment on reads
  // ════════════════════════════════════════════════════════════════════
  describe('Promotion enrichment on reads', () => {
    const baseDto = {
      name: 'Promo Product',
      sku: 'SKU-PROMO',
      costPrice: 100,
      salePrice: 19900,
      stock: 10,
      minStock: 5,
      categoryId: 'cat-1',
    };

    const promoProduct = buildProduct({
      salePrice: 19900,
      promotionType: 'PERCENTAGE',
      promotionValue: 15,
    });

    it('create persists the promotion and returns effectiveSalePrice', async () => {
      prismaMock.category.findFirst.mockResolvedValue(
        categoryWithDefault(null, false),
      );
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.product.create.mockResolvedValue(promoProduct);
      prismaMock.inventoryMovement.create.mockResolvedValue({});

      const result = await service.create(
        {
          ...baseDto,
          promotionType: 'PERCENTAGE',
          promotionValue: 15,
        },
        USER_ID,
        ORG_ID,
      );

      expect(prismaMock.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            promotionType: 'PERCENTAGE',
            promotionValue: 15,
          }),
        }),
      );
      expect(result.effectiveSalePrice).toBe(16915);
    });

    it('findAll enriches every product with effectiveSalePrice', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        promoProduct,
        buildProduct({ id: 'p2' }),
      ]);
      prismaMock.product.count.mockResolvedValue(2);

      const result = await service.findAll(ORG_ID, 1, 10);

      expect(result.data[0].effectiveSalePrice).toBe(16915);
      expect(result.data[1].effectiveSalePrice).toBeNull();
    });

    it('findOne returns effectiveSalePrice for a promoted product', async () => {
      prismaMock.product.findFirst.mockResolvedValue(promoProduct);

      const result = await service.findOne('prod-1', ORG_ID);

      expect(result.effectiveSalePrice).toBe(16915);
    });

    it('update returns effectiveSalePrice for the updated product', async () => {
      prismaMock.product.findFirst
        .mockResolvedValueOnce(buildProduct({ version: 1 }))
        .mockResolvedValueOnce(promoProduct);
      prismaMock.product.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.inventoryMovement.create.mockResolvedValue({});

      const result = await service.update(
        'prod-1',
        { promotionType: 'PERCENTAGE', promotionValue: 15 },
        USER_ID,
        ORG_ID,
      );

      expect(result.effectiveSalePrice).toBe(16915);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Promotion validation (cross-field invariants)
  // ════════════════════════════════════════════════════════════════════
  describe('Promotion validation', () => {
    const createBase = {
      name: 'Promo Product',
      sku: 'SKU-PROMO-2',
      costPrice: 100,
      salePrice: 10000,
      stock: 10,
      minStock: 5,
      categoryId: 'cat-1',
    };

    const setupCreateSuccess = () => {
      prismaMock.category.findFirst.mockResolvedValue(
        categoryWithDefault(null, false),
      );
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.product.create.mockResolvedValue(buildProduct());
      prismaMock.inventoryMovement.create.mockResolvedValue({});
    };

    it('rejects PERCENTAGE values above 100 on create', async () => {
      setupCreateSuccess();

      await expect(
        service.create(
          { ...createBase, promotionType: 'PERCENTAGE', promotionValue: 150 },
          USER_ID,
          ORG_ID,
        ),
      ).rejects.toThrow(/promotionValue.*100/);
    });

    it('rejects FIXED_PRICE at or above the sale price on create', async () => {
      setupCreateSuccess();

      await expect(
        service.create(
          { ...createBase, promotionType: 'FIXED_PRICE', promotionValue: 10000 },
          USER_ID,
          ORG_ID,
        ),
      ).rejects.toThrow(/promotionValue.*salePrice/);
    });

    it('rejects FIXED_PRICE of 0 or less', async () => {
      setupCreateSuccess();

      await expect(
        service.create(
          { ...createBase, promotionType: 'FIXED_PRICE', promotionValue: 0 },
          USER_ID,
          ORG_ID,
        ),
      ).rejects.toThrow(/promotionValue/);
    });

    it('rejects a promotion type sent without a value', async () => {
      setupCreateSuccess();

      await expect(
        service.create(
          { ...createBase, promotionType: 'PERCENTAGE' },
          USER_ID,
          ORG_ID,
        ),
      ).rejects.toThrow(/together/);
    });

    it('validates FIXED_PRICE against the new salePrice when salePrice is also updated', async () => {
      const existing = buildProduct({ salePrice: 20000, version: 1 });
      prismaMock.product.findFirst.mockResolvedValueOnce(existing);

      await expect(
        service.update(
          'prod-1',
          { salePrice: 5000, promotionType: 'FIXED_PRICE', promotionValue: 6000 },
          USER_ID,
          ORG_ID,
        ),
      ).rejects.toThrow(/promotionValue.*salePrice/);
    });

    it('validates FIXED_PRICE against the existing salePrice when salePrice is omitted', async () => {
      const existing = buildProduct({ salePrice: 10000, version: 1 });
      prismaMock.product.findFirst.mockResolvedValueOnce(existing);

      await expect(
        service.update(
          'prod-1',
          { promotionType: 'FIXED_PRICE', promotionValue: 12000 },
          USER_ID,
          ORG_ID,
        ),
      ).rejects.toThrow(/promotionValue.*salePrice/);
    });

    it('clears the promotion when both fields are explicitly null and exposes null effectiveSalePrice', async () => {
      const existing = buildProduct({
        salePrice: 19900,
        promotionType: 'PERCENTAGE',
        promotionValue: 15,
        version: 3,
      });
      prismaMock.product.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(buildProduct({ version: 4 }));
      prismaMock.product.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.update(
        'prod-1',
        { promotionType: null, promotionValue: null },
        USER_ID,
        ORG_ID,
      );

      expect(prismaMock.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            promotionType: null,
            promotionValue: null,
          }),
        }),
      );
      expect(result.effectiveSalePrice).toBeNull();
    });

    it('keeps optimistic concurrency intact on promo updates (version where + increment)', async () => {
      const existing = buildProduct({ version: 3 });
      prismaMock.product.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(
          buildProduct({ promotionType: 'PERCENTAGE', promotionValue: 20, version: 4 }),
        );
      prismaMock.product.updateMany.mockResolvedValue({ count: 1 });

      await service.update(
        'prod-1',
        { promotionType: 'PERCENTAGE', promotionValue: 20 },
        USER_ID,
        ORG_ID,
      );

      expect(prismaMock.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'prod-1', version: 3 }),
          data: expect.objectContaining({ version: { increment: 1 } }),
        }),
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // findAll — additive lowStock/orderBy params (D5, inventory pagination)
  // ════════════════════════════════════════════════════════════════════
  describe('findAll — additive lowStock/orderBy params', () => {
    const setupFindAll = () => {
      prismaMock.product.findMany.mockResolvedValue([]);
      prismaMock.product.count.mockResolvedValue(0);
    };

    it('filters stock <= minStock via a field reference when lowStock is true', async () => {
      setupFindAll();

      await service.findAll(ORG_ID, 1, 10, undefined, undefined, 'active', true);

      expect(prismaMock.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            stock: { lte: MIN_STOCK_FIELD_REF },
          }),
        }),
      );
    });

    it('orders by name ascending when orderBy is "name"', async () => {
      setupFindAll();

      await service.findAll(
        ORG_ID,
        1,
        10,
        undefined,
        undefined,
        'active',
        undefined,
        'name',
      );

      expect(prismaMock.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } }),
      );
    });

    it('composes the low-stock filter with search and category filters', async () => {
      setupFindAll();

      await service.findAll(ORG_ID, 1, 10, 'panela', 'cat-2', 'active', true);

      expect(prismaMock.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: ORG_ID,
            categoryId: 'cat-2',
            OR: expect.any(Array),
            stock: { lte: MIN_STOCK_FIELD_REF },
          }),
        }),
      );
    });

    it('keeps current behavior by default (createdAt desc, no stock filter)', async () => {
      setupFindAll();

      await service.findAll(ORG_ID, 1, 10);

      expect(prismaMock.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
          where: expect.not.objectContaining({ stock: expect.anything() }),
        }),
      );
    });
  });
});
