import { PrismaClient, Prisma, PlanType } from '@prisma/client';
import { SalesService } from './sales.service';
import { SequenceService } from '../common/sequences/sequence.service';
import { CacheService } from '../common/services/cache.service';
import { SettingsService } from '../settings/settings.service';

const prisma = new PrismaClient();

const cloudinaryServiceMock = {
  uploadImage: jest.fn(),
};

describe('SalesService — Integration (Numbering + Isolation)', () => {
  let salesService: SalesService;
  let orgId: string;
  let userId: string;
  let productId: string;
  let customerId: string;

  beforeAll(async () => {
    const settingsService = new SettingsService(
      prisma as never,
      cloudinaryServiceMock as never,
    );
    const cacheService = new CacheService();
    const sequenceService = new SequenceService();

    salesService = new SalesService(
      prisma as never,
      cacheService,
      settingsService,
      sequenceService,
    );

    // Create org
    const org = await prisma.organization.create({
      data: {
        name: 'Sales INT Org',
        slug: 'sales-int-' + Date.now(),
        plan: PlanType.BASIC,
        active: true,
      },
    });
    orgId = org.id;

    // Create user
    const user = await prisma.user.create({
      data: {
        email: 'sales-int-user@example.com',
        password: 'hash',
        name: 'Test User',
        tokenVersion: 0,
      },
    });
    userId = user.id;

    // Create category + product
    const category = await prisma.category.create({
      data: { name: 'Sales INT Cat', organizationId: orgId, active: true },
    });
    const product = await prisma.product.create({
      data: {
        name: 'Sales INT Product',
        sku: 'SALES-SKU-' + Date.now(),
        salePrice: new Prisma.Decimal(1000),
        costPrice: new Prisma.Decimal(500),
        taxRate: new Prisma.Decimal(19),
        stock: 100,
        minStock: 1,
        active: true,
        categoryId: category.id,
        organizationId: orgId,
      },
    });
    productId = product.id;

    // Create customer
    const customer = await prisma.customer.create({
      data: {
        name: 'Sales INT Customer',
        documentType: 'CC',
        documentNumber: '12345678',
        organizationId: orgId,
        active: true,
      },
    });
    customerId = customer.id;

    // Ensure sequence exists
    const year = new Date().getFullYear();
    await prisma.organizationSequence.create({
      data: {
        organizationId: orgId,
        type: 'SALE',
        prefix: 'REC',
        currentNumber: 0,
        year,
      },
    });
  });

  afterAll(async () => {
    await prisma.saleItem.deleteMany({
      where: { sale: { organizationId: orgId } },
    });
    await prisma.payment.deleteMany({
      where: { sale: { organizationId: orgId } },
    });
    await prisma.sale.deleteMany({ where: { organizationId: orgId } });
    await prisma.inventoryMovement.deleteMany({
      where: { organizationId: orgId },
    });
    await prisma.product.deleteMany({ where: { organizationId: orgId } });
    await prisma.category.deleteMany({ where: { organizationId: orgId } });
    await prisma.customer.deleteMany({ where: { organizationId: orgId } });
    await prisma.organizationSequence.deleteMany({
      where: { organizationId: orgId },
    });
    await prisma.organizationUser.deleteMany({
      where: { organizationId: orgId },
    });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it('should assign consecutive saleNumbers for two sales in the same org', async () => {
    const dto1 = {
      customerId,
      items: [{ productId, quantity: 1 }],
      payments: [{ method: 'CASH' as const, amount: 1190 }],
    };

    const dto2 = {
      customerId,
      items: [{ productId, quantity: 1 }],
      payments: [{ method: 'CASH' as const, amount: 1190 }],
    };

    const sale1 = await salesService.create(dto1, userId, orgId);
    const sale2 = await salesService.create(dto2, userId, orgId);

    expect(sale1.saleNumber).toBe(1);
    expect(sale2.saleNumber).toBe(2);
  });
});
