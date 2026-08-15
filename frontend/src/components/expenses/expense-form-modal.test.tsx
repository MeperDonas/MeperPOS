import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { Expense } from "@/types";

const createMutateAsyncMock = vi.fn();
const updateMutateAsyncMock = vi.fn();
const uploadReceiptMutateAsyncMock = vi.fn();
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

vi.mock("@/components/ui/ImageUpload", () => ({
  ImageUpload: () => <div>ImageUpload</div>,
}));

vi.mock("@/hooks/useExpenses", () => ({
  useExpenseCategories: () => ({
    data: [
      {
        id: "cat-1",
        organizationId: "org-1",
        name: "Arriendo",
        active: true,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
      {
        id: "cat-2",
        organizationId: "org-1",
        name: "Caja menor",
        active: true,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ],
    isLoading: false,
  }),
  useCreateExpense: () => ({
    mutateAsync: createMutateAsyncMock,
    isPending: false,
  }),
  useUpdateExpense: () => ({
    mutateAsync: updateMutateAsyncMock,
    isPending: false,
  }),
  useUploadExpenseReceipt: () => ({
    mutateAsync: uploadReceiptMutateAsyncMock,
    isPending: false,
  }),
}));

vi.mock("@/hooks/useSuppliers", () => ({
  useSuppliers: () => ({ data: { data: [] }, isLoading: false }),
}));

vi.mock("@/hooks/usePurchaseOrders", () => ({
  usePurchaseOrders: () => ({ data: { data: [] }, isLoading: false }),
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
  getApiErrorMessage: () => "Error de red",
}));

import { ExpenseFormModal } from "./ExpenseFormModal";

function makeExpense(): Expense {
  return {
    id: "exp-1",
    organizationId: "org-1",
    categoryId: "cat-1",
    category: {
      id: "cat-1",
      organizationId: "org-1",
      name: "Arriendo",
      active: true,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
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

describe("ExpenseFormModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMutateAsyncMock.mockResolvedValue({ id: "exp-1" } as never);
    updateMutateAsyncMock.mockResolvedValue({} as never);
    uploadReceiptMutateAsyncMock.mockResolvedValue({} as never);
  });

  afterEach(() => {
    cleanup();
  });

  it("submits a create payload with the inline first payment", async () => {
    const user = userEvent.setup();

    render(<ExpenseFormModal isOpen onClose={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText("Categoría"), "cat-1");
    fireEvent.change(screen.getByLabelText("Fecha"), {
      target: { value: "2026-08-10" },
    });
    fireEvent.change(screen.getByPlaceholderText("Total del gasto"), {
      target: { value: "500000" },
    });
    fireEvent.change(screen.getByPlaceholderText("Valor del pago"), {
      target: { value: "500000" },
    });
    await user.click(screen.getByRole("button", { name: /Registrar gasto/i }));

    expect(createMutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(createMutateAsyncMock).toHaveBeenCalledWith({
      categoryId: "cat-1",
      supplierId: undefined,
      purchaseOrderId: undefined,
      description: undefined,
      date: "2026-08-10",
      total: 500000,
      payments: [
        { amount: 500000, method: "CASH", date: expect.any(String) },
      ],
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Gasto registrado");
  });

  it("blocks submission when there is no valid payment (EXP-1)", async () => {
    const user = userEvent.setup();

    render(<ExpenseFormModal isOpen onClose={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText("Categoría"), "cat-1");
    fireEvent.change(screen.getByLabelText("Fecha"), {
      target: { value: "2026-08-10" },
    });
    fireEvent.change(screen.getByPlaceholderText("Total del gasto"), {
      target: { value: "500000" },
    });
    await user.click(screen.getByRole("button", { name: /Registrar gasto/i }));

    expect(
      screen.getByText("Agrega al menos un pago válido"),
    ).toBeInTheDocument();
    expect(createMutateAsyncMock).not.toHaveBeenCalled();
  });

  it("blocks submission when payments exceed the total (EXP-2 overpayment guard)", async () => {
    const user = userEvent.setup();

    render(<ExpenseFormModal isOpen onClose={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText("Categoría"), "cat-1");
    fireEvent.change(screen.getByLabelText("Fecha"), {
      target: { value: "2026-08-10" },
    });
    fireEvent.change(screen.getByPlaceholderText("Total del gasto"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByPlaceholderText("Valor del pago"), {
      target: { value: "200" },
    });
    await user.click(screen.getByRole("button", { name: /Registrar gasto/i }));

    expect(
      screen.getByText("El total de pagos supera el total del gasto"),
    ).toBeInTheDocument();
    expect(createMutateAsyncMock).not.toHaveBeenCalled();
  });

  it("boots edit mode from the expense snapshot and submits an update", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseFormModal
        isOpen
        expense={makeExpense()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("Renta agosto")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Descripción (opcional)"), {
      target: { value: "Renta septiembre" },
    });
    await user.click(screen.getByRole("button", { name: /Guardar cambios/i }));

    expect(updateMutateAsyncMock).toHaveBeenCalledWith({
      id: "exp-1",
      data: {
        categoryId: "cat-1",
        supplierId: null,
        purchaseOrderId: null,
        description: "Renta septiembre",
        date: "2026-08-01",
        total: 500000,
      },
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Gasto actualizado");
  });

  it("blocks an edit whose new total is below the sum of payments (EXP-5)", async () => {
    const user = userEvent.setup();

    render(
      <ExpenseFormModal
        isOpen
        expense={makeExpense()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Total del gasto"), {
      target: { value: "200000" },
    });
    await user.click(screen.getByRole("button", { name: /Guardar cambios/i }));

    expect(
      screen.getByText("El nuevo total no puede ser menor a los pagos registrados"),
    ).toBeInTheDocument();
    expect(updateMutateAsyncMock).not.toHaveBeenCalled();
  });
});
