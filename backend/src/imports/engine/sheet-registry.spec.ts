import { SheetRegistry, IMPORT_SHEET_HANDLERS } from './sheet-registry';
import type {
  ImportSheetHandler,
  ParsedFileRow,
  SheetRowContext,
  ValidationResult,
} from './import-sheet-handler.interface';

function fakeHandler(sheetId: ImportSheetHandler['sheetId']): ImportSheetHandler {
  return {
    sheetId,
    requiredFields: ['name'],
    editableFields: ['name'],
    detectColumns: (headers) => ({
      sheetId,
      detectedColumns: headers,
      mapping: {},
      missingRequiredFields: [],
    }),
    validateRow: (_row: ParsedFileRow, _ctx: SheetRowContext): ValidationResult => ({
      ok: true,
      data: { name: 'x' },
    }),
    createRow: async (_data, _ctx) => undefined,
  };
}

describe('SheetRegistry', () => {
  it('exposes the DI injection token', () => {
    expect(IMPORT_SHEET_HANDLERS).toBe('IMPORT_SHEET_HANDLERS');
  });

  it('resolves a registered handler by sheet id', () => {
    const productos = fakeHandler('productos');
    const clientes = fakeHandler('clientes');
    const registry = new SheetRegistry([productos, clientes]);

    expect(registry.get('productos')).toBe(productos);
    expect(registry.get('clientes')).toBe(clientes);
  });

  it('returns undefined for an unregistered sheet id', () => {
    const registry = new SheetRegistry([fakeHandler('productos')]);

    expect(registry.get('usuarios')).toBeUndefined();
  });

  it('returns every registered handler via all()', () => {
    const products = [fakeHandler('productos'), fakeHandler('proveedores')];
    const registry = new SheetRegistry(products);

    expect(registry.all()).toHaveLength(2);
    expect(registry.all()).toEqual(expect.arrayContaining(products));
  });
});
