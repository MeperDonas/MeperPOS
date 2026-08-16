import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  updateSettingsMutateAsyncMock,
  toastSuccessMock,
  settingsData,
} = vi.hoisted(() => ({
  updateSettingsMutateAsyncMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  settingsData: {
    organization: { name: "Mi Empresa", logoUrl: null },
    invoicing: { printHeader: "Header actual", printFooter: "Footer actual" },
    receipt: { prefix: "REC-" },
    locale: { currency: "COP", locale: "es-CO", timezone: "America/Bogota" },
    custom: {},
  },
}));

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({ data: settingsData, isLoading: false }),
  useUpdateSettings: () => ({
    mutateAsync: updateSettingsMutateAsyncMock,
    isPending: false,
  }),
}));

vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({
    success: toastSuccessMock,
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

import InvoicingSettingsPage from "./page";

describe("Invoicing & Receipts settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateSettingsMutateAsyncMock.mockResolvedValue(settingsData);
  });

  afterEach(() => {
    cleanup();
  });

  it("shows print header/footer and the receipt prefix", () => {
    render(<InvoicingSettingsPage />);

    expect(screen.getByLabelText(/encabezado/i)).toHaveValue("Header actual");
    expect(screen.getByLabelText(/pie de página/i)).toHaveValue("Footer actual");
    expect(screen.getByText("REC-")).toBeInTheDocument();
  });

  it("saves only printHeader and printFooter on submit", async () => {
    const user = userEvent.setup();
    render(<InvoicingSettingsPage />);

    const header = screen.getByLabelText(/encabezado/i);
    await user.clear(header);
    await user.type(header, "Nuevo encabezado");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(updateSettingsMutateAsyncMock).toHaveBeenCalledWith({
      printHeader: "Nuevo encabezado",
      printFooter: "Footer actual",
    });
  });
});
