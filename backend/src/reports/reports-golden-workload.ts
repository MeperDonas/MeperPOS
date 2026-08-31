// Shared definition of the report golden workload (S5 — perf-refactor #98).
//
// The capture script (backend/test/fixtures/reports-golden/capture-goldens.ts)
// and the golden equality gate (reports.golden.spec.ts) both execute EXACTLY
// this workload, so the committed goldens prove parsed-JSON equality of every
// report endpoint output across the query-tuning refactor of reports.service.ts.
import type { ReportsService } from './reports.service';

export interface GoldenScenario {
  name: string;
  startDate: string;
  endDate: string;
}

// Fixed date ranges: year-2026 covers every org's seeded sales (created
// 2026-06-15 / 2026-08-26); year-2025-empty exercises the zero-data paths
// (empty groups, empty buckets, comparison ranges with no rows).
export const GOLDEN_SCENARIOS: GoldenScenario[] = [
  { name: 'year-2026', startDate: '2026-01-01', endDate: '2026-12-31' },
  { name: 'year-2025-empty', startDate: '2025-01-01', endDate: '2025-12-31' },
];

export type ReportWorkloadOutputs = Record<string, unknown>;

// One call per controller endpoint variant (see reports.controller.ts) with
// the fixed range applied. The key order below is the golden file format.
export async function runReportWorkload(
  service: ReportsService,
  organizationId: string,
  scenario: GoldenScenario,
): Promise<ReportWorkloadOutputs> {
  const { startDate, endDate } = scenario;

  return {
    dashboard: await service.getDashboardKPIs(organizationId, startDate, endDate),
    economic: await service.getFinancialOverview(organizationId, startDate, endDate),
    economicCash: await service.getCashFlow(organizationId, startDate, endDate),
    economicInventory: await service.getInventorySnapshot(organizationId, startDate, endDate),
    economicExport: await service.getEconomicExport(organizationId, startDate, endDate),
    salesPaymentMethod: await service.getSalesByPaymentMethod(organizationId, startDate, endDate),
    salesCategory: await service.getSalesByCategory(organizationId, startDate, endDate),
    salesCategoryDaily: await service.getSalesByCategoryDaily(organizationId, startDate, endDate),
    topSellingProductsDefault: await service.getTopSellingProducts(organizationId, startDate, endDate),
    topSellingProductsLimit2: await service.getTopSellingProducts(organizationId, startDate, endDate, 2),
    customersStatistics: await service.getCustomerStatistics(organizationId, startDate, endDate),
    usersPerformanceCompare: await service.getUserPerformance(organizationId, startDate, endDate, true),
    usersPerformanceNoCompare: await service.getUserPerformance(organizationId, startDate, endDate, false),
    salesDaily: await service.getDailySales(organizationId, startDate, endDate),
  };
}
