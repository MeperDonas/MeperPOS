import {
  detectColumns,
  SHEET_COLUMN_ALIASES,
  SHEET_REQUIRED_FIELDS,
} from './column-detector';
import type { SheetId } from '../engine/import-sheet-handler.interface';

describe('SHEET_REQUIRED_FIELDS', () => {
  it('defines the required field set for every entity sheet', () => {
    expect(SHEET_REQUIRED_FIELDS.productos).toEqual([
      'name',
      'salePrice',
      'stock',
    ]);
    expect(SHEET_REQUIRED_FIELDS.clientes).toEqual([
      'name',
      'documentType',
      'documentNumber',
    ]);
    expect(SHEET_REQUIRED_FIELDS.proveedores).toEqual([
      'name',
      'documentNumber',
    ]);
    expect(SHEET_REQUIRED_FIELDS.usuarios).toEqual(['email', 'password']);
  });

  it('covers exactly the four sheet ids', () => {
    expect(Object.keys(SHEET_REQUIRED_FIELDS).sort()).toEqual([
      'clientes',
      'productos',
      'proveedores',
      'usuarios',
    ]);
  });
});

describe('SHEET_COLUMN_ALIASES', () => {
  it('declares alias tables for every entity sheet', () => {
    expect(Object.keys(SHEET_COLUMN_ALIASES).sort()).toEqual([
      'clientes',
      'productos',
      'proveedores',
      'usuarios',
    ]);
  });

  it('exposes an aliases table per sheet for the required fields', () => {
    expect(SHEET_COLUMN_ALIASES.clientes.documentType).toBeDefined();
    expect(SHEET_COLUMN_ALIASES.clientes.documentNumber).toBeDefined();
    expect(SHEET_COLUMN_ALIASES.proveedores.documentNumber).toBeDefined();
    expect(SHEET_COLUMN_ALIASES.usuarios.email).toBeDefined();
    expect(SHEET_COLUMN_ALIASES.usuarios.password).toBeDefined();
  });
});

describe('detectColumns', () => {
  it('detects the Productos sheet from Spanish headers', () => {
    const result = detectColumns('productos', [
      'Nombre',
      'Precio Venta',
      'Stock',
      'SKU',
    ]);

    expect(result.sheetId).toBe('productos');
    expect(result.mapping).toEqual({
      name: 'Nombre',
      sku: 'SKU',
      salePrice: 'Precio Venta',
      stock: 'Stock',
    });
    expect(result.missingRequiredFields).toEqual([]);
  });

  it('flags missing required fields on the Productos sheet', () => {
    const result = detectColumns('productos', ['Nombre', 'Precio Venta']);

    expect(result.mapping).not.toHaveProperty('stock');
    expect(result.missingRequiredFields).toEqual(['stock']);
  });

  it('resolves Productos generic price column aliases', () => {
    const result = detectColumns('productos', [
      'producto',
      'pvp',
      'existencia',
      'codigo',
    ]);

    expect(result.mapping.name).toBe('producto');
    expect(result.mapping.salePrice).toBe('pvp');
    expect(result.mapping.stock).toBe('existencia');
    expect(result.mapping.sku).toBe('codigo');
    expect(result.missingRequiredFields).toEqual([]);
  });

  it('detects the Clientes sheet and its required fields', () => {
    const result = detectColumns('clientes', [
      'Nombre',
      'Tipo Documento',
      'Documento',
    ]);

    expect(result.mapping).toEqual({
      name: 'Nombre',
      documentType: 'Tipo Documento',
      documentNumber: 'Documento',
    });
    expect(result.missingRequiredFields).toEqual([]);
  });

  it('flags the missing documentType on the Clientes sheet', () => {
    const result = detectColumns('clientes', ['Nombre', 'Documento']);

    expect(result.missingRequiredFields).toEqual(['documentType']);
  });

  it('detects the Proveedores sheet by NIT alias', () => {
    const result = detectColumns('proveedores', ['Nombre', 'NIT']);

    expect(result.mapping.name).toBe('Nombre');
    expect(result.mapping.documentNumber).toBe('NIT');
    expect(result.missingRequiredFields).toEqual([]);
  });

  it('flags the missing documentNumber on the Proveedores sheet', () => {
    const result = detectColumns('proveedores', ['Nombre']);

    expect(result.missingRequiredFields).toEqual(['documentNumber']);
  });

  it('detects the Usuarios sheet and its required fields', () => {
    const result = detectColumns('usuarios', ['Correo', 'Contraseña']);

    expect(result.mapping.email).toBe('Correo');
    expect(result.mapping.password).toBe('Contraseña');
    expect(result.missingRequiredFields).toEqual([]);
  });

  it('flags the missing password on the Usuarios sheet', () => {
    const result = detectColumns('usuarios', ['Correo']);

    expect(result.missingRequiredFields).toEqual(['password']);
  });

  it('normalizes accented / mixed-case headers before aliasing', () => {
    const result = detectColumns('usuarios', [
      'CORREO ELECTRÓNICO',
      'CONTRASEÑA',
    ]);

    expect(result.mapping.email).toBe('CORREO ELECTRÓNICO');
    expect(result.mapping.password).toBe('CONTRASEÑA');
    expect(result.missingRequiredFields).toEqual([]);
  });

  it('skips a sheet with no matching required columns', () => {
    const result = detectColumns('clientes', ['Precio', 'Stock']);

    expect(result.mapping).toEqual({});
    expect(result.missingRequiredFields).toEqual([
      'name',
      'documentType',
      'documentNumber',
    ]);
  });

  it('exposes the detected non-empty headers list', () => {
    const result = detectColumns('productos', ['Nombre', '', 'Stock']);

    expect(result.detectedColumns).toEqual(['Nombre', 'Stock']);
  });

  it('round-trips every sheet id through the alias tables', () => {
    const sheetIds: SheetId[] = [
      'productos',
      'clientes',
      'proveedores',
      'usuarios',
    ];

    for (const sheetId of sheetIds) {
      expect(detectColumns(sheetId, []).sheetId).toBe(sheetId);
      expect(
        Array.isArray(detectColumns(sheetId, []).missingRequiredFields),
      ).toBe(true);
    }
  });
});
