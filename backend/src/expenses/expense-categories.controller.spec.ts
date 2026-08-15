import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgRole } from '@prisma/client';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ExpenseCategoriesController } from './expense-categories.controller';
import type { RequestUser } from '../common/interfaces/request-user.interface';

describe('ExpenseCategoriesController', () => {
  const serviceMock = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const adminUser: RequestUser = {
    userId: 'user-1',
    email: 'admin@example.com',
    organizationId: 'org-1',
    role: OrgRole.ADMIN,
    tokenVersion: 1,
    isSuperAdmin: false,
  };

  const createContext = (
    handler: (...args: unknown[]) => unknown,
    role: OrgRole,
  ): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => ExpenseCategoriesController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role } }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires ADMIN on every handler', () => {
    const controller = new ExpenseCategoriesController(serviceMock as never);
    const handlers = [
      controller.findAll,
      controller.create,
      controller.update,
      controller.remove,
    ];

    for (const handler of handlers) {
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([OrgRole.ADMIN]);
    }
  });

  it('allows OWNER through RolesGuard because OWNER inherits ADMIN', () => {
    const controller = new ExpenseCategoriesController(serviceMock as never);
    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(createContext(controller.findAll, OrgRole.OWNER)),
    ).toBe(true);
  });

  it('denies CASHIER access through RolesGuard', () => {
    const controller = new ExpenseCategoriesController(serviceMock as never);
    const guard = new RolesGuard(new Reflector());

    expect(() =>
      guard.canActivate(createContext(controller.findAll, OrgRole.CASHIER)),
    ).toThrow(ForbiddenException);
  });

  it('delegates list/create/update/remove with organizationId from token only', async () => {
    const controller = new ExpenseCategoriesController(serviceMock as never);
    const body = { name: 'Servicios' };
    const category = {
      id: 'c1',
      name: 'Servicios',
      organizationId: 'org-1',
    };

    serviceMock.findAll.mockResolvedValue([category]);
    serviceMock.create.mockResolvedValue(category);
    serviceMock.update.mockResolvedValue(category);
    serviceMock.remove.mockResolvedValue({ ...category, active: false });

    await expect(controller.findAll(adminUser)).resolves.toEqual([category]);
    await expect(controller.create(body, adminUser)).resolves.toEqual(category);
    await expect(controller.update('c1', body, adminUser)).resolves.toEqual(
      category,
    );
    await expect(controller.remove('c1', adminUser)).resolves.toEqual({
      ...category,
      active: false,
    });

    expect(serviceMock.findAll).toHaveBeenCalledWith('org-1');
    expect(serviceMock.create).toHaveBeenCalledWith(body, 'org-1');
    expect(serviceMock.update).toHaveBeenCalledWith('c1', body, 'org-1');
    expect(serviceMock.remove).toHaveBeenCalledWith('c1', 'org-1');
  });
});
