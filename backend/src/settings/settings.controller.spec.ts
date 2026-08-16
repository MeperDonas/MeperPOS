import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SettingsController } from './settings.controller';

describe('SettingsController write endpoints', () => {
  const settingsServiceMock = {
    find: jest.fn(),
    getDefaultSettings: jest.fn(),
    update: jest.fn(),
    uploadLogo: jest.fn(),
    updateOrganizationName: jest.fn(),
    updateSalePrefix: jest.fn(),
  };

  const createContext = (
    handler: (...args: unknown[]) => unknown,
    role: string,
    isSuperAdmin = false,
  ): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => SettingsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role, isSuperAdmin } }),
      }),
    }) as unknown as ExecutionContext;

  it('marks updateOrganizationName as org-ADMIN only', () => {
    const controller = new SettingsController(settingsServiceMock as never);

    expect(
      Reflect.getMetadata(ROLES_KEY, controller.updateOrganizationName),
    ).toEqual(['ADMIN']);
  });

  it('marks updateReceiptPrefix as org-ADMIN only', () => {
    const controller = new SettingsController(settingsServiceMock as never);

    expect(
      Reflect.getMetadata(ROLES_KEY, controller.updateReceiptPrefix),
    ).toEqual(['ADMIN']);
  });

  it('allows ADMIN access to updateOrganizationName', () => {
    const controller = new SettingsController(settingsServiceMock as never);
    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(
        createContext(controller.updateOrganizationName, 'ADMIN'),
      ),
    ).toBe(true);
  });

  it('denies CASHIER access to updateReceiptPrefix', () => {
    const controller = new SettingsController(settingsServiceMock as never);
    const guard = new RolesGuard(new Reflector());

    expect(() =>
      guard.canActivate(createContext(controller.updateReceiptPrefix, 'CASHIER')),
    ).toThrow(ForbiddenException);
  });

  it('delegates updateOrganizationName to the service', async () => {
    const controller = new SettingsController(settingsServiceMock as never);
    const dto = { name: 'Acme Corp' };
    const user = { organizationId: 'org-1' } as never;
    const expected = { organization: { name: 'Acme Corp' } };

    settingsServiceMock.updateOrganizationName.mockResolvedValue(expected);

    await expect(
      controller.updateOrganizationName(dto, user),
    ).resolves.toEqual(expected);
    expect(settingsServiceMock.updateOrganizationName).toHaveBeenCalledWith(
      'org-1',
      'Acme Corp',
    );
  });

  it('delegates updateReceiptPrefix to the service', async () => {
    const controller = new SettingsController(settingsServiceMock as never);
    const dto = { prefix: 'REC-' };
    const user = { organizationId: 'org-1' } as never;
    const expected = { receipt: { prefix: 'REC-' } };

    settingsServiceMock.updateSalePrefix.mockResolvedValue(expected);

    await expect(
      controller.updateReceiptPrefix(dto, user),
    ).resolves.toEqual(expected);
    expect(settingsServiceMock.updateSalePrefix).toHaveBeenCalledWith(
      'org-1',
      'REC-',
    );
  });
});
