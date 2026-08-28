import { CustomerHandler } from './customer.handler';
import type { ParsedFileRow, SheetRowContext } from '../import-sheet-handler.interface';

describe('CustomerHandler', () => {
  let customersService: { create: jest.Mock };
  let handler: CustomerHandler;

  beforeEach(() => {
    customersService = { create: jest.fn().mockResolvedValue(undefined) };
    handler = new CustomerHandler(customersService as never);
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
    it('validates a mapped row and registers its document number', () => {
      const ctx = makeCtx();

      const result = handler.validateRow(
        makeRow({
          'Nombre': 'John Doe',
          'Tipo de Documento': 'CC',
          'Documento': '1234567890',
          'Segmento': 'frequent',
        }),
        ctx,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toMatchObject({
          name: 'John Doe',
          documentType: 'CC',
          documentNumber: '1234567890',
          segment: 'FREQUENT',
        });
      }
      expect(ctx.existingKeys.has('1234567890')).toBe(true);
    });

    it('rejects a document number already present in the organization', () => {
      const ctx = makeCtx({ existingKeys: new Set(['1234567890']) });

      const result = handler.validateRow(
        makeRow({
          'Nombre': 'John Doe',
          'Tipo de Documento': 'CC',
          'Documento': '1234567890',
        }),
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
        makeRow({ 'Nombre': 'A', 'Tipo de Documento': 'CC', 'Documento': '999' }, 2),
        ctx,
      );

      const duplicate = handler.validateRow(
        makeRow({ 'Nombre': 'B', 'Tipo de Documento': 'CC', 'Documento': '999' }, 3),
        ctx,
      );

      expect(duplicate.ok).toBe(false);
      if (!duplicate.ok) {
        expect(duplicate.error.errorCode).toBe('DUPLICATE_DOCUMENT');
      }
    });

    it('propagates a validation failure (missing name)', () => {
      const ctx = makeCtx();

      const result = handler.validateRow(
        makeRow({ 'Tipo de Documento': 'CC', 'Documento': '1234567890' }),
        ctx,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.errorCode).toBe('EMPTY_NAME');
      }
    });
  });

  describe('createRow', () => {
    it('creates the customer via the service with the organization id', async () => {
      const ctx = makeCtx();

      await handler.createRow(
        { name: 'John Doe', documentType: 'CC', documentNumber: '1234567890', segment: 'OCCASIONAL' },
        ctx,
      );

      expect(customersService.create).toHaveBeenCalledTimes(1);
      const [dto, organizationId] = customersService.create.mock.calls[0];
      expect(dto).toMatchObject({
        name: 'John Doe',
        documentType: 'CC',
        documentNumber: '1234567890',
      });
      expect(organizationId).toBe('org-1');
    });
  });

  describe('contract metadata', () => {
    it('declares the clientes sheet id, required and editable fields', () => {
      expect(handler.sheetId).toBe('clientes');
      expect(handler.requiredFields).toEqual(['name', 'documentType', 'documentNumber']);
      expect(handler.editableFields).toEqual([
        'name',
        'documentType',
        'documentNumber',
        'email',
        'phone',
        'segment',
      ]);
    });
  });
});
