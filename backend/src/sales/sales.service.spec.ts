import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SalesService } from './sales.service';

describe('SalesService', () => {
  let service: SalesService;

  const sequenceServiceMock = {
    nextNumber: jest.fn(),
  };

  const prismaMock = {
    $transaction: jest.fn(),
    sale: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
    },
  };

  const cacheMock = {
    clear: jest.fn(),
  };

  const settingsServiceMock = {
    find: jest.fn(),
  };

  const mockUser = (
    overrides: Partial<{
      userId: string;
      role: 'ADMIN' | 'MEMBER' | 'OWNER';
      organizationId: string;
    }> = {},
  ) => ({
    userId: 'user-1',
    email: 'user@example.com',
    organizationId: 'org-1',
    role: 'MEMBER' as const,
    tokenVersion: 1,
    isSuperAdmin: false,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SalesService(
      prismaMock as never,
      cacheMock as never,
      settingsServiceMock as never,
      sequenceServiceMock as never,
    );
  });

  // ---- existing tests preserved ----

  it('applies own-sales scope for MEMBER in list queries', async () => {
    prismaMock.sale.findMany.mockResolvedValue([
      {
        id: 'sale-1',
        userId: 'cashier-1',
        user: { id: 'cashier-1', name: 'Caja', email: 'caja@example.com' },
        customer: null,
        items: [],
        payments: [],
      },
    ]);
    prismaMock.sale.count.mockResolvedValue(1);

    const result = await service.findAll(
      'org-1',
      1,
      10,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockUser({ userId: 'cashier-1', role: 'MEMBER' }),
    );

    expect(prismaMock.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'cashier-1',
          organizationId: 'org-1',
        }),
        include: expect.objectContaining({
          user: { select: { id: true, name: true, email: true } },
        }),
      }),
    );
    expect(result.data[0].user).toEqual({
      id: 'cashier-1',
      name: 'Caja',
      email: 'caja@example.com',
    });
  });

  it('applies customerId filter in list queries', async () => {
    prismaMock.sale.findMany.mockResolvedValue([
      {
        id: 'sale-1',
        customerId: 'customer-1',
        userId: 'admin-1',
        user: { id: 'admin-1', name: 'Admin', email: 'admin@example.com' },
        customer: { id: 'customer-1', name: 'Ana Perez' },
        items: [],
        payments: [],
      },
    ]);
    prismaMock.sale.count.mockResolvedValue(1);

    await service.findAll(
      'org-1',
      1,
      10,
      undefined,
      undefined,
      undefined,
      undefined,
      'customer-1',
      mockUser({ userId: 'admin-1', role: 'ADMIN' }),
    );

    expect(prismaMock.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          customerId: 'customer-1',
          organizationId: 'org-1',
        }),
      }),
    );
    expect(prismaMock.sale.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        customerId: 'customer-1',
        organizationId: 'org-1',
      }),
    });
  });

  it('combines customerId filter with MEMBER scope', async () => {
    prismaMock.sale.findMany.mockResolvedValue([
      {
        id: 'sale-1',
        customerId: 'customer-1',
        userId: 'cashier-1',
        user: { id: 'cashier-1', name: 'Caja', email: 'caja@example.com' },
        customer: { id: 'customer-1', name: 'Ana Perez' },
        items: [],
        payments: [],
      },
    ]);
    prismaMock.sale.count.mockResolvedValue(1);

    await service.findAll(
      'org-1',
      1,
      10,
      undefined,
      undefined,
      undefined,
      undefined,
      'customer-1',
      mockUser({ userId: 'cashier-1', role: 'MEMBER' }),
    );

    expect(prismaMock.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'cashier-1',
          customerId: 'customer-1',
          organizationId: 'org-1',
        }),
      }),
    );
    expect(prismaMock.sale.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: 'cashier-1',
        customerId: 'customer-1',
        organizationId: 'org-1',
      }),
    });
  });

  it('returns no foreign sales when a customer has no purchases in member scope', async () => {
    prismaMock.sale.findMany.mockResolvedValue([]);
    prismaMock.sale.count.mockResolvedValue(0);

    const result = await service.findAll(
      'org-1',
      1,
      10,
      undefined,
      undefined,
      undefined,
      undefined,
      'customer-without-sales',
      mockUser({ userId: 'cashier-1', role: 'MEMBER' }),
    );

    expect(prismaMock.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'cashier-1',
          customerId: 'customer-without-sales',
          organizationId: 'org-1',
        }),
      }),
    );
    expect(result).toEqual({
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      },
    });
  });

  it('denies MEMBER access to another seller sale detail', async () => {
    prismaMock.sale.findFirst.mockResolvedValue({
      id: 'sale-foreign',
      userId: 'admin-1',
      user: { id: 'admin-1', name: 'Admin', email: 'admin@example.com' },
      customer: null,
      items: [],
      payments: [],
    });

    await expect(
      service.findOne(
        'sale-foreign',
        'org-1',
        mockUser({ userId: 'cashier-1', role: 'MEMBER' }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('[#15] allows MEMBER drill-down for own sale detail', async () => {
    prismaMock.sale.findFirst.mockResolvedValue({
      id: 'sale-own',
      userId: 'cashier-1',
      user: { id: 'cashier-1', name: 'Caja', email: 'caja@example.com' },
      customer: null,
      items: [],
      payments: [],
    });

    await expect(
      service.findOne(
        'sale-own',
        'org-1',
        mockUser({ userId: 'cashier-1', role: 'MEMBER' }),
      ),
    ).resolves.toEqual(
      expect.objectContaining({ id: 'sale-own', userId: 'cashier-1' }),
    );
  });

  it('[#15] allows ADMIN drill-down for any sale detail', async () => {
    prismaMock.sale.findFirst.mockResolvedValue({
      id: 'sale-foreign',
      userId: 'cashier-2',
      user: { id: 'cashier-2', name: 'Otra Caja', email: 'otra@example.com' },
      customer: null,
      items: [],
      payments: [],
    });

    await expect(
      service.findOne(
        'sale-foreign',
        'org-1',
        mockUser({ userId: 'admin-1', role: 'ADMIN' }),
      ),
    ).resolves.toEqual(
      expect.objectContaining({ id: 'sale-foreign', userId: 'cashier-2' }),
    );
  });

  // ---- new tests for T5.1 ----

  it('create uses Serializable transaction and assigns saleNumber from SequenceService', async () => {
    const txMock = {
      sale: { create: jest.fn() },
      saleItem: { create: jest.fn() },
      product: {
        findUnique: jest.fn().mockResolvedValue({ stock: 10 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      inventoryMovement: { create: jest.fn() },
      payment: { create: jest.fn() },
    };

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown, _options: unknown) => {
        return callback(txMock);
      },
    );

    sequenceServiceMock.nextNumber.mockResolvedValue({
      number: 42,
      formatted: '42',
    });
    prismaMock.product.findUnique.mockResolvedValue({
      id: 'prod-1',
      name: 'Test Product',
      active: true,
      salePrice: 100,
      taxRate: 19,
      stock: 10,
      category: { defaultTaxRate: null },
    });
    prismaMock.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
    txMock.sale.create.mockResolvedValue({ id: 'sale-new', saleNumber: 42 });

    // Mock findOne call inside create
    prismaMock.sale.findFirst.mockResolvedValue({
      id: 'sale-new',
      saleNumber: 42,
      userId: 'user-1',
      user: { id: 'user-1', name: 'User', email: 'user@example.com' },
      customer: null,
      items: [],
      payments: [],
    });

    const createSaleDto = {
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 1, discountAmount: 0 }],
      discountAmount: 0,
      payments: [{ method: 'CASH' as const, amount: 119 }],
    };

    await service.create(createSaleDto, 'user-1', 'org-1');

    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      }),
    );

    expect(sequenceServiceMock.nextNumber).toHaveBeenCalledWith(
      expect.anything(),
      'org-1',
      'SALE',
      new Date().getFullYear(),
    );

    expect(txMock.sale.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          saleNumber: 42,
          userId: 'user-1',
        }),
      }),
    );
  });

  it('create throws ServiceUnavailableException on P2028 transaction timeout', async () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Transaction timeout',
      {
        code: 'P2028',
        clientVersion: '6.0.0',
      },
    );
    prismaMock.$transaction.mockRejectedValue(error);
    prismaMock.product.findUnique.mockResolvedValue({
      id: 'prod-1',
      name: 'Test Product',
      active: true,
      salePrice: 100,
      taxRate: 19,
      stock: 10,
      category: { defaultTaxRate: null },
    });
    prismaMock.customer.findUnique.mockResolvedValue({ id: 'cust-1' });

    const createSaleDto = {
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 1, discountAmount: 0 }],
      discountAmount: 0,
      payments: [{ method: 'CASH' as const, amount: 119 }],
    };

    await expect(
      service.create(createSaleDto, 'user-1', 'org-1'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('findOne returns sale scoped by organizationId', async () => {
    prismaMock.sale.findFirst.mockResolvedValue({
      id: 'sale-1',
      organizationId: 'org-1',
      userId: 'user-1',
      user: { id: 'user-1', name: 'User', email: 'user@example.com' },
      customer: null,
      items: [],
      payments: [],
    });

    const result = await service.findOne('sale-1', 'org-1');

    expect(prismaMock.sale.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sale-1', organizationId: 'org-1' },
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ id: 'sale-1', organizationId: 'org-1' }),
    );
  });

  it('update validates ownership with organizationId and applies cancel fields', async () => {
    const txMock = {
      product: {
        findUnique: jest.fn().mockResolvedValue({ stock: 5 }),
        update: jest.fn(),
      },
      inventoryMovement: { create: jest.fn() },
      sale: { update: jest.fn() },
    };

    prismaMock.sale.findFirst
      .mockResolvedValueOnce({
        id: 'sale-1',
        status: 'COMPLETED',
        userId: 'user-1',
        organizationId: 'org-1',
        saleNumber: 10,
        items: [
          {
            id: 'si-1',
            productId: 'prod-1',
            quantity: 2,
          },
        ],
      })
      .mockResolvedValueOnce({
        id: 'sale-1',
        status: 'CANCELLED',
        userId: 'user-1',
        organizationId: 'org-1',
        saleNumber: 10,
        cancelledAt: new Date(),
        cancelledById: 'user-1',
        cancelReason: 'Cliente arrepentido',
        items: [],
        payments: [],
        customer: null,
        user: { id: 'user-1', name: 'User', email: 'user@example.com' },
      });

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => {
        return callback(txMock);
      },
    );

    const result = await service.update(
      'sale-1',
      { status: 'CANCELLED', cancelReason: 'Cliente arrepentido' },
      'user-1',
      'org-1',
    );

    expect(prismaMock.sale.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sale-1', organizationId: 'org-1' },
      }),
    );

    expect(txMock.sale.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CANCELLED',
          cancelledAt: expect.any(Date),
          cancelledById: 'user-1',
          cancelReason: 'Cliente arrepentido',
        }),
      }),
    );
  });
});
