import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoansService } from './loans.service';
import { CounterpartyType, CreateLoanDto } from './dto/create-loan.dto';

const dto: CreateLoanDto = {
  amount: 120.25,
  issuedAt: '2026-10-09',
  dueAt: '2026-11-09',
  reason: '  Anticipo  ',
  counterpartyType: CounterpartyType.CUSTOMER,
  counterpartyId: '00000000-0000-4000-8000-000000000001',
};

const objectContaining = (sample: Record<string, unknown>): unknown =>
  expect.objectContaining(sample) as unknown;

function fixture() {
  const tx = {
    customer: {
      findFirst: jest.fn().mockResolvedValue({ id: dto.counterpartyId }),
    },
    supplier: {
      findFirst: jest.fn().mockResolvedValue({ id: dto.counterpartyId }),
    },
    organizationUser: {
      findFirst: jest.fn().mockResolvedValue({ userId: dto.counterpartyId }),
    },
    moneyLoan: {
      create: jest
        .fn<
          Promise<{
            id: string;
            amount: Prisma.Decimal;
            status: string;
            version: number;
            events: never[];
          }>,
          [Prisma.MoneyLoanCreateArgs]
        >()
        .mockResolvedValue({
          id: 'loan',
          amount: new Prisma.Decimal(120.25),
          status: 'OPEN',
          version: 0,
          events: [],
        }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    moneyLoanEvent: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    ...tx,
    customer: { findFirst: jest.fn() },
    supplier: { findFirst: jest.fn() },
    organizationUser: { findFirst: jest.fn() },
    moneyLoan: { ...tx.moneyLoan, create: jest.fn() },
    moneyLoanEvent: { ...tx.moneyLoanEvent, create: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };
  return {
    tx,
    prisma,
    service: new LoansService(prisma as unknown as PrismaService),
  };
}

describe('LoansService creation', () => {
  it.each(Object.values(CounterpartyType))(
    'validates %s inside the creation transaction',
    async (type) => {
      const { service, tx, prisma } = fixture();
      await service.create(
        { ...dto, counterpartyType: type },
        'actor',
        'org-a',
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.customer.findFirst).not.toHaveBeenCalled();
      expect(prisma.supplier.findFirst).not.toHaveBeenCalled();
      expect(prisma.organizationUser.findFirst).not.toHaveBeenCalled();
      expect(prisma.moneyLoan.create).not.toHaveBeenCalled();
      expect(prisma.moneyLoanEvent.create).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
      if (type === CounterpartyType.EMPLOYEE) {
        expect(tx.organizationUser.findFirst).toHaveBeenCalledWith({
          where: {
            userId: dto.counterpartyId,
            organizationId: 'org-a',
            user: { active: true },
          },
          select: { userId: true },
        });
      } else {
        const delegate =
          type === CounterpartyType.CUSTOMER ? tx.customer : tx.supplier;
        expect(delegate.findFirst).toHaveBeenCalledWith({
          where: {
            id: dto.counterpartyId,
            organizationId: 'org-a',
            active: true,
          },
          select: { id: true },
        });
      }
      expect(tx.moneyLoan.create).toHaveBeenCalledWith(
        objectContaining({
          data: objectContaining({
            organizationId: 'org-a',
            createdById: 'actor',
            reason: 'Anticipo',
            amount: new Prisma.Decimal(120.25),
          }),
          select: objectContaining({
            employee: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } },
          }),
        }),
      );
      const data = tx.moneyLoan.create.mock.calls[0][0].data;
      expect(
        [data.customerId, data.supplierId, data.employeeId].filter(Boolean),
      ).toEqual([dto.counterpartyId]);
      expect(tx.moneyLoanEvent.create).toHaveBeenCalledWith({
        data: {
          loanId: 'loan',
          organizationId: 'org-a',
          createdById: 'actor',
          type: 'CREATED',
          reason: 'Anticipo',
        },
      });
      expect(tx.auditLog.create).toHaveBeenCalledWith({
        data: objectContaining({
          organizationId: 'org-a',
          userId: 'actor',
          action: 'LOAN_CREATED',
          resource: 'MoneyLoan',
          resourceId: 'loan',
          metadata: objectContaining({
            amount: '120.25',
            reason: 'Anticipo',
          }),
        }),
      });
    },
  );

  const invalidParties = Object.values(CounterpartyType).flatMap((type) =>
    ['missing', 'foreign', 'inactive'].map((state) => ({ type, state })),
  );
  it.each(invalidParties)(
    'rejects $type counterparties that are $state',
    async ({ type, state }) => {
      const { service, tx } = fixture();
      const party = {
        id: dto.counterpartyId,
        organizationId: state === 'foreign' ? 'org-b' : 'org-a',
        active: state !== 'inactive',
      };
      // These doubles apply the requested filter instead of always returning null.
      const findParty = ({
        where,
      }: {
        where: { id: string; organizationId: string; active: boolean };
      }) =>
        state !== 'missing' &&
        where.id === party.id &&
        where.organizationId === party.organizationId &&
        where.active === party.active
          ? { id: party.id }
          : null;
      tx.customer.findFirst.mockImplementation(findParty);
      tx.supplier.findFirst.mockImplementation(findParty);
      tx.organizationUser.findFirst.mockImplementation(
        ({
          where,
        }: {
          where: {
            userId: string;
            organizationId: string;
            user: { active: boolean };
          };
        }) =>
          findParty({
            where: {
              id: where.userId,
              organizationId: where.organizationId,
              active: where.user.active,
            },
          }),
      );
      await expect(
        service.create({ ...dto, counterpartyType: type }, 'actor', 'org-a'),
      ).rejects.toThrow(BadRequestException);
      expect(tx.moneyLoan.create).not.toHaveBeenCalled();
      expect(tx.moneyLoanEvent.create).not.toHaveBeenCalled();
      expect(tx.auditLog.create).not.toHaveBeenCalled();
    },
  );

  it.each(['moneyLoan', 'moneyLoanEvent', 'auditLog'] as const)(
    'propagates %s persistence failure instead of returning success',
    async (delegate) => {
      const { service, tx } = fixture();
      tx[delegate].create.mockRejectedValue(new Error('write failed'));
      await expect(service.create(dto, 'actor', 'org-a')).rejects.toThrow(
        'write failed',
      );
      if (delegate === 'moneyLoan') {
        expect(tx.moneyLoanEvent.create).not.toHaveBeenCalled();
      }
      if (delegate !== 'auditLog') {
        expect(tx.auditLog.create).not.toHaveBeenCalled();
      }
    },
  );

  it('rejects reversed dates before writing', async () => {
    const { service, tx } = fixture();
    await expect(
      service.create({ ...dto, dueAt: '2026-10-08' }, 'actor', 'org-a'),
    ).rejects.toThrow(BadRequestException);
    expect(tx.moneyLoan.create).not.toHaveBeenCalled();
  });

  it('allows same-day maturity and an omitted due date', async () => {
    const { service, tx } = fixture();
    await service.create({ ...dto, dueAt: dto.issuedAt }, 'actor', 'org-a');
    await service.create({ ...dto, dueAt: undefined }, 'actor', 'org-a');
    expect(tx.moneyLoan.create).toHaveBeenLastCalledWith(
      objectContaining({
        data: objectContaining({ dueAt: null }),
      }),
    );
  });
});

describe('LoansService tenant reads', () => {
  it('scopes list and count and bounds pagination', async () => {
    const { service, tx } = fixture();
    const rows = [
      {
        id: 'loan-a',
        organizationId: 'org-a',
        amount: new Prisma.Decimal('120.25'),
        status: 'OPEN',
        events: [],
      },
      {
        id: 'loan-b',
        organizationId: 'org-b',
        amount: new Prisma.Decimal('120.25'),
        status: 'OPEN',
        events: [],
      },
    ];
    type Filter = { where: { organizationId: string } };
    tx.moneyLoan.findMany.mockImplementation(
      ({ where, skip, take }: Filter & { skip: number; take: number }) =>
        Promise.resolve(
          rows
            .filter((row) => row.organizationId === where.organizationId)
            .slice(skip, skip + take),
        ),
    );
    tx.moneyLoan.count.mockImplementation(({ where }: Filter) =>
      Promise.resolve(
        rows.filter((row) => row.organizationId === where.organizationId)
          .length,
      ),
    );
    expect(await service.findAll({}, 'org-a')).toEqual({
      data: [
        {
          id: 'loan-a',
          organizationId: 'org-a',
          amount: rows[0].amount,
          status: 'OPEN',
          balance: '120.25',
          collected: '0.00',
          paymentStatus: 'UNPAID',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    expect(await service.findAll({ page: 2, limit: 10 }, 'org-a')).toEqual({
      data: [],
      total: 1,
      page: 2,
      limit: 10,
      totalPages: 1,
    });
    expect(tx.moneyLoan.findMany).toHaveBeenLastCalledWith(
      objectContaining({
        where: { organizationId: 'org-a' },
        skip: 10,
        take: 10,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(tx.moneyLoan.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-a' },
    });
    await service.findAll({ limit: 1000 }, 'org-a');
    expect(tx.moneyLoan.findMany).toHaveBeenLastCalledWith(
      objectContaining({ take: 100 }),
    );
  });

  it.each(['missing', 'foreign'])(
    'returns 404 for %s detail and history',
    async (state) => {
      const { service, tx } = fixture();
      const foreign = { id: 'loan-b', organizationId: 'org-b' };
      tx.moneyLoan.findFirst.mockImplementation(
        ({ where }: { where: { id: string; organizationId: string } }) =>
          Promise.resolve(
            state !== 'missing' &&
              where.id === foreign.id &&
              where.organizationId === foreign.organizationId
              ? foreign
              : null,
          ),
      );
      await expect(service.findOne('loan-b', 'org-a')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getHistory('loan-b', {}, 'org-a')).rejects.toThrow(
        NotFoundException,
      );
      expect(tx.moneyLoan.findFirst).toHaveBeenCalledWith(
        objectContaining({
          where: { id: 'loan-b', organizationId: 'org-a' },
        }),
      );
      expect(tx.moneyLoanEvent.findMany).not.toHaveBeenCalled();
    },
  );

  it('scopes and paginates history with safe actor projection', async () => {
    const { service, tx } = fixture();
    tx.moneyLoan.findFirst.mockResolvedValue({
      id: 'loan',
      amount: new Prisma.Decimal('120.25'),
      status: 'OPEN',
      events: [],
    });
    expect(await service.findOne('loan', 'org-a')).toEqual({
      id: 'loan',
      amount: new Prisma.Decimal('120.25'),
      status: 'OPEN',
      balance: '120.25',
      collected: '0.00',
      paymentStatus: 'UNPAID',
    });
    await service.getHistory('loan', { page: 2, limit: 5 }, 'org-a');
    expect(tx.moneyLoanEvent.findMany).toHaveBeenCalledWith(
      objectContaining({
        where: { loanId: 'loan', organizationId: 'org-a' },
        skip: 5,
        take: 5,
        select: objectContaining({
          createdBy: { select: { id: true, name: true } },
        }),
      }),
    );
    expect(tx.moneyLoanEvent.count).toHaveBeenCalledWith({
      where: { loanId: 'loan', organizationId: 'org-a' },
    });
  });

  it('ignores a query tenant selector for normal scoped reads', async () => {
    const { service, tx } = fixture();
    await service.findAll({ organizationId: 'org-b' }, 'org-a');
    expect(tx.moneyLoan.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-a' },
    });
  });

  it('fails closed without organization scope', async () => {
    const { service, prisma } = fixture();
    await expect(service.create(dto, 'actor', undefined)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.findAll({}, undefined)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.findOne('loan', undefined)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.getHistory('loan', {}, undefined)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
