import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  RequestMethod,
} from '@nestjs/common';
import { OrgRole, Prisma } from '@prisma/client';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { LoansController } from './loans.controller';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePosLoanDto } from './dto/create-pos-loan.dto';
import { LoansService } from './loans.service';

const actor = (role: RequestUser['role'] = 'CASHIER'): RequestUser => ({
  userId: 'actor',
  email: 'actor@example.test',
  organizationId: 'org',
  role,
  isSuperAdmin: role === 'SUPER_ADMIN',
  tokenVersion: 0,
});
const request = (
  changes: Partial<CreatePosLoanDto> = {},
): CreatePosLoanDto => ({
  customerId: 'c1419db5-591b-4ba6-a926-846d95628ad6',
  requestKey: 'pos-key',
  issuedAt: '2026-10-13',
  dueAt: '2026-11-13',
  reason: 'Compra financiada',
  items: [{ productId: 'coffee', quantity: 2, discountAmount: 10 }],
  ...changes,
});
const product = (id = 'coffee') => ({
  id,
  organizationId: 'org',
  name: 'Coffee',
  active: true,
  type: 'PRODUCT',
  tracksStock: true,
  stock: 12,
  reservedStock: 3,
  version: 7,
  costPrice: new Prisma.Decimal(40),
  salePrice: new Prisma.Decimal(100),
  promotionType: 'PERCENTAGE',
  promotionValue: new Prisma.Decimal(20),
  taxable: true,
  taxRate: new Prisma.Decimal(19),
  category: { taxable: true, defaultTaxRate: new Prisma.Decimal(10) },
});
type Row = Record<string, unknown>;
type Event = Row & {
  id: string;
  type: string;
  amount: Prisma.Decimal | null;
  reversesId: string | null;
};
const initialLoan = () => ({
  id: 'loan',
  organizationId: 'org',
  type: 'MONEY',
  status: 'OPEN',
  version: 0,
  customerId: request().customerId,
  supplierId: null,
  employeeId: null,
  createdById: 'actor',
  amount: new Prisma.Decimal('178.50'),
  events: [] as Event[],
});
type State = {
  loan: ReturnType<typeof initialLoan>;
  products: ReturnType<typeof product>[];
  intents: Row[];
  holds: Row[];
  audits: Row[];
  customers: { id: string; organizationId: string; active: boolean }[];
};
// Only the scalar predicates used by this unit are modeled; unknown operators fail.
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([field, value]) => {
    if (value && typeof value === 'object') {
      const condition = value as Row;
      if ('in' in condition)
        return (condition.in as unknown[]).includes(row[field]);
      if ('gte' in condition)
        return Number(row[field]) >= Number(condition.gte);
      if (field === 'organizationId_initiationRequestKey')
        return matches(row, condition);
      return false;
    }
    return row[field] === value;
  });
}
function fixture() {
  let committed: State = {
    loan: initialLoan(),
    products: [product()],
    intents: [],
    holds: [],
    audits: [],
    customers: [
      { id: request().customerId, organizationId: 'org', active: true },
    ],
  };
  let pending = committed;
  let visibleWinner: Row | null = null;
  const tx = {
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: 'actor', active: true }),
    },
    organizationUser: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ userId: 'actor', role: 'CASHIER' }),
    },
    customer: {
      findFirst: jest.fn(
        async ({ where }: { where: Row }) =>
          pending.customers.find((row) => matches(row, where)) ?? null,
      ),
    },
    product: {
      findMany: jest.fn(async ({ where }: { where: Row }) =>
        pending.products.filter((row) => matches(row, where)),
      ),
      findFirst: jest.fn(
        async ({ where }: { where: Row }) =>
          pending.products.find((row) => matches(row, where)) ?? null,
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: Row;
          data: {
            reservedStock: { increment?: number; decrement?: number };
            version: { increment: number };
          };
        }) => {
          const rows = pending.products.filter((row) => matches(row, where));
          for (const row of rows) {
            row.reservedStock +=
              (data.reservedStock.increment ?? 0) -
              (data.reservedStock.decrement ?? 0);
            row.version += data.version.increment;
          }
          return { count: rows.length };
        },
      ),
    },
    moneyLoan: {
      create: jest.fn(async ({ data }: { data: Row }) => {
        pending.loan = { ...pending.loan, ...data };
        return pending.loan;
      }),
      findFirst: jest.fn(async ({ where }: { where: Row }) =>
        matches(pending.loan, where) ? pending.loan : null,
      ),
      updateMany: jest.fn(
        async ({ where, data }: { where: Row; data: { status: string } }) => {
          if (!matches(pending.loan, where)) return { count: 0 };
          pending.loan = {
            ...pending.loan,
            status: data.status,
            version: pending.loan.version + 1,
          };
          return { count: 1 };
        },
      ),
    },
    moneyLoanEvent: {
      findFirst: jest.fn(
        async ({ where }: { where: Row }) =>
          pending.loan.events.find((event) => matches(event, where)) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: Row }) => {
        const event = {
          amount: null,
          reversesId: null,
          ...data,
          id: `event-${pending.loan.events.length}`,
          type: String(data.type),
        };
        pending.loan.events.push(event);
        return event;
      }),
    },
    posLoanSaleIntent: {
      findFirst: jest.fn(
        async ({ where }: { where: Row }) =>
          pending.intents.find((row) => matches(row, where)) ?? null,
      ),
      findUnique: jest.fn(
        async ({ where }: { where: Row }) =>
          pending.intents.find((row) => matches(row, where)) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row = { id: 'intent', ...data };
        pending.intents.push(row);
        return row;
      }),
    },
    posLoanSaleReservation: {
      findMany: jest.fn(async ({ where }: { where: Row }) =>
        pending.holds.filter((row) => matches(row, where)),
      ),
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row = {
          id: `hold-${String(data.productId)}`,
          state: 'HELD',
          ...data,
        };
        pending.holds.push(row);
        return row;
      }),
      updateMany: jest.fn(
        async ({ where, data }: { where: Row; data: Row }) => {
          const rows = pending.holds.filter((row) => matches(row, where));
          for (const row of rows) Object.assign(row, data);
          return { count: rows.length };
        },
      ),
    },
    auditLog: {
      create: jest.fn(async ({ data }: { data: Row }) => {
        pending.audits.push(data);
        return data;
      }),
    },
    sale: { create: jest.fn() },
    payment: { create: jest.fn() },
    inventoryMovement: { create: jest.fn() },
  };
  // Root reads model post-abort winner visibility; every write must use the callback.
  const outsideWrite = jest.fn(() => {
    throw new Error('Write outside transaction');
  });
  const readIntent = jest.fn(
    async ({ where }: { where: Row }) =>
      [...committed.intents, ...(visibleWinner ? [visibleWinner] : [])].find(
        (row) => matches(row, where),
      ) ?? null,
  );
  // This is local callback atomicity simulation, not Prisma rollback or SSI proof.
  const prisma = {
    ...tx,
    moneyLoan: {
      ...tx.moneyLoan,
      create: outsideWrite,
      updateMany: outsideWrite,
    },
    moneyLoanEvent: { ...tx.moneyLoanEvent, create: outsideWrite },
    product: { ...tx.product, updateMany: outsideWrite },
    posLoanSaleIntent: {
      findFirst: readIntent,
      findUnique: readIntent,
      create: outsideWrite,
    },
    posLoanSaleReservation: {
      ...tx.posLoanSaleReservation,
      create: outsideWrite,
      updateMany: outsideWrite,
    },
    auditLog: { create: outsideWrite },
    $transaction: jest.fn(
      async (fn: (client: typeof tx) => Promise<unknown>) => {
        pending = {
          ...committed,
          loan: { ...committed.loan, events: [...committed.loan.events] },
          products: committed.products.map((row) => ({ ...row })),
          intents: committed.intents.map((row) => ({ ...row })),
          holds: committed.holds.map((row) => ({ ...row })),
          audits: committed.audits.map((row) => ({ ...row })),
          customers: committed.customers.map((row) => ({ ...row })),
        };
        try {
          const result = await fn(tx);
          committed = pending;
          return result;
        } finally {
          pending = committed;
        }
      },
    ),
  };
  const service = new LoansService(prisma as unknown as PrismaService);
  const initiate = (
    dto = request(),
    user: RequestUser | undefined = actor(),
    org: string | undefined = 'org',
  ) => service.initiateFromPos(dto, org, user);
  const cancel = () =>
    service.mutate(
      'loan',
      'CANCELLED',
      { requestKey: 'cancel-key', reason: 'Desistió' },
      'actor',
      'org',
    );
  return {
    tx,
    prisma,
    service,
    initiate,
    cancel,
    outsideWrite,
    state: () => committed,
    exposeWinner: (row: Row) => {
      visibleWinner = row;
    },
  };
}
function noSaleEffects(tx: ReturnType<typeof fixture>['tx']) {
  expect(tx.sale.create).not.toHaveBeenCalled();
  expect(tx.payment.create).not.toHaveBeenCalled();
  expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
}
function noNewWrites(tx: ReturnType<typeof fixture>['tx']) {
  for (const write of [
    tx.moneyLoan.create,
    tx.moneyLoanEvent.create,
    tx.auditLog.create,
    tx.product.updateMany,
    tx.posLoanSaleIntent.create,
    tx.posLoanSaleReservation.create,
  ]) {
    expect(write).not.toHaveBeenCalled();
  }
}

