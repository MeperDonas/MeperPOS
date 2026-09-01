import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CashRegistersService } from './cash-registers.service';
import {
  setupTwoOrgFixture,
  type TwoOrgFixture,
} from '../testing/two-org-fixture';

const planLimitServiceMock = {};

describe('CashRegistersService — Integration (Two-Org Isolation)', () => {
  let fixture: TwoOrgFixture;
  let service: CashRegistersService;
  let registerAId: string;
  let registerBId: string;

  beforeAll(async () => {
    fixture = await setupTwoOrgFixture('cash-registers-int');
    service = new CashRegistersService(
      fixture.prisma as never,
      planLimitServiceMock as never,
    );

    const [registerA, registerB] = await Promise.all([
      fixture.prisma.cashRegister.create({
        data: { name: 'Caja A', organizationId: fixture.orgAId },
      }),
      fixture.prisma.cashRegister.create({
        data: { name: 'Caja B', organizationId: fixture.orgBId },
      }),
    ]);
    registerAId = registerA.id;
    registerBId = registerB.id;
  });

  afterAll(() =>
    fixture.teardown(async () => {
      await fixture.prisma.cashRegister.deleteMany({
        where: { organizationId: { in: [fixture.orgAId, fixture.orgBId] } },
      });
    }),
  );

  it('cross-org detail read returns 404 and leaks no foreign data', async () => {
    await expect(
      service.findOne(registerBId, fixture.orgAId),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.findOne(registerBId, fixture.orgAId),
    ).rejects.toThrow('Cash register not found');
  });

  it('list returns zero foreign-org rows', async () => {
    const list = await service.findAll(fixture.orgAId);
    expect(list.map((register) => register.id)).toEqual([registerAId]);
  });

  it('cross-org update is denied and the foreign row stays unchanged', async () => {
    await expect(
      service.update(registerBId, { name: 'Hijacked' }, fixture.orgAId),
    ).rejects.toThrow(NotFoundException);

    const unchanged = await fixture.prisma.cashRegister.findUniqueOrThrow({
      where: { id: registerBId },
    });
    expect(unchanged.name).toBe('Caja B');
  });

  it('cross-org delete is denied and the foreign row stays intact', async () => {
    await expect(
      service.remove(registerBId, fixture.orgAId),
    ).rejects.toThrow(NotFoundException);

    const stillThere = await fixture.prisma.cashRegister.findUniqueOrThrow({
      where: { id: registerBId },
    });
    expect(stillThere.name).toBe('Caja B');
  });

  it('missing organization context is a hard error, never an all-orgs read', async () => {
    // url-identifier-policy §1: a missing organization context is a hard
    // error, never an implicit "all organizations" query (expenses
    // requireOrganizationId convention).
    await expect(service.findAll(undefined)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.findOne(registerBId, undefined),
    ).rejects.toThrow(BadRequestException);
  });
});
