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

  describe('promotion parity', () => {
    const user = { userId: 'user-1', organizationId: 'org-1', role: OrgRole.CASHIER };

    const promoRow = {
      id: 'prod-1',
      name: 'Promo Donut',
      sku: 'DNT-001',
      barcode: '7701234567890',
      salePrice: 10000,
      stock: 10,
      minStock: 2,
      imageUrl: null,
      category: { id: 'cat-1', name: 'Donuts' },
      promotionType: 'PERCENTAGE',
      promotionValue: 20,
    };

    it('search results carry promotion fields and the derived effective price', async () => {
      prismaMock.product.findMany.mockResolvedValue([promoRow]);
      const controller = new ProductsSearchController(prismaMock as never);

      const result = await controller.searchProducts(user, 'donut');

      expect(
        prismaMock.product.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            promotionType: true,
            promotionValue: true,
          }),
        }),
      );
      expect(result.data[0]).toEqual(
        expect.objectContaining({
          promotionType: 'PERCENTAGE',
          promotionValue: 20,
          effectiveSalePrice: 8000,
        }),
      );
    });

    it('quick-search results carry promotion fields and the derived effective price', async () => {
      prismaMock.product.findFirst.mockResolvedValue(promoRow);
      const controller = new ProductsSearchController(prismaMock as never);

      const result = await controller.quickSearch(user, '7701234567890');

      expect(
        prismaMock.product.findFirst,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            promotionType: true,
            promotionValue: true,
          }),
        }),
      );
      expect(result.data).toEqual(
        expect.objectContaining({
          promotionType: 'PERCENTAGE',
          promotionValue: 20,
          effectiveSalePrice: 8000,
        }),
      );
    });

    it('exposes a null effectiveSalePrice for products without an active promotion', async () => {
      prismaMock.product.findFirst.mockResolvedValue({
        ...promoRow,
        promotionType: null,
        promotionValue: null,
      });
      const controller = new ProductsSearchController(prismaMock as never);

      const result = await controller.quickSearch(user, '7701234567890');

      expect(result.data.effectiveSalePrice).toBeNull();
    });
  });
});
