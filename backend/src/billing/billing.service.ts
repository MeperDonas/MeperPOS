import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SYSTEM_KEY_SET } from '../settings/schema';

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  async getStatus(organizationId: string | undefined) {
    if (!organizationId) {
      return null;
    }
    const org = await this.prisma.organization.findUnique({
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

    if (!org) {
      return null;
    }

    // Expose only system-managed keys (e.g. downgradeFlags). These are never
    // user-writable — the settings engine rejects writes to them on PUT.
    const raw = org.settings as Record<string, unknown> | null;
    const settings: Record<string, unknown> = {};
    if (raw && typeof raw === 'object') {
      for (const key of SYSTEM_KEY_SET) {
        if (key in raw && raw[key] !== undefined) {
          settings[key] = raw[key];
        }
      }
    }

    return {
      id: org.id,
      plan: org.plan,
      status: org.status,
      trialEndsAt: org.trialEndsAt,
      billingStatus: org.billingStatus,
      settings,
    };
  }
}
