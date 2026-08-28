import { ProductHandler, parseProductRow, PRODUCT_EDITABLE_FIELDS } from './product.handler';
import type {
  ParsedFileRow,
  SheetRowContext,
} from '../import-sheet-handler.interface';
import { buildGeneratedSku } from '../../helpers/row-validator';

describe('parseProductRow', () => {
  it('accepts a minimal valid row and defaults sku/category/cost fields', () => {
    const result = parseProductRow(
      { name: 'Pan', salePrice: '5000', stock: '10' },
      2,
    );

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.data).toMatchObject({
        name: 'Pan',
        sku: buildGeneratedSku(1),
        category: 'General',
        salePrice: 5000,
        stock: 10,
        minStock: 0,
        taxRate: 0,
        taxRateProvided: false,
        costInferred: true,
      });
    }
  });

  it('generates a sku from the row index when the row lacks one', () => {
    const result = parseProductRow(
      { name: 'Producto', salePrice: '100', stock: '1' },
      7,
    );

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.data.sku).toBe(buildGeneratedSku(6));
    }
  });

  it('infers cost price from sale price when cost is missing', () => {
    const result = parseProductRow(
      { name: 'Producto', salePrice: '2500', stock: '5' },
      2,
    );

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.data.costPrice).toBe(2500);
      expect(result.data.costInferred).toBe(true);
    }
  });

  it('rejects a row without a name', () => {
    const result = parseProductRow({ salePrice: '5000', stock: '10' }, 2);

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.errorCode).toBe('EMPTY_NAME');
      expect(result.field).toBe('name');
    }
  });

  it('rejects an invalid sale price', () => {
    const result = parseProductRow(
      { name: 'Producto', salePrice: 'abc', stock: '10' },
      2,
    );

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.errorCode).toBe('INVALID_PRICE');
      expect(result.field).toBe('salePrice');
    }
  });

  it('rejects an invalid stock', () => {
    const result = parseProductRow(
      { name: 'Producto', salePrice: '5000', stock: '-1' },
      2,
    );

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.errorCode).toBe('INVALID_STOCK');
      expect(result.field).toBe('stock');
    }
  });

  it('rejects an invalid cost price', () => {
    const result = parseProductRow(
      { name: 'Producto', salePrice: '5000', stock: '10', costPrice: 'x' },
      2,
    );

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.errorCode).toBe('INVALID_COST_PRICE');
      expect(result.field).toBe('costPrice');
    }
  });

  it('parses comma decimal separators for price fields', () => {
    const result = parseProductRow(
      { name: 'Producto', salePrice: '5.000,50', stock: '10' },
      2,
    );

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.data.salePrice).toBe(5000.5);
    }
  });
});

