import { NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import {
  setupTwoOrgFixture,
  type TwoOrgFixture,
} from '../testing/two-org-fixture';

describe('SuppliersService — Integration (Query Isolation)', () => {
  let prisma: TwoOrgFixture['prisma'];
  let fixture: TwoOrgFixture;
  let service: SuppliersService;
  const documentNumber = 'INT-NIT-' + Date.now();
  let supplierAOrgId: string;
  let supplierBOrgId: string;

  beforeAll(async () => {
    fixture = await setupTwoOrgFixture('suppliers-int');
    prisma = fixture.prisma;
    service = new SuppliersService(prisma as never);

    // Create supplier with the same document number in both orgs
    const supplierA = await prisma.supplier.create({
      data: {
        name: 'Supplier Org1',
        documentNumber,
        organizationId: fixture.orgAId,
      },
    });
    supplierAOrgId = supplierA.id;

    const supplierB = await prisma.supplier.create({
      data: {
        name: 'Supplier Org2',
        documentNumber,
        organizationId: fixture.orgBId,
      },
    });
    supplierBOrgId = supplierB.id;
  });

  afterAll(() =>
    fixture.teardown(async () => {
      await prisma.supplier.deleteMany({
        where: { organizationId: { in: [fixture.orgAId, fixture.orgBId] } },
      });
    }),
  );

  it('cross-org detail read returns 404 and leaks no foreign data', async () => {
    await expect(
      service.findOne(supplierBOrgId, fixture.orgAId),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.findOne(supplierBOrgId, fixture.orgAId),
    ).rejects.toThrow('Proveedor no encontrado');
  });

  it('list returns zero foreign-org rows under search, status and pagination', async () => {
    const list = await service.findAll({}, fixture.orgAId);
    expect(list.data.map((supplier) => supplier.id)).toEqual([supplierAOrgId]);

    const searched = await service.findAll(
      { search: 'Supplier Org2' },
      fixture.orgAId,
    );
    expect(searched.data).toHaveLength(0);
    expect(searched.meta.total).toBe(0);

    const byStatus = await service.findAll(
      { status: 'active' },
      fixture.orgAId,
    );
    expect(byStatus.data.map((s) => s.id)).toEqual([supplierAOrgId]);

    const paged = await service.findAll({ page: 2 }, fixture.orgAId);
    expect(paged.data).toHaveLength(0);
  });

  it('cross-org update is denied and the foreign row stays unchanged', async () => {
    await expect(
      service.update(supplierBOrgId, { name: 'Hijacked' }, fixture.orgAId),
    ).rejects.toThrow(NotFoundException);

    const unchanged = await prisma.supplier.findUniqueOrThrow({
      where: { id: supplierBOrgId },
    });
    expect(unchanged.name).toBe('Supplier Org2');
  });

  it('cross-org deactivate and reactivate are denied and the foreign row stays intact', async () => {
    await expect(
      service.remove(supplierBOrgId, fixture.orgAId),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.reactivate(supplierBOrgId, fixture.orgAId),
    ).rejects.toThrow(NotFoundException);

    const intact = await prisma.supplier.findUniqueOrThrow({
      where: { id: supplierBOrgId },
    });
    expect(intact.active).toBe(true);
    expect(intact.name).toBe('Supplier Org2');
  });
});
