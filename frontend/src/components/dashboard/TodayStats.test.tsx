import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodayStatsInner } from "./TodayStats";

const pushMock = vi.fn();
const useDailySalesMock = vi.fn();
const useDashboardMock = vi.fn();
const useExpensesMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

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

describe("TodayStats (8 KPI cards in two rows of four)", () => {
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

  it("queries useDailySales across the 8-day KPI window ending today", () => {
    render(<TodayStatsInner today="2026-08-22" />);

    expect(useDailySalesMock).toHaveBeenCalledWith("2026-08-15", "2026-08-22");
    expect(screen.getByText("Ventas hoy")).toBeTruthy();
  });

  it("renders the 8 KPI cards split into two rows of four", () => {
    render(<TodayStatsInner today="2026-08-22" />);

    const row1 = screen.getByTestId("kpi-row-1");
    const row2 = screen.getByTestId("kpi-row-2");

    expect(row1.querySelectorAll("[data-tone]")).toHaveLength(4);
    expect(row2.querySelectorAll("[data-tone]")).toHaveLength(4);

    const row1Cards = within(row1);
    expect(row1Cards.getByText("Ventas hoy")).toBeTruthy();
    expect(row1Cards.getByText("Salidas hoy")).toBeTruthy();
    expect(row1Cards.getByText("Transacciones")).toBeTruthy();
    expect(row1Cards.getByText("Ticket promedio")).toBeTruthy();

    const row2Cards = within(row2);
    expect(row2Cards.getByText("Ventas completadas")).toBeTruthy();
    expect(row2Cards.getByText("Productos totales")).toBeTruthy();
    expect(row2Cards.getByText("Clientes totales")).toBeTruthy();
    expect(row2Cards.getByText("Stock crítico")).toBeTruthy();
  });

  it("shows a sparkline on every row-1 card and none on row-2", () => {
    render(<TodayStatsInner today="2026-08-22" />);

    const row1 = screen.getByTestId("kpi-row-1");
    const row2 = screen.getByTestId("kpi-row-2");

    expect(row1.querySelectorAll('[data-testid="metric-sparkline"]')).toHaveLength(4);
    expect(row2.querySelectorAll('[data-testid="metric-sparkline"]')).toHaveLength(0);
  });

  it("shows today's real sales total, transactions count and average ticket", () => {
    render(<TodayStatsInner today="2026-08-22" />);

    expect(screen.getByText(/\$\s250\.000/)).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    // Ticket promedio = 250000 / 5 = 50000
    expect(screen.getByText(/\$\s50\.000/)).toBeTruthy();
  });

  it("sums today's expenses for the Salidas hoy metric", () => {
    render(<TodayStatsInner today="2026-08-22" />);

    expect(screen.getByText("Salidas hoy")).toBeTruthy();
    expect(screen.getByText(/\$\s60\.000/)).toBeTruthy();
  });

  it("reads the accumulated metrics from useDashboard", () => {
    render(<TodayStatsInner today="2026-08-22" />);

    const row2 = within(screen.getByTestId("kpi-row-2"));

    expect(row2.getByText("12")).toBeTruthy();
    expect(row2.getByText("30")).toBeTruthy();
    expect(row2.getByText("8")).toBeTruthy();
    expect(row2.getByText("2")).toBeTruthy();
  });

  it("renders 'Sin base' when there is no real yesterday baseline", () => {
    render(<TodayStatsInner today="2026-08-22" />);

    const row1 = within(screen.getByTestId("kpi-row-1"));
    // Only today's record exists, so every row-1 delta falls back to "Sin base".
    expect(row1.getAllByText("Sin base")).toHaveLength(4);
    expect(within(screen.getByTestId("kpi-row-2")).queryByText("Sin base")).toBeNull();
  });

  it("computes the delta from yesterday's real series value", () => {
    useDailySalesMock.mockReturnValue({
      data: {
        data: [daily("2026-08-21", 200000, 4), daily("2026-08-22", 250000, 5)],
      },
    });

    render(<TodayStatsInner today="2026-08-22" />);

    // Sales: (250000 - 200000) / 200000 = +25.0%
    expect(screen.getAllByText("+25.0%").length).toBeGreaterThan(0);
    expect(screen.queryByText("Sin base")).toBeTruthy();
  });

  it("routes the Stock crítico Reordenar action to the low-stock filter", async () => {
    render(<TodayStatsInner today="2026-08-22" />);

    await userEvent.click(screen.getByRole("button", { name: "Reordenar" }));

    expect(pushMock).toHaveBeenCalledWith("/inventory?filter=lowStock");
  });

  it("shows $0 for sales and expenses when there is no data today", () => {
    useDailySalesMock.mockReturnValue({ data: { data: [] } });
    useExpensesMock.mockReturnValue({ data: { data: [] } });

    render(<TodayStatsInner today="2026-08-22" />);

    expect(screen.getAllByText(/\$ 0/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("0")).toBeTruthy();
  });
});
