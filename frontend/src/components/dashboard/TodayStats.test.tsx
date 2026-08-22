import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TodayStatsInner } from "./TodayStats";

const useDailySalesMock = vi.fn();

vi.mock("@/hooks/useReports", () => ({
  useDailySales: (startDate: string, endDate: string) =>
    useDailySalesMock(startDate, endDate),
}));

function daily(date: string, total: number, count: number) {
  return { date, total, subtotal: Math.round(total * 0.84), tax: total - Math.round(total * 0.84), count };
}

describe("TodayStats (DIA-1..3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDailySalesMock.mockReturnValue({ data: { data: [daily("2026-08-22", 250000, 5)] } });
  });

  afterEach(() => {
    cleanup();
  });

  it("queries useDailySales with today as both start and end (never the full-range aggregate)", () => {
    render(<TodayStatsInner today="2026-08-22" />);

    expect(useDailySalesMock).toHaveBeenCalledWith("2026-08-22", "2026-08-22");
    expect(screen.getByText("Ventas hoy")).toBeTruthy();
  });

  it("shows today's real total, average ticket and count as COP/Day KPI values", () => {
    render(<TodayStatsInner today="2026-08-22" />);

    expect(screen.getByText(/\$\s250\.000/)).toBeTruthy();
    expect(screen.getByText(/\$\s50\.000/)).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("shows $0 (not a full-period value) when there are no sales today", () => {
    useDailySalesMock.mockReturnValue({ data: { data: [] } });
    render(<TodayStatsInner today="2026-08-22" />);

    expect(screen.getAllByText(/\$ 0/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("shows a zero ticket when count is 0 without dividing by zero", () => {
    useDailySalesMock.mockReturnValue({ data: { data: [daily("2026-08-22", 50000, 0)] } });
    render(<TodayStatsInner today="2026-08-22" />);

    expect(screen.getByText(/50\.000/)).toBeTruthy();
    expect(screen.getAllByText(/\$ 0/).length).toBeGreaterThanOrEqual(1);
  });
});
