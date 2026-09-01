import { PlanType, PrismaClient } from '@prisma/client';

/**
 * Shared two-organization integration fixture.
 *
 * Extracted from the expenses service integration spec pattern: a real
 * PrismaClient, two organizations plus two users created in `beforeAll`, and
 * deleteMany cleanup in `afterAll`. Family specs pass their own row-level
 * deleteMany chain as the teardown's `extraCleanup` so children are removed
 * before the fixture users and organizations.
 */
export interface OrgActor {
  organizationId: string;
  userId: string;
}

export interface TwoOrgFixture {
  prisma: PrismaClient;
  orgAId: string;
  orgBId: string;
  userAId: string;
  userBId: string;
  /** Credential bundle to act as an org-A or org-B user in service calls. */
  actAs(org: 'A' | 'B'): OrgActor;
  /**
   * Runs the family's own cleanup first (children before parents), then
   * removes the fixture users and organizations and disconnects the client.
   */
  teardown(extraCleanup?: () => Promise<void>): Promise<void>;
}

export async function setupTwoOrgFixture(
  label: string,
): Promise<TwoOrgFixture> {
  const prisma = new PrismaClient();
  const unique = `${label}-${Date.now()}`;

  const [orgA, orgB] = await Promise.all([
    prisma.organization.create({
      data: {
        name: `${label} Org A`,
        slug: `${unique}-org-a`,
        plan: PlanType.BASIC,
        active: true,
      },
    }),
    prisma.organization.create({
      data: {
        name: `${label} Org B`,
        slug: `${unique}-org-b`,
        plan: PlanType.BASIC,
        active: true,
      },
    }),
  ]);

  const [userA, userB] = await Promise.all([
    prisma.user.create({
      data: {
        email: `${unique}-user-a@example.com`,
        password: 'hash',
        name: 'Test User A',
        tokenVersion: 0,
      },
    }),
    prisma.user.create({
      data: {
        email: `${unique}-user-b@example.com`,
        password: 'hash',
        name: 'Test User B',
        tokenVersion: 0,
      },
    }),
  ]);

  return {
    prisma,
    orgAId: orgA.id,
    orgBId: orgB.id,
    userAId: userA.id,
    userBId: userB.id,
    actAs(org) {
      return org === 'A'
        ? { organizationId: orgA.id, userId: userA.id }
        : { organizationId: orgB.id, userId: userB.id };
    },
    async teardown(extraCleanup) {
      if (extraCleanup) {
        await extraCleanup();
      }
      await prisma.user.deleteMany({
        where: { id: { in: [userA.id, userB.id] } },
      });
      await prisma.organization.deleteMany({
        where: { id: { in: [orgA.id, orgB.id] } },
      });
      await prisma.$disconnect();
    },
  };
}
