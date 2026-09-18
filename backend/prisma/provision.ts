import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../src/common/constants/security.constants';
import {
  MIN_SUPERADMIN_PASSWORD_LENGTH,
  normalizeSuperAdminEmail,
  planProvisioning,
} from '../src/provisioning/provisioning-plan';
import type { ProvisioningPlan } from '../src/provisioning/provisioning-plan';

/**
 * Production SuperAdmin provisioning CLI (issue #116 / AUDIT-FINDING-010,
 * criterion #2). Wired to the `provision:prod` npm script.
 *
 * Scope is deliberately one account and nothing else:
 *  - creates a single SuperAdmin from SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD, or
 *  - promotes an existing account only when SUPERADMIN_PROMOTE=true, or
 *  - does nothing when the account is already a SuperAdmin (idempotent).
 *
 * It never creates demo organizations, demo catalogs or demo users, never uses
 * faker, never prints the password, and exits non-zero on any refusal. The
 * organization itself is created separately through the SuperAdmin-only
 * POST /api/admin/organizations endpoint.
 *
 * The decision logic lives in ../src/provisioning/provisioning-plan.ts, so this
 * file only reads the environment, runs one database operation and reports it.
 */

const prisma = new PrismaClient();

const LOG_PREFIX = '[provision]';

async function findExistingUser(email: string) {
  if (!email) {
    return null;
  }

  return prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, isSuperAdmin: true },
  });
}

async function execute(plan: ProvisioningPlan): Promise<number> {
  switch (plan.action) {
    case 'refuse': {
      console.error(`${LOG_PREFIX} refused (${plan.code}): ${plan.reason}`);
      return 1;
    }

    case 'noop': {
      console.log(
        `${LOG_PREFIX} noop: ${plan.email} is already a SuperAdmin (user ${plan.userId}). Nothing changed.`,
      );
      return 0;
    }

    case 'promote': {
      const promoted = await prisma.user.update({
        where: { id: plan.userId },
        data: { isSuperAdmin: true },
        select: { id: true, email: true },
      });

      console.log(
        `${LOG_PREFIX} promoted: existing user ${promoted.email} (${promoted.id}) is now a SuperAdmin. No password was changed.`,
      );
      return 0;
    }

    case 'create': {
      const name = process.env.SUPERADMIN_NAME?.trim() || 'Super Administrador';

      // Hash with the shared cost factor; the plaintext never touches disk and
      // is never logged.
      const password = await bcrypt.hash(plan.password, BCRYPT_ROUNDS);

      const created = await prisma.user.create({
        data: {
          email: plan.email,
          name,
          password,
          isSuperAdmin: true,
          tokenVersion: 0,
        },
        select: { id: true, email: true },
      });

      console.log(
        `${LOG_PREFIX} created SuperAdmin ${created.email} (${created.id}) with a password of at least ${MIN_SUPERADMIN_PASSWORD_LENGTH} characters.`,
      );
      console.log(
        `${LOG_PREFIX} the password is intentionally not printed: retrieve it from the environment you set and store it in the team password manager.`,
      );
      return 0;
    }

    default: {
      const unexpected: never = plan;
      throw new Error(
        `unhandled provisioning action: ${JSON.stringify(unexpected)}`,
      );
    }
  }
}

async function run(): Promise<void> {
  try {
    const email = normalizeSuperAdminEmail(process.env.SUPERADMIN_EMAIL);

    const plan = planProvisioning({
      email,
      password: process.env.SUPERADMIN_PASSWORD,
      promoteExistingUser: process.env.SUPERADMIN_PROMOTE === 'true',
      existingUser: await findExistingUser(email),
    });

    process.exitCode = await execute(plan);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${LOG_PREFIX} failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void run();
