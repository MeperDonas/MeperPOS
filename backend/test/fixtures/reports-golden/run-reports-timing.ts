/**
 * Report workload timing runner (S5 — perf-refactor #98).
 *
 * Seeds the deterministic fixture organization (seed-golden-fixtures.ts),
 * runs the exact report golden workload against it, then a focused loop over
 * the two payment-aggregation endpoints, while aggregating per-statement
 * query timings through the S1 harness helpers. Writes
 * backend/query-timing-<label>.json for before/after evidence of the
 * reports query tuning. Measuring the SAME deterministic dataset before and
 * after keeps the comparison honest (no local-seed-data dependence).
 *
 * Usage (from /backend):
 *   $env:PRISMA_QUERY_DUMP = 'reports-before'; npm run fixtures:reports-timing
 *   Remove-Item Env:PRISMA_QUERY_DUMP
 */
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
  aggregateQueryTiming,
  summarizeQueryTiming,
  writeQueryTimingDump,
  type QueryTimingStats,
} from '../../../src/prisma/query-timing';
import {
  GOLDEN_ORG_SLUG,
  seedGoldenFixtures,
} from './seed-golden-fixtures';

const FOCUSED_ITERATIONS = 20;

async function main(): Promise<void> {
  const label = process.env.PRISMA_QUERY_DUMP;
  if (!label) {
    console.error(
      '❌ Set PRISMA_QUERY_DUMP=<label> (e.g. reports-before) so the dump file is labelled.',
    );
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaService();
  const stats: QueryTimingStats = new Map();
  const client = prisma as unknown as {
    $on(
      event: 'query',
      listener: (event: { query: string; duration: number }) => void,
    ): void;
  };
  client.$on('query', (event) =>
    aggregateQueryTiming(stats, { query: event.query, duration: event.duration }),
  );

  const cache = new CacheService();
  const expenses = new ExpensesService(
    prisma,
    new CloudinaryService(new ConfigService()),
  );
  const service = new ReportsService(prisma, cache, expenses);

  // Same deterministic dataset as the golden capture (self-contained).
  const { orgId } = await seedGoldenFixtures(prisma);
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { id: true, slug: true },
  });
  const orgs = [org];

  // Full workload: identical endpoint set as the golden capture.
  for (const o of orgs) {
    for (const scenario of GOLDEN_SCENARIOS) {
      await runReportWorkload(service, o.id, scenario);
    }
  }
  console.log(`[reports-timing] full workload done (${orgs.length} orgs)`);

  // Focused loop on the two payment-aggregation endpoints (both uncached)
  // for stable per-statement milliseconds. The fixture org has sales, so the
  // measured path is the populated one, not the empty early-exit.
  const focus = orgs.find((o) => o.id === orgId) ?? orgs[0];
  for (let i = 0; i < FOCUSED_ITERATIONS; i++) {
    for (const scenario of GOLDEN_SCENARIOS) {
      await service.getSalesByPaymentMethod(focus.id, scenario.startDate, scenario.endDate);
      await service.getCashFlow(focus.id, scenario.startDate, scenario.endDate);
    }
  }
  console.log(
    `[reports-timing] focused loop done (${FOCUSED_ITERATIONS} iterations on ${focus.slug})`,
  );

  console.log(`[prisma-timing] final summary:\n${summarizeQueryTiming(stats)}`);
  const dumpPath = writeQueryTimingDump(stats, label);
  console.log(`[prisma-timing] dumped query timings to ${dumpPath}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('❌ Timing run failed:', error);
  process.exitCode = 1;
});
