import * as ExcelJS from 'exceljs';
import { NotFoundException } from '@nestjs/common';
import { ImportsService } from './imports.service';
import { MultiSheetImportService } from './multi-sheet-import.service';
import {
  setupTwoOrgFixture,
  type TwoOrgFixture,
} from '../testing/two-org-fixture';

// Handlers are stubbed: isolation specs exercise job ownership, not imports.
const productsServiceStub = { create: jest.fn() };
const planLimitsStub = { invalidateCache: jest.fn() };

const NOT_FOUND_MESSAGE = 'No se encontró la importacion solicitada';

const PRODUCTS_CSV = [
  'Nombre,SKU,Categoria,Precio Venta,Precio Costo,Stock,Stock Minimo',
  'Producto Org A,SKU-INT-A,General,5000,3500,10,1',
].join('\n');

async function buildMultiSheetFile(): Promise<Express.Multer.File> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Productos');
  sheet.addRow(['Nombre', 'Precio Venta', 'Stock']);
  sheet.addRow(['Producto Multi Org A', 5000, 10]);
  const buffer = await workbook.xlsx.writeBuffer();
  return {
    originalname: 'full.xlsx',
    buffer: Buffer.from(buffer as ArrayBuffer),
  } as unknown as Express.Multer.File;
}

describe('ImportsService — Integration (Two-Org Isolation)', () => {
  let fixture: TwoOrgFixture;
  let service: ImportsService;
  let multiSheetService: MultiSheetImportService;
  let jobAId: string;
  let multiSheetJobAId: string;

  beforeAll(async () => {
    fixture = await setupTwoOrgFixture('imports-int');
    service = new ImportsService(
      fixture.prisma as never,
      productsServiceStub as never,
    );
    multiSheetService = new MultiSheetImportService(
      fixture.prisma as never,
      planLimitsStub as never,
      productsServiceStub as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const started = await service.startProductsImport(
      {
        originalname: 'products.csv',
        buffer: Buffer.from(PRODUCTS_CSV, 'utf-8'),
      } as unknown as Express.Multer.File,
      fixture.userAId,
      fixture.orgAId,
    );
    jobAId = started.jobId;

    const multiSheetStarted = await multiSheetService.startFullImport(
      await buildMultiSheetFile(),
      fixture.userAId,
      fixture.orgAId,
    );
    multiSheetJobAId = multiSheetStarted.jobId;
  });

  afterAll(() => fixture.teardown());

  it('nonexistent job returns 404', () => {
    expect(() =>
      service.getImportStatus('missing-job', fixture.userAId),
    ).toThrow(NotFoundException);
  });

  it('cross-org job status read returns 404 (same as nonexistent), not 403', () => {
    expect(() => service.getImportStatus(jobAId, fixture.userBId)).toThrow(
      NotFoundException,
    );
    expect(() => service.getImportStatus(jobAId, fixture.userBId)).toThrow(
      NOT_FOUND_MESSAGE,
    );
  });

  it('cross-org retry is denied with 404 and leaves the job unchanged', async () => {
    const before = service.getImportStatus(jobAId, fixture.userAId);

    await expect(
      service.retryImportRow(jobAId, fixture.userBId, {
        rowIndex: 1,
        correctedData: {},
      }),
    ).rejects.toThrow(NotFoundException);

    const after = service.getImportStatus(jobAId, fixture.userAId);
    expect(after.importedCount).toBe(before.importedCount);
    expect(after.errorCount).toBe(before.errorCount);
    expect(after.status).toBe(before.status);
  });

  it('multi-sheet cross-org job access returns 404 (not 403)', () => {
    expect(() =>
      multiSheetService.getImportStatus(multiSheetJobAId, fixture.userBId),
    ).toThrow(NotFoundException);
  });
});
