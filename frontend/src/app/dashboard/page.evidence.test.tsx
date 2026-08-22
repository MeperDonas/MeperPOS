import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { DashboardData } from "@/types";

const pushMock = vi.fn();
const useDashboardMock = vi.fn();
const useDailySalesMock = vi.fn();
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

  it("renders KPI cards and operational panels without legacy date/task widgets", () => {
    render(<DashboardPage />);

    expect(screen.getByText("Bienvenido, Ana")).toBeTruthy();
    expect(screen.getByText("Ventas hoy")).toBeTruthy();
    expect(screen.getByText("Ventas Completadas")).toBeTruthy();
    expect(screen.getByText("Stock bajo")).toBeTruthy();
    expect(screen.getByText("Gastos por pagar")).toBeTruthy();
    expect(screen.getByText("Tareas abiertas")).toBeTruthy();

    expect(document.querySelectorAll('input[type="date"]').length).toBe(0);
    expect(screen.queryByText("Filtro de fechas")).toBeNull();
    expect(screen.queryByText("API real")).toBeNull();
    expect(screen.queryByText("Historial")).toBeNull();
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

  it("routes to low-stock inventory filter from the summary reorder CTA", async () => {
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
