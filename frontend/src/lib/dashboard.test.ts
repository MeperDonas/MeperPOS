import { describe, expect, it } from "vitest";
import {
  buildCategoryColorMap,
  buildStackedDailySeries,
  chartHeight,
  computePendingAmount,
  computeTodayMetrics,
  filterOpenTasks,
  sumExpensesOnDate,
} from "./dashboard";
import type { TaskStatus } from "@/types";

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
      { status: "PENDING" as const },
      { status: "COMPLETED" as const },
      { status: "IN_PROGRESS" as const },
      { status: "CANCELLED" as const },
    ];

    expect(filterOpenTasks(tasks)).toEqual([
      { status: "PENDING" },
      { status: "IN_PROGRESS" },
    ]);
  });

  it("caps the open-task list to five entries", () => {
    const tasks: Array<{ status: TaskStatus }> = Array.from(
      { length: 8 },
      (_, index) => ({
        status: index % 2 === 0 ? "PENDING" : "IN_PROGRESS",
      }),
    );

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

describe("buildCategoryColorMap (stacked chart)", () => {
  it("assigns a stable color per category ordered by name", () => {
    const map = buildCategoryColorMap(["Bebidas", "Snacks", "Bebidas"]);
    expect(map.get("Bebidas")).toBe(map.get("Bebidas"));
    expect(map.get("Bebidas")).not.toBe(map.get("Snacks"));
  });

  it("de-duplicates category names", () => {
    const map = buildCategoryColorMap(["A", "A", "B"]);
    expect(map.size).toBe(2);
  });
});

describe("buildStackedDailySeries (stacked chart)", () => {
  const days = ["2026-08-20", "2026-08-21", "2026-08-22"];

  it("groups rows into one day slot per requested day", () => {
    const series = buildStackedDailySeries(
      [
        { date: "2026-08-21", category: "Bebidas", total: 100, quantity: 2 },
        { date: "2026-08-21", category: "Snacks", total: 50, quantity: 1 },
      ],
      days,
    );

    expect(series).toHaveLength(3);
    expect(series[0]).toEqual({ date: "2026-08-20", segments: [], total: 0 });
    expect(series[1].date).toBe("2026-08-21");
    expect(series[1].total).toBe(150);
    expect(series[1].segments).toEqual([
      { category: "Bebidas", total: 100, quantity: 2 },
      { category: "Snacks", total: 50, quantity: 1 },
    ]);
    expect(series[2]).toEqual({ date: "2026-08-22", segments: [], total: 0 });
  });

  it("aggregates repeated rows into a single segment per category", () => {
    const series = buildStackedDailySeries(
      [
        { date: "2026-08-21", category: "Bebidas", total: 100, quantity: 2 },
        { date: "2026-08-21", category: "Bebidas", total: 25, quantity: 1 },
      ],
      days,
    );

    expect(series[1].segments).toHaveLength(1);
    expect(series[1].segments[0]).toEqual({
      category: "Bebidas",
      total: 125,
      quantity: 3,
    });
  });
});

describe("sumExpensesOnDate (Salidas hoy)", () => {
  const today = "2026-08-22";

  it("sums only the expenses on the given date", () => {
    expect(
      sumExpensesOnDate(
        [
          { date: "2026-08-22", total: 120000 },
          { date: "2026-08-21", total: 50000 },
        ],
        today,
      ),
    ).toBe(120000);
  });

  it("accepts ISO timestamps by matching the first 10 characters", () => {
    expect(
      sumExpensesOnDate(
        [{ date: "2026-08-22T05:00:00.000Z", total: 30000 }],
        today,
      ),
    ).toBe(30000);
  });

  it("returns 0 when the list is empty or undefined", () => {
    expect(sumExpensesOnDate([], today)).toBe(0);
    expect(sumExpensesOnDate(undefined, today)).toBe(0);
  });
});
