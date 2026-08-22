import type { Task, TaskStatus } from "@/types";

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
