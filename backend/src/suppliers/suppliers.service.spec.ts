import { SuppliersService } from './suppliers.service';
import { validate } from 'class-validator';
import { SupplierAccountType } from '@prisma/client';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

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
    jest.resetAllMocks();
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

    it('survives accountNumber, accountType and bank into the create payload', async () => {
      prismaMock.supplier.findFirst.mockResolvedValue(null);
      prismaMock.supplier.create.mockResolvedValue({
        id: 's1',
        name: 'Proveedor Andino',
        documentNumber: '900123456',
        bank: 'Bancolombia',
        accountNumber: '1234567890',
        accountType: 'SAVINGS',
        organizationId: orgId,
        active: true,
      });

      const dto = {
        name: 'Proveedor Andino',
        documentNumber: '900123456',
        bank: 'Bancolombia',
        accountNumber: '1234567890',
        accountType: 'SAVINGS' as SupplierAccountType,
      };
      const result = await service.create(dto, orgId);

      expect(prismaMock.supplier.create).toHaveBeenCalledWith({
        data: { ...dto, organizationId: orgId },
      });
      expect(result.bank).toBe('Bancolombia');
      expect(result.accountType).toBe('SAVINGS');
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

    it('survives accountNumber, accountType and bank into the update payload', async () => {
      prismaMock.supplier.findFirst
        .mockResolvedValueOnce({ id: 's1', documentNumber: '900' })
        .mockResolvedValueOnce(null);
      prismaMock.supplier.update.mockResolvedValue({
        id: 's1',
        name: 'Andino Updated',
        documentNumber: '900',
        bank: 'Davivienda',
        accountNumber: '0987654321',
        accountType: 'CHECKING',
      });

      const dto = {
        name: 'Andino Updated',
        bank: 'Davivienda',
        accountNumber: '0987654321',
        accountType: 'CHECKING' as SupplierAccountType,
      };
      const result = await service.update('s1', dto, orgId);

      expect(prismaMock.supplier.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: dto,
      });
      expect(result.bank).toBe('Davivienda');
      expect(result.accountType).toBe('CHECKING');
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

  describe('accountType field validation', () => {
    it('accepts SAVINGS and CHECKING as valid enum values on create', async () => {
      const dto = new CreateSupplierDto();
      dto.name = 'Andino';
      dto.documentNumber = '900';
      dto.accountType = 'SAVINGS';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('accepts CHECKING on update', async () => {
      const dto = new UpdateSupplierDto();
      dto.accountType = 'CHECKING';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects an arbitrary invalid accountType value (e.g. AHORROS)', async () => {
      const dto = new CreateSupplierDto();
      dto.name = 'Andino';
      dto.documentNumber = '900';
      dto.accountType = 'AHORROS' as SupplierAccountType;
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'accountType')).toBe(true);
    });

    it('treats accountNumber and accountType as optional fields', async () => {
      const dto = new CreateSupplierDto();
      dto.name = 'Andino';
      dto.documentNumber = '900';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
