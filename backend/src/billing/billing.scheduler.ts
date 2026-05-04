import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OrgStatus } from '@prisma/client';

@Injectable()
export class BillingScheduler {
  private readonly logger = new Logger(BillingScheduler.name);

  constructor(private prisma: PrismaService) {}

  @Cron('0 0 * * *')
  async handleBillingTransitions() {
    try {
      const now = new Date();

      // TRIAL -> PAST_DUE after trial ends
      const expiredTrials = await this.prisma.organization.findMany({
        where: {
          status: OrgStatus.TRIAL,
          trialEndsAt: { lt: now },
        },
      });

      for (const org of expiredTrials) {
        await this.prisma.organization.update({
          where: { id: org.id },
          data: { status: OrgStatus.PAST_DUE, pastDueAt: now },
        });
      }

      // PAST_DUE -> SUSPENDED after 15 days
      const fifteenDaysAgo = new Date(now);
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

      const overdueOrgs = await this.prisma.organization.findMany({
        where: {
          status: OrgStatus.PAST_DUE,
          pastDueAt: { lt: fifteenDaysAgo },
        },
      });

      for (const org of overdueOrgs) {
        await this.prisma.organization.update({
          where: { id: org.id },
          data: { status: OrgStatus.SUSPENDED },
        });

        // Revoke all tokens for the organization
        const orgUsers = await this.prisma.organizationUser.findMany({
          where: { organizationId: org.id },
          select: { userId: true },
        });

        const userIds = orgUsers.map((ou) => ou.userId);

        if (userIds.length > 0) {
          await this.prisma.$transaction([
            this.prisma.refreshToken.updateMany({
              where: { userId: { in: userIds }, revokedAt: null },
              data: { revokedAt: now },
            }),
            this.prisma.user.updateMany({
              where: { id: { in: userIds } },
              data: { tokenVersion: { increment: 1 } },
            }),
          ]);
        }
      }
    } catch (error) {
      this.logger.error('Billing scheduler failed', error.stack);
      throw error;
    }
  }
}
