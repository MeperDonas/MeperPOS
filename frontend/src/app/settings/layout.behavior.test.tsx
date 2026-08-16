import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/general",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    scroll,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    scroll?: boolean;
  }) => (
    <a
      href={href}
      data-scroll={scroll === false ? "false" : "true"}
      {...rest}
    >
      {children}
    </a>
  ),
}));

vi.mock("@/components/layout/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import SettingsLayout from "./layout";

describe("settings sub-sidebar layout", () => {
  it("renders all five sections as links with visible labels", () => {
    render(
      <SettingsLayout>
        <div>Contenido</div>
      </SettingsLayout>
    );

    expect(screen.getByRole("link", { name: "General" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Facturación y Recibos" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Moneda y Región" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Suscripción" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Avanzado" })).toBeInTheDocument();
  });

  it("marks the active section and navigates without scrolling the page", () => {
    render(
      <SettingsLayout>
        <div>Contenido</div>
      </SettingsLayout>
    );

    const generalLink = screen.getByRole("link", { name: "General" });
    expect(generalLink).toHaveAttribute("aria-current", "page");
    expect(generalLink).toHaveAttribute("data-scroll", "false");

    const invoicingLink = screen.getByRole("link", {
      name: "Facturación y Recibos",
    });
    expect(invoicingLink).not.toHaveAttribute("aria-current");
    expect(invoicingLink).toHaveAttribute("data-scroll", "false");
  });
});
