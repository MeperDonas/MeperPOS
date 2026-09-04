import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ExpensesService } from './expenses.service';

describe('Expenses taxonomy validation and reporting', () => {
  const tx = { expense: { create: jest.fn() }, auditLog: { create: jest.fn() } };
  const prisma = {
    expenseLabel: { findFirst: jest.fn(), findMany: jest.fn() },
    expense: { groupBy: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    supplier: { findFirst: jest.fn() }, purchaseOrder: { findFirst: jest.fn() },
  };
  const cloudinary = {};
  const service = new ExpensesService(prisma as never, cloudinary as never);

  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['missing', null],
    ['inactive', { id: 'l1', active: false, group: { active: true, organizationId: 'org-1' } }],
    ['cross-organization', { id: 'l1', active: true, group: { active: true, organizationId: 'org-2' } }],
    ['inactive group', { id: 'l1', active: true, group: { active: false, organizationId: 'org-1' } }],
  ])('rejects %s labels before opening a transaction', async (_reason, label) => {
    prisma.expenseLabel.findFirst.mockResolvedValue(label);
    await expect(service.create({ labelId: 'l1', date: '2026-08-15', total: 10, payments: [{ amount: 10, method: 'CASH', date: '2026-08-15' }] } as never, 'u1', 'org-1')).rejects.toThrow(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns nested groups and labels ordered by amount then stable identity', async () => {
    prisma.expense.groupBy.mockResolvedValue([
      { labelId: 'l2', _sum: { total: new Prisma.Decimal(100) } },
      { labelId: 'l1', _sum: { total: new Prisma.Decimal(300) } },
    ]);
    prisma.expenseLabel.findMany.mockResolvedValue([
      { id: 'l1', name: 'Arriendo', group: { id: 'g1', name: 'Local' } },
      { id: 'l2', name: 'Servicios', group: { id: 'g1', name: 'Local' } },
    ]);
    await expect(service.getMonthlySummary('2026-08', 'org-1')).resolves.toEqual({
      month: '2026-08', total: new Prisma.Decimal(400),
      groups: [{ groupId: 'g1', name: 'Local', total: new Prisma.Decimal(400), labels: [
        { labelId: 'l1', name: 'Arriendo', total: new Prisma.Decimal(300) },
        { labelId: 'l2', name: 'Servicios', total: new Prisma.Decimal(100) },
      ] }],
    });
  });

  it('rejects a malformed summary month without querying expenses', async () => {
    await expect(service.getMonthlySummary('2026-8', 'org-1')).rejects.toThrow(BadRequestException);
    expect(prisma.expense.groupBy).not.toHaveBeenCalled();
  });
});
