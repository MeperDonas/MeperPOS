import type { Expense, SaleByCategoryDaily, Task, TaskStatus } from "@/types";

export interface TodaySaleRecord {
  total: number;
  count: number;
}

export interface TodayMetrics {
  sales: number;
  transactions: number;
  ticket: number;
}

/**
 * Derives the day KPIs from a single DailySale record.
 * Guards against a division by zero: when `count` is 0 the ticket is 0.
 */
export function computeTodayMetrics(rec?: TodaySaleRecord): TodayMetrics {
  const total = rec?.total ?? 0;
  const count = rec?.count ?? 0;

  return {
    sales: total,
    transactions: count,
    ticket: count > 0 ? total / count : 0,
  };
}

/**
 * Computes the pending amount of a partially-paid expense as
 * `total - sum(payments.amount)`. When payments is missing or empty the
 * pending amount falls back to the full `total`.
 */
export function computePendingAmount(expense: {
  total: number;
  payments?: Array<{ amount: number }>;
}): number {
  const total = expense?.total ?? 0;
  const payments = expense?.payments;

  if (!payments || payments.length === 0) {
    return total;
  }

  const paid = payments.reduce((sum, payment) => sum + (payment?.amount ?? 0), 0);
  return total - paid;
}

const OPEN_TASK_STATUSES: TaskStatus[] = ["PENDING", "IN_PROGRESS"];

/**
 * Keeps only the client-side open tasks (PENDING / IN_PROGRESS) and caps
 * the result to `cap` entries (default 5).
 */
export function filterOpenTasks<T extends { status: TaskStatus }>(
  tasks: T[],
  cap = 5,
): T[] {
  return (tasks ?? []).filter((task) => OPEN_TASK_STATUSES.includes(task.status)).slice(0, cap);
}

/**
 * Returns a proportional chart bar height for a day total against the series
 * max. A zero (or immeasurable) total renders at the minimum visible height
 * (18%); non-zero totals are scaled to at least 28% and at most 100%.
 */
export function chartHeight(total: number, max: number): number {
  if (total <= 0 || max <= 0) {
    return 18;
  }

  const scaled = Math.round((total / max) * 100);
  return Math.max(28, Math.min(scaled, 100));
}

export type { Task };

// ─── Category stacked chart helpers ───────────────────────────────────────────

export const CATEGORY_CHART_PALETTE = [
  "#C25E36", // terracotta (primary)
  "#3B82F6", // blue
  "#22C55E", // green
  "#8B5CF6", // violet
  "#F59E0B", // amber
  "#06B6D4", // cyan
  "#EC4899", // pink
  "#E0524C", // coral
] as const;

export interface CategoryDailySegment {
  category: string;
  total: number;
  quantity: number;
}

export interface StackedDay {
  date: string;
  segments: CategoryDailySegment[];
  total: number;
}

/**
 * Assigns a stable chart color to each distinct category name. Colors are
 * ordered by the sorted category name so a given category keeps the same color
 * regardless of data ordering across renders.
 */
export function buildCategoryColorMap(
  categories: string[] | undefined,
): Map<string, string> {
  const unique = Array.from(new Set(categories ?? [])).filter(Boolean).sort((a, b) =>
    a.localeCompare(b),
  );
  const map = new Map<string, string>();
  unique.forEach((category, index) => {
    map.set(category, CATEGORY_CHART_PALETTE[index % CATEGORY_CHART_PALETTE.length]);
  });
  return map;
}

/**
 * Groups daily-by-category sale rows into one `StackedDay` per day in `days`.
 * Days without data render as a day with an empty segment list (total 0), so
 * the chart always shows one bar per day in the requested range.
 */
export function buildStackedDailySeries(
  data: SaleByCategoryDaily[] | undefined,
  days: string[] | undefined,
): StackedDay[] {
  const byDate = new Map<string, Map<string, CategoryDailySegment>>();

  for (const row of data ?? []) {
    const dayMap = byDate.get(row.date) ?? new Map<string, CategoryDailySegment>();
    const existing = dayMap.get(row.category) ?? {
      category: row.category,
      total: 0,
      quantity: 0,
    };
    existing.total += row.total ?? 0;
    existing.quantity += row.quantity ?? 0;
    dayMap.set(row.category, existing);
    byDate.set(row.date, dayMap);
  }

  return (days ?? []).map((date) => {
    const dayMap = byDate.get(date);
    const segments = dayMap
      ? Array.from(dayMap.values()).sort((a, b) => a.category.localeCompare(b.category))
      : [];
    return {
      date,
      segments,
      total: segments.reduce((sum, segment) => sum + segment.total, 0),
    };
  });
}

export type ExpenseDateLike = Pick<Expense, "date" | "total">;

/**
 * Sums the `total` of the expenses whose Bogotá date matches `date`. Accepts
 * both plain `YYYY-MM-DD` values and ISO timestamps (matched on the first 10
 * characters) so it works against either serialization from the API.
 */
export function sumExpensesOnDate(
  expenses: ExpenseDateLike[] | undefined,
  date: string,
): number {
  return (expenses ?? []).reduce((sum, expense) => {
    if (!expense) return sum;
    const expenseDate = expense.date;
    const matches = expenseDate === date || expenseDate.slice(0, 10) === date;
    return matches ? sum + (expense.total ?? 0) : sum;
  }, 0);
}
