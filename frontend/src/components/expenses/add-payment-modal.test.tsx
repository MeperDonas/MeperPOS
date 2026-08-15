import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { Expense } from "@/types";

const addPaymentMutateAsyncMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

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

vi.mock("@/components/ui/Button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/hooks/useExpenses", () => ({
  useAddExpensePayment: () => ({
    mutateAsync: addPaymentMutateAsyncMock,
    isPending: false,
  }),
}));

vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({
    success: toastSuccessMock,
    error: toastErrorMock,
    info: vi.fn(),
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {},
  getApiErrorMessage: () => "Overpayment",
}));

import { AddPaymentModal } from "./AddPaymentModal";

function makeExpense(): Expense {
  return {
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
    payments: [
      {
        id: "pay-1",
        expenseId: "exp-1",
        organizationId: "org-1",
        amount: "300000",
        method: "CASH",
        date: "2026-08-01T00:00:00.000Z",
        createdAt: "2026-08-01T00:00:00.000Z",
      },
    ],
    // Decimal fields arrive as strings at runtime (backend Decimal serialization)
  } as unknown as Expense;
}

describe("AddPaymentModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addPaymentMutateAsyncMock.mockResolvedValue({} as never);
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the remaining balance and submits a valid payment", async () => {
    const user = userEvent.setup();

    render(<AddPaymentModal expense={makeExpense()} isOpen onClose={vi.fn()} />);

    expect(screen.getByText(/Saldo pendiente/)).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Valor del pago"), {
      target: { value: "100000" },
    });
    await user.click(screen.getByRole("button", { name: /Registrar pago/i }));

    expect(addPaymentMutateAsyncMock).toHaveBeenCalledWith({
      id: "exp-1",
      data: {
        amount: 100000,
        method: "CASH",
        date: expect.any(String),
      },
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Pago registrado");
  });

  it("surfaces an overpayment error before calling the API (EXP-2)", async () => {
    const user = userEvent.setup();

    render(<AddPaymentModal expense={makeExpense()} isOpen onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Valor del pago"), {
      target: { value: "300000" },
    });
    await user.click(screen.getByRole("button", { name: /Registrar pago/i }));

    expect(
      screen.getByText("El pago supera el saldo pendiente"),
    ).toBeInTheDocument();
    expect(addPaymentMutateAsyncMock).not.toHaveBeenCalled();
  });

  it("surfaces a server overpayment rejection through the error toast", async () => {
    const user = userEvent.setup();
    addPaymentMutateAsyncMock.mockRejectedValueOnce(new Error("boom"));

    render(<AddPaymentModal expense={makeExpense()} isOpen onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Valor del pago"), {
      target: { value: "50000" },
    });
    await user.click(screen.getByRole("button", { name: /Registrar pago/i }));

    expect(toastErrorMock).toHaveBeenCalledWith("Overpayment");
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });
});