describe('ProductHandler', () => {
  let productsService: { create: jest.Mock };
  let handler: ProductHandler;

  beforeEach(() => {
    productsService = { create: jest.fn().mockResolvedValue(undefined) };
    handler = new ProductHandler(productsService as never);
  });

  function makeCtx(overrides: Partial<SheetRowContext> = {}): SheetRowContext {
    return {
      organizationId: 'org-1',
      userId: 'user-1',
      prisma: {
        category: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'cat-1', name: 'Bebidas', active: true }),
          update: jest.fn().mockResolvedValue({ id: 'cat-1', name: 'Bebidas', active: true }),
        },
      },
      planLimits: {},
      existingKeys: new Set<string>(),
      ...overrides,
    } as unknown as SheetRowContext;
  }

  function makeRow(rawData: Record<string, string>, rowIndex = 2): ParsedFileRow {
    return { rowIndex, rawData };
  }

  describe('validateRow', () => {
    it('maps detected columns, parses and reports sku duplicates', () => {
      const ctx = makeCtx();
      handler.validateRow(makeRow({ 'Nombre': 'Pan', 'Precio': '5000', 'Stock': '10' }), ctx);

      const duplicate = handler.validateRow(makeRow({ 'Nombre': 'Otro', 'SKU': 'IMP-001', 'Precio': '10', 'Stock': '1' }), ctx);

      expect(duplicate.ok).toBe(false);
      if (!duplicate.ok) {
        expect(duplicate.error.errorCode).toBe('DUPLICATE_SKU');
        expect(duplicate.error.field).toBe('sku');
      }
    });

    it('detects a barcode duplicate within the same file', () => {
      const ctx = makeCtx();
      handler.validateRow(
        makeRow({ 'Nombre': 'Pan', 'Codigo de Barras': '7702011', 'Precio': '5000', 'Stock': '10' }, 2),
        ctx,
      );

      const duplicate = handler.validateRow(
        makeRow({ 'Nombre': 'Otro', 'Codigo de Barras': '7702011', 'Precio': '10', 'Stock': '1' }, 3),
        ctx,
      );

      expect(duplicate.ok).toBe(false);
      if (!duplicate.ok) {
        expect(duplicate.error.errorCode).toBe('DUPLICATE_BARCODE');
        expect(duplicate.error.field).toBe('barcode');
      }
    });

    it('detects a sku already present in the organization (seeded existing keys)', () => {
      const ctx = makeCtx({ existingKeys: new Set(['pan']) });

      const result = handler.validateRow(
        makeRow({ 'Nombre': 'Pan', 'SKU': 'Pan', 'Precio': '5000', 'Stock': '10' }),
        ctx,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.errorCode).toBe('DUPLICATE_SKU');
      }
    });

    it('returns parsed product data on a valid row', () => {
      const ctx = makeCtx();

      const result = handler.validateRow(
        makeRow({ 'Nombre': 'Pan', 'Precio': '5000', 'Stock': '10' }),
        ctx,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toMatchObject({
          name: 'Pan',
          salePrice: 5000,
          stock: 10,
        });
      }
    });
  });

  describe('createRow', () => {
    it('resolves an existing category and creates the product via the service', async () => {
      const prisma = {
        category: {
          findFirst: jest.fn().mockResolvedValue({ id: 'cat-existing', name: 'Bebidas', active: true }),
          create: jest.fn(),
          update: jest.fn(),
        },
      };
      const ctx = makeCtx({ prisma } as never);
      const data = {
        name: 'Pan',
        sku: 'IMP-001',
        barcode: undefined,
        category: 'Bebidas',
        salePrice: 5000,
        costPrice: 3500,
        stock: 10,
        minStock: 0,
        taxRate: 0,
        taxRateProvided: false,
        description: undefined,
        costInferred: false,
      };

      await handler.createRow(data, ctx);

      expect(prisma.category.create).not.toHaveBeenCalled();
      expect(productsService.create).toHaveBeenCalledTimes(1);
      const args = productsService.create.mock.calls[0];
      expect(args[0]).toMatchObject({
        name: 'Pan',
        salePrice: 5000,
        categoryId: 'cat-existing',
      });
      expect(args[1]).toBe('user-1');
      expect(args[2]).toBe('org-1');
    });

    it('auto-creates a missing category and reuses the created category', async () => {
      const prisma = {
        category: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'cat-new', name: 'Limpieza', active: true }),
          update: jest.fn(),
        },
      };
      const ctx = makeCtx({ prisma } as never);
      const data = {
        name: 'Detergente',
        sku: 'IMP-002',
        barcode: undefined,
        category: 'Limpieza',
        salePrice: 8000,
        costPrice: 6000,
        stock: 30,
        minStock: 5,
        taxRate: 19,
        taxRateProvided: true,
        description: undefined,
        costInferred: false,
      };

      await handler.createRow(data, ctx);

      expect(prisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: 'Limpieza', organizationId: 'org-1' } }),
      );
      expect(productsService.create).toHaveBeenCalledTimes(1);
      const firstArg = productsService.create.mock.calls[0][0];
      expect(firstArg).toMatchObject({ categoryId: 'cat-new', taxable: true, taxRate: 19 });
    });
  });

  describe('contract metadata', () => {
    it('declares the productos sheet id', () => {
      expect(handler.sheetId).toBe('productos');
    });

    it('declares required fields and editable fields', () => {
      expect(handler.requiredFields).toEqual(['name', 'salePrice', 'stock']);
      expect(handler.editableFields).toEqual(PRODUCT_EDITABLE_FIELDS);
    });
  });
});
