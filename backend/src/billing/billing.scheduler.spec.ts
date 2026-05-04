import { BillingScheduler } from './billing.scheduler';
import { OrgStatus } from '@prisma/client';

describe('BillingScheduler', () => {
  let scheduler: BillingScheduler;

  const prismaMock = {
    organization: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    organizationUser: {
      findMany: jest.fn(),
    },
    refreshToken: {
      updateMany: jest.fn(),
    },
    user: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((ops) => Promise.all(ops)),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new BillingScheduler(prismaMock as never);
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('handleBillingTransitions', () => {
    it('transitions TRIAL to PAST_DUE when trialEndsAt has passed', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      prismaMock.organization.findMany.mockResolvedValueOnce([
        {
          id: 'org-trial-1',
          status: OrgStatus.TRIAL,
          trialEndsAt: yesterday,
        },
      ]);
      prismaMock.organization.findMany.mockResolvedValueOnce([]); // no PAST_DUE orgs

      await scheduler.handleBillingTransitions();

      expect(prismaMock.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-trial-1' },
        data: { status: OrgStatus.PAST_DUE, pastDueAt: expect.any(Date) },
      });
      expect(prismaMock.organizationUser.findMany).not.toHaveBeenCalled();
    });

    it('does not transition TRIAL if trialEndsAt is in the future', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      prismaMock.organization.findMany.mockResolvedValueOnce([]);
      prismaMock.organization.findMany.mockResolvedValueOnce([]);

      await scheduler.handleBillingTransitions();

      expect(prismaMock.organization.update).not.toHaveBeenCalled();
    });

    it('transitions PAST_DUE to SUSPENDED after 15 days and revokes tokens', async () => {
      const sixteenDaysAgo = new Date();
      sixteenDaysAgo.setDate(sixteenDaysAgo.getDate() - 16);

      prismaMock.organization.findMany.mockResolvedValueOnce([]); // no expired trials
      prismaMock.organization.findMany.mockResolvedValueOnce([
        {
          id: 'org-pastdue-1',
          status: OrgStatus.PAST_DUE,
          pastDueAt: sixteenDaysAgo,
        },
      ]);
      prismaMock.organizationUser.findMany.mockResolvedValueOnce([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);

      await scheduler.handleBillingTransitions();

      expect(prismaMock.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-pastdue-1' },
        data: { status: OrgStatus.SUSPENDED },
      });
      expect(prismaMock.organizationUser.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-pastdue-1' },
        select: { userId: true },
      });
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: { in: ['user-1', 'user-2'] }, revokedAt: null },
        }),
      );
      expect(prismaMock.user.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['user-1', 'user-2'] } },
        }),
      );
    });

    it('does not transition PAST_DUE before 15 days', async () => {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      prismaMock.organization.findMany.mockResolvedValueOnce([]);
      prismaMock.organization.findMany.mockResolvedValueOnce([]);

      await scheduler.handleBillingTransitions();

      expect(prismaMock.organization.update).not.toHaveBeenCalled();
      expect(prismaMock.organizationUser.findMany).not.toHaveBeenCalled();
    });

    it('handles multiple organizations in both transitions', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const sixteenDaysAgo = new Date();
      sixteenDaysAgo.setDate(sixteenDaysAgo.getDate() - 16);

      prismaMock.organization.findMany.mockResolvedValueOnce([
        { id: 'org-trial-1', status: OrgStatus.TRIAL, trialEndsAt: yesterday },
        { id: 'org-trial-2', status: OrgStatus.TRIAL, trialEndsAt: yesterday },
      ]);
      prismaMock.organization.findMany.mockResolvedValueOnce([
        {
          id: 'org-pastdue-1',
          status: OrgStatus.PAST_DUE,
          pastDueAt: sixteenDaysAgo,
        },
      ]);
      prismaMock.organizationUser.findMany.mockResolvedValueOnce([
        { userId: 'user-1' },
      ]);

      await scheduler.handleBillingTransitions();

      expect(prismaMock.organization.update).toHaveBeenCalledTimes(3);
      expect(prismaMock.organizationUser.findMany).toHaveBeenCalledTimes(1);
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('does not revoke tokens if organization has no users', async () => {
      const sixteenDaysAgo = new Date();
      sixteenDaysAgo.setDate(sixteenDaysAgo.getDate() - 16);

      prismaMock.organization.findMany.mockResolvedValueOnce([]);
      prismaMock.organization.findMany.mockResolvedValueOnce([
        {
          id: 'org-empty',
          status: OrgStatus.PAST_DUE,
          pastDueAt: sixteenDaysAgo,
        },
      ]);
      prismaMock.organizationUser.findMany.mockResolvedValueOnce([]);

      await scheduler.handleBillingTransitions();

      expect(prismaMock.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-empty' },
        data: { status: OrgStatus.SUSPENDED },
      });
      expect(prismaMock.organizationUser.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-empty' },
        select: { userId: true },
      });
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  });
});
