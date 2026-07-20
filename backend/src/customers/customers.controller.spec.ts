import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgRole } from '@prisma/client';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CustomersController } from './customers.controller';
import type { RequestUser } from '../common/interfaces/request-user.interface';

describe('CustomersController', () => {
  const customersServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByDocumentNumber: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const cashierUser: RequestUser = {
    userId: 'cashier-1',
    email: 'cashier@example.com',
    organizationId: 'org-1',
    role: OrgRole.CASHIER,
    tokenVersion: 1,
    isSuperAdmin: false,
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
      getClass: () => CustomersController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role } }),
      }),
    }) as unknown as ExecutionContext;

  it('allows CASHIER to create customers', () => {
    const requiredRoles = Reflect.getMetadata(
      ROLES_KEY,
      CustomersController.prototype.create,
    );
    expect(requiredRoles).toContain(OrgRole.CASHIER);
  });

  it('allows CASHIER to list customers', () => {
    const requiredRoles = Reflect.getMetadata(
      ROLES_KEY,
      CustomersController.prototype.findAll,
    );
    expect(requiredRoles).toContain(OrgRole.CASHIER);
  });

  it('allows CASHIER to find a customer by document number', () => {
    const requiredRoles = Reflect.getMetadata(
      ROLES_KEY,
      CustomersController.prototype.findByDocumentNumber,
    );
    expect(requiredRoles).toContain(OrgRole.CASHIER);
  });

  it('allows CASHIER to get a customer by id', () => {
    const requiredRoles = Reflect.getMetadata(
      ROLES_KEY,
      CustomersController.prototype.findOne,
    );
    expect(requiredRoles).toContain(OrgRole.CASHIER);
  });

  it('denies CASHIER access to update customers', () => {
    const controller = new CustomersController(customersServiceMock as never);
    const guard = new RolesGuard(new Reflector());

    expect(() =>
      guard.canActivate(createContext(controller.update, OrgRole.CASHIER)),
    ).toThrow(ForbiddenException);
  });

  it('denies CASHIER access to delete customers', () => {
    const controller = new CustomersController(customersServiceMock as never);
    const guard = new RolesGuard(new Reflector());

    expect(() =>
      guard.canActivate(createContext(controller.remove, OrgRole.CASHIER)),
    ).toThrow(ForbiddenException);
  });

  it('delegates customer creation with organizationId', async () => {
    const controller = new CustomersController(customersServiceMock as never);
    const createCustomerDto = {
      name: 'Walk-in Customer',
      documentType: 'CC' as const,
      documentNumber: '123456',
      email: 'walkin@example.com',
      phone: '3000000000',
      address: '',
      segment: 'OCCASIONAL' as const,
    };
    const expected = { id: 'customer-1', ...createCustomerDto };

    customersServiceMock.create.mockResolvedValue(expected);

    const result = await controller.create(createCustomerDto, cashierUser);

    expect(result).toEqual(expected);
    expect(customersServiceMock.create).toHaveBeenCalledWith(
      createCustomerDto,
      'org-1',
    );
  });
});
