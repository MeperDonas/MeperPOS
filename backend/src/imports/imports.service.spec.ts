import { ImportsService } from './imports.service';
import * as ExcelJS from 'exceljs';
import * as protectedDiagnostics from '../common/errors/protected-diagnostics';

async function buildXlsxBuffer(
  rows: Array<Array<string | number>>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Productos');
  const headers = [
    'Nombre',
    'SKU',
    'Precio Venta',
    'Precio Costo',
    'Stock',
    'Stock Minimo',
    'Impuesto (%)',
    'Codigo de Barras',
    'Categoria',
  ];
  worksheet.addRow(headers);
  for (const row of rows) {
    worksheet.addRow(row);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function makeFile(
  buffer: Buffer,
  name = 'inventario.xlsx',
): Express.Multer.File {
  return {
    buffer,
    originalname: name,
    mimetype:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  } as Express.Multer.File;
}

describe('ImportsService', () => {
  let service: ImportsService;
  let prisma: any;
  let productsService: { create: jest.Mock };

  beforeEach(() => {
    prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      category: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'cat-1', name: 'General', active: true }),
        update: jest.fn(),
        create: jest
          .fn()
          .mockResolvedValue({ id: 'cat-9', name: 'Nueva', active: true }),
      },
    };
    productsService = { create: jest.fn().mockResolvedValue(undefined) };
    service = new ImportsService(prisma, productsService as never);
  });

  async function flush() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('imports a product and returns a sheet-aware job status', async () => {
    const buffer = await buildXlsxBuffer([
      ['Pan', '', 5000, '', 10, '', 19, ''],
    ]);
    const started = await service.startProductsImport(
      makeFile(buffer),
      'user-1',
      'org-1',
    );
    await flush();

    expect(productsService.create).toHaveBeenCalledTimes(1);

    const status = service.getImportStatus(started.jobId, 'user-1');
    expect(status.status).toBe('COMPLETED');
    expect(status.importedCount).toBe(1);
    expect(status.sheets).toHaveLength(1);
    expect(status.sheets[0].sheetId).toBe('productos');
    expect(status.sheets[0].imported).toBe(1);
    expect(status.correlationId).toEqual(expect.any(String));
  });

  it('skips rows without a product name instead of failing them', async () => {
    const buffer = await buildXlsxBuffer([['', '', 5000, '', 10, '', 19, '']]);
    const started = await service.startProductsImport(
      makeFile(buffer),
      'user-1',
      'org-1',
    );
    await flush();

    expect(productsService.create).not.toHaveBeenCalled();

    const status = service.getImportStatus(started.jobId, 'user-1');
    expect(status.skippedCount).toBe(1);
    expect(status.errorCount).toBe(0);
  });

  it('reports an in-file duplicate SKU with the productos sheet and sheetId on the error', async () => {
    const buffer = await buildXlsxBuffer([
      ['Pan', 'PAN-1', 5000, '', 10, '', 0, ''],
      ['Otro', 'PAN-1', 6000, '', 5, '', 0, ''],
    ]);
    const started = await service.startProductsImport(
      makeFile(buffer),
      'user-1',
      'org-1',
    );
    await flush();

    const status = service.getImportStatus(started.jobId, 'user-1');
    expect(status.errorCount).toBe(1);
    expect(status.errors[0].code).toBe('DUPLICATE_SKU_FILE');
    expect(status.errors[0].sheetId).toBe('productos');
    expect(status.sheets[0].sheetId).toBe('productos');
  });

  it('defaults a retry to the productos sheet and reconciles counters', async () => {
    const buffer = await buildXlsxBuffer([['Pan', '', '', '', 10, '', 0, '']]);
    const started = await service.startProductsImport(
      makeFile(buffer),
      'user-1',
      'org-1',
    );
    await flush();

    let status = service.getImportStatus(started.jobId, 'user-1');
    expect(status.errors[0].code).toBe('INVALID_PRICE');

    status = await service.retryImportRow(started.jobId, 'user-1', {
      rowIndex: status.errors[0].row,
      correctedData: { salePrice: 5000 },
    });

    expect(productsService.create).toHaveBeenCalledTimes(1);
    expect(status.importedCount).toBe(1);
    expect(status.errorCount).toBe(0);
    expect(status.errors[0].retriedSuccess).toBe(true);
    expect(status.errors[0].sheetId).toBe('productos');
  });

  it('sanitizes unexpected row creation diagnostics in status and events', async () => {
    const marker = 'sensitive-products-db-marker';
    productsService.create.mockRejectedValueOnce(new Error(marker));
    const recordDiagnostic = jest.spyOn(
      protectedDiagnostics,
      'recordProtectedDiagnostic',
    );
    const buffer = await buildXlsxBuffer([['Pan', 'PAN-1', 5000, '', 10, '', 0, '']]);

    const started = await service.startProductsImport(
      makeFile(buffer),
      'user-1',
      'org-1',
      'request-products-1',
    );
    await flush();

    const status = service.getImportStatus(started.jobId, 'user-1');
    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain(marker);
    expect(status.errors[0]).toMatchObject({
      code: 'IMPORT_ROW_FAILED',
      message: 'The row could not be imported',
      row: 2,
    });
    expect(status.errors[0]).not.toHaveProperty('rawData');
    expect(status.errors[0]).not.toHaveProperty('mappedData');
    expect(status.recentEvents.every((event) => !event.message.includes(marker))).toBe(true);
    expect(recordDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: started.jobId, row: 2 }),
      expect.any(Error),
    );
  });

  it('turns parser failures into a safe import exception and protected diagnostic', async () => {
    const marker = 'sensitive-parser-marker';
    const recordDiagnostic = jest.spyOn(
      protectedDiagnostics,
      'recordProtectedDiagnostic',
    );
    (service as any).parseFile = jest.fn().mockRejectedValue(new Error(marker));

    await expect(
      service.startProductsImport(makeFile(Buffer.from('invalid')), 'user-1', 'org-1', 'request-products-2'),
    ).rejects.toMatchObject({ message: 'The import file could not be processed' });
    expect(recordDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ boundary: 'product-import-parser', requestId: 'request-products-2' }),
      expect.any(Error),
    );
  });
});
