import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { DashboardData } from "@/types";

const pushMock = vi.fn();
const useDashboardMock = vi.fn();
const useDailySalesMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/components/layout/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useReports", () => ({
  useDashboard: () => useDashboardMock(),
  useDailySales: (startDate: string, endDate: string) =>
    useDailySalesMock(startDate, endDate),
}));

vi.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({
    data: { meta: { total: 4 } },
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", name: "Ana Admin", role: "ADMIN" },
  }),
}));

import DashboardPage from "./page";

function makeDashboardData(input: Partial<DashboardData>): DashboardData {
  return {
    totalSales: 5,
    totalRevenue: 500000,
    totalProducts: 10,
    totalCustomers: 3,
    lowStockProducts: 1,
    trends: {
      totalSales: 2,
      totalRevenue: 5,
      totalCustomers: 1,
    },
    previousPeriod: {
      revenue: 400000,
      sales: 4,
    },
    recentSales: [
      {
        id: "sale-1",
        saleNumber: 101,
        total: 50000,
        status: "COMPLETED",
        createdAt: "2026-01-01T12:00:00.000Z",
        customer: { id: "customer-1", name: "Cliente Uno" },
        items: [
          {
            id: "item-1",
            quantity: 1,
            total: 50000,
            product: { id: "product-1", name: "Producto Uno" },
          },
        ],
      },
    ],
    appliedRange: {
      startDate: "2026-01-01",
      endDate: "2026-01-07",
      timezone: "America/Bogota",
    },
    ...input,
  };
}

function makeSalesWithOneItem(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const itemNumber = index + 1;
    const day = String(itemNumber).padStart(2, "0");
    return {
      id: `sale-${itemNumber}`,
      saleNumber: 100 + itemNumber,
      total: 10000 * itemNumber,
      status: "COMPLETED",
      createdAt: `2026-01-${day}T12:00:00.000Z`,
      customer: { id: `customer-${itemNumber}`, name: `Cliente ${itemNumber}` },
      items: [
        {
          id: `item-${itemNumber}`,
          quantity: 1,
          total: 10000 * itemNumber,
          product: { id: `product-${itemNumber}`, name: `Producto ${itemNumber}` },
        },
      ],
    };
  });
}

describe("Dashboard scope evidence (tasks moved, date filter removed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useDailySalesMock.mockReturnValue({
      data: {
        data: [
          { date: "2026-01-01", total: 50000, subtotal: 42000, tax: 8000, count: 1 },
        ],
      },
    });

    useDashboardMock.mockReturnValue({
      data: makeDashboardData({}),
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders KPI cards and sold-products table without legacy date/task widgets", () => {
    render(<DashboardPage />);

    expect(screen.getByText("Bienvenido, Ana")).toBeTruthy();
    expect(screen.getByText("Ingresos Totales")).toBeTruthy();
    expect(screen.getByText("Ventas Completadas")).toBeTruthy();
    expect(screen.getByText("Productos Vendidos")).toBeTruthy();

    expect(document.querySelectorAll('input[type="date"]').length).toBe(0);
    expect(screen.queryByText("Filtro de fechas")).toBeNull();
    expect(screen.queryByText("API real")).toBeNull();
    expect(screen.queryByText("Historial")).toBeNull();
  });

  it("renders empty sold-products state safely", () => {
    useDashboardMock.mockReturnValue({
      data: makeDashboardData({
        totalSales: 0,
        totalRevenue: 0,
        totalProducts: 0,
        lowStockProducts: 0,
        recentSales: [],
      }),
      isLoading: false,
      error: null,
    });

    render(<DashboardPage />);

    expect(screen.getByText("No hay productos vendidos en este período")).toBeTruthy();
  });

  it("routes to low-stock inventory filter from reorder CTA", async () => {
    render(<DashboardPage />);

    await userEvent.click(screen.getByRole("button", { name: "REORDENAR" }));
    expect(pushMock).toHaveBeenCalledWith("/inventory?filter=lowStock");
  });

  it("paginates sold products list when there are more than ten items", async () => {
    useDashboardMock.mockReturnValue({
      data: makeDashboardData({
        recentSales: makeSalesWithOneItem(11),
      }),
      isLoading: false,
      error: null,
    });

    // The range summary lives in a <p> whose numbers are wrapped in nested <span>s,
    // so assert on the combined textContent instead of a single text node.
    const rangeText = (expected: string) => (_: string, element: Element | null) =>
      (element?.textContent ?? "").replace(/\s+/g, " ").trim() === expected;

    render(<DashboardPage />);

    expect(screen.getByText(rangeText("Mostrando 1 - 10 de 11"))).toBeTruthy();
    expect(screen.getByText("1 / 2")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(screen.getByText(rangeText("Mostrando 11 - 11 de 11"))).toBeTruthy();
    expect(screen.getByText("2 / 2")).toBeTruthy();
  });
});
