import { PrismaClient, Prisma, PlanType } from '@prisma/client';
import { ProductsService } from './products.service';

const prisma = new PrismaClient();

// Minimal mocks for dependencies not under test
const settingsServiceMock = {
  find: jest.fn().mockResolvedValue({}),
};

const cloudinaryServiceMock = {};
const planLimitServiceMock = {};

describe('ProductsService — Integration (Query Isolation)', () => {
  let service: ProductsService;
  let org1Id: string;
  let org2Id: string;
  const sku = 'INT-SKU-' + Date.now();

  beforeAll(async () => {
    service = new ProductsService(
      prisma as never,
      settingsServiceMock as never,
      cloudinaryServiceMock as never,
      planLimitServiceMock as never,
    );

    // Create two orgs
    const org1 = await prisma.organization.create({
      data: {
        name: 'Org 1 INT',
        slug: 'org1-int-' + Date.now(),
        plan: PlanType.BASIC,
        active: true,
      },
    });
    const org2 = await prisma.organization.create({
      data: {
        name: 'Org 2 INT',
        slug: 'org2-int-' + Date.now(),
        plan: PlanType.BASIC,
        active: true,
      },
    });
    org1Id = org1.id;
    org2Id = org2.id;

    // Create category per org
    const cat1 = await prisma.category.create({
      data: { name: 'Cat INT 1', organizationId: org1Id, active: true },
    });
    const cat2 = await prisma.category.create({
      data: { name: 'Cat INT 2', organizationId: org2Id, active: true },
    });

    // Create product with same SKU in both orgs
    await prisma.product.create({
      data: {
        name: 'Product Org1',
        sku,
        salePrice: new Prisma.Decimal(100),
        costPrice: new Prisma.Decimal(50),
        taxRate: new Prisma.Decimal(19),
        stock: 10,
        minStock: 1,
        active: true,
        categoryId: cat1.id,
        organizationId: org1Id,
      },
    });

    await prisma.product.create({
      data: {
        name: 'Product Org2',
        sku,
        salePrice: new Prisma.Decimal(200),
        costPrice: new Prisma.Decimal(100),
        taxRate: new Prisma.Decimal(19),
        stock: 20,
        minStock: 2,
        active: true,
        categoryId: cat2.id,
        organizationId: org2Id,
      },
    });
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { sku } });
    await prisma.category.deleteMany({
      where: { name: { in: ['Cat INT 1', 'Cat INT 2'] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [org1Id, org2Id] } },
    });
    await prisma.$disconnect();
  });

  it('should return only the product belonging to the requested organization when searching by SKU', async () => {
    const productOrg1 = await prisma.product.findFirst({
      where: { sku, organizationId: org1Id },
    });
    expect(productOrg1).not.toBeNull();
    expect(productOrg1!.name).toBe('Product Org1');

    const productOrg2 = await prisma.product.findFirst({
      where: { sku, organizationId: org2Id },
    });
    expect(productOrg2).not.toBeNull();
    expect(productOrg2!.name).toBe('Product Org2');
  });
});