describe('POS financing through LoansService (unwired)', () => {
  it('persists one canonical MONEY debt, frozen quote, actor history and owned reservation', async () => {
    const f = fixture();
    const result = await f.initiate();
    expect(result).toEqual({
      intentId: expect.any(String),
      loanId: 'loan',
      organizationId: 'org',
      customerId: request().customerId,
      agreedCustomerTotal: '178.50',
      quoteSnapshot: {
        agreedCustomerTotal: '178.50',
        items: [
          {
            productId: 'coffee',
            quantity: 2,
            resolvedUnitPrice: '80.00',
            discountAmount: '10.00',
          },
        ],
      },
    });
    const loanData = f.tx.moneyLoan.create.mock.calls[0][0].data;
    const intentData = f.tx.posLoanSaleIntent.create.mock.calls[0][0].data;
    expect(loanData).toMatchObject({
      type: 'MONEY',
      customerId: request().customerId,
      createdById: 'actor',
      organizationId: 'org',
    });
    expect(loanData.amount).toBe(intentData.agreedCustomerTotal);
    expect((loanData.amount as Prisma.Decimal).toFixed(2)).toBe('178.50');
    expect(intentData).toMatchObject({
      id: result.intentId,
      initiationRequestKey: 'pos-key',
      initiatedById: 'actor',
      initiationRequestHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      initiationResult: result,
      quoteSnapshot: result.quoteSnapshot,
    });
    expect(f.tx.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: request().customerId,
          organizationId: 'org',
          active: true,
        },
      }),
    );
    expect(f.tx.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org', active: true }),
      }),
    );
    expect(f.tx.moneyLoanEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          loanId: 'loan',
          organizationId: 'org',
          createdById: 'actor',
          type: 'CREATED',
        }),
      }),
    );
    expect(f.tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'LOAN_CREATED',
          resource: 'MoneyLoan',
          resourceId: 'loan',
          userId: 'actor',
        }),
      }),
    );
    expect(f.tx.posLoanSaleReservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          intentId: result.intentId,
          organizationId: 'org',
          productId: 'coffee',
          quantity: 2,
        }),
      }),
    );
    expect(f.prisma.$transaction).toHaveBeenCalledTimes(1);
    const lookups = [
      ...f.tx.posLoanSaleIntent.findFirst.mock.calls,
      ...f.tx.posLoanSaleIntent.findUnique.mock.calls,
    ];
    expect(lookups.some(([call]) => matches(intentData, call.where))).toBe(
      true,
    );
    const lookupOrder = [
      ...f.tx.posLoanSaleIntent.findFirst.mock.invocationCallOrder,
      ...f.tx.posLoanSaleIntent.findUnique.mock.invocationCallOrder,
    ];
    expect(Math.min(...lookupOrder)).toBeLessThan(
      f.tx.customer.findFirst.mock.invocationCallOrder[0],
    );
    expect(f.outsideWrite).not.toHaveBeenCalled();
    expect(f.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    noSaleEffects(f.tx);
  });

  it('replays original evidence before live reads, even after cancellation and catalog changes', async () => {
    const f = fixture();
    const original = await f.initiate();
    f.state().loan.status = 'CANCELLED';
    f.state().products[0].salePrice = new Prisma.Decimal(999);
    f.state().customers[0].active = false;
    for (const mock of [
      f.tx.customer.findFirst,
      f.tx.product.findMany,
      f.tx.product.findFirst,
      f.tx.moneyLoan.create,
      f.tx.moneyLoanEvent.create,
      f.tx.auditLog.create,
      f.tx.product.updateMany,
      f.tx.posLoanSaleIntent.create,
      f.tx.posLoanSaleReservation.create,
    ])
      mock.mockClear();
    expect(await f.initiate()).toEqual(original);
    expect(f.tx.customer.findFirst).not.toHaveBeenCalled();
    expect(f.tx.product.findMany).not.toHaveBeenCalled();
    expect(f.tx.product.findFirst).not.toHaveBeenCalled();
    noNewWrites(f.tx);
  });

  it('canonicalizes equivalent requested fields without hashing live catalog or object key order', async () => {
    const f = fixture();
    const original = await f.initiate();
    const before = f.state();
    const equivalent = request({
      reason: '  Compra financiada  ',
      items: [{ discountAmount: 10, quantity: 2, productId: 'coffee' }],
    });
    expect(await f.initiate(equivalent)).toEqual(original);
    expect(f.state()).toEqual(before);
    expect(f.tx.moneyLoan.create).toHaveBeenCalledTimes(1);
  });

  it.each([
    { target: ['organizationId', 'initiationRequestKey'] },
    { target: 'PosLoanSaleIntent_organizationId_initiationRequestKey_key' },
  ])(
    'reconciles only the initiation-key unique loser (%j) against an already visible winner',
    async ({ target }) => {
      const winner = fixture();
      const original = await winner.initiate();
      const loser = fixture();
      const before = loser.state();
      loser.exposeWinner(winner.state().intents[0]);
      loser.tx.posLoanSaleIntent.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique initiation key', {
          code: 'P2002',
          clientVersion: '6.19.2',
          meta: { modelName: 'PosLoanSaleIntent', target },
        }),
      );
      expect(await loser.initiate()).toEqual(original);
      expect(loser.state()).toEqual(before);
      expect(loser.outsideWrite).not.toHaveBeenCalled();
      expect(loser.prisma.$transaction).toHaveBeenCalledTimes(1);
      // This models post-abort evidence visibility, not a PostgreSQL race.
    },
  );

  it('does not turn an unrelated unique failure into an initiation replay', async () => {
    const f = fixture();
    const before = f.state();
    const unrelated = new Prisma.PrismaClientKnownRequestError(
      'unrelated unique',
      {
        code: 'P2002',
        clientVersion: '6.19.2',
        meta: { modelName: 'MoneyLoan', target: ['id'] },
      },
    );
    f.tx.moneyLoan.create.mockRejectedValue(unrelated);
    await expect(f.initiate()).rejects.toBe(unrelated);
    expect(f.state()).toEqual(before);
    expect(f.prisma.posLoanSaleIntent.findFirst).not.toHaveBeenCalled();
    expect(f.prisma.posLoanSaleIntent.findUnique).not.toHaveBeenCalled();
  });

  it.each(['actor', 'hash'])(
    'rejects a unique-loser winner with a different %s',
    async (field) => {
      const winner = fixture();
      await winner.initiate();
      const row = { ...winner.state().intents[0] };
      if (field === 'actor') row.initiatedById = 'other-actor';
      else row.initiationRequestHash = '0'.repeat(64);
      const f = fixture();
      const before = f.state();
      f.exposeWinner(row);
      f.tx.posLoanSaleIntent.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique initiation key', {
          code: 'P2002',
          clientVersion: '6.19.2',
          meta: {
            modelName: 'PosLoanSaleIntent',
            target: ['organizationId', 'initiationRequestKey'],
          },
        }),
      );
      await expect(f.initiate()).rejects.toThrow(ConflictException);
      expect(f.state()).toEqual(before);
    },
  );

  it.each([
    'customer',
    'reason',
    'date',
    'quantity',
    'price',
    'discount',
    'actor',
  ])('conflicts on changed %s under the same key', async (change) => {
    const f = fixture();
    await f.initiate();
    const dto = request();
    const user = actor();
    if (change === 'customer') dto.customerId = 'other';
    if (change === 'reason') dto.reason = 'Otra compra';
    if (change === 'date') dto.dueAt = '2026-12-13';
    if (change === 'quantity') dto.items[0].quantity = 3;
    if (change === 'price') dto.items[0].unitPrice = 60;
    if (change === 'discount') dto.items[0].discountAmount = 5;
    if (change === 'actor') user.userId = 'other-actor';
    await expect(f.initiate(dto, user)).rejects.toThrow(ConflictException);
    expect(f.state().intents).toHaveLength(1);
    expect(f.state().audits).toHaveLength(1);
  });

  it.each(['OWNER', 'ADMIN', 'CASHIER', 'MEMBER', 'SUPER_ADMIN'] as const)(
    'permits %s financing; global SUPER_ADMIN needs no membership',
    async (role) => {
      const f = fixture();
      const principal = actor(role);
      if (role === 'SUPER_ADMIN') {
        f.tx.organizationUser.findFirst.mockResolvedValue(null);
        principal.organizationId = undefined;
      }
      await expect(f.initiate(request(), principal)).resolves.toMatchObject({
        loanId: 'loan',
      });
    },
  );
  it.each(['inventory', 'missing', 'scope', 'foreign'])(
    'denies %s actor/scope before effects',
    async (kind) => {
      const f = fixture();
      const user =
        kind === 'missing'
          ? undefined
          : actor(kind === 'inventory' ? 'INVENTORY_USER' : 'CASHIER');
      if (kind === 'foreign' && user) user.organizationId = 'foreign-org';
      // Explicit call avoids a default argument replacing a missing principal/scope.
      await expect(
        f.service.initiateFromPos(
          request(),
          kind === 'scope' ? undefined : 'org',
          user,
        ),
      ).rejects.toThrow(ForbiddenException);
      noNewWrites(f.tx);
    },
  );
  it.each(['inactive', 'foreign', 'missing'])(
    'rejects %s customer from the scoped active lookup',
    async (kind) => {
      const f = fixture();
      if (kind === 'inactive') f.state().customers[0].active = false;
      if (kind === 'foreign')
        f.state().customers[0].organizationId = 'foreign-org';
      if (kind === 'missing') f.state().customers = [];
      await expect(f.initiate()).rejects.toThrow(BadRequestException);
      noNewWrites(f.tx);
    },
  );

  it.each(['OWNER', 'ADMIN', 'CASHIER', 'SUPER_ADMIN'] as const)(
    'audits %s upward and downward price overrides against the actual loan',
    async (role) => {
      for (const price of [60, 120]) {
        const f = fixture();
        const result = await f.initiate(
          request({
            items: [{ productId: 'coffee', quantity: 2, unitPrice: price }],
          }),
          actor(role),
        );
        expect(result.agreedCustomerTotal).toBe(
          price === 60 ? '142.80' : '285.60',
        );
        const override = f
          .state()
          .audits.find((row) => row.action === 'SALE_PRICE_OVERRIDE');
        expect(override).toMatchObject({
          userId: 'actor',
          organizationId: 'org',
          resourceId: 'loan',
        });
        expect(JSON.stringify(override)).toContain('intent');
        expect(JSON.stringify(override)).not.toContain('saleNumber');
        noSaleEffects(f.tx);
      }
    },
  );
  it.each(['MEMBER', 'INVENTORY_USER'] as const)(
    'denies %s manual pricing',
    async (role) => {
      const f = fixture();
      await expect(
        f.initiate(
          request({
            items: [{ productId: 'coffee', quantity: 1, unitPrice: 120 }],
          }),
          actor(role),
        ),
      ).rejects.toThrow(ForbiddenException);
      noNewWrites(f.tx);
    },
  );

  it('aggregates duplicate physical lines and pins the complete reservation-only CAS', async () => {
    const f = fixture();
    await f.initiate(
      request({
        items: [
          { productId: 'coffee', quantity: 2 },
          { productId: 'coffee', quantity: 3 },
        ],
      }),
    );
    expect(f.tx.product.updateMany).toHaveBeenCalledTimes(1);
    expect(f.tx.product.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'coffee',
        organizationId: 'org',
        active: true,
        type: 'PRODUCT',
        tracksStock: true,
        version: 7,
        stock: 12,
        reservedStock: 3,
      },
      data: { reservedStock: { increment: 5 }, version: { increment: 1 } },
    });
    expect(f.state().holds).toHaveLength(1);
    expect(f.state().holds[0].quantity).toBe(5);
    expect(f.state().products[0]).toMatchObject({
      stock: 12,
      reservedStock: 8,
      version: 8,
    });
    expect(f.outsideWrite).not.toHaveBeenCalled();
    noSaleEffects(f.tx);
  });
  it.each([10, 0.5, 2147483648])(
    'rejects unavailable/noninteger/overflow quantity %s',
    async (quantity) => {
      const f = fixture();
      await expect(
        f.initiate(request({ items: [{ productId: 'coffee', quantity }] })),
      ).rejects.toThrow(
        quantity === 10 ? ConflictException : BadRequestException,
      );
      expect(f.state().intents).toHaveLength(0);
      expect(f.state().holds).toHaveLength(0);
    },
  );
  it.each(['SERVICE', 'untracked'])(
    'creates MONEY for %s without physical holds',
    async (kind) => {
      const f = fixture();
      if (kind === 'SERVICE') f.state().products[0].type = 'SERVICE';
      else f.state().products[0].tracksStock = false;
      await f.initiate();
      expect(f.state().loan.type).toBe('MONEY');
      expect(f.tx.product.updateMany).not.toHaveBeenCalled();
      expect(f.tx.posLoanSaleReservation.create).not.toHaveBeenCalled();
      noSaleEffects(f.tx);
    },
  );

  it.each(['CAS', 'intent', 'event', 'audit'])(
    'aborts local staged effects when %s fails',
    async (stage) => {
      const f = fixture();
      const failure = new Error(`failure-${stage}`);
      const before = f.state();
      if (stage === 'CAS')
        f.tx.product.updateMany.mockResolvedValue({ count: 0 });
      if (stage === 'intent')
        f.tx.posLoanSaleIntent.create.mockRejectedValue(failure);
      if (stage === 'event')
        f.tx.moneyLoanEvent.create.mockRejectedValue(failure);
      if (stage === 'audit') f.tx.auditLog.create.mockRejectedValue(failure);
      await expect(f.initiate()).rejects.toThrow(
        stage === 'CAS' ? ConflictException : failure,
      );
      expect(f.state().intents).toEqual([]);
      expect(f.state().holds).toEqual([]);
      expect(f.state().loan.events).toEqual([]);
      expect(f.state().audits).toEqual([]);
      expect(f.state()).toEqual(before);
      expect(f.outsideWrite).not.toHaveBeenCalled();
    },
  );

  it('cancels unpaid financing, claims CANCELLED first, releases only owned HELD rows once', async () => {
    const f = fixture();
    const initiated = await f.initiate();
    f.state().holds.push({
      id: 'foreign',
      intentId: 'other-intent',
      state: 'HELD',
      organizationId: 'org',
      productId: 'coffee',
      quantity: 8,
    });
    f.state().holds.push({
      id: 'foreign-tenant',
      intentId: initiated.intentId,
      organizationId: 'other',
      productId: 'coffee',
      state: 'HELD',
      quantity: 9,
    });
    f.state().holds.push({
      id: 'terminal',
      intentId: initiated.intentId,
      organizationId: 'org',
      productId: 'old-product',
      state: 'CONSUMED',
      quantity: 1,
    });
    f.state().products[0].active = false;
    f.state().products[0].type = 'SERVICE';
    f.tx.product.updateMany.mockClear();
    const result = await f.cancel();
    expect(result).toMatchObject({ status: 'CANCELLED', collected: '0.00' });
    expect(f.tx.moneyLoan.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'loan',
        organizationId: 'org',
        status: 'OPEN',
        version: 0,
      },
      data: { status: 'CANCELLED', version: { increment: 1 } },
    });
    expect(f.tx.product.updateMany).toHaveBeenCalledTimes(1);
    const release = f.tx.product.updateMany.mock.calls[0][0];
    expect(release).toMatchObject({
      where: { id: 'coffee', organizationId: 'org' },
      data: { reservedStock: { decrement: 2 }, version: { increment: 1 } },
    });
    expect(release.where).not.toHaveProperty('active');
    expect(release.where).not.toHaveProperty('type');
    expect(release.data).not.toHaveProperty('stock');
    expect(f.tx.posLoanSaleReservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          intentId: initiated.intentId,
          organizationId: 'org',
          state: 'HELD',
        }),
        data: expect.objectContaining({
          state: 'RELEASED',
          finalizedById: 'actor',
          finalizedAt: expect.any(Date),
        }),
      }),
    );
    expect(f.tx.moneyLoan.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      f.tx.posLoanSaleReservation.updateMany.mock.invocationCallOrder[0],
    );
    expect(f.state().products[0]).toMatchObject({
      stock: 12,
      reservedStock: 3,
      version: 9,
    });
    expect(f.state().holds[0]).toMatchObject({
      state: 'RELEASED',
      finalizedById: 'actor',
      finalizedAt: expect.any(Date),
    });
    expect(
      f
        .state()
        .holds.slice(1)
        .map((row) => row.state),
    ).toEqual(['HELD', 'HELD', 'CONSUMED']);
    const after = f.state();
    await expect(f.cancel()).resolves.toEqual(result);
    expect(f.state()).toEqual(after);
    expect(f.outsideWrite).not.toHaveBeenCalled();
    expect(f.tx.product.updateMany).toHaveBeenCalledTimes(1);
    expect(f.tx.posLoanSaleReservation.updateMany).toHaveBeenCalledTimes(1);
    noSaleEffects(f.tx);
  });
  it('sorts multiple physical holds and cancellation releases by product ID', async () => {
    const f = fixture();
    f.state().products = [product('z-product'), product('a-product')];
    await f.initiate(
      request({
        items: [
          { productId: 'z-product', quantity: 2 },
          { productId: 'a-product', quantity: 1 },
        ],
      }),
    );
    expect(
      f.tx.product.updateMany.mock.calls.map(([call]) => call.where.id),
    ).toEqual(['a-product', 'z-product']);
    expect(f.state().holds.map((row) => row.productId)).toEqual([
      'a-product',
      'z-product',
    ]);
    f.tx.product.updateMany.mockClear();
    await f.cancel();
    expect(
      f.tx.product.updateMany.mock.calls.map(([call]) => call.where.id),
    ).toEqual(['a-product', 'z-product']);
    expect(
      f
        .state()
        .products.map((row) => [row.stock, row.reservedStock, row.version]),
    ).toEqual([
      [12, 3, 9],
      [12, 3, 9],
    ]);
    expect(f.state().holds.every((row) => row.state === 'RELEASED')).toBe(true);
    expect(f.outsideWrite).not.toHaveBeenCalled();
  });

  it.each(['loan-CAS', 'second-counter', 'claim', 'event', 'audit'])(
    'rolls back CANCELLED, counters and owned row states when %s fails',
    async (stage) => {
      const f = fixture();
      f.state().products = [product('z-product'), product('a-product')];
      await f.initiate(
        request({
          items: [
            { productId: 'z-product', quantity: 2 },
            { productId: 'a-product', quantity: 1 },
          ],
        }),
      );
      const before = f.state();
      const failure = new Error(`cancel-${stage}`);
      if (stage === 'loan-CAS')
        f.tx.moneyLoan.updateMany.mockResolvedValueOnce({ count: 0 });
      if (stage === 'second-counter') {
        const update = f.tx.product.updateMany.getMockImplementation()!;
        f.tx.product.updateMany
          .mockImplementationOnce(update)
          .mockResolvedValueOnce({ count: 0 });
      }
      if (stage === 'claim')
        f.tx.posLoanSaleReservation.updateMany.mockResolvedValueOnce({
          count: 0,
        });
      if (stage === 'event')
        f.tx.moneyLoanEvent.create.mockRejectedValueOnce(failure);
      if (stage === 'audit')
        f.tx.auditLog.create.mockRejectedValueOnce(failure);
      await expect(f.cancel()).rejects.toThrow(
        ['loan-CAS', 'second-counter', 'claim'].includes(stage)
          ? ConflictException
          : failure,
      );
      expect(f.state()).toEqual(before);
      expect(f.state().loan.status).toBe('OPEN');
      expect(f.state().holds.every((row) => row.state === 'HELD')).toBe(true);
      expect(f.outsideWrite).not.toHaveBeenCalled();
    },
  );

  it('rejects paid cancellation without changing holds', async () => {
    const f = fixture();
    await f.initiate();
    const beforeHolds = f.state().holds.map((row) => ({ ...row }));
    f.tx.product.updateMany.mockClear();
    f.state().loan.events.push({
      id: 'paid',
      type: 'COLLECTED',
      amount: new Prisma.Decimal(1),
      reversesId: null,
    });
    await expect(f.cancel()).rejects.toThrow(ConflictException);
    expect(f.state().holds).toEqual(beforeHolds);
    expect(f.tx.product.updateMany).not.toHaveBeenCalled();
    expect(f.tx.posLoanSaleReservation.updateMany).not.toHaveBeenCalled();
  });
  it('keeps independent cancellation free of physical effects', async () => {
    const f = fixture();
    await expect(f.cancel()).resolves.toMatchObject({ status: 'CANCELLED' });
    expect(f.tx.product.updateMany).not.toHaveBeenCalled();
    expect(f.tx.posLoanSaleReservation.updateMany).not.toHaveBeenCalled();
    noSaleEffects(f.tx);
  });
});

