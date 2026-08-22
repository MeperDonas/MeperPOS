import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TodayStatsInner } from "./TodayStats";

const useDailySalesMock = vi.fn();
const useDashboardMock = vi.fn();
const useExpensesMock = vi.fn();

vi.mock("@/hooks/useReports", () => ({
  useDailySales: (startDate: string, endDate: string) =>
    useDailySalesMock(startDate, endDate),
  useDashboard: () => useDashboardMock(),
}));

vi.mock("@/hooks/useExpenses", () => ({
  useExpenses: (params: unknown) => useExpensesMock(params),
}));

function daily(date: string, total: number, count: number) {
  return {
    date,
    total,
    subtotal: Math.round(total * 0.84),
    tax: total - Math.round(total * 0.84),
    count,
  };
}

describe("TodayStats (day KPIs + compact metric grid)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDailySalesMock.mockReturnValue({
      data: { data: [daily("2026-08-22", 250000, 5)] },
    });
    useDashboardMock.mockReturnValue({
      data: {
        totalSales: 12,
        totalProducts: 30,
        totalCustomers: 8,
        lowStockProducts: 2,
      },
    });
    useExpensesMock.mockReturnValue({
      data: { data: [{ date: "2026-08-22", total: 60000 }] },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("queries useDailySales with today as both start and end", () => {
    render(<TodayStatsInner today="2026-08-22" />);

    expect(useDailySalesMock).toHaveBeenCalledWith("2026-08-22", "2026-08-22");
    expect(screen.getByText("Ventas hoy")).toBeTruthy();
  });

  it("shows today's real sales total and transactions count", () => {
    render(<TodayStatsInner today="2026-08-22" />);

    expect(screen.getByText(/\$\s250\.000/)).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("sums today's expenses for the Salidas hoy metric", () => {
    render(<TodayStatsInner today="2026-08-22" />);

    expect(screen.getByText("Salidas hoy")).toBeTruthy();
    expect(screen.getByText(/\$\s60\.000/)).toBeTruthy();
  });

  it("reads the aggregate metrics from useDashboard", () => {
    render(<TodayStatsInner today="2026-08-22" />);

    expect(screen.getByText("Ventas completadas")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("Productos totales")).toBeTruthy();
    expect(screen.getByText("30")).toBeTruthy();
    expect(screen.getByText("Clientes totales")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.getByText("Stock crítico")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("shows $0 for sales and expenses when there is no data today", () => {
    useDailySalesMock.mockReturnValue({ data: { data: [] } });
    useExpensesMock.mockReturnValue({ data: { data: [] } });

    render(<TodayStatsInner today="2026-08-22" />);

    expect(screen.getAllByText(/\$ 0/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("0")).toBeTruthy();
  });
});
