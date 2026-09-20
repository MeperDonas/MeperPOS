import { ProductType } from '@prisma/client';
import { SalesService } from './sales.service';

/**
 * Selling a service must be indistinguishable from selling anything else from the
 * cashier's point of view, and completely invisible to the kárdex: no stock guard, no
 * decrement, no movement on the way in, and no restore on the way out.
 *
 * These specs are deliberately separate from `sales.service.spec.ts` so the
 * service-specific contract stays reviewable on its own.
 */
describe('SalesService — selling services', () => {
  let service: SalesService;

  const prismaMock = {
    $transaction: jest.fn(),
    sale: {
      findFirst: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
    },
    customer: {
      findFirst: jest.fn(),
    },
  };

  const cacheMock = { clear: jest.fn() };
  const settingsServiceMock = { find: jest.fn() };
  const sequenceServiceMock = { nextNumber: jest.fn() };
  const receiptsServiceMock = { generateSaleReceiptPdf: jest.fn() };

  const productRow = (
    overrides: Partial<{
      id: string;
      name: string;
      type: ProductType;
      stock: number;
      salePrice: number;
    }> = {},
  ) => ({
    id: 'prod-1',
    name: 'Test Product',
    type: ProductType.PRODUCT,
    active: true,
    salePrice: 100,
    taxable: false,
    taxRate: 0,
    stock: 10,
    category: { taxable: false, defaultTaxRate: null },
    ...overrides,
  });

  const buildTx = () => ({
    sale: {
      create: jest.fn().mockResolvedValue({ id: 'sale-new', saleNumber: 42 }),
    },
    saleItem: { create: jest.fn() },
    product: {
      findFirst: jest.fn().mockResolvedValue({ stock: 10 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
    },
    inventoryMovement: { create: jest.fn() },
    payment: { create: jest.fn() },
  });

  const wireTransaction = (txMock: ReturnType<typeof buildTx>) => {
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => callback(txMock),
    );
    return txMock;
  };

  const wireCreate = () => {
    sequenceServiceMock.nextNumber.mockResolvedValue({
      number: 42,
      formatted: '42',
    });
    prismaMock.sale.findFirst.mockResolvedValue({
      id: 'sale-new',
      saleNumber: 42,
      userId: 'user-1',
      user: { id: 'user-1', name: 'User', email: 'user@example.com' },
      customer: null,
      items: [],
      payments: [],
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SalesService(
      prismaMock as never,
      cacheMock as never,
      settingsServiceMock as never,
      sequenceServiceMock as never,
      receiptsServiceMock as never,
    );
    wireCreate();
  });

  const serviceRow = (overrides = {}) =>
    productRow({
      id: 'serv-1',
      name: 'MANTENIMIENTO',
      type: ProductType.SERVICE,
      salePrice: 20000,
      ...overrides,
    });

  describe('create', () => {
    it('sells a zero-stock service and writes no inventory movement', async () => {
      const txMock = wireTransaction(buildTx());
      prismaMock.product.findFirst.mockResolvedValue(serviceRow({ stock: 0 }));

      await service.create(
        {
          items: [{ productId: 'serv-1', quantity: 1, discountAmount: 0 }],
          discountAmount: 0,
          payments: [{ method: 'CASH' as const, amount: 20000 }],
        },
        'user-1',
        'org-1',
      );

      expect(txMock.saleItem.create).toHaveBeenCalledTimes(1);
      expect(txMock.product.updateMany).not.toHaveBeenCalled();
      expect(txMock.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('accepts an arbitrary service quantity without a stock ceiling', async () => {
      const txMock = wireTransaction(buildTx());
      prismaMock.product.findFirst.mockResolvedValue(serviceRow({ stock: 0 }));

      await service.create(
        {
          items: [{ productId: 'serv-1', quantity: 5, discountAmount: 0 }],
          discountAmount: 0,
          payments: [{ method: 'CASH' as const, amount: 100000 }],
        },
        'user-1',
        'org-1',
      );

      expect(txMock.saleItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ quantity: 5 }),
        }),
      );
      expect(txMock.product.updateMany).not.toHaveBeenCalled();
      expect(txMock.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('still guards, decrements and records the movement for a product in the same sale', async () => {
      const txMock = wireTransaction(buildTx());
      prismaMock.product.findFirst
        .mockResolvedValueOnce(serviceRow({ stock: 0 }))
        .mockResolvedValueOnce(productRow({ id: 'prod-1', stock: 10 }));

      await service.create(
        {
          items: [
            { productId: 'serv-1', quantity: 1, discountAmount: 0 },
            { productId: 'prod-1', quantity: 1, discountAmount: 0 },
          ],
          discountAmount: 0,
          payments: [{ method: 'CASH' as const, amount: 20100 }],
        },
        'user-1',
        'org-1',
      );

      expect(txMock.product.updateMany).toHaveBeenCalledTimes(1);
      expect(txMock.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'prod-1' }),
        }),
      );
      expect(txMock.inventoryMovement.create).toHaveBeenCalledTimes(1);
      expect(txMock.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ productId: 'prod-1', type: 'SALE' }),
        }),
      );
    });

    it('sells an untracked product with no stock and writes no inventory movement', async () => {
      const txMock = wireTransaction(buildTx());
      // An untracked product is merchandise nobody counts: it is billed like a
      // service, so its stock is never guarded or moved.
      prismaMock.product.findFirst.mockResolvedValue({
        ...productRow({ id: 'prod-1', stock: 0 }),
        tracksStock: false,
      });

      await service.create(
        {
          items: [{ productId: 'prod-1', quantity: 1, discountAmount: 0 }],
          discountAmount: 0,
          payments: [{ method: 'CASH' as const, amount: 100 }],
        },
        'user-1',
        'org-1',
      );

      expect(txMock.saleItem.create).toHaveBeenCalledTimes(1);
      expect(txMock.product.updateMany).not.toHaveBeenCalled();
      expect(txMock.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('update — cancelling a sale', () => {
    const saleWithItem = (productId: string, quantity: number) => ({
      id: 'sale-1',
      status: 'COMPLETED',
      userId: 'user-1',
      organizationId: 'org-1',
      saleNumber: 10,
      items: [{ id: 'si-1', productId, quantity }],
    });

    const cancelledSale = {
      id: 'sale-1',
      status: 'CANCELLED',
      userId: 'user-1',
      organizationId: 'org-1',
      saleNumber: 10,
      cancelledAt: new Date(),
      cancelledById: 'user-1',
      cancelReason: 'Cliente arrepentido',
      items: [],
      payments: [],
      customer: null,
      user: { id: 'user-1', name: 'User', email: 'user@example.com' },
    };

    it('cancels a service sale without restoring stock or writing a RETURN', async () => {
      const txMock = {
        product: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ stock: 0, type: ProductType.SERVICE }),
          update: jest.fn(),
        },
        inventoryMovement: { create: jest.fn() },
        sale: { update: jest.fn() },
      };
      prismaMock.sale.findFirst
        .mockResolvedValueOnce(saleWithItem('serv-1', 2))
        .mockResolvedValueOnce(cancelledSale);
      prismaMock.$transaction.mockImplementation(
        async (callback: (tx: unknown) => unknown) => callback(txMock),
      );

      await service.update(
        'sale-1',
        { status: 'CANCELLED', cancelReason: 'Cliente arrepentido' },
        'user-1',
        'org-1',
      );

      expect(txMock.product.update).not.toHaveBeenCalled();
      expect(txMock.inventoryMovement.create).not.toHaveBeenCalled();
      expect(txMock.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });

    it('still restores stock and writes a RETURN for a product line', async () => {
      const txMock = {
        product: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ stock: 5, type: ProductType.PRODUCT }),
          update: jest.fn(),
        },
        inventoryMovement: { create: jest.fn() },
        sale: { update: jest.fn() },
      };
      prismaMock.sale.findFirst
        .mockResolvedValueOnce(saleWithItem('prod-1', 2))
        .mockResolvedValueOnce(cancelledSale);
      prismaMock.$transaction.mockImplementation(
        async (callback: (tx: unknown) => unknown) => callback(txMock),
      );

      await service.update(
        'sale-1',
        { status: 'CANCELLED', cancelReason: 'Cliente arrepentido' },
        'user-1',
        'org-1',
      );

      expect(txMock.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { stock: 7 } }),
      );
      expect(txMock.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 'prod-1',
            type: 'RETURN',
            quantity: 2,
            previousStock: 5,
            newStock: 7,
          }),
        }),
      );
    });
  });
});
