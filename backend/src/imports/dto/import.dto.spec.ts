import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  RetryImportRowDto,
  ImportSheetStatusDto,
  ImportJobStatusResponseDto,
} from './import.dto';

describe('ImportDtos', () => {
  describe('RetryImportRowDto', () => {
    it('accepts a valid sheetId', async () => {
      const dto = plainToInstance(RetryImportRowDto, {
        rowIndex: 5,
        sheetId: 'clientes',
        correctedData: { name: 'Cliente Uno' },
      });
      const errors = await validate(dto);
      expect(errors).toEqual([]);
    });

    it('rejects an unknown sheetId', async () => {
      const dto = plainToInstance(RetryImportRowDto, {
        rowIndex: 5,
        sheetId: 'nope',
        correctedData: {},
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('allows omitting sheetId for product-only retries', async () => {
      const dto = plainToInstance(RetryImportRowDto, {
        rowIndex: 5,
        correctedData: { name: 'Producto Uno' },
      });
      const errors = await validate(dto);
      expect(errors).toEqual([]);
    });
  });

  describe('sheet-aware job status breakdown', () => {
    it('validates a per-sheet status with counters and rowErrors', async () => {
      const sheet = plainToInstance(ImportSheetStatusDto, {
        sheetId: 'productos',
        status: 'COMPLETED',
        totalRows: 1,
        processedRows: 1,
        imported: 1,
        skipped: 0,
        errors: 0,
        warnings: 0,
        rowErrors: [],
      });
      const errors = await validate(sheet);
      expect(errors).toEqual([]);
    });

    it('exposes the sheets[] array on the job status response type', async () => {
      const instance = plainToInstance(ImportJobStatusResponseDto, {});
      expect('sheets' in instance).toBe(true);
    });
  });
});
