import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;

  const prismaMock = {
    organization: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    organizationSequence: {
      findFirst: jest.fn(),
    },
  };

  const cloudinaryMock = {
    uploadImage: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SettingsService(prismaMock as never, cloudinaryMock as never);
  });

  describe('find', () => {
    it('hydrates a full SettingsView from Organization + SALE sequence', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({
        name: 'Acme Corp',
        logoUrl: 'https://cdn/acme.png',
        settings: {
          printHeader: 'Acme - Comprobante',
          printFooter: 'Gracias por su compra',
          downgradeFlags: { usersOverLimit: true },
          custom: { theme: 'dark' },
          legacyKey: 'preserved',
        },
        settingsVersion: 2,
      });
      prismaMock.organizationSequence.findFirst.mockResolvedValue({
        prefix: 'ACME',
      });

      const result = await service.find('org-1');

      expect(prismaMock.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        select: { name: true, logoUrl: true, settings: true, settingsVersion: true },
      });
      expect(prismaMock.organizationSequence.findFirst).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', type: 'SALE' },
        orderBy: { year: 'desc' },
        select: { prefix: true },
      });
      expect(result).toEqual({
        organization: { name: 'Acme Corp', logoUrl: 'https://cdn/acme.png' },
        invoicing: { printHeader: 'Acme - Comprobante', printFooter: 'Gracias por su compra' },
        receipt: { prefix: 'ACME' },
        locale: { currency: 'COP', locale: 'es-CO', timezone: 'America/Bogota' },
        custom: { theme: 'dark', legacyKey: 'preserved' },
      });
    });

    it('falls back to defaults for invalid persisted values (no throw)', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({
        name: 'Acme Corp',
        logoUrl: null,
        settings: { printHeader: 123, printFooter: null },
        settingsVersion: 0,
      });
      prismaMock.organizationSequence.findFirst.mockResolvedValue(null);

      const result = await service.find('org-1');

      expect(result.invoicing).toEqual({ printHeader: '', printFooter: '' });
      expect(result.receipt.prefix).toBeNull();
    });

    it('returns a default view when the organization is not found', async () => {
      prismaMock.organization.findUnique.mockResolvedValue(null);

      const result = await service.find('org-1');

      expect(result).toEqual({
        organization: { name: '', logoUrl: null },
        invoicing: { printHeader: '', printFooter: '' },
        receipt: { prefix: null },
        locale: { currency: 'COP', locale: 'es-CO', timezone: 'America/Bogota' },
        custom: {},
      });
    });

    it('returns a default view without an organizationId and skips the query', async () => {
      const result = await service.find(undefined);

      expect(result.organization.name).toBe('');
      expect(prismaMock.organization.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('merges typed params into existing settings without full-replace', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({
        name: 'Acme Corp',
        logoUrl: null,
        settings: {
          printHeader: 'Old Header',
          downgradeFlags: { usersOverLimit: false },
          custom: { theme: 'light' },
          legacyKey: 'keep-me',
        },
        settingsVersion: 4,
      });
      prismaMock.organization.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.organizationSequence.findFirst.mockResolvedValue({
        prefix: 'ACME',
      });

      const result = await service.update('org-1', {
        printFooter: 'New Footer',
      } as never);

      expect(prismaMock.organization.updateMany).toHaveBeenCalledWith({
        where: { id: 'org-1', settingsVersion: 4 },
        data: {
          settings: {
            printHeader: 'Old Header',
            downgradeFlags: { usersOverLimit: false },
            printFooter: 'New Footer',
            custom: { theme: 'light', legacyKey: 'keep-me' },
          },
          settingsVersion: { increment: 1 },
        },
      });
      expect(result.invoicing.printFooter).toBe('New Footer');
      expect(result.receipt.prefix).toBe('ACME');
    });

    it('overlays custom without dropping existing custom keys', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({
        name: 'Acme Corp',
        logoUrl: null,
        settings: { custom: { theme: 'light' } },
        settingsVersion: 1,
      });
      prismaMock.organization.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.organizationSequence.findFirst.mockResolvedValue(null);

      await service.update('org-1', { custom: { lang: 'es' } } as never);

      expect(prismaMock.organization.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            settings: expect.objectContaining({
              custom: { theme: 'light', lang: 'es' },
            }),
          }),
        }),
      );
    });

    it('rejects writes to the downgradeFlags system key', async () => {
      await expect(
        service.update('org-1', {
          downgradeFlags: { usersOverLimit: true },
        } as never),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaMock.organization.findUnique).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the optimistic lock detects a concurrent write', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({
        name: 'Acme Corp',
        logoUrl: null,
        settings: {},
        settingsVersion: 2,
      });
      prismaMock.organization.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.update('org-1', { printHeader: 'X' } as never),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws NotFoundException when the organization does not exist', async () => {
      prismaMock.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.update('org-1', { printHeader: 'X' } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException without an organizationId', async () => {
      await expect(
        service.update(undefined, {} as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('uploadLogo', () => {
    it('writes the URL to Organization.logoUrl (top-level)', async () => {
      const file = { originalname: 'logo.png' } as Express.Multer.File;
      cloudinaryMock.uploadImage.mockResolvedValue('https://cdn/logo.png');
      prismaMock.organization.update.mockResolvedValue({
        id: 'org-1',
        logoUrl: 'https://cdn/logo.png',
      });

      const result = await service.uploadLogo('org-1', file);

      expect(cloudinaryMock.uploadImage).toHaveBeenCalledWith(file, 'logos');
      expect(prismaMock.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { logoUrl: 'https://cdn/logo.png' },
      });
      expect(result).toEqual({ logoUrl: 'https://cdn/logo.png' });
    });

    it('throws BadRequestException when no file is provided', async () => {
      await expect(
        service.uploadLogo('org-1', undefined as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException without an organizationId', async () => {
      await expect(
        service.uploadLogo(undefined, {} as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getDefaultSettings', () => {
    it('returns the defaults registry as a SettingsView', () => {
      expect(service.getDefaultSettings()).toEqual({
        organization: { name: '', logoUrl: null },
        invoicing: { printHeader: '', printFooter: '' },
        receipt: { prefix: null },
        locale: { currency: 'COP', locale: 'es-CO', timezone: 'America/Bogota' },
        custom: {},
      });
    });
  });
});
