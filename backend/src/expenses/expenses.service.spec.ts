import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ExpensesService,
  buildMonthRange,
  deriveExpensePaymentStatus,
} from './expenses.service';

describe('ExpensesService', () => {
  let service: ExpensesService;
  const orgId = 'org-1';
  const userId = 'user-1';

  const txMock = {
    expense: {
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const prismaMock = {
    $transaction: jest.fn(),
    expense: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    expenseCategory: {
      findFirst: jest.fn(),
    },
    supplier: {
      findFirst: jest.fn(),
    },
    purchaseOrder: {
      findFirst: jest.fn(),
    },
  };

  const buildValidCreateDto = () => ({
    categoryId: 'cat-1',
    supplierId: 'sup-1',
    purchaseOrderId: 'po-1',
    description: 'Arriendo agosto',
    date: '2026-08-15',
    total: 500000,
    payments: [{ amount: 500000, method: 'CASH', date: '2026-08-15' }],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof txMock) => unknown) => callback(txMock),
    );
    service = new ExpensesService(prismaMock as never);
  });

  describe('deriveExpensePaymentStatus', () => {
    it('returns PAID when the payments sum equals the total', () => {
      expect(
        deriveExpensePaymentStatus(
          new Prisma.Decimal(500000),
          new Prisma.Decimal(500000),
        ),
      ).toBe('PAID');
    });

    it('returns PARTIAL when the payments sum is lower than the total', () => {
      expect(
        deriveExpensePaymentStatus(
          new Prisma.Decimal(500000),
          new Prisma.Decimal(200000),
        ),
      ).toBe('PARTIAL');
    });

    it('returns PAID when the payments sum covers the total exactly after multiple payments', () => {
      expect(
        deriveExpensePaymentStatus(
          new Prisma.Decimal(500000),
          new Prisma.Decimal(500000.01),
        ),
      ).toBe('PAID');
    });
  });

  describe('buildMonthRange', () => {
    it('maps a YYYY-MM month to Bogota day boundaries', () => {
      const { start, end } = buildMonthRange('2026-08');

      expect(start.toISOString()).toBe('2026-08-01T05:00:00.000Z');
      expect(end.toISOString()).toBe('2026-09-01T04:59:59.999Z');
    });

    it('rejects malformed month strings', () => {
      expect(() => buildMonthRange('2026-8')).toThrow(BadRequestException);
      expect(() => buildMonthRange('nope')).toThrow(BadRequestException);
    });
  });

  describe('create', () => {
    it('creates a PAID expense when the first payment equals the total', async () => {
      prismaMock.expenseCategory.findFirst.mockResolvedValue({ id: 'cat-1' });
      prismaMock.supplier.findFirst.mockResolvedValue({ id: 'sup-1' });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue({ id: 'po-1' });
      txMock.expense.create.mockResolvedValue({ id: 'exp-1', status: 'PAID' });

      const result = await service.create(buildValidCreateDto(), userId, orgId);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      const createArgs = txMock.expense.create.mock.calls[0][0];
      expect(createArgs.data.status).toBe('PAID');
      expect(createArgs.data.total).toEqual(new Prisma.Decimal(500000));
      expect(createArgs.data.createdById).toBe(userId);
      expect(createArgs.data.organizationId).toBe(orgId);
      expect(createArgs.data.payments.create).toHaveLength(1);
      expect(createArgs.data.payments.create[0]).toMatchObject({
        amount: new Prisma.Decimal(500000),
        method: 'CASH',
        date: new Date('2026-08-15'),
        organizationId: orgId,
      });
      expect(txMock.auditLog.create).toHaveBeenCalledTimes(1);
      const auditArgs = txMock.auditLog.create.mock.calls[0][0];
      expect(auditArgs.data).toMatchObject({
        userId,
        action: 'EXPENSE_CREATED',
        resource: 'Expense',
        resourceId: 'exp-1',
        organizationId: orgId,
      });
      expect(result).toEqual({ id: 'exp-1', status: 'PAID' });
    });

    it('creates a PARTIAL expense when the first payment is lower than the total', async () => {
      prismaMock.expenseCategory.findFirst.mockResolvedValue({ id: 'cat-1' });
      prismaMock.supplier.findFirst.mockResolvedValue(null);
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);
      txMock.expense.create.mockResolvedValue({
        id: 'exp-2',
        status: 'PARTIAL',
      });

      const result = await service.create(
        {
          ...buildValidCreateDto(),
          supplierId: undefined,
          purchaseOrderId: undefined,
          payments: [
            { amount: 200000, method: 'TRANSFER', date: '2026-08-15' },
          ],
        },
        userId,
        orgId,
      );

      expect(txMock.expense.create.mock.calls[0][0].data.status).toBe(
        'PARTIAL',
      );
      expect(result.status).toBe('PARTIAL');
    });

    it('rejects zero payments with 400 and never opens a transaction', async () => {
      prismaMock.expenseCategory.findFirst.mockResolvedValue({ id: 'cat-1' });
      prismaMock.supplier.findFirst.mockResolvedValue({ id: 'sup-1' });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue({ id: 'po-1' });

      await expect(
        service.create(
          { ...buildValidCreateDto(), payments: [] },
          userId,
          orgId,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a payment that exceeds the total with 400', async () => {
      prismaMock.expenseCategory.findFirst.mockResolvedValue({ id: 'cat-1' });
      prismaMock.supplier.findFirst.mockResolvedValue({ id: 'sup-1' });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue({ id: 'po-1' });

      await expect(
        service.create(
          {
            ...buildValidCreateDto(),
            payments: [{ amount: 600000, method: 'CASH', date: '2026-08-15' }],
          },
          userId,
          orgId,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a category that does not belong to the organization with 404', async () => {
      prismaMock.expenseCategory.findFirst.mockResolvedValue(null);

      await expect(
        service.create(buildValidCreateDto(), userId, orgId),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a supplier that does not belong to the organization with 404', async () => {
      prismaMock.expenseCategory.findFirst.mockResolvedValue({ id: 'cat-1' });
      prismaMock.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.create(buildValidCreateDto(), userId, orgId),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a purchase order that does not belong to the organization with 404', async () => {
      prismaMock.expenseCategory.findFirst.mockResolvedValue({ id: 'cat-1' });
      prismaMock.supplier.findFirst.mockResolvedValue({ id: 'sup-1' });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.create(buildValidCreateDto(), userId, orgId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when organizationId is missing', async () => {
      await expect(
        service.create(buildValidCreateDto(), userId, undefined),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('paginates active org-scoped expenses with filters and related data', async () => {
      prismaMock.expense.findMany.mockResolvedValue([{ id: 'exp-1' }]);
      prismaMock.expense.count.mockResolvedValue(42);

      const result = await service.findAll(
        {
          page: 2,
          limit: 10,
          month: '2026-08',
          categoryId: 'cat-1',
          supplierId: 'sup-1',
          status: 'PARTIAL',
          search: 'arriendo',
        },
        orgId,
      );

      expect(prismaMock.expense.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          active: true,
          date: {
            gte: new Date('2026-08-01T05:00:00.000Z'),
            lte: new Date('2026-09-01T04:59:59.999Z'),
          },
          categoryId: 'cat-1',
          supplierId: 'sup-1',
          status: 'PARTIAL',
          description: { contains: 'arriendo', mode: 'insensitive' },
        },
        skip: 10,
        take: 10,
        orderBy: { date: 'desc' },
        include: { category: true, supplier: true, payments: true },
      });
      expect(prismaMock.expense.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ organizationId: orgId, active: true }),
      });
      expect(result).toEqual({
        data: [{ id: 'exp-1' }],
        meta: { total: 42, page: 2, limit: 10, totalPages: 5 },
      });
    });

    it('throws BadRequestException when organizationId is missing', async () => {
      await expect(service.findAll({}, undefined)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findOne', () => {
    it('returns the org-scoped expense with payments, category and supplier', async () => {
      prismaMock.expense.findFirst.mockResolvedValue({
        id: 'exp-1',
        organizationId: orgId,
      });

      const result = await service.findOne('exp-1', orgId);

      expect(prismaMock.expense.findFirst).toHaveBeenCalledWith({
        where: { id: 'exp-1', organizationId: orgId },
        include: {
          category: true,
          supplier: true,
          purchaseOrder: true,
          payments: { orderBy: { date: 'asc' } },
        },
      });
      expect(result).toEqual({ id: 'exp-1', organizationId: orgId });
    });

    it('throws NotFoundException for unknown or cross-org ids', async () => {
      prismaMock.expense.findFirst.mockResolvedValue(null);

      await expect(service.findOne('exp-x', orgId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const buildExisting = () => ({
      id: 'exp-1',
      organizationId: orgId,
      total: new Prisma.Decimal(500000),
      status: 'PAID',
      description: 'Arriendo agosto',
      date: new Date('2026-08-15T00:00:00.000Z'),
      payments: [{ id: 'pay-1', amount: new Prisma.Decimal(500000) }],
    });

    it('recomputes status to PARTIAL when the total grows beyond payments', async () => {
      prismaMock.expense.findFirst.mockResolvedValue(buildExisting());
      txMock.expense.update.mockResolvedValue({
        id: 'exp-1',
        status: 'PARTIAL',
        total: new Prisma.Decimal(800000),
        description: 'Arriendo agosto',
        date: new Date('2026-08-15T00:00:00.000Z'),
      });

      const result = await service.update(
        'exp-1',
        { total: 800000 },
        userId,
        orgId,
      );

      expect(txMock.expense.update).toHaveBeenCalledWith({
        where: { id: 'exp-1' },
        data: expect.objectContaining({ status: 'PARTIAL' }),
        include: { category: true, supplier: true, payments: true },
      });
      expect(txMock.auditLog.create).toHaveBeenCalledTimes(1);
      expect(txMock.auditLog.create.mock.calls[0][0].data).toMatchObject({
        userId,
        action: 'EXPENSE_UPDATED',
        resource: 'Expense',
        resourceId: 'exp-1',
        organizationId: orgId,
      });
      expect(result).toEqual({
        id: 'exp-1',
        status: 'PARTIAL',
        total: new Prisma.Decimal(800000),
        description: 'Arriendo agosto',
        date: new Date('2026-08-15T00:00:00.000Z'),
      });
    });

    it('keeps PAID when the total shrinks to the payments sum', async () => {
      prismaMock.expense.findFirst.mockResolvedValue(buildExisting());
      txMock.expense.update.mockResolvedValue({
        id: 'exp-1',
        status: 'PAID',
        total: new Prisma.Decimal(500000),
        description: 'Arriendo agosto',
        date: new Date('2026-08-15T00:00:00.000Z'),
      });

      const result = await service.update(
        'exp-1',
        { total: 500000 },
        userId,
        orgId,
      );

      expect(txMock.expense.update.mock.calls[0][0].data.status).toBe('PAID');
      expect(result.status).toBe('PAID');
    });

    it('rejects a new total below the payments sum with 400', async () => {
      prismaMock.expense.findFirst.mockResolvedValue(buildExisting());

      await expect(
        service.update('exp-1', { total: 400000 }, userId, orgId),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a category that does not belong to the organization with 404', async () => {
      prismaMock.expense.findFirst.mockResolvedValue(buildExisting());
      prismaMock.expenseCategory.findFirst.mockResolvedValue(null);

      await expect(
        service.update('exp-1', { categoryId: 'cat-x' }, userId, orgId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for unknown or cross-org ids', async () => {
      prismaMock.expense.findFirst.mockResolvedValue(null);

      await expect(
        service.update('exp-x', { description: 'Nuevo' }, userId, orgId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft-deletes with active=false and writes an audit log in the same transaction', async () => {
      prismaMock.expense.findFirst.mockResolvedValue({
        id: 'exp-1',
        organizationId: orgId,
        total: new Prisma.Decimal(500000),
      });
      txMock.expense.update.mockResolvedValue({ id: 'exp-1', active: false });

      const result = await service.remove('exp-1', userId, orgId);

      expect(txMock.expense.update).toHaveBeenCalledWith({
        where: { id: 'exp-1' },
        data: { active: false },
      });
      expect(txMock.auditLog.create).toHaveBeenCalledTimes(1);
      expect(txMock.auditLog.create.mock.calls[0][0].data).toMatchObject({
        userId,
        action: 'EXPENSE_DELETED',
        resource: 'Expense',
        resourceId: 'exp-1',
        organizationId: orgId,
      });
      expect(result).toEqual({ id: 'exp-1', active: false });
    });

    it('throws NotFoundException for unknown or cross-org ids', async () => {
      prismaMock.expense.findFirst.mockResolvedValue(null);

      await expect(service.remove('exp-x', userId, orgId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
