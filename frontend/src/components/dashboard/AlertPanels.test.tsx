import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertPanels } from "./AlertPanels";

const pushMock = vi.fn();
const useLowStockMock = vi.fn();
const useExpensesMock = vi.fn();
const useTasksMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
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

const expense = (id: string, description: string, total: number, payments: number[]) => ({
  id,
  description,
  total,
  status: "PARTIAL",
  payments: payments.map((amount, index) => ({ id: `${id}-p${index}`, amount })),
});

describe("AlertPanels (DIA-6..8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLowStockMock.mockReturnValue({ data: [] });
    useExpensesMock.mockReturnValue({ data: { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } } });
    useTasksMock.mockReturnValue({ data: { tasks: [], source: "remote" } });
  });

  afterEach(() => {
    cleanup();
  });

  // ---- DIA-6: low stock ----
  it("lists real low-stock products with name and stock", () => {
    useLowStockMock.mockReturnValue({
      data: [
        { id: "p1", name: "Café", stock: 3 },
        { id: "p2", name: "Azúcar", stock: 1 },
      ],
    });

    render(<AlertPanels />);

    expect(screen.getByText("Café")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("Azúcar")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("shows 'Stock OK' and no fabricated count when there is no low stock", () => {
    render(<AlertPanels />);

    expect(screen.getByText("Stock OK")).toBeTruthy();
    expect(screen.queryByText(/productos en stock crítico/i)).toBeNull();
    expect(screen.queryByText(/bajo requerido/i)).toBeNull();
    expect(screen.queryByText(/sin stock/i)).toBeNull();
  });

  it("routes to the low-stock filter from the Reordenar CTA", async () => {
    useLowStockMock.mockReturnValue({
      data: [{ id: "p1", name: "Café", stock: 3 }],
    });

    render(<AlertPanels />);

    await userEvent.click(screen.getByRole("button", { name: /reordenar/i }));
    expect(pushMock).toHaveBeenCalledWith("/inventory?filter=lowStock");
  });

  // ---- DIA-7: partial expenses ----
  it("lists partial expenses with their pending amounts and total pending in COP", () => {
    useExpensesMock.mockReturnValue({
      data: {
        data: [
          expense("e1", "Arriendo", 100000, [40000, 30000]),
          expense("e2", "Servicios", 50000, []),
        ],
        meta: { total: 2, page: 1, limit: 10, totalPages: 1 },
      },
    });

    render(<AlertPanels />);

    expect(screen.getByText("Arriendo")).toBeTruthy();
    expect(screen.getByText(/\$\s30\.000/)).toBeTruthy(); // 100000 - 70000
    expect(screen.getByText("Servicios")).toBeTruthy();
    expect(screen.getByText(/\$\s50\.000/)).toBeTruthy(); // fallback to full total
    expect(screen.getByText(/\$\s80\.000/)).toBeTruthy(); // total pending
  });

  it("queries expenses with status PARTIAL", () => {
    render(<AlertPanels />);

    expect(useExpensesMock).toHaveBeenCalledWith({ status: "PARTIAL" });
  });

  it("shows an empty state (no stale total) when there are no partial expenses", () => {
    render(<AlertPanels />);

    expect(screen.getByText(/sin gastos pendientes/i)).toBeTruthy();
    expect(screen.queryByText(/\$\s[0-9]/)).toBeNull();
  });

  // ---- DIA-8: open tasks ----
  it("lists open tasks with title and due date, excluding COMPLETED/CANCELLED", () => {
    useTasksMock.mockReturnValue({
      data: {
        tasks: [
          { id: "t1", title: "Reponer stock", status: "PENDING", dueDate: "2026-08-25" },
          { id: "t2", title: "Cerrar caja", status: "IN_PROGRESS", dueDate: "2026-08-26" },
          { id: "t3", title: "Limpiar", status: "COMPLETED", dueDate: "2026-08-27" },
          { id: "t4", title: "Cancelada", status: "CANCELLED", dueDate: "2026-08-28" },
        ],
        source: "remote",
      },
    });

    render(<AlertPanels />);

    expect(screen.getByText("Reponer stock")).toBeTruthy();
    expect(screen.getByText("Cerrar caja")).toBeTruthy();
    expect(screen.queryByText("Limpiar")).toBeNull();
    expect(screen.queryByText("Cancelada")).toBeNull();
    // due date is rendered for the open tasks
    expect(screen.getAllByText(/2026/).length).toBeGreaterThanOrEqual(2);
  });

  it("caps the open-task list to four entries", () => {
    useTasksMock.mockReturnValue({
      data: {
        tasks: Array.from({ length: 6 }, (_, index) => ({
          id: `t${index + 1}`,
          title: `Tarea ${index + 1}`,
          status: "PENDING",
          dueDate: null,
        })),
        source: "remote",
      },
    });

    render(<AlertPanels />);

    expect(screen.getByText("Tarea 1")).toBeTruthy();
    expect(screen.getByText("Tarea 4")).toBeTruthy();
    expect(screen.queryByText("Tarea 5")).toBeNull();
    expect(screen.queryByText("Tarea 6")).toBeNull();
  });

  it("shows an empty state when all tasks are completed or cancelled", () => {
    render(<AlertPanels />);

    expect(screen.getByText(/sin tareas abiertas/i)).toBeTruthy();
  });
});