describe('CreatePosLoanDto boundary', () => {
  it('accepts the customer-only nested cart and trims the original reason', async () => {
    const dto = plainToInstance(
      CreatePosLoanDto,
      request({ reason: ' Compra financiada ' }),
    );
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).toEqual([]);
    expect(dto.reason).toBe('Compra financiada');
  });
  it.each([
    'amount',
    'quoteSnapshot',
    'origin',
    'type',
    'supplierId',
    'employeeId',
  ])('rejects client-owned %s', async (field) => {
    const dto = plainToInstance(CreatePosLoanDto, {
      ...request(),
      [field]: 'forbidden',
    });
    expect(
      (
        await validate(dto, { whitelist: true, forbidNonWhitelisted: true })
      ).some((error) => error.property === field),
    ).toBe(true);
  });
  it.each([
    { issuedAt: '2026-02-30' },
    { dueAt: '2026-11-13T12:00:00Z' },
    { reason: ' ' },
    { requestKey: ' ' },
    { items: [] },
    { items: [{ productId: 'coffee', quantity: 0 }] },
  ])('rejects malformed nested/date/reason input %j', async (changes) => {
    expect(
      await validate(
        plainToInstance(CreatePosLoanDto, { ...request(), ...changes }),
      ),
    ).not.toEqual([]);
  });
});

describe('POS initiation controller boundary', () => {
  it('forwards exact identities and the original result', async () => {
    const f = fixture();
    const dto = request();
    const user = actor();
    const result = { loanId: 'original-result' };
    const spy = jest.spyOn(f.service, 'initiateFromPos');
    spy.mockResolvedValue(result);
    const controller = new LoansController(f.service);
    expect(await controller.initiateFromPos(dto, user)).toBe(result);
    expect(spy.mock.calls[0][0]).toBe(dto);
    expect(spy.mock.calls[0][1]).toBe(user.organizationId);
    expect(spy.mock.calls[0][2]).toBe(user);
  });

  it('rejects missing organization before writes', async () => {
    const f = fixture();
    const user = actor();
    user.organizationId = undefined;
    const controller = new LoansController(f.service);
    await expect(controller.initiateFromPos(request(), user)).rejects.toThrow(
      ForbiddenException,
    );
    noNewWrites(f.tx);
  });

  it('declares the CASHIER POST pos-initiation route', () => {
    const handler = LoansController.prototype.initiateFromPos;
    expect(Reflect.getMetadata('path', handler)).toBe('pos-initiation');
    expect(Reflect.getMetadata('method', handler)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([OrgRole.CASHIER]);
  });
});
