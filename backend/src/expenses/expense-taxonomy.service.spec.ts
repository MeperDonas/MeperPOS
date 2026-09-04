import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ExpenseTaxonomyService } from './expense-taxonomy.service';

describe('ExpenseTaxonomyService', () => {
  const prisma = {
    expenseGroup: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    expenseLabel: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new ExpenseTaxonomyService(prisma as never);

  beforeEach(() => { jest.clearAllMocks(); });

  it('lists only active groups and nested active labels for the token organization', async () => {
    const groups = [{ id: 'g1', organizationId: 'org-1', active: true, labels: [{ id: 'l1', active: true }] }];
    prisma.expenseGroup.findMany.mockResolvedValue(groups);
    await expect(service.findGroups('org-1')).resolves.toEqual(groups);
    expect(prisma.expenseGroup.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', active: true },
      orderBy: { name: 'asc' },
      include: { labels: { where: { active: true }, orderBy: { name: 'asc' } } },
    });
  });

  it('reactivates an inactive same-name group instead of creating a duplicate', async () => {
    prisma.expenseGroup.findFirst.mockResolvedValue({ id: 'g1', active: false });
    prisma.expenseGroup.update.mockResolvedValue({ id: 'g1', active: true });
    await expect(service.createGroup({ name: '  Transporte ' }, 'org-1')).resolves.toEqual({ id: 'g1', active: true });
    expect(prisma.expenseGroup.update).toHaveBeenCalledWith({ where: { id: 'g1' }, data: { name: 'Transporte', active: true } });
    expect(prisma.expenseGroup.create).not.toHaveBeenCalled();
  });

  it('rejects a label whose group belongs to another organization before writing', async () => {
    prisma.expenseGroup.findFirst.mockResolvedValue(null);
    await expect(service.createLabel({ name: 'Gasolina', groupId: 'g1' }, 'org-1')).rejects.toThrow(NotFoundException);
    expect(prisma.expenseLabel.create).not.toHaveBeenCalled();
  });

  it('rejects missing organization and duplicate active names', async () => {
    await expect(service.findGroups(undefined)).rejects.toThrow(BadRequestException);
    prisma.expenseGroup.findFirst.mockResolvedValue({ id: 'g1', active: true });
    await expect(service.createGroup({ name: 'Transporte' }, 'org-1')).rejects.toThrow(ConflictException);
  });

  it('soft-deletes groups and labels without deleting records', async () => {
    prisma.expenseGroup.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1' });
    prisma.expenseGroup.update.mockResolvedValue({ id: 'g1', active: false });
    await expect(service.removeGroup('g1', 'org-1')).resolves.toMatchObject({ active: false });
    expect(prisma.expenseGroup.update).toHaveBeenCalledWith({ where: { id: 'g1' }, data: { active: false } });
  });
});
