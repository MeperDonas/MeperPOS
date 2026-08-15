import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Expense, ExpenseAuditEntry } from "@/types";

const useExpenseHistoryMock = vi.fn();

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title?: string;
    children: ReactNode;
  }) =>
    isOpen ? (
      <section>
        {title ? <h2>{title}</h2> : null}
        {children}
      </section>
    ) : null,
}));

vi.mock("@/hooks/useExpenses", () => ({
  useExpenseHistory: (id: string) => useExpenseHistoryMock(id),
}));

import { HistoryModal } from "./HistoryModal";

const expense = {
  id: "exp-1",
  organizationId: "org-1",
  categoryId: "cat-1",
  supplierId: null,
  purchaseOrderId: null,
  description: "Renta agosto",
  date: "2026-08-01T00:00:00.000Z",
  total: "500000",
  status: "PARTIAL",
  receiptUrl: null,
  active: true,
  createdById: "user-1",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  // Decimal fields arrive as strings at runtime (backend Decimal serialization)
} as unknown as Expense;

const entries: ExpenseAuditEntry[] = [
  {
    id: "a-1",
    userId: "user-1",
    action: "EXPENSE_CREATED",
    resource: "Expense",
    resourceId: "exp-1",
    metadata: {},
    createdAt: "2026-08-01T10:00:00.000Z",
    organizationId: "org-1",
    user: { name: "Ana Admin", email: "ana@example.com" },
  },
  {
    id: "a-2",
    userId: "user-1",
    action: "EXPENSE_PAYMENT_ADDED",
    resource: "Expense",
    resourceId: "exp-1",
    metadata: {},
    createdAt: "2026-08-02T10:00:00.000Z",
    organizationId: "org-1",
    user: { name: "Ana Admin", email: "ana@example.com" },
  },
];

describe("HistoryModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useExpenseHistoryMock.mockReturnValue({
      data: entries,
      isLoading: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("lists human-readable audit entries with user and date", () => {
    render(<HistoryModal expense={expense} isOpen onClose={vi.fn()} />);

    expect(useExpenseHistoryMock).toHaveBeenCalledWith("exp-1");
    expect(screen.getByText("Gasto creado")).toBeInTheDocument();
    expect(screen.getByText("Pago agregado")).toBeInTheDocument();
    expect(screen.getAllByText("Ana Admin").length).toBeGreaterThanOrEqual(2);
  });

  it("shows a loading message while history is pending", () => {
    useExpenseHistoryMock.mockReturnValue({ data: undefined, isLoading: true });

    render(<HistoryModal expense={expense} isOpen onClose={vi.fn()} />);

    expect(screen.getByText(/Cargando historial/)).toBeInTheDocument();
  });
});
