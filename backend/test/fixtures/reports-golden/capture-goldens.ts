/**
 * Golden capture script for the report endpoints (S5 — perf-refactor #98).
 *
 * Boots the REAL dependency graph (PrismaService + CacheService +
 * ExpensesService), seeds the deterministic fixture organization
 * (seed-golden-fixtures.ts) and calls every report endpoint of the CURRENT
 * ReportsService against it for each fixed date scenario, serializing outputs
 * to committed JSON files:
 *
 *   orgs.json                              manifest of captured org slugs
 *   golden-<orgSlug>-<scenario>.json       all endpoint outputs per org/scenario
 *
 * The committed files are the equality gate used by reports.golden.spec.ts:
 * they must only be regenerated from UNMODIFIED reports.service.ts code
 * (pre-refactor capture). Regenerating to make a failing gate pass defeats
 * the gate.
 *
 * Usage (from /backend): npm run fixtures:reports-golden
 */
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { CacheService } from '../../../src/common/services/cache.service';
import { CloudinaryService } from '../../../src/cloudinary/cloudinary.service';
import { ExpensesService } from '../../../src/expenses/expenses.service';
import { ReportsService } from '../../../src/reports/reports.service';
import {
  GOLDEN_SCENARIOS,
  runReportWorkload,
} from '../../../src/reports/reports-golden-workload';
import {
  GOLDEN_ORG_SLUG,
  seedGoldenFixtures,
} from './seed-golden-fixtures';

async function main(): Promise<void> {
  const prisma = new PrismaService();
  const cache = new CacheService();
  const expenses = new ExpensesService(
    prisma,
    new CloudinaryService(new ConfigService()),
  );
  const service = new ReportsService(prisma, cache, expenses);

  // Self-contained capture: seed the deterministic fixture org so the goldens
  // never depend on local seed data (CI runs against an empty-but-migrated
  // database).
  const { orgId } = await seedGoldenFixtures(prisma);
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { id: true, slug: true },
  });
  const orgs = [org];

  fs.mkdirSync(__dirname, { recursive: true });

  fs.writeFileSync(
    path.join(__dirname, 'orgs.json'),
    JSON.stringify(
      {
        _comment:
          'Organizations covered by the report goldens (S5). Regenerate with: npm run fixtures:reports-golden',
        orgs: orgs.map((org) => ({ slug: org.slug })),
      },
      null,
      2,
    ) + '\n',
  );

  for (const org of orgs) {
    for (const scenario of GOLDEN_SCENARIOS) {
      const outputs = await runReportWorkload(service, org.id, scenario);
      const payload = {
        _comment:
          'Golden report outputs captured from the UNMODIFIED ReportsService (S5 perf-refactor #98). Regenerate ONLY from unmodified reports.service.ts via: npm run fixtures:reports-golden',
        orgSlug: org.slug,
        scenario: scenario.name,
        startDate: scenario.startDate,
        endDate: scenario.endDate,
        outputs,
      };
      const fileName = `golden-${org.slug}-${scenario.name}.json`;
      fs.writeFileSync(
        path.join(__dirname, fileName),
        JSON.stringify(payload, null, 2) + '\n',
      );
      console.log(
        `✅ ${org.slug}/${scenario.name}: ${Object.keys(outputs).length} endpoints → ${fileName}`,
      );
    }
  }

  console.log('\nGoldens written to backend/test/fixtures/reports-golden/');
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('❌ Golden capture failed:', error);
  process.exitCode = 1;
});
