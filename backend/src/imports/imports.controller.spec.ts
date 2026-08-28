import { NotFoundException } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { ImportsController } from './imports.controller';
import type { RequestUser } from '../common/interfaces/request-user.interface';

describe('ImportsController', () => {
  const importsServiceMock = {
    getImportStatus: jest.fn(),
    retryImportRow: jest.fn(),
  };
  const multiSheetImportServiceMock = {
    startFullImport: jest.fn(),
    getImportStatus: jest.fn(),
    retryImportRow: jest.fn(),
  };
  const templateServiceMock = {
    downloadTemplate: jest.fn(),
  };

  const cashierUser: RequestUser = {
    userId: 'cashier-1',
    email: 'cashier@example.com',
    organizationId: 'org-1',
    role: OrgRole.CASHIER,
    tokenVersion: 1,
    isSuperAdmin: false,
  };

  let controller: ImportsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ImportsController(
      importsServiceMock as never,
      multiSheetImportServiceMock as never,
      templateServiceMock as never,
    );
  });

  describe('full template endpoint', () => {
    it('streams the multi-sheet template via TemplateService', async () => {
      const res = { setHeader: jest.fn(), send: jest.fn() };
      await controller.downloadFullTemplate(res as never);
      expect(templateServiceMock.downloadTemplate).toHaveBeenCalledWith(res);
    });

    it('is restricted to ADMIN and CASHIER', () => {
      const requiredRoles = Reflect.getMetadata(
        ROLES_KEY,
        ImportsController.prototype.downloadFullTemplate,
      );
      expect(requiredRoles).toContain(OrgRole.ADMIN);
      expect(requiredRoles).toContain(OrgRole.CASHIER);
    });
  });

  describe('full import endpoint', () => {
    it('delegates to the multi-sheet orchestrator with the JWT org', async () => {
      const file = { originalname: 'a.xlsx' } as Express.Multer.File;
      await controller.startFullImport(file, cashierUser);
      expect(multiSheetImportServiceMock.startFullImport).toHaveBeenCalledWith(
        file,
        'cashier-1',
        'org-1',
      );
    });

    it('is restricted to ADMIN and CASHIER', () => {
      const requiredRoles = Reflect.getMetadata(
        ROLES_KEY,
        ImportsController.prototype.startFullImport,
      );
      expect(requiredRoles).toContain(OrgRole.ADMIN);
      expect(requiredRoles).toContain(OrgRole.CASHIER);
    });
  });

  describe('sheet-aware status dispatch', () => {
    it('falls back to the multi-sheet service when the product service does not own the job', () => {
      importsServiceMock.getImportStatus.mockImplementation(() => {
        throw new NotFoundException('No se encontró la importacion solicitada');
      });
      multiSheetImportServiceMock.getImportStatus.mockReturnValue({
        jobId: 'full-job',
        sheets: [],
      });

      const result = controller.getImportStatus('full-job', {
        user: { userId: 'cashier-1' },
      });

      expect(importsServiceMock.getImportStatus).toHaveBeenCalledWith(
        'full-job',
        'cashier-1',
      );
      expect(multiSheetImportServiceMock.getImportStatus).toHaveBeenCalledWith(
        'full-job',
        'cashier-1',
      );
      expect(result).toEqual({ jobId: 'full-job', sheets: [] });
    });

    it('returns the product job status when the product service owns it', () => {
      importsServiceMock.getImportStatus.mockReturnValue({
        jobId: 'product-job',
        sheets: [{ sheetId: 'productos' }],
      });

      const result = controller.getImportStatus('product-job', {
        user: { userId: 'cashier-1' },
      });

      expect(
        multiSheetImportServiceMock.getImportStatus,
      ).not.toHaveBeenCalled();
      expect(result.jobId).toBe('product-job');
    });
  });

  describe('sheet-aware retry dispatch', () => {
    it('routes a non-productos sheetId to the multi-sheet service', async () => {
      await controller.retryImportRow(
        'full-job',
        { rowIndex: 5, sheetId: 'clientes', correctedData: { name: 'X' } },
        { user: { userId: 'cashier-1' } },
      );

      expect(multiSheetImportServiceMock.retryImportRow).toHaveBeenCalledWith(
        'full-job',
        'cashier-1',
        { rowIndex: 5, sheetId: 'clientes', correctedData: { name: 'X' } },
      );
      expect(importsServiceMock.retryImportRow).not.toHaveBeenCalled();
    });

    it('routes an omitted sheetId (product-only) to the product service', async () => {
      importsServiceMock.retryImportRow.mockResolvedValue({
        jobId: 'product-job',
      });

      await controller.retryImportRow(
        'product-job',
        { rowIndex: 5, correctedData: { name: 'X' } },
        { user: { userId: 'cashier-1' } },
      );

      expect(importsServiceMock.retryImportRow).toHaveBeenCalledWith(
        'product-job',
        'cashier-1',
        { rowIndex: 5, correctedData: { name: 'X' } },
      );
      expect(multiSheetImportServiceMock.retryImportRow).not.toHaveBeenCalled();
    });
  });
});
