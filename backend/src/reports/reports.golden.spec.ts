// Golden equality gate for the reports query tuning (S5 — perf-refactor #98).
//
// The committed JSON files under backend/test/fixtures/reports-golden/ were
// captured from the UNMODIFIED ReportsService against the live seeded
// database with FIXED date ranges (see capture-goldens.ts). This spec
// re-runs the identical workload and asserts parsed-JSON equality per
// endpoint, so it must keep passing while reports.service.ts is refactored;
// any output difference is a semantics regression.
//
// Regeneration policy: goldens may only be regenerated from unmodified
// reports.service.ts code (pre-refactor capture). Never regenerate goldens
// to make a failing gate pass — that defeats the gate.
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/services/cache.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { ExpensesService } from '../expenses/expenses.service';
import { ReportsService } from './reports.service';
import {
  GOLDEN_SCENARIOS,
  runReportWorkload,
  type ReportWorkloadOutputs,
} from './reports-golden-workload';

const GOLDEN_DIR = path.join(__dirname, '..', '..', 'test', 'fixtures', 'reports-golden');

interface OrgsManifest {
  orgs: Array<{ slug: string }>;
}

interface GoldenFile {
  _comment?: string;
  orgSlug: string;
  scenario: string;
  startDate: string;
  endDate: string;
  outputs: ReportWorkloadOutputs;
}

// Loaded synchronously so the test tree can be built from the manifest.
// A missing manifest is itself a RED state: capture the goldens first.
const manifest = JSON.parse(
  fs.readFileSync(path.join(GOLDEN_DIR, 'orgs.json'), 'utf-8'),
) as OrgsManifest;

describe('Reports golden equality (S5 perf-refactor #98)', () => {
  let prisma: PrismaService;
  let service: ReportsService;

  beforeAll(async () => {
    prisma = new PrismaService();
    const cache = new CacheService();
    const expenses = new ExpensesService(
      prisma,
      new CloudinaryService(new ConfigService()),
    );
    service = new ReportsService(prisma, cache, expenses);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  for (const { slug } of manifest.orgs) {
    for (const scenario of GOLDEN_SCENARIOS) {
      const fileName = `golden-${slug}-${scenario.name}.json`;

      describe(`${slug} / ${scenario.name}`, () => {
        const golden = JSON.parse(
          fs.readFileSync(path.join(GOLDEN_DIR, fileName), 'utf-8'),
        ) as GoldenFile;
        let actual: ReportWorkloadOutputs;

        beforeAll(async () => {
          const org = await prisma.organization.findUnique({ where: { slug } });
          if (!org) {
            throw new Error(
              `Organization "${slug}" from the goldens manifest was not found in the database`,
            );
          }
          actual = await runReportWorkload(service, org.id, scenario);
        });

        for (const key of Object.keys(golden.outputs)) {
          it(`matches golden output: ${key}`, () => {
            const parsed = JSON.parse(JSON.stringify(actual[key]));
            expect(parsed).toEqual(golden.outputs[key]);
          });
        }
      });
    }
  }
});
