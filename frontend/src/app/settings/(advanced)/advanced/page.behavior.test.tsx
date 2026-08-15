import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { updateSettingsMutateAsyncMock, settingsData } = vi.hoisted(() => ({
  updateSettingsMutateAsyncMock: vi.fn(),
  settingsData: {
    organization: { name: "Mi Empresa", logoUrl: null },
    invoicing: { printHeader: "", printFooter: "" },
    receipt: { prefix: null },
    locale: { currency: "COP", locale: "es-CO", timezone: "America/Bogota" },
    custom: { theme: "dark" },
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
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

import AdvancedSettingsPage from "./page";

describe("Advanced settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateSettingsMutateAsyncMock.mockResolvedValue(settingsData);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders existing custom key/value entries", () => {
    render(<AdvancedSettingsPage />);

    expect(screen.getByDisplayValue("theme")).toBeInTheDocument();
    expect(screen.getByDisplayValue("dark")).toBeInTheDocument();
  });

  it("adds a key/value row and saves the merged custom object", async () => {
    const user = userEvent.setup();
    render(<AdvancedSettingsPage />);

    await user.click(screen.getByRole("button", { name: /agregar/i }));

    const keys = screen.getAllByLabelText(/clave/i);
    const values = screen.getAllByLabelText(/valor/i);
    await user.type(keys[1], "color");
    await user.type(values[1], "rojo");

    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(updateSettingsMutateAsyncMock).toHaveBeenCalledWith({
      custom: { theme: "dark", color: "rojo" },
    });
  });
});
