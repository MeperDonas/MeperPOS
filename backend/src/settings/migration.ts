import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CORE_KEY_SET, SYSTEM_KEY_SET } from './schema';

/** Type guard for plain objects. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Current Organization state needed to decide relocation targets. */
export interface NormalizeContext {
  /** Current `Organization.logoUrl` — the top-level value wins on conflict. */
  logoUrl: string | null;
}

/** Result of normalizing one organization's settings JSON. */
export interface NormalizedSettings {
  /** The settings JSON to persist (relocated legacy keys removed). */
  settings: Record<string, unknown>;
  /** New `Organization.name`, set only when `settings.companyName` was present. */
  organizationName?: string;
  /** New `Organization.logoUrl`, set only when `settings.logoUrl` moved. */
  logoUrl?: string;
  /** New SALE sequence prefix, set only when `settings.receiptPrefix` was present. */
  receiptPrefix?: string;
}

/**
 * Idempotent, key-presence-guarded JSON normalize for the settings refactor:
 *
 * - `companyName`  → `Organization.name` (then removed from the blob)
 * - `logoUrl`      → `Organization.logoUrl` (top-level wins; then removed)
 * - `receiptPrefix`→ SALE sequence `prefix` (then removed)
 * - unknown ad-hoc keys → `custom` section
 * - `downgradeFlags` (system key) is preserved untouched
 *
 * Each relocation only fires when its source key is present, so the function is
 * a no-op once the sources have been removed (re-runnable).
 */
export function normalizeSettingsJson(
  raw: Record<string, unknown>,
  ctx: NormalizeContext,
): NormalizedSettings {
  const next: Record<string, unknown> = {};
  const custom: Record<string, unknown> = {};

  let organizationName: string | undefined;
  let logoUrl: string | undefined;
  let receiptPrefix: string | undefined;

  for (const [key, value] of Object.entries(raw)) {
    if (SYSTEM_KEY_SET.has(key)) {
      next[key] = value;
    } else if (CORE_KEY_SET.has(key)) {
      next[key] = value;
    } else if (key === 'custom') {
      if (isRecord(value)) Object.assign(custom, value);
    } else if (key === 'companyName') {
      if (typeof value === 'string' && value.length > 0) {
        organizationName = value;
      }
    } else if (key === 'logoUrl') {
      if (typeof value === 'string' && value.length > 0 && !ctx.logoUrl) {
        logoUrl = value;
      }
    } else if (key === 'receiptPrefix') {
      if (typeof value === 'string' && value.length > 0) {
        receiptPrefix = value;
      }
    } else {
      custom[key] = value;
    }
  }

  if (Object.keys(custom).length > 0) {
    next.custom = custom;
  }

  return { settings: next, organizationName, logoUrl, receiptPrefix };
}

/**
 * Applies the JSON normalize across organizations. Not wired into any
 * endpoint; invoked once as a data migration (re-runnable).
 */
@Injectable()
export class SettingsMigrationService {
  constructor(private prisma: PrismaService) {}

  async migrateOrganization(organizationId: string): Promise<NormalizedSettings> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, logoUrl: true, settings: true },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const raw = isRecord(org.settings) ? org.settings : {};
    const normalized = normalizeSettingsJson(raw, { logoUrl: org.logoUrl });

    const data: {
      name?: string;
      logoUrl?: string;
      settings: Prisma.InputJsonValue;
    } = { settings: normalized.settings as Prisma.InputJsonValue };

    if (normalized.organizationName !== undefined) {
      data.name = normalized.organizationName;
    }
    if (normalized.logoUrl !== undefined) {
      data.logoUrl = normalized.logoUrl;
    }

    await this.prisma.organization.update({
      where: { id: organizationId },
      data,
    });

    if (normalized.receiptPrefix !== undefined) {
      const sequence = await this.prisma.organizationSequence.findFirst({
        where: { organizationId, type: 'SALE' },
        orderBy: { year: 'desc' },
      });
      if (sequence) {
        await this.prisma.organizationSequence.update({
          where: { id: sequence.id },
          data: { prefix: normalized.receiptPrefix },
        });
      }
    }

    return normalized;
  }

  async migrateAll(): Promise<number> {
    const organizations = await this.prisma.organization.findMany({
      select: { id: true },
    });
    for (const organization of organizations) {
      await this.migrateOrganization(organization.id);
    }
    return organizations.length;
  }
}
