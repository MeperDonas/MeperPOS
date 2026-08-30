import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgRole } from '@prisma/client';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { ProductsController } from './products.controller';

describe('ProductsController — promotion write authorization', () => {
  const serviceMock = {
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    searchProducts: jest.fn(),
    quickSearch: jest.fn(),
    remove: jest.fn(),
    deactivate: jest.fn(),
    reactivate: jest.fn(),
    getLowStockProducts: jest.fn(),
    uploadImage: jest.fn(),
    uploadProductImage: jest.fn(),
  };

  const createContext = (
    handler: (...args: unknown[]) => unknown,
    role: OrgRole,
  ): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => ProductsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role } }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('restricts product writes (create/update) to ADMIN and MEMBER', () => {
    const controller = new ProductsController(serviceMock as never);

    expect(Reflect.getMetadata(ROLES_KEY, controller.create)).toEqual([
      OrgRole.ADMIN,
      OrgRole.MEMBER,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, controller.update)).toEqual([
      OrgRole.ADMIN,
      OrgRole.MEMBER,
    ]);
  });

  it('denies CASHIER a promotion write through PUT /products/:id (403)', () => {
    const controller = new ProductsController(serviceMock as never);
    const guard = new RolesGuard(new Reflector());

    expect(() =>
      guard.canActivate(createContext(controller.update, OrgRole.CASHIER)),
    ).toThrow(ForbiddenException);
    expect(serviceMock.update).not.toHaveBeenCalled();
  });

  it('allows MEMBER through RolesGuard on product update', () => {
    const controller = new ProductsController(serviceMock as never);
    const guard = new RolesGuard(new Reflector());

    expect(
      guard.canActivate(createContext(controller.update, OrgRole.MEMBER)),
    ).toBe(true);
  });
});

describe('ProductsController — findAll additive params (D5)', () => {
  const serviceMock = { findAll: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards lowStock and orderBy query params to the service', () => {
    const controller = new ProductsController(serviceMock as never);
    const user = { userId: 'u1', organizationId: 'org-1', role: OrgRole.ADMIN };

    controller.findAll(
      user as never,
      1,
      10,
      undefined,
      undefined,
      'active',
      'true',
      'name',
    );

    expect(serviceMock.findAll).toHaveBeenCalledWith(
      'org-1',
      1,
      10,
      undefined,
      undefined,
      'active',
      true,
      'name',
    );
  });

  it('treats any lowStock value other than "true" as absent', () => {
    const controller = new ProductsController(serviceMock as never);
    const user = { userId: 'u1', organizationId: 'org-1', role: OrgRole.ADMIN };

    controller.findAll(
      user as never,
      1,
      10,
      undefined,
      undefined,
      'active',
      'false',
      undefined,
    );

    expect(serviceMock.findAll).toHaveBeenCalledWith(
      'org-1',
      1,
      10,
      undefined,
      undefined,
      'active',
      false,
      undefined,
    );
  });
});
