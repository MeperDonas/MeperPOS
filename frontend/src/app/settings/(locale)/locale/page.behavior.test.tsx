import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const { settingsData } = vi.hoisted(() => ({
  settingsData: {
    organization: { name: "Mi Empresa", logoUrl: null },
    invoicing: { printHeader: "", printFooter: "" },
    receipt: { prefix: null },
    locale: { currency: "COP", locale: "es-CO", timezone: "America/Bogota" },
    custom: {},
  },
}));

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({ data: settingsData, isLoading: false }),
}));

import LocaleSettingsPage from "./page";

describe("Currency & Locale settings page", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows currency, locale and timezone as read-only values", () => {
    render(<LocaleSettingsPage />);

    expect(screen.getByText("COP")).toBeInTheDocument();
    expect(screen.getByText("es-CO")).toBeInTheDocument();
    expect(screen.getByText("America/Bogota")).toBeInTheDocument();
  });

  it("renders no editable fields or save button", () => {
    render(<LocaleSettingsPage />);

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /guardar/i })).toBeNull();
  });
});
