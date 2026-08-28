import { SupplierHandler } from './supplier.handler';
import type { ParsedFileRow, SheetRowContext } from '../import-sheet-handler.interface';

describe('SupplierHandler', () => {
  let suppliersService: { create: jest.Mock };
  let handler: SupplierHandler;

  beforeEach(() => {
    suppliersService = { create: jest.fn().mockResolvedValue(undefined) };
    handler = new SupplierHandler(suppliersService as never);
  });

  function makeCtx(overrides: Partial<SheetRowContext> = {}): SheetRowContext {
    return {
      organizationId: 'org-1',
      userId: 'user-1',
      prisma: {},
      planLimits: {},
      existingKeys: new Set<string>(),
      ...overrides,
    } as unknown as SheetRowContext;
  }

  function makeRow(rawData: Record<string, string>, rowIndex = 2): ParsedFileRow {
    return { rowIndex, rawData };
  }

  describe('validateRow', () => {
    it('validates a mapped supplier row and normalizes account type', () => {
      const ctx = makeCtx();

      const result = handler.validateRow(
        makeRow({
          'Nombre': 'Distribuidora XYZ',
          'Documento': '900123456',
          'Tipo de Cuenta': 'savings',
        }),
        ctx,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toMatchObject({
          name: 'Distribuidora XYZ',
          documentNumber: '900123456',
          accountType: 'SAVINGS',
        });
      }
      expect(ctx.existingKeys.has('900123456')).toBe(true);
    });

    it('rejects a document number already present in the organization', () => {
      const ctx = makeCtx({ existingKeys: new Set(['900123456']) });

      const result = handler.validateRow(
        makeRow({ 'Nombre': 'Distribuidora XYZ', 'Documento': '900123456' }),
        ctx,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.errorCode).toBe('DUPLICATE_DOCUMENT');
        expect(result.error.field).toBe('documentNumber');
      }
    });

    it('rejects a duplicate document number within the same file', () => {
      const ctx = makeCtx();
      handler.validateRow(
        makeRow({ 'Nombre': 'A', 'Documento': '111' }, 2),
        ctx,
      );

      const duplicate = handler.validateRow(
        makeRow({ 'Nombre': 'B', 'Documento': '111' }, 3),
        ctx,
      );

      expect(duplicate.ok).toBe(false);
      if (!duplicate.ok) {
        expect(duplicate.error.errorCode).toBe('DUPLICATE_DOCUMENT');
      }
    });

    it('rejects an invalid account type', () => {
      const ctx = makeCtx();

      const result = handler.validateRow(
        makeRow({ 'Nombre': 'Distribuidora XYZ', 'Documento': '900123456', 'Tipo de Cuenta': 'CREDIT' }),
        ctx,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.errorCode).toBe('INVALID_ACCOUNT_TYPE');
        expect(result.error.field).toBe('accountType');
      }
    });

    it('propagates a validation failure (missing document)', () => {
      const ctx = makeCtx();

      const result = handler.validateRow(makeRow({ 'Nombre': 'Distribuidora XYZ' }), ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.errorCode).toBe('EMPTY_DOCUMENT');
      }
    });
  });

  describe('createRow', () => {
    it('creates the supplier via the service with the organization id', async () => {
      const ctx = makeCtx();

      await handler.createRow(
        { name: 'Distribuidora XYZ', documentNumber: '900123456', accountType: 'SAVINGS' },
        ctx,
      );

      expect(suppliersService.create).toHaveBeenCalledTimes(1);
      const [dto, organizationId] = suppliersService.create.mock.calls[0];
      expect(dto).toMatchObject({
        name: 'Distribuidora XYZ',
        documentNumber: '900123456',
      });
      expect(organizationId).toBe('org-1');
    });
  });

  describe('contract metadata', () => {
    it('declares the proveedores sheet id, required and editable fields', () => {
      expect(handler.sheetId).toBe('proveedores');
      expect(handler.requiredFields).toEqual(['name', 'documentNumber']);
      expect(handler.editableFields).toContain('name');
      expect(handler.editableFields).toContain('documentNumber');
      expect(handler.editableFields).toContain('accountType');
    });
  });
});
