import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertPanels } from "./AlertPanels";

const pushMock = vi.fn();
const useExpensesMock = vi.fn();
const useTasksMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
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

describe("AlertPanels (compact operational panels)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useExpensesMock.mockReturnValue({ data: { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } } });
    useTasksMock.mockReturnValue({ data: { tasks: [], source: "remote" } });
  });

  afterEach(() => {
    cleanup();
  });

  it("no longer renders the low-stock panel (now owned by the Stock crítico KPI)", () => {
    render(<AlertPanels />);

    expect(screen.queryByText("Stock bajo")).toBeNull();
    expect(screen.queryByRole("button", { name: /reordenar/i })).toBeNull();
    expect(screen.queryByText("Stock OK")).toBeNull();
  });

  it("lays the two panels side by side at md and stacks them on mobile", () => {
    const { container } = render(<AlertPanels />);

    const grid = container.firstElementChild as HTMLElement;
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("md:grid-cols-2");
    expect(grid.children).toHaveLength(2);
  });

  // ---- Partial expenses ----
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

  it("caps the expense list to two entries", () => {
    useExpensesMock.mockReturnValue({
      data: {
        data: [
          expense("e1", "Gasto 1", 10000, []),
          expense("e2", "Gasto 2", 10000, []),
          expense("e3", "Gasto 3", 10000, []),
        ],
        meta: { total: 3, page: 1, limit: 10, totalPages: 1 },
      },
    });

    render(<AlertPanels />);

    expect(screen.getByText("Gasto 1")).toBeTruthy();
    expect(screen.getByText("Gasto 2")).toBeTruthy();
    expect(screen.queryByText("Gasto 3")).toBeNull();
    expect(screen.getByRole("button", { name: "Ver 1 más" })).toBeTruthy();
  });

  it("shows an empty state (no stale total) when there are no partial expenses", () => {
    render(<AlertPanels />);

    expect(screen.getByText(/sin gastos pendientes/i)).toBeTruthy();
    expect(screen.queryByText(/\$\s[0-9]/)).toBeNull();
  });

  // ---- Open tasks ----
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
    expect(within(screen.getByText("Reponer stock").closest("li")!).getByText("Pendiente")).toBeTruthy();
    expect(within(screen.getByText("Cerrar caja").closest("li")!).getByText("En progreso")).toBeTruthy();
    expect(screen.queryByText("Limpiar")).toBeNull();
    expect(screen.queryByText("Cancelada")).toBeNull();
    // due date is rendered for the open tasks
    expect(screen.getAllByText(/2026/).length).toBeGreaterThanOrEqual(2);
  });

  it("caps the open-task list to two entries", () => {
    useTasksMock.mockReturnValue({
      data: {
        tasks: Array.from({ length: 4 }, (_, index) => ({
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
    expect(screen.getByText("Tarea 2")).toBeTruthy();
    expect(screen.queryByText("Tarea 3")).toBeNull();
    expect(screen.queryByText("Tarea 4")).toBeNull();
  });

  it("shows an empty state when all tasks are completed or cancelled", () => {
    render(<AlertPanels />);

    expect(screen.getByText(/sin tareas abiertas/i)).toBeTruthy();
  });
});
