import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminController } from './admin.controller';

describe('AdminController', () => {
  const adminServiceMock = {
    createOrganization: jest.fn(),
    findAllOrganizations: jest.fn(),
    findOrganizationById: jest.fn(),
    updateStatus: jest.fn(),
    updatePlan: jest.fn(),
    getMetrics: jest.fn(),
  };

  const createContext = (
    handler: (...args: unknown[]) => unknown,
    role: string,
    isSuperAdmin = false,
  ): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => AdminController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role, isSuperAdmin } }),
      }),
    }) as unknown as ExecutionContext;

  it('marks the controller as SUPER_ADMIN-only', () => {
    const requiredRoles = Reflect.getMetadata(ROLES_KEY, AdminController);

    expect(requiredRoles).toEqual(['SUPER_ADMIN']);
  });

  it('denies non-super-admin access', () => {
    const controller = new AdminController(adminServiceMock as never);
    const guard = new RolesGuard(new Reflector());

    expect(() =>
      guard.canActivate(createContext(controller.getMetrics, 'ADMIN')),
    ).toThrow(ForbiddenException);
  });

  it('allows SuperAdmin access', () => {
    const controller = new AdminController(adminServiceMock as never);
    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(
        createContext(controller.getMetrics, 'SUPER_ADMIN', true),
      ),
    ).toBe(true);
  });

  it('delegates createOrganization to the service', async () => {
    const controller = new AdminController(adminServiceMock as never);
    const dto = {
      name: 'New Org',
      slug: 'new-org',
      plan: 'BASIC' as const,
    };
    const expected = { organization: { id: 'org-1' } };

    adminServiceMock.createOrganization.mockResolvedValue(expected);

    await expect(controller.createOrganization(dto)).resolves.toEqual(expected);
    expect(adminServiceMock.createOrganization).toHaveBeenCalledWith(dto);
  });

  it('delegates findAllOrganizations to the service', async () => {
    const controller = new AdminController(adminServiceMock as never);
    const expected = [{ id: 'org-1', name: 'Org One' }];

    adminServiceMock.findAllOrganizations.mockResolvedValue(expected);

    await expect(controller.findAllOrganizations()).resolves.toEqual(expected);
    expect(adminServiceMock.findAllOrganizations).toHaveBeenCalled();
  });

  it('delegates findOrganizationById to the service', async () => {
    const controller = new AdminController(adminServiceMock as never);
    const expected = { id: 'org-1', name: 'Org One' };

    adminServiceMock.findOrganizationById.mockResolvedValue(expected);

    await expect(controller.findOrganizationById('org-1')).resolves.toEqual(
      expected,
    );
    expect(adminServiceMock.findOrganizationById).toHaveBeenCalledWith('org-1');
  });

  it('delegates updateStatus to the service', async () => {
    const controller = new AdminController(adminServiceMock as never);
    const dto = { status: 'SUSPENDED' as const };
    const expected = { id: 'org-1', status: 'SUSPENDED' };

    adminServiceMock.updateStatus.mockResolvedValue(expected);

    await expect(controller.updateStatus('org-1', dto)).resolves.toEqual(
      expected,
    );
    expect(adminServiceMock.updateStatus).toHaveBeenCalledWith('org-1', dto);
  });

  it('delegates updatePlan to the service', async () => {
    const controller = new AdminController(adminServiceMock as never);
    const dto = { plan: 'PRO' as const };
    const expected = { id: 'org-1', plan: 'PRO' };

    adminServiceMock.updatePlan.mockResolvedValue(expected);

    await expect(controller.updatePlan('org-1', dto)).resolves.toEqual(
      expected,
    );
    expect(adminServiceMock.updatePlan).toHaveBeenCalledWith('org-1', dto);
  });

  it('delegates getMetrics to the service', async () => {
    const controller = new AdminController(adminServiceMock as never);
    const expected = { totalOrganizations: 5 };

    adminServiceMock.getMetrics.mockResolvedValue(expected);

    await expect(controller.getMetrics()).resolves.toEqual(expected);
    expect(adminServiceMock.getMetrics).toHaveBeenCalled();
  });
});
