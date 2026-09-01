import { NotFoundException } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import {
  setupTwoOrgFixture,
  type TwoOrgFixture,
} from '../testing/two-org-fixture';

// Minimal mock: only create() consumes the sequence service and this spec
// seeds PurchaseOrder rows directly through Prisma.
const sequenceServiceMock = {};

describe('PurchaseOrdersService — Integration (Query Isolation)', () => {
  let prisma: TwoOrgFixture['prisma'];
  let fixture: TwoOrgFixture;
  let service: PurchaseOrdersService;
  let orderAOrgId: string;
  let orderBOrgId: string;
  let supplierBOrgId: string;

  beforeAll(async () => {
    fixture = await setupTwoOrgFixture('purchase-orders-int');
    prisma = fixture.prisma;
    service = new PurchaseOrdersService(
      prisma as never,
      sequenceServiceMock as never,
    );

    // Build the supplier + product + order chain for both orgs (same order
    // number per org: @@unique([organizationId, orderNumber]) allows it).
    const suppliers = await Promise.all([
      prisma.supplier.create({
        data: {
          name: 'PO Supplier A',
          documentNumber: 'PO-SUP-A-' + Date.now(),
          organizationId: fixture.orgAId,
        },
      }),
      prisma.supplier.create({
        data: {
          name: 'PO Supplier B',
          documentNumber: 'PO-SUP-B-' + Date.now(),
          organizationId: fixture.orgBId,
        },
      }),
    ]);
    supplierBOrgId = suppliers[1].id;

    const categories = await Promise.all([
      prisma.category.create({
        data: { name: 'PO Cat A', organizationId: fixture.orgAId },
      }),
      prisma.category.create({
        data: { name: 'PO Cat B', organizationId: fixture.orgBId },
      }),
    ]);

    const products = await Promise.all([
      prisma.product.create({
        data: {
          name: 'PO Product A',
          sku: 'PO-PROD-A-' + Date.now(),
          costPrice: 100,
          salePrice: 200,
          categoryId: categories[0].id,
          organizationId: fixture.orgAId,
        },
      }),
      prisma.product.create({
        data: {
          name: 'PO Product B',
          sku: 'PO-PROD-B-' + Date.now(),
          costPrice: 100,
          salePrice: 200,
          categoryId: categories[1].id,
          organizationId: fixture.orgBId,
        },
      }),
    ]);

    const [orderA, orderB] = await Promise.all([
      prisma.purchaseOrder.create({
        data: {
          orderNumber: 1,
          supplierId: suppliers[0].id,
          createdById: fixture.userAId,
          status: 'DRAFT',
          organizationId: fixture.orgAId,
          items: {
            create: {
              productId: products[0].id,
              qtyOrdered: 5,
              unitCost: 100,
              subtotal: 500,
              organizationId: fixture.orgAId,
            },
          },
        },
      }),
      prisma.purchaseOrder.create({
        data: {
          orderNumber: 1,
          supplierId: suppliers[1].id,
          createdById: fixture.userBId,
          status: 'DRAFT',
          organizationId: fixture.orgBId,
          items: {
            create: {
              productId: products[1].id,
              qtyOrdered: 5,
              unitCost: 100,
              subtotal: 500,
              organizationId: fixture.orgBId,
            },
          },
        },
      }),
    ]);
    orderAOrgId = orderA.id;
    orderBOrgId = orderB.id;
  });

  afterAll(() =>
    fixture.teardown(async () => {
      await prisma.purchaseOrderItem.deleteMany({
        where: { organizationId: { in: [fixture.orgAId, fixture.orgBId] } },
      });
      await prisma.purchaseOrder.deleteMany({
        where: { organizationId: { in: [fixture.orgAId, fixture.orgBId] } },
      });
      await prisma.product.deleteMany({
        where: { organizationId: { in: [fixture.orgAId, fixture.orgBId] } },
      });
      await prisma.category.deleteMany({
        where: { organizationId: { in: [fixture.orgAId, fixture.orgBId] } },
      });
      await prisma.supplier.deleteMany({
        where: { organizationId: { in: [fixture.orgAId, fixture.orgBId] } },
      });
    }),
  );

  it('cross-org detail read returns 404 and leaks no foreign data', async () => {
    await expect(service.findOne(orderBOrgId, fixture.orgAId)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.findOne(orderBOrgId, fixture.orgAId)).rejects.toThrow(
      'Orden de compra no encontrada',
    );
  });

  it('list returns zero foreign-org rows under supplier, status and pagination filters', async () => {
    const list = await service.findAll(fixture.orgAId, {});
    expect(list.data.map((order) => order.id)).toEqual([orderAOrgId]);

    // Foreign supplier id intersected with org scope must yield no rows
    const byForeignSupplier = await service.findAll(fixture.orgAId, {
      supplierId: supplierBOrgId,
    });
    expect(byForeignSupplier.data).toHaveLength(0);

    const byForeignQuery = await service.findAll(fixture.orgAId, {
      q: 'PO Supplier B',
    });
    expect(byForeignQuery.data).toHaveLength(0);

    const paged = await service.findAll(fixture.orgAId, { page: 2 });
    expect(paged.data).toHaveLength(0);
  });

  it('cross-org update is denied and the foreign row stays unchanged', async () => {
    await expect(
      service.update(orderBOrgId, { notes: 'Hijacked' }, fixture.orgAId),
    ).rejects.toThrow(NotFoundException);

    const unchanged = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: orderBOrgId },
    });
    expect(unchanged.notes).toBeNull();
    expect(unchanged.status).toBe('DRAFT');
  });

  it('cross-org confirm and cancel are denied and the foreign row stays intact', async () => {
    await expect(service.confirm(orderBOrgId, fixture.orgAId)).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      service.cancel(orderBOrgId, { reason: 'Hijacked' }, fixture.orgAId),
    ).rejects.toThrow(NotFoundException);

    const intact = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: orderBOrgId },
    });
    expect(intact.status).toBe('DRAFT');
    expect(intact.cancelReason).toBeNull();
  });
});
