import { Prisma } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import {
  setupTwoOrgFixture,
  type TwoOrgFixture,
} from '../testing/two-org-fixture';

// Minimal mocks for dependencies not under test
const cloudinaryServiceMock = {};
const planLimitServiceMock = {};

describe('ProductsService — Integration (Query Isolation)', () => {
  let prisma: TwoOrgFixture['prisma'];
  let fixture: TwoOrgFixture;
  let service: ProductsService;
  const sku = 'INT-SKU-' + Date.now();
  let productAOrgId: string;
  let productBOrgId: string;
  let catBOrgId: string;

  beforeAll(async () => {
    fixture = await setupTwoOrgFixture('products-int');
    prisma = fixture.prisma;
    service = new ProductsService(
      prisma as never,
      cloudinaryServiceMock as never,
      planLimitServiceMock as never,
    );

    // Create category per org
    const [catA, catB] = await Promise.all([
      prisma.category.create({
        data: {
          name: 'Cat INT A',
          organizationId: fixture.orgAId,
          active: true,
        },
      }),
      prisma.category.create({
        data: {
          name: 'Cat INT B',
          organizationId: fixture.orgBId,
          active: true,
        },
      }),
    ]);
    catBOrgId = catB.id;

    // Create product with same SKU in both orgs
    const productA = await prisma.product.create({
      data: {
        name: 'Product Org1',
        sku,
        salePrice: new Prisma.Decimal(100),
        costPrice: new Prisma.Decimal(50),
        taxRate: new Prisma.Decimal(19),
        stock: 10,
        minStock: 1,
        active: true,
        categoryId: catA.id,
        organizationId: fixture.orgAId,
      },
    });
    productAOrgId = productA.id;

    const productB = await prisma.product.create({
      data: {
        name: 'Product Org2',
        sku,
        salePrice: new Prisma.Decimal(200),
        costPrice: new Prisma.Decimal(100),
        taxRate: new Prisma.Decimal(19),
        stock: 20,
        minStock: 2,
        active: true,
        categoryId: catB.id,
        organizationId: fixture.orgBId,
      },
    });
    productBOrgId = productB.id;
  });

  afterAll(() =>
    fixture.teardown(async () => {
      await prisma.product.deleteMany({
        where: { organizationId: { in: [fixture.orgAId, fixture.orgBId] } },
      });
      await prisma.category.deleteMany({
        where: { organizationId: { in: [fixture.orgAId, fixture.orgBId] } },
      });
    }),
  );

  it('should return only the product belonging to the requested organization when searching by SKU', async () => {
    const productOrg1 = await prisma.product.findFirst({
      where: { sku, organizationId: fixture.orgAId },
    });
    expect(productOrg1).not.toBeNull();
    expect(productOrg1!.name).toBe('Product Org1');

    const productOrg2 = await prisma.product.findFirst({
      where: { sku, organizationId: fixture.orgBId },
    });
    expect(productOrg2).not.toBeNull();
    expect(productOrg2!.name).toBe('Product Org2');
  });

  it('cross-org detail read returns 404 and leaks no foreign data', async () => {
    await expect(
      service.findOne(productBOrgId, fixture.orgAId),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.findOne(productBOrgId, fixture.orgAId),
    ).rejects.toThrow('Product not found');
  });

  it('list returns zero foreign-org rows under filters and pagination', async () => {
    const list = await service.findAll(fixture.orgAId, 1, 10);
    expect(list.data.map((product) => product.id)).toEqual([productAOrgId]);

    const searched = await service.findAll(
      fixture.orgAId,
      1,
      10,
      'Product Org2',
    );
    expect(searched.data).toHaveLength(0);
    expect(searched.meta.total).toBe(0);

    const byForeignCategory = await service.findAll(
      fixture.orgAId,
      1,
      10,
      undefined,
      catBOrgId,
    );
    expect(byForeignCategory.data).toHaveLength(0);

    const paged = await service.findAll(fixture.orgAId, 2, 10);
    expect(paged.data).toHaveLength(0);
  });

  it('cross-org update is denied and the foreign row stays unchanged', async () => {
    await expect(
      service.update(
        productBOrgId,
        { name: 'Hijacked' },
        fixture.userAId,
        fixture.orgAId,
      ),
    ).rejects.toThrow(NotFoundException);

    const unchanged = await prisma.product.findUniqueOrThrow({
      where: { id: productBOrgId },
    });
    expect(unchanged.name).toBe('Product Org2');
  });

  it('cross-org deactivate and delete are denied and the foreign row stays intact', async () => {
    await expect(
      service.deactivate(productBOrgId, fixture.orgAId),
    ).rejects.toThrow(NotFoundException);
    await expect(service.remove(productBOrgId, fixture.orgAId)).rejects.toThrow(
      NotFoundException,
    );

    const intact = await prisma.product.findUniqueOrThrow({
      where: { id: productBOrgId },
    });
    expect(intact.active).toBe(true);
    expect(intact.name).toBe('Product Org2');
  });
});
