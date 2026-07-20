import { ExportsService } from './exports.service';
import { ExportQueryDto } from './dto/export.dto';

describe('ExportsService', () => {
  let service: ExportsService;

  const prismaMock = {
    inventoryMovement: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    sale: {
      findMany: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
    },
    customer: {
      findMany: jest.fn(),
    },
  };

  const ORG_ID = 'org-1';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExportsService(prismaMock as never);
  });

  it('getInventoryMovements filters by organizationId', async () => {
    prismaMock.inventoryMovement.findMany.mockResolvedValue([]);
    prismaMock.inventoryMovement.count.mockResolvedValue(0);

    await service.getInventoryMovements(ORG_ID, {});

    expect(prismaMock.inventoryMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG_ID }),
      }),
    );
    expect(prismaMock.inventoryMovement.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG_ID }),
      }),
    );
  });

  it('exportSales filters by organizationId', async () => {
    prismaMock.sale.findMany.mockResolvedValue([]);
    const res = {
      setHeader: jest.fn(),
      end: jest.fn(),
      write: jest.fn(),
      flushHeaders: jest.fn(),
      pipe: jest.fn(),
      send: jest.fn(),
    };

    await service.exportSales(
      ORG_ID,
      { format: 'pdf', type: 'sales' } as ExportQueryDto,
      res,
    );

    expect(prismaMock.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG_ID }),
      }),
    );
  });

  it('exportProducts filters by organizationId', async () => {
    prismaMock.product.findMany.mockResolvedValue([]);
    const res = {
      setHeader: jest.fn(),
      end: jest.fn(),
      write: jest.fn(),
      flushHeaders: jest.fn(),
      pipe: jest.fn(),
      send: jest.fn(),
    };

    await service.exportProducts(
      ORG_ID,
      { format: 'pdf', type: 'products' } as ExportQueryDto,
      res,
    );

    expect(prismaMock.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG_ID,
          active: true,
        }),
      }),
    );
  });

  it('exportCustomers filters by organizationId', async () => {
    prismaMock.customer.findMany.mockResolvedValue([]);
    const res = {
      setHeader: jest.fn(),
      end: jest.fn(),
      write: jest.fn(),
      flushHeaders: jest.fn(),
      pipe: jest.fn(),
      send: jest.fn(),
    };

    await service.exportCustomers(
      ORG_ID,
      { format: 'pdf', type: 'customers' } as ExportQueryDto,
      res,
    );

    expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG_ID,
          active: true,
        }),
      }),
    );
  });

  it('exportInventory filters by organizationId', async () => {
    prismaMock.inventoryMovement.findMany.mockResolvedValue([]);
    const res = {
      setHeader: jest.fn(),
      end: jest.fn(),
      write: jest.fn(),
      flushHeaders: jest.fn(),
      pipe: jest.fn(),
      send: jest.fn(),
    };

    await service.exportInventory(
      ORG_ID,
      { format: 'pdf', type: 'inventory' } as ExportQueryDto,
      res,
    );

    expect(prismaMock.inventoryMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG_ID }),
      }),
    );
  });
});
