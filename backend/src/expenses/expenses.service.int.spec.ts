import { PrismaClient, Prisma, PlanType } from '@prisma/client';
import { formatDateInBogota } from '../common/utils/bogota-date';
import { ExpensesService } from './expenses.service';

const prisma = new PrismaClient();

const cloudinaryServiceMock = {
  uploadImage: jest.fn(),
  deleteImage: jest.fn(),
};

describe('ExpensesService — Integration (Isolation + Payments + Summary)', () => {
  let service: ExpensesService;
  let orgAId: string;
  let orgBId: string;
  let userAId: string;
  let userBId: string;
  let catArriendoId: string;
  let catCajaMenorId: string;
  let catOrgBId: string;

  const buildCreateDto = (
    categoryId: string,
    overrides: Partial<{
      date: string | Date;
      total: number;
      payments: { amount: number; method: 'CASH' | 'CARD' | 'TRANSFER'; date: string }[];
      description: string;
    }> = {},
  ) => ({
    categoryId,
    description: overrides.description ?? 'Gasto de integración',
    date: (overrides.date ?? '2026-08-15') as string,
    total: overrides.total ?? 500000,
    payments: overrides.payments ?? [
      { amount: overrides.total ?? 500000, method: 'CASH' as const, date: '2026-08-15' },
    ],
  });

  beforeAll(async () => {
    service = new ExpensesService(
      prisma as never,
      cloudinaryServiceMock as never,
    );

    const [orgA, orgB] = await Promise.all([
      prisma.organization.create({
        data: {
          name: 'Expenses INT Org A',
          slug: 'expenses-int-a-' + Date.now(),
          plan: PlanType.BASIC,
          active: true,
        },
      }),
      prisma.organization.create({
        data: {
          name: 'Expenses INT Org B',
          slug: 'expenses-int-b-' + Date.now(),
          plan: PlanType.BASIC,
          active: true,
        },
      }),
    ]);
    orgAId = orgA.id;
    orgBId = orgB.id;

    const [userA, userB] = await Promise.all([
      prisma.user.create({
        data: {
          email: 'expenses-int-user-a@example.com',
          password: 'hash',
          name: 'Test User A',
          tokenVersion: 0,
        },
      }),
      prisma.user.create({
        data: {
          email: 'expenses-int-user-b@example.com',
          password: 'hash',
          name: 'Test User B',
          tokenVersion: 0,
        },
      }),
    ]);
    userAId = userA.id;
    userBId = userB.id;

    const [catArriendo, catCajaMenor, catOrgB] = await Promise.all([
      prisma.expenseCategory.create({
        data: { name: 'Arriendo INT', organizationId: orgAId },
      }),
      prisma.expenseCategory.create({
        data: { name: 'Caja menor INT', organizationId: orgAId },
      }),
      prisma.expenseCategory.create({
        data: { name: 'Categoría org B', organizationId: orgBId },
      }),
    ]);
    catArriendoId = catArriendo.id;
    catCajaMenorId = catCajaMenor.id;
    catOrgBId = catOrgB.id;
  });

  afterAll(async () => {
    await prisma.expensePayment.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.auditLog.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.expense.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.expenseCategory.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [orgAId, orgBId] } },
    });
    await prisma.$disconnect();
  });

  it('isolates organizations: cross-org reads 404 and lists never leak', async () => {
    const created = await service.create(
      buildCreateDto(catArriendoId),
      userAId,
      orgAId,
    );

    await expect(service.findOne(created.id, orgBId)).rejects.toThrow(
      'Salida no encontrada',
    );
    await expect(service.getHistory(created.id, orgBId)).rejects.toThrow(
      'Salida no encontrada',
    );
    await expect(
      service.duplicate(created.id, userBId, orgBId),
    ).rejects.toThrow('Salida no encontrada');

    const listB = await service.findAll({}, orgBId);
    expect(listB.data).toHaveLength(0);
    expect(listB.meta.total).toBe(0);

    const summaryB = await service.getMonthlySummary('2026-08', orgBId);
    expect(summaryB.total.toString()).toBe('0');
  });

  it('supports the partial to paid payment flow and rejects overpayment', async () => {
    const created = await service.create(
      buildCreateDto(catArriendoId, {
        total: 500000,
        payments: [{ amount: 200000, method: 'TRANSFER', date: '2026-08-15' }],
      }),
      userAId,
      orgAId,
    );
    expect(created.status).toBe('PARTIAL');

    const paid = await service.addPayment(
      created.id,
      { amount: 300000, method: 'CASH', date: '2026-08-16' },
      userAId,
      orgAId,
    );
    expect(paid.status).toBe('PAID');

    await expect(
      service.addPayment(
        created.id,
        { amount: 1, method: 'CASH', date: '2026-08-17' },
        userAId,
        orgAId,
      ),
    ).rejects.toThrow(
      'La suma de los pagos no puede superar el total de la salida',
    );

    const history = await service.getHistory(created.id, orgAId);
    expect(history.map((entry) => entry.action)).toEqual([
      'EXPENSE_CREATED',
      'EXPENSE_PAYMENT_ADDED',
    ]);
  });

  it('summarizes the Bogota month per category, honoring month boundaries and org scope', async () => {
    await service.create(
      buildCreateDto(catArriendoId, {
        description: 'Arriendo junio',
        date: '2026-06-15',
        total: 500000,
        payments: [{ amount: 500000, method: 'CASH', date: '2026-06-15' }],
      }),
      userAId,
      orgAId,
    );
    await service.create(
      buildCreateDto(catArriendoId, {
        description: 'Inicio de mes (00:00 Bogota)',
        date: new Date('2026-06-01T05:00:00.000Z'),
        total: 200000,
        payments: [
          { amount: 200000, method: 'CASH', date: '2026-06-01T05:00:00.000Z' },
        ],
      }),
      userAId,
      orgAId,
    );
    await service.create(
      buildCreateDto(catCajaMenorId, {
        description: 'Caja menor junio',
        date: '2026-06-20',
        total: 300000,
        payments: [{ amount: 300000, method: 'CASH', date: '2026-06-20' }],
      }),
      userAId,
      orgAId,
    );
    await service.create(
      buildCreateDto(catArriendoId, {
        description: 'Mayo 31 23:59 Bogota — fuera del mes',
        date: new Date('2026-06-01T04:59:59.000Z'),
        total: 999999,
        payments: [
          {
            amount: 999999,
            method: 'CASH',
            date: '2026-06-01T04:59:59.000Z',
          },
        ],
      }),
      userAId,
      orgAId,
    );
    await service.create(
      buildCreateDto(catOrgBId, {
        description: 'Gasto de la organización B',
        date: '2026-06-18',
        total: 777777,
        payments: [{ amount: 777777, method: 'CASH', date: '2026-06-18' }],
      }),
      userBId,
      orgBId,
    );

    const summary = await service.getMonthlySummary('2026-06', orgAId);

    expect(summary.month).toBe('2026-06');
    expect(summary.total.toString()).toBe('1000000');
    expect(
      summary.categories.map((row) => ({
        categoryId: row.categoryId,
        name: row.name,
        total: row.total.toString(),
      })),
    ).toEqual([
      { categoryId: catArriendoId, name: 'Arriendo INT', total: '700000' },
      { categoryId: catCajaMenorId, name: 'Caja menor INT', total: '300000' },
    ]);
  });

  it('duplicates an expense with today Bogota date, copied payments and derived status', async () => {
    const created = await service.create(
      buildCreateDto(catArriendoId, {
        description: 'Original a duplicar',
        date: '2026-08-10',
        total: 500000,
        payments: [
          { amount: 300000, method: 'CASH', date: '2026-08-10' },
          { amount: 200000, method: 'TRANSFER', date: '2026-08-11' },
        ],
      }),
      userAId,
      orgAId,
    );
    expect(created.status).toBe('PAID');

    const duplicated = await service.duplicate(created.id, userAId, orgAId);

    expect(duplicated.id).not.toBe(created.id);
    expect(duplicated.categoryId).toBe(catArriendoId);
    expect(duplicated.description).toBe('Original a duplicar');
    expect(duplicated.total.toString()).toBe('500000');
    expect(duplicated.status).toBe('PAID');
    expect(duplicated.date.toISOString()).toBe(
      new Date(formatDateInBogota(new Date())).toISOString(),
    );
    expect(duplicated.payments).toHaveLength(2);
    expect(duplicated.payments.map((payment) => payment.method)).toEqual([
      'CASH',
      'TRANSFER',
    ]);

    const history = await service.getHistory(duplicated.id, orgAId);
    expect(history.map((entry) => entry.action)).toEqual([
      'EXPENSE_DUPLICATED',
    ]);
  });
});
