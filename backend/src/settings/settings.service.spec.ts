import { BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;

  const prismaMock = {
    organization: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const cloudinaryMock = {
    uploadImage: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SettingsService(prismaMock as never, cloudinaryMock as never);
  });

  it('find returns settings from organization.settings JSON', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({
      settings: {
        companyName: 'Acme Corp',
        currency: 'USD',
        taxRate: 10,
        receiptPrefix: 'ACME-',
      },
    });

    const result = await service.find('org-1');

    expect(prismaMock.organization.findUnique).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      select: { settings: true },
    });
    expect(result).toEqual({
      companyName: 'Acme Corp',
      currency: 'USD',
      taxRate: 10,
      receiptPrefix: 'ACME-',
    });
  });

  it('find returns empty object when organization has no settings', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ settings: {} });

    const result = await service.find('org-1');

    expect(result).toEqual({});
  });

  it('find returns empty object when organization is not found', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(null);

    const result = await service.find('org-1');

    expect(result).toEqual({});
  });

  it('update persists settings into organization.settings', async () => {
    prismaMock.organization.update.mockResolvedValue({
      id: 'org-1',
      settings: { companyName: 'New Name' },
    });

    const result = await service.update('org-1', {
      companyName: 'New Name',
    } as any);

    expect(prismaMock.organization.update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: { settings: { companyName: 'New Name' } },
    });
    expect(result).toEqual({
      id: 'org-1',
      settings: { companyName: 'New Name' },
    });
  });

  it('uploadLogo uploads image and stores url in organization.settings', async () => {
    const file = { originalname: 'logo.png' } as Express.Multer.File;
    cloudinaryMock.uploadImage.mockResolvedValue(
      'https://cloudinary.com/logo.png',
    );
    prismaMock.organization.update.mockResolvedValue({
      id: 'org-1',
      settings: { logoUrl: 'https://cloudinary.com/logo.png' },
    });

    const result = await service.uploadLogo('org-1', file);

    expect(cloudinaryMock.uploadImage).toHaveBeenCalledWith(file, 'logos');
    expect(prismaMock.organization.update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: {
        settings: {
          logoUrl: 'https://cloudinary.com/logo.png',
        },
      },
    });
    expect(result).toEqual({ logoUrl: 'https://cloudinary.com/logo.png' });
  });

  it('uploadLogo throws BadRequestException when no file is provided', async () => {
    await expect(
      service.uploadLogo('org-1', undefined as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('getDefaultSettings returns fallback values', () => {
    const result = service.getDefaultSettings();

    expect(result).toEqual({
      companyName: 'Mi Negocio',
      currency: 'COP',
      taxRate: 19,
      receiptPrefix: 'REC-',
    });
  });
});
