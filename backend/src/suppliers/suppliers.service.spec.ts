import { SuppliersService } from './suppliers.service';

describe('SuppliersService', () => {
  let service: SuppliersService;
  const orgId = 'org-1';

  const prismaMock = {
    supplier: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SuppliersService(prismaMock as never);
  });

  describe('create', () => {
    it('creates supplier scoped to organization', async () => {
      prismaMock.supplier.findFirst.mockResolvedValue(null);
      prismaMock.supplier.create.mockResolvedValue({
        id: 's1',
        name: 'Proveedor Andino',
        documentNumber: '900123456',
        organizationId: orgId,
        active: true,
      });

      const dto = { name: 'Proveedor Andino', documentNumber: '900123456' };
      const result = await service.create(dto, orgId);

      expect(prismaMock.supplier.findFirst).toHaveBeenCalledWith({
        where: { documentNumber: '900123456', organizationId: orgId },
      });
      expect(prismaMock.supplier.create).toHaveBeenCalledWith({
        data: { ...dto, organizationId: orgId },
      });
      expect(result.name).toBe('Proveedor Andino');
    });

    it('throws ConflictException when document exists in organization', async () => {
      prismaMock.supplier.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({ name: 'X', documentNumber: '900123456' }, orgId),
      ).rejects.toThrow('Ya existe un proveedor con ese número de documento');
    });
  });

  describe('findAll', () => {
    it('filters by organizationId', async () => {
      prismaMock.supplier.findMany.mockResolvedValue([]);
      prismaMock.supplier.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 1, limit: 10 }, orgId);

      expect(prismaMock.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: orgId }),
        }),
      );
      expect(result.data).toHaveLength(0);
    });

    it('includes search and status filters', async () => {
      prismaMock.supplier.findMany.mockResolvedValue([
        { id: 's1', name: 'Andino', active: true },
      ]);
      prismaMock.supplier.count.mockResolvedValue(1);

      const result = await service.findAll(
        { page: 1, limit: 10, search: 'andino', status: 'active' },
        orgId,
      );

      expect(prismaMock.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
            active: true,
            OR: expect.any(Array),
          }),
        }),
      );
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('returns supplier when found in organization', async () => {
      prismaMock.supplier.findFirst.mockResolvedValue({
        id: 's1',
        name: 'Andino',
        active: true,
      });

      const result = await service.findOne('s1', orgId);

      expect(prismaMock.supplier.findFirst).toHaveBeenCalledWith({
        where: { id: 's1', organizationId: orgId },
      });
      expect(result.name).toBe('Andino');
    });

    it('throws NotFoundException when supplier not in organization', async () => {
      prismaMock.supplier.findFirst.mockResolvedValue(null);

      await expect(service.findOne('s-999', orgId)).rejects.toThrow(
        'Proveedor no encontrado',
      );
    });
  });

  describe('update', () => {
    it('updates supplier within organization', async () => {
      prismaMock.supplier.findFirst
        .mockResolvedValueOnce({ id: 's1', documentNumber: '900' })
        .mockResolvedValueOnce(null);
      prismaMock.supplier.update.mockResolvedValue({
        id: 's1',
        name: 'Andino Updated',
        documentNumber: '900',
      });

      const result = await service.update(
        's1',
        { name: 'Andino Updated' },
        orgId,
      );

      expect(prismaMock.supplier.findFirst).toHaveBeenCalledWith({
        where: { id: 's1', organizationId: orgId },
      });
      expect(prismaMock.supplier.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { name: 'Andino Updated' },
      });
      expect(result.name).toBe('Andino Updated');
    });

    it('throws NotFoundException when supplier not in organization', async () => {
      prismaMock.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.update('s-999', { name: 'X' }, orgId),
      ).rejects.toThrow('Proveedor no encontrado');
    });

    it('throws ConflictException when new document exists in organization', async () => {
      prismaMock.supplier.findFirst
        .mockResolvedValueOnce({ id: 's1', documentNumber: '900' })
        .mockResolvedValueOnce({ id: 'other' });

      await expect(
        service.update('s1', { documentNumber: '901' }, orgId),
      ).rejects.toThrow('Ya existe un proveedor con ese número de documento');
    });
  });

  describe('remove', () => {
    it('deactivates supplier within organization', async () => {
      prismaMock.supplier.findFirst.mockResolvedValue({
        id: 's1',
        name: 'Andino',
        active: true,
      });
      prismaMock.supplier.update.mockResolvedValue({
        id: 's1',
        name: 'Andino',
        active: false,
      });

      const result = await service.remove('s1', orgId);

      expect(prismaMock.supplier.findFirst).toHaveBeenCalledWith({
        where: { id: 's1', organizationId: orgId },
      });
      expect(prismaMock.supplier.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { active: false },
      });
      expect(result.active).toBe(false);
    });

    it('throws NotFoundException when supplier not in organization', async () => {
      prismaMock.supplier.findFirst.mockResolvedValue(null);

      await expect(service.remove('s-999', orgId)).rejects.toThrow(
        'Proveedor no encontrado',
      );
    });
  });

  describe('reactivate', () => {
    it('reactivates supplier within organization', async () => {
      prismaMock.supplier.findFirst.mockResolvedValue({
        id: 's1',
        name: 'Andino',
        active: false,
      });
      prismaMock.supplier.update.mockResolvedValue({
        id: 's1',
        name: 'Andino',
        active: true,
      });

      const result = await service.reactivate('s1', orgId);

      expect(prismaMock.supplier.findFirst).toHaveBeenCalledWith({
        where: { id: 's1', organizationId: orgId },
      });
      expect(prismaMock.supplier.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { active: true },
      });
      expect(result.active).toBe(true);
    });

    it('throws NotFoundException when supplier not in organization', async () => {
      prismaMock.supplier.findFirst.mockResolvedValue(null);

      await expect(service.reactivate('s-999', orgId)).rejects.toThrow(
        'Proveedor no encontrado',
      );
    });
  });
});
