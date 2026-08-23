import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

const {
  createSupplierMutateAsyncMock,
  updateSupplierMutateAsyncMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  createSupplierMutateAsyncMock: vi.fn(),
  updateSupplierMutateAsyncMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@/components/layout/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useSuppliers", () => ({
  useSuppliers: () => ({
    data: {
      data: [
        {
          id: "sup-1",
          name: "Distribuidora Central",
          documentNumber: "900123456",
          email: null,
          phone: null,
          address: null,
          contactName: null,
          active: true,
          accountNumber: "0111111111",
          accountType: "CHECKING",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
    isLoading: false,
  }),
  useCreateSupplier: () => ({
    mutateAsync: createSupplierMutateAsyncMock,
    isPending: false,
  }),
  useUpdateSupplier: () => ({
    mutateAsync: updateSupplierMutateAsyncMock,
    isPending: false,
  }),
  useDeactivateSupplier: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReactivateSupplier: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "admin-1",
      role: "ADMIN",
      name: "Admin",
      email: "admin@example.com",
    },
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
  getApiErrorMessage: () => "Error",
}));

import SuppliersPage from "./page";

describe("Suppliers page modal — customer-supplier-info-fields (T19)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSupplierMutateAsyncMock.mockResolvedValue({} as never);
    updateSupplierMutateAsyncMock.mockResolvedValue({} as never);
  });

  afterEach(() => {
    cleanup();
  });

  it("sends accountNumber and accountType (Ahorros/SAVINGS) to createSupplier", async () => {
    const user = userEvent.setup();
    render(<SuppliersPage />);

    await user.click(screen.getByRole("button", { name: /nuevo proveedor/i }));

    const accountNumberInput = await screen.findByLabelText(/Número de cuenta/i);
    expect(accountNumberInput).toBeTruthy();

    const accountTypeTrigger = screen.getByRole("button", { name: /Seleccionar.../i });
    expect(accountTypeTrigger).toBeTruthy();

    await user.type(screen.getByLabelText(/Nombre \/ Razón social/i), "Dist Test");
    await user.type(screen.getByLabelText(/NIT \/ Documento/i), "900");
    await user.type(accountNumberInput, "0112345678");

    await user.click(accountTypeTrigger);
    await user.click(screen.getByText("Ahorros"));

    await user.click(screen.getByRole("button", { name: /^crear$/i }));

    await waitFor(() => {
      expect(createSupplierMutateAsyncMock).toHaveBeenCalled();
    });
    expect(createSupplierMutateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountNumber: "0112345678",
        accountType: "SAVINGS",
      })
    );
    expect(toastSuccessMock).toHaveBeenCalledWith("Proveedor creado correctamente");
  });

  it("coerces whitespace accountNumber to null and empty accountType to null", async () => {
    const user = userEvent.setup();
    render(<SuppliersPage />);

    await user.click(screen.getByRole("button", { name: /nuevo proveedor/i }));

    const accountNumberInput = await screen.findByLabelText(/Número de cuenta/i);

    await user.type(screen.getByLabelText(/Nombre \/ Razón social/i), "Dist Test");
    await user.type(screen.getByLabelText(/NIT \/ Documento/i), "900");
    await user.type(accountNumberInput, "   ");

    await user.click(screen.getByRole("button", { name: /^crear$/i }));

    await waitFor(() => {
      expect(createSupplierMutateAsyncMock).toHaveBeenCalled();
    });
    expect(createSupplierMutateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountNumber: null,
        accountType: null,
      })
    );
  });

  it("seeds accountNumber and accountType (Corriente/CHECKING) when editing a supplier", async () => {
    const user = userEvent.setup();
    render(<SuppliersPage />);

    // Clicking the card (an ADMIN can manage) triggers handleEdit.
    await user.click(screen.getByText("Distribuidora Central"));

    const accountNumberInput = await screen.findByLabelText(/Número de cuenta/i);
    expect(accountNumberInput).toHaveValue("0111111111");
    // BentoSelect value=CHECKING renders its label as the trigger text.
    expect(screen.getByRole("button", { name: /Corriente/i })).toBeTruthy();
  });

  it("renders bank account number and type on the supplier card", () => {
    render(<SuppliersPage />);
    expect(screen.getByText("Corriente: 0111111111")).toBeTruthy();
  });
});
