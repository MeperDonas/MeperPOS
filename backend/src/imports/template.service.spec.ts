import * as ExcelJS from 'exceljs';
import {
  TemplateService,
  buildTemplateDefinitions,
  SHEET_DISPLAY_NAMES,
} from './template.service';

function readRow(cells: { value: ExcelJS.CellValue }[]): string[] {
  return cells.map((cell) => String(cell.value ?? ''));
}

function readAllRowsText(worksheet: ExcelJS.Worksheet): string {
  const parts: string[] = [];
  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    for (let col = 1; col <= row.cellCount; col += 1) {
      parts.push(String(row.getCell(col).value ?? ''));
    }
  }
  return parts.join(' ');
}

function readHeaderRow(worksheet: ExcelJS.Worksheet, count: number): string[] {
  const row = worksheet.getRow(1);
  const cells = [];
  for (let i = 1; i <= count; i += 1) {
    cells.push({ value: row.getCell(i).value });
  }
  return readRow(cells);
}

describe('TemplateService', () => {
  let service: TemplateService;

  beforeEach(() => {
    service = new TemplateService();
  });

  describe('buildTemplateDefinitions', () => {
    it('defines the four entity sheets in the required order', () => {
      const defs = buildTemplateDefinitions();
      expect(defs.map((def) => def.sheetName)).toEqual([
        'Productos',
        'Clientes',
        'Proveedores',
        'Usuarios',
      ]);
      expect(defs.map((def) => def.sheetId)).toEqual([
        'productos',
        'clientes',
        'proveedores',
        'usuarios',
      ]);
    });

    it('marks the required columns per entity', () => {
      const defs = buildTemplateDefinitions();
      const productos = defs.find((def) => def.sheetId === 'productos')!;
      expect(productos.requiredKeys).toEqual(['name', 'salePrice', 'stock']);

      const clientes = defs.find((def) => def.sheetId === 'clientes')!;
      expect(clientes.requiredKeys).toEqual([
        'name',
        'documentType',
        'documentNumber',
      ]);

      const proveedores = defs.find((def) => def.sheetId === 'proveedores')!;
      expect(proveedores.requiredKeys).toEqual(['name', 'documentNumber']);

      const usuarios = defs.find((def) => def.sheetId === 'usuarios')!;
      expect(usuarios.requiredKeys).toEqual(['email', 'password']);
    });

    it('exposes a display header for every column', () => {
      const defs = buildTemplateDefinitions();
      for (const def of defs) {
        const columns = def.columns;
        expect(columns.length).toBeGreaterThan(0);
        for (const column of columns) {
          expect(column.header.length).toBeGreaterThan(0);
          expect(column.key.length).toBeGreaterThan(0);
        }
      }
      expect(SHEET_DISPLAY_NAMES.productos).toBe('Productos');
    });
  });

  describe('buildWorkbook', () => {
    it('builds a workbook with the four entity sheets plus Instrucciones', () => {
      const workbook = service.buildWorkbook();
      expect(workbook.worksheets.map((ws) => ws.name)).toEqual([
        'Productos',
        'Clientes',
        'Proveedores',
        'Usuarios',
        'Instrucciones',
      ]);
    });

    it('marks required columns with an asterisk in the Productos header row', () => {
      const workbook = service.buildWorkbook();
      const productos = workbook.getWorksheet('Productos')!;
      const def = buildTemplateDefinitions().find(
        (item) => item.sheetId === 'productos',
      )!;
      const headers = readHeaderRow(productos, def.columns.length);

      expect(headers[0]).toBe('Nombre *');
      const salePriceIndex = def.columns.findIndex(
        (col) => col.key === 'salePrice',
      );
      expect(headers[salePriceIndex]).toBe('Precio Venta *');
      const stockIndex = def.columns.findIndex((col) => col.key === 'stock');
      expect(headers[stockIndex]).toBe('Stock *');
      const skuIndex = def.columns.findIndex((col) => col.key === 'sku');
      expect(headers[skuIndex]).toBe('SKU');
    });

    it('adds example rows beneath the header row for each entity sheet', () => {
      const workbook = service.buildWorkbook();
      const clientes = workbook.getWorksheet('Clientes')!;
      const def = buildTemplateDefinitions().find(
        (item) => item.sheetId === 'clientes',
      )!;
      const exampleRow = clientes.getRow(2).values;
      const exampleCells = [];
      for (let i = 1; i <= def.columns.length; i += 1) {
        exampleCells.push({ value: exampleRow?.[i] });
      }
      const example = readRow(exampleCells);
      expect(example[0].length).toBeGreaterThan(0);
    });

    it('lists required columns, example rows and retry guidance in Instrucciones', () => {
      const workbook = service.buildWorkbook();
      const instrucciones = workbook.getWorksheet('Instrucciones')!;
      const text = readAllRowsText(instrucciones);
      expect(text.toLowerCase()).toContain('columna requerida');
      expect(text.toLowerCase()).toContain('reintentar');
      expect(text.toLowerCase()).toContain('productos - columnas requeridas');
    });
  });
});
