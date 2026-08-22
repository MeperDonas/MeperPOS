import { describe, expect, it } from "vitest";
import {
  chartHeight,
  computePendingAmount,
  computeTodayMetrics,
  filterOpenTasks,
} from "./dashboard";

describe("computeTodayMetrics (DIA-1/DIA-2)", () => {
  it("returns sales, count and a non-zero average ticket when count > 0", () => {
    expect(computeTodayMetrics({ total: 250000, count: 5 })).toEqual({
      sales: 250000,
      transactions: 5,
      ticket: 50000,
    });
  });

  it("returns a zero ticket when count is 0 without dividing by zero", () => {
    expect(computeTodayMetrics({ total: 50000, count: 0 })).toEqual({
      sales: 50000,
      transactions: 0,
      ticket: 0,
    });
  });

  it("returns all-zero metrics when the record is missing", () => {
    expect(computeTodayMetrics(undefined)).toEqual({
      sales: 0,
      transactions: 0,
      ticket: 0,
    });
  });
});

describe("computePendingAmount (DIA-7)", () => {
  it("subtracts the sum of payments from the expense total", () => {
    expect(
      computePendingAmount({
        total: 100000,
        payments: [{ amount: 40000 }, { amount: 30000 }],
      }),
    ).toBe(30000);
  });

  it("falls back to the full total when payments is empty", () => {
    expect(computePendingAmount({ total: 100000, payments: [] })).toBe(100000);
  });

  it("falls back to the full total when payments are absent", () => {
    expect(computePendingAmount({ total: 100000 })).toBe(100000);
  });
});

describe("filterOpenTasks (DIA-8)", () => {
  it("keeps only PENDING/IN_PROGRESS tasks and drops COMPLETED/CANCELLED", () => {
    const tasks = [
      { status: "PENDING" },
      { status: "COMPLETED" },
      { status: "IN_PROGRESS" },
      { status: "CANCELLED" },
    ];

    expect(filterOpenTasks(tasks)).toEqual([
      { status: "PENDING" },
      { status: "IN_PROGRESS" },
    ]);
  });

  it("caps the open-task list to five entries", () => {
    const tasks = Array.from({ length: 8 }, (_, index) => ({
      status: index % 2 === 0 ? "PENDING" : "IN_PROGRESS",
    }));

    expect(filterOpenTasks(tasks)).toHaveLength(5);
  });
});

describe("chartHeight (DIA-11)", () => {
  it("uses the minimum visible height for a zero-total day", () => {
    expect(chartHeight(0, 100)).toBe(18);
  });

  it("scales a non-zero total proportionally to the max", () => {
    expect(chartHeight(50, 100)).toBe(50);
    expect(chartHeight(100, 100)).toBe(100);
  });

  it("respects the minimum visible height for small totals", () => {
    expect(chartHeight(25, 100)).toBe(28);
  });

  it("returns the minimum height without a measurable max", () => {
    expect(chartHeight(50, 0)).toBe(18);
  });
});
