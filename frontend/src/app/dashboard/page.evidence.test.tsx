import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { DashboardData } from "@/types";

const pushMock = vi.fn();
const useDashboardMock = vi.fn();
const useDailySalesMock = vi.fn();
const useSalesByCategoryDailyMock = vi.fn();
const useLowStockMock = vi.fn();
const useExpensesMock = vi.fn();
const useTasksMock = vi.fn();

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
  useSalesByCategoryDaily: (startDate: string, endDate: string) =>
    useSalesByCategoryDailyMock(startDate, endDate),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", name: "Ana Admin", role: "ADMIN" },
  }),
}));

vi.mock("@/hooks/useProducts", () => ({
  useLowStockProducts: () => useLowStockMock(),
}));

vi.mock("@/hooks/useExpenses", () => ({
  useExpenses: (params: unknown) => useExpensesMock(params),
}));

vi.mock("@/hooks/useTasks", () => ({
  useTasks: () => useTasksMock(),
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

describe("Dashboard scope evidence (DIA-4/13/10 — reports no longer duplicated)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useDailySalesMock.mockReturnValue({
      data: {
        data: [
          { date: "2026-01-01", total: 50000, subtotal: 42000, tax: 8000, count: 1 },
        ],
      },
    });

    useSalesByCategoryDailyMock.mockReturnValue({
      data: {
        data: [
          { date: "2026-01-01", category: "Bebidas", total: 50000, quantity: 1 },
        ],
        appliedRange: {
          startDate: "2026-01-01",
          endDate: "2026-01-07",
          timezone: "America/Bogota",
        },
      },
    });

    useDashboardMock.mockReturnValue({
      data: makeDashboardData({}),
      isLoading: false,
      error: null,
    });

    useLowStockMock.mockReturnValue({ data: [] });
    useExpensesMock.mockReturnValue({ data: { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } } });
    useTasksMock.mockReturnValue({ data: { tasks: [], source: "remote" } });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the top quick actions, the 7-metric grid and operational panels", () => {
    render(<DashboardPage />);

    // Quick actions bento above the metrics
    expect(screen.getByText("Nuevo producto")).toBeTruthy();
    expect(screen.getByText("Nueva venta")).toBeTruthy();

    // 7 compact metrics
    expect(screen.getByText("Ventas hoy")).toBeTruthy();
    expect(screen.getByText("Salidas hoy")).toBeTruthy();
    expect(screen.getByText("Transacciones")).toBeTruthy();
    expect(screen.getByText("Ventas completadas")).toBeTruthy();
    expect(screen.getByText("Productos totales")).toBeTruthy();
    expect(screen.getByText("Clientes totales")).toBeTruthy();
    expect(screen.getByText("Stock crítico")).toBeTruthy();

    // Operational panels
    expect(screen.getByText("Stock bajo")).toBeTruthy();
    expect(screen.getByText("Gastos por pagar")).toBeTruthy();
    expect(screen.getByText("Tareas abiertas")).toBeTruthy();
  });

  it("renders the stacked category chart for the full current month", () => {
    render(<DashboardPage />);

    expect(screen.getByText(/^Ingresos de /)).toBeTruthy();
    // One bar per day across every day of the current month (>= 28 days).
    const barsCount = screen.getAllByTestId("category-daily-bar").length;
    expect(barsCount).toBeGreaterThanOrEqual(28);
    expect(barsCount).toBeLessThanOrEqual(31);
  });

  it("does not render a hardcoded sales goal, a fake curve or mislabeled 'Ayer vs Hoy' (DIA-4/DIA-13)", () => {
    render(<DashboardPage />);

    expect(screen.queryByText(/1,500/)).toBeNull();
    expect(screen.queryByText(/Meta:/)).toBeNull();
    expect(screen.queryByText("Ayer vs Hoy")).toBeNull();
    expect(screen.queryByText(/Q50,70/)).toBeNull();
  });

  it("does not render the historical reports sections nor the sold-products table (DIA-10)", () => {
    render(<DashboardPage />);

    expect(screen.queryByText("Productos Vendidos")).toBeNull();
    expect(screen.queryByText("Productos Más Vendidos")).toBeNull();
    expect(screen.queryByText("Economía")).toBeNull();
    expect(screen.queryByText("Caja y pagos")).toBeNull();
    expect(screen.queryByText("Top Clientes")).toBeNull();
    expect(screen.queryByText("Métodos de Pago")).toBeNull();
    expect(screen.queryByText("Categorías")).toBeNull();
    expect(screen.queryByText("Inventario actual")).toBeNull();
  });

  it("routes to low-stock inventory filter from the alert reorder CTA", async () => {
    useLowStockMock.mockReturnValue({
      data: [{ id: "p1", name: "Café", stock: 3, minStock: 5 }],
    });

    render(<DashboardPage />);

    await userEvent.click(screen.getByRole("button", { name: "REORDENAR" }));
    expect(pushMock).toHaveBeenCalledWith("/inventory?filter=lowStock");
  });

  it("shows alert panels with real low-stock data from the hook", () => {
    useLowStockMock.mockReturnValue({
      data: [{ id: "p1", name: "Café", stock: 3 }],
    });

    render(<DashboardPage />);

    const item = screen.getByText("Café").closest("li");
    expect(item).toBeTruthy();
    expect(within(item as HTMLElement).getByText("3")).toBeTruthy();
  });
});
