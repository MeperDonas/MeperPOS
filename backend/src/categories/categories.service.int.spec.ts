import { NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import {
  setupTwoOrgFixture,
  type TwoOrgFixture,
} from '../testing/two-org-fixture';

describe('CategoriesService — Integration (Query Isolation)', () => {
  let prisma: TwoOrgFixture['prisma'];
  let fixture: TwoOrgFixture;
  let service: CategoriesService;
  let categoryAOrgId: string;
  let categoryBOrgId: string;

  beforeAll(async () => {
    fixture = await setupTwoOrgFixture('categories-int');
    prisma = fixture.prisma;
    service = new CategoriesService(prisma as never);

    const categoryA = await prisma.category.create({
      data: {
        name: 'Cat INT A',
        organizationId: fixture.orgAId,
        active: true,
      },
    });
    categoryAOrgId = categoryA.id;

    const categoryB = await prisma.category.create({
      data: {
        name: 'Cat INT B',
        organizationId: fixture.orgBId,
        active: true,
      },
    });
    categoryBOrgId = categoryB.id;
  });

  afterAll(() =>
    fixture.teardown(async () => {
      await prisma.category.deleteMany({
        where: { organizationId: { in: [fixture.orgAId, fixture.orgBId] } },
      });
    }),
  );

  it('cross-org detail read returns 404 and leaks no foreign data', async () => {
    await expect(
      service.findOne(categoryBOrgId, fixture.orgAId),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.findOne(categoryBOrgId, fixture.orgAId),
    ).rejects.toThrow('Category not found');
  });

  it('list returns zero foreign-org rows under search and pagination', async () => {
    const list = await service.findAll(fixture.orgAId, 1, 10);
    expect(list.data.map((category) => category.id)).toEqual([categoryAOrgId]);

    const searched = await service.findAll(fixture.orgAId, 1, 10, 'Cat INT B');
    expect(searched.data).toHaveLength(0);
    expect(searched.meta.total).toBe(0);

    const paged = await service.findAll(fixture.orgAId, 2, 10);
    expect(paged.data).toHaveLength(0);
  });

  it('cross-org update is denied and the foreign row stays unchanged', async () => {
    await expect(
      service.update(categoryBOrgId, { name: 'Hijacked' }, fixture.orgAId),
    ).rejects.toThrow(NotFoundException);

    const unchanged = await prisma.category.findUniqueOrThrow({
      where: { id: categoryBOrgId },
    });
    expect(unchanged.name).toBe('Cat INT B');
  });

  it('cross-org delete is denied and the foreign row stays intact', async () => {
    await expect(
      service.remove(categoryBOrgId, fixture.orgAId),
    ).rejects.toThrow(NotFoundException);

    const intact = await prisma.category.findUniqueOrThrow({
      where: { id: categoryBOrgId },
    });
    expect(intact.active).toBe(true);
    expect(intact.name).toBe('Cat INT B');
  });
});
