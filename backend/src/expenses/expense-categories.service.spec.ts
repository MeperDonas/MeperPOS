import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  DEFAULT_EXPENSE_CATEGORY_NAMES,
  ExpenseCategoriesService,
} from './expense-categories.service';

describe('ExpenseCategoriesService', () => {
  let service: ExpenseCategoriesService;
  const orgId = 'org-1';

  const prismaMock = {
    expenseCategory: {
      count: jest.fn(),
      createMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExpenseCategoriesService(prismaMock as never);
  });

  describe('ensureDefaultCategories', () => {
    it('seeds the five Spanish defaults when the org has zero categories', async () => {
      prismaMock.expenseCategory.count.mockResolvedValue(0);
      prismaMock.expenseCategory.createMany.mockResolvedValue({ count: 5 });

      const result = await service.ensureDefaultCategories(orgId);

      expect(prismaMock.expenseCategory.count).toHaveBeenCalledWith({
        where: { organizationId: orgId },
      });
      expect(prismaMock.expenseCategory.createMany).toHaveBeenCalledWith({
        data: DEFAULT_EXPENSE_CATEGORY_NAMES.map((name) => ({
          name,
          organizationId: orgId,
        })),
        skipDuplicates: true,
      });
      expect(result).toBe(5);
    });

    it('is idempotent: does nothing when the org already has categories', async () => {
      prismaMock.expenseCategory.count.mockResolvedValue(3);

      const result = await service.ensureDefaultCategories(orgId);

      expect(prismaMock.expenseCategory.createMany).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });
  });

  describe('findAll', () => {
    it('ensures defaults lazily and lists org-scoped active categories', async () => {
      prismaMock.expenseCategory.count.mockResolvedValue(5);
      prismaMock.expenseCategory.findMany.mockResolvedValue([
        { id: 'c1', name: 'Arriendo', active: true, organizationId: orgId },
      ]);

      const result = await service.findAll(orgId);

      expect(prismaMock.expenseCategory.count).toHaveBeenCalledWith({
        where: { organizationId: orgId },
      });
      expect(prismaMock.expenseCategory.findMany).toHaveBeenCalledWith({
        where: { organizationId: orgId, active: true },
        orderBy: { name: 'asc' },
      });
      expect(result).toHaveLength(1);
    });

    it('throws BadRequestException when organizationId is missing', async () => {
      await expect(service.findAll(undefined)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('create', () => {
    it('creates a category scoped to the organization', async () => {
      prismaMock.expenseCategory.findFirst.mockResolvedValue(null);
      prismaMock.expenseCategory.create.mockResolvedValue({
        id: 'c1',
        name: 'Servicios',
        organizationId: orgId,
        active: true,
      });

      const result = await service.create({ name: 'Servicios' }, orgId);

      expect(prismaMock.expenseCategory.findFirst).toHaveBeenCalledWith({
        where: { name: 'Servicios', organizationId: orgId },
      });
      expect(prismaMock.expenseCategory.create).toHaveBeenCalledWith({
        data: { name: 'Servicios', organizationId: orgId },
      });
      expect(result.name).toBe('Servicios');
    });

    it('rejects duplicate names within the same organization (409)', async () => {
      prismaMock.expenseCategory.findFirst.mockResolvedValue({ id: 'c1' });

      await expect(service.create({ name: 'Arriendo' }, orgId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('allows the same name in another organization', async () => {
      prismaMock.expenseCategory.findFirst.mockResolvedValue(null);
      prismaMock.expenseCategory.create.mockResolvedValue({
        id: 'c2',
        name: 'Arriendo',
        organizationId: 'org-2',
      });

      const result = await service.create({ name: 'Arriendo' }, 'org-2');

      expect(prismaMock.expenseCategory.findFirst).toHaveBeenCalledWith({
        where: { name: 'Arriendo', organizationId: 'org-2' },
      });
      expect(result.organizationId).toBe('org-2');
    });

    it('throws BadRequestException when organizationId is missing', async () => {
      await expect(service.create({ name: 'X' }, undefined)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('updates a category within the organization', async () => {
      prismaMock.expenseCategory.findFirst
        .mockResolvedValueOnce({
          id: 'c1',
          name: 'Arriendo',
          organizationId: orgId,
        })
        .mockResolvedValueOnce(null);
      prismaMock.expenseCategory.update.mockResolvedValue({
        id: 'c1',
        name: 'Arriendo Nómina',
        active: true,
      });

      const result = await service.update(
        'c1',
        { name: 'Arriendo Nómina' },
        orgId,
      );

      expect(prismaMock.expenseCategory.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { name: 'Arriendo Nómina' },
      });
      expect(result.name).toBe('Arriendo Nómina');
    });

    it('throws NotFoundException when category is not in the organization', async () => {
      prismaMock.expenseCategory.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nope', { name: 'X' }, orgId),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects renaming to a duplicate name within the org (409)', async () => {
      prismaMock.expenseCategory.findFirst
        .mockResolvedValueOnce({ id: 'c1' })
        .mockResolvedValueOnce({ id: 'c2' });

      await expect(
        service.update('c1', { name: 'Seguridad' }, orgId),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('soft-deletes the category, keeping expense references intact', async () => {
      prismaMock.expenseCategory.findFirst.mockResolvedValue({
        id: 'c1',
        active: true,
      });
      prismaMock.expenseCategory.update.mockResolvedValue({
        id: 'c1',
        active: false,
      });

      const result = await service.remove('c1', orgId);

      expect(prismaMock.expenseCategory.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { active: false },
      });
      expect(prismaMock.expenseCategory.delete).not.toHaveBeenCalled();
      expect(result.active).toBe(false);
    });

    it('throws NotFoundException when category is not in the organization', async () => {
      prismaMock.expenseCategory.findFirst.mockResolvedValue(null);

      await expect(service.remove('nope', orgId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
