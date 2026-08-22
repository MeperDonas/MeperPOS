import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QuickActions } from "./QuickActions";

const useAuthMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

describe("QuickActions (DIA-9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the full set of actions for an ADMIN user", () => {
    useAuthMock.mockReturnValue({ user: { id: "u1", role: "ADMIN" } });

    render(<QuickActions />);

    expect(screen.getByText("Nuevo producto")).toBeTruthy();
    expect(screen.getByText("Nueva venta")).toBeTruthy();
    expect(screen.getByText("Reordenar")).toBeTruthy();
    expect(screen.getByText("Nuevo gasto")).toBeTruthy();
  });

  it("does not render a reorder action for a role without inventory permission", () => {
    useAuthMock.mockReturnValue({ user: { id: "u1", role: "CASHIER" } });

    render(<QuickActions />);

    expect(screen.queryByText("Reordenar")).toBeNull();
    expect(screen.queryByText("Nuevo gasto")).toBeNull();
  });

  it("does not render a new-expense action for a role without expense permission", () => {
    useAuthMock.mockReturnValue({ user: { id: "u1", role: "INVENTORY_USER" } });

    render(<QuickActions />);

    expect(screen.queryByText("Nuevo gasto")).toBeNull();
    expect(screen.queryByText("Nuevo producto")).toBeTruthy();
  });
});
