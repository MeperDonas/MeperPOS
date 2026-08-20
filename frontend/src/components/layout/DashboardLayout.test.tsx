import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DashboardLayout } from "./DashboardLayout";

const replaceMock = vi.fn();
const pushMock = vi.fn();
const useAuthMock = vi.fn();
let currentPathname = "/expenses";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  usePathname: () => currentPathname,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("./Sidebar", () => ({
  Sidebar: () => null,
}));

vi.mock("@/components/billing/PlanLimitBanner", () => ({
  PlanLimitBanner: () => null,
}));

function setUser(role: string) {
  useAuthMock.mockReturnValue({
    isAuthenticated: true,
    loading: false,
    user: { id: "user-1", name: "Ana Perez", role, active: true },
    organization: undefined,
  });
}

describe("DashboardLayout route gating for /expenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentPathname = "/expenses";
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps ADMIN users on /expenses", () => {
    setUser("ADMIN");

    render(
      <DashboardLayout>
        <p>Salidas</p>
      </DashboardLayout>
    );

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects CASHIER users away from /expenses to /pos", () => {
    setUser("CASHIER");

    render(
      <DashboardLayout>
        <p>Salidas</p>
      </DashboardLayout>
    );

    expect(replaceMock).toHaveBeenCalledWith("/pos");
  });

  it("redirects INVENTORY_USER users away from /expenses to /dashboard", () => {
    setUser("INVENTORY_USER");

    render(
      <DashboardLayout>
        <p>Salidas</p>
      </DashboardLayout>
    );

    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
  });

  it("does not redirect when the pathname is not gated", () => {
    currentPathname = "/profile";
    setUser("CASHIER");

    render(
      <DashboardLayout>
        <p>Perfil</p>
      </DashboardLayout>
    );

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("keeps Team & Access ADMIN-only", () => {
    currentPathname = "/settings/team";
    setUser("CASHIER");

    render(
      <DashboardLayout>
        <p>Equipo y acceso</p>
      </DashboardLayout>
    );

    expect(replaceMock).toHaveBeenCalledWith("/pos");
  });
});
