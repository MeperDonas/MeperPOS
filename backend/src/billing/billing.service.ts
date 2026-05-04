import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  async getStatus(organizationId: string) {
    return this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        plan: true,
        status: true,
        trialEndsAt: true,
        billingStatus: true,
        settings: true,
      },
    });
  }
}
