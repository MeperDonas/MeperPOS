import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgRole } from '@prisma/client';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ProductsSearchController } from './products-search.controller';

describe('ProductsSearchController', () => {
  const prismaMock = {
    product: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createContext = (
    handler: (...args: unknown[]) => unknown,
    role: OrgRole,
  ): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => ProductsSearchController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role } }),
      }),
    }) as unknown as ExecutionContext;

  it('allows CASHIER to search products', () => {
    const requiredRoles = Reflect.getMetadata(
      ROLES_KEY,
      ProductsSearchController.prototype.searchProducts,
    );
    expect(requiredRoles).toContain(OrgRole.CASHIER);
  });

  it('allows CASHIER to quick-search products', () => {
    const requiredRoles = Reflect.getMetadata(
      ROLES_KEY,
      ProductsSearchController.prototype.quickSearch,
    );
    expect(requiredRoles).toContain(OrgRole.CASHIER);
  });

  it('denies unauthorized roles for product search', () => {
    const controller = new ProductsSearchController(prismaMock as never);
    const guard = new RolesGuard(new Reflector());

    expect(() =>
      guard.canActivate(
        createContext(controller.searchProducts, OrgRole.INVENTORY_USER),
      ),
    ).toThrow(ForbiddenException);
  });
});
