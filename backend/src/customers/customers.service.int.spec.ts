import { NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import {
  setupTwoOrgFixture,
  type TwoOrgFixture,
} from '../testing/two-org-fixture';

// Minimal mock for the dependency not under test (only invalidateCache is used)
const planLimitServiceMock = {};

describe('CustomersService — Integration (Query Isolation)', () => {
  let prisma: TwoOrgFixture['prisma'];
  let fixture: TwoOrgFixture;
  let service: CustomersService;
  const documentNumber = 'INT-DOC-' + Date.now();
  let customerAOrgId: string;
  let customerBOrgId: string;

  beforeAll(async () => {
    fixture = await setupTwoOrgFixture('customers-int');
    prisma = fixture.prisma;
    service = new CustomersService(
      prisma as never,
      planLimitServiceMock as never,
    );

    // Create customer with the same document number in both orgs
    const customerA = await prisma.customer.create({
      data: {
        name: 'Customer Org1',
        documentType: 'CC',
        documentNumber,
        organizationId: fixture.orgAId,
      },
    });
    customerAOrgId = customerA.id;

    const customerB = await prisma.customer.create({
      data: {
        name: 'Customer Org2',
        documentType: 'CC',
        documentNumber,
        organizationId: fixture.orgBId,
      },
    });
    customerBOrgId = customerB.id;
  });

  afterAll(() =>
    fixture.teardown(async () => {
      await prisma.customer.deleteMany({
        where: { organizationId: { in: [fixture.orgAId, fixture.orgBId] } },
      });
    }),
  );

  it('cross-org detail read returns 404 and leaks no foreign data', async () => {
    await expect(
      service.findOne(customerBOrgId, fixture.orgAId),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.findOne(customerBOrgId, fixture.orgAId),
    ).rejects.toThrow('Customer not found');
  });

  it('list returns zero foreign-org rows under search, segment and pagination', async () => {
    const list = await service.findAll(fixture.orgAId, 1, 10);
    expect(list.data.map((customer) => customer.id)).toEqual([customerAOrgId]);

    const searched = await service.findAll(
      fixture.orgAId,
      1,
      10,
      'Customer Org2',
    );
    expect(searched.data).toHaveLength(0);
    expect(searched.meta.total).toBe(0);

    const byForeignDocument = await service.findAll(
      fixture.orgAId,
      1,
      10,
      documentNumber,
    );
    expect(byForeignDocument.data.map((c) => c.id)).toEqual([customerAOrgId]);

    const paged = await service.findAll(fixture.orgAId, 2, 10);
    expect(paged.data).toHaveLength(0);
  });

  it('cross-org update is denied and the foreign row stays unchanged', async () => {
    await expect(
      service.update(customerBOrgId, { name: 'Hijacked' }, fixture.orgAId),
    ).rejects.toThrow(NotFoundException);

    const unchanged = await prisma.customer.findUniqueOrThrow({
      where: { id: customerBOrgId },
    });
    expect(unchanged.name).toBe('Customer Org2');
  });

  it('cross-org delete is denied and the foreign row stays intact', async () => {
    await expect(
      service.remove(customerBOrgId, fixture.orgAId),
    ).rejects.toThrow(NotFoundException);

    const intact = await prisma.customer.findUniqueOrThrow({
      where: { id: customerBOrgId },
    });
    expect(intact.active).toBe(true);
    expect(intact.name).toBe('Customer Org2');
  });
});
