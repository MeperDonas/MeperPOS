import type { SheetId } from '../engine/import-sheet-handler.interface';

export type ImportFieldKey =
  | 'name'
  | 'sku'
  | 'barcode'
  | 'category'
  | 'salePrice'
  | 'costPrice'
  | 'stock'
  | 'minStock'
  | 'taxRate'
  | 'description';

/** Result of {@link detectColumns} for a single entity sheet. */
export interface SheetColumnDetectionResult {
  sheetId: SheetId;
  detectedColumns: string[];
  mapping: Record<string, string>;
  missingRequiredFields: string[];
}

export type ColumnMapping = Partial<Record<ImportFieldKey, string>>;

export interface ColumnDetectionResult {
  detectedColumns: string[];
  mapping: ColumnMapping;
  missingRequiredFields: Array<'name' | 'salePrice' | 'stock'>;
  usesGenericPriceColumn: boolean;
}

const COLUMN_ALIASES: Record<ImportFieldKey, string[]> = {
  name: [
    'nombre',
    'name',
    'producto',
    'product',
    'descripcion_corta',
    'articulo',
  ],
  sku: ['sku', 'codigo', 'code', 'ref', 'referencia', 'codigo_interno'],
  barcode: [
    'codigo_de_barras',
    'barcode',
    'ean',
    'upc',
    'codigo_barras',
    'codigobarras',
  ],
  category: ['categoria', 'category', 'cat', 'tipo', 'grupo', 'familia'],
  salePrice: ['precio_venta', 'sale_price', 'pvp', 'precio_de_venta', 'precio'],
  costPrice: [
    'precio_costo',
    'cost_price',
    'costo',
    'precio_de_costo',
    'precio_compra',
  ],
  stock: [
    'stock',
    'cantidad',
    'qty',
    'quantity',
    'existencia',
    'inventario',
    'unidades',
  ],
  minStock: [
    'stock_minimo',
    'min_stock',
    'punto_reorden',
    'minimo',
    'stock_min',
  ],
  taxRate: [
    'impuesto',
    'iva',
    'tax',
    'tax_rate',
    'tasa_impuesto',
    'porcentaje_iva',
  ],
  description: [
    'descripcion',
    'description',
    'detalle',
    'notas',
    'observaciones',
    'descripcion_larga',
  ],
};

export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[%]/g, 'porcentaje')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function detectColumnMapping(headers: string[]): ColumnDetectionResult {
  const detectedColumns = headers.filter((header) => header.trim().length > 0);
  const normalizedHeaders = detectedColumns.map(normalizeHeader);
  const mapping: ColumnMapping = {};

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as Array<
    [ImportFieldKey, string[]]
  >) {
    const matchedIndex = normalizedHeaders.findIndex((header) =>
      aliases.includes(header),
    );

    if (matchedIndex >= 0) {
      mapping[field] = detectedColumns[matchedIndex];
    }
  }

  const missingRequiredFields = (
    ['name', 'salePrice', 'stock'] as Array<'name' | 'salePrice' | 'stock'>
  ).filter((field) => !mapping[field]);

  const salePriceHeader = mapping.salePrice;
  const usesGenericPriceColumn =
    !!salePriceHeader && normalizeHeader(salePriceHeader) === 'precio';

  return {
    detectedColumns,
    mapping,
    missingRequiredFields,
    usesGenericPriceColumn,
  };
}

/** Fields that must be present on each sheet for it to be importable. */
export const SHEET_REQUIRED_FIELDS: Record<SheetId, string[]> = {
  productos: ['name', 'salePrice', 'stock'],
  clientes: ['name', 'documentType', 'documentNumber'],
  proveedores: ['name', 'documentNumber'],
  usuarios: ['email', 'password'],
};

/**
 * Per-entity column alias tables, keyed by import field name and normalized
 * via {@link normalizeHeader}. The Productos table reuses the existing
 * product-only aliases so both code paths share one source of truth.
 */
export const SHEET_COLUMN_ALIASES: Record<SheetId, Record<string, string[]>> = {
  productos: COLUMN_ALIASES,
  clientes: {
    name: ['nombre', 'name', 'cliente', 'customer', 'nombre_cliente'],
    documentType: [
      'tipo_documento',
      'document_type',
      'tipo_doc',
      'tipo_de_documento',
      'documenttype',
    ],
    documentNumber: [
      'documento',
      'document_number',
      'numero_documento',
      'cedula',
      'documento_identidad',
      'num_documento',
      'nit',
    ],
    email: ['email', 'correo', 'correo_electronico', 'mail'],
    phone: ['telefono', 'phone', 'celular', 'movil'],
    segment: ['segmento', 'segment', 'tipo_cliente'],
  },
  proveedores: {
    name: ['nombre', 'name', 'proveedor', 'supplier', 'razon_social'],
    documentNumber: [
      'documento',
      'document_number',
      'nit',
      'nit_number',
      'numero_documento',
      'cedula',
      'ruc',
      'cuit',
    ],
    email: ['email', 'correo', 'correo_electronico', 'mail'],
    phone: ['telefono', 'phone', 'celular', 'movil'],
    accountType: [
      'tipo_cuenta',
      'account_type',
      'tipo_de_cuenta',
      'accounttype',
    ],
  },
  usuarios: {
    email: ['email', 'correo', 'correo_electronico', 'mail'],
    password: ['password', 'contrasena', 'clave', 'pass'],
    name: ['nombre', 'name', 'usuario', 'user', 'nombres'],
    role: ['rol', 'role', 'perfil'],
  },
};

/**
 * Detects the column mapping for a single entity sheet, returning the minimum
 * set of import fields that are missing so the sheet can be rejected (or
 * repaired) before any row is processed.
 */
export function detectColumns(
  sheetId: SheetId,
  headers: string[],
): SheetColumnDetectionResult {
  const detectedColumns = headers.filter((header) => header.trim().length > 0);
  const normalizedHeaders = detectedColumns.map(normalizeHeader);
  const aliases = SHEET_COLUMN_ALIASES[sheetId] ?? {};
  const mapping: Record<string, string> = {};

  for (const [field, fieldAliases] of Object.entries(aliases)) {
    const matchedIndex = normalizedHeaders.findIndex((header) =>
      fieldAliases.includes(header),
    );

    if (matchedIndex >= 0) {
      mapping[field] = detectedColumns[matchedIndex];
    }
  }

  const missingRequiredFields = (SHEET_REQUIRED_FIELDS[sheetId] ?? []).filter(
    (field) => !mapping[field],
  );

  return {
    sheetId,
    detectedColumns,
    mapping,
    missingRequiredFields,
  };
}
