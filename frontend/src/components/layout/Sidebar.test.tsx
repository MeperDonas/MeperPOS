import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "./Sidebar";
import { api } from "@/lib/api";

const pushMock = vi.fn();
const switchOrganizationMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const organizations = [
  {
    id: "org-a",
    name: "Org A",
    role: "ADMIN",
    plan: "BASIC",
    status: "ACTIVE",
  },
  {
    id: "org-b",
    name: "Org B",
    role: "MEMBER",
    plan: "PRO",
    status: "ACTIVE",
  },
];

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      user: {
        id: "user-1",
        name: "Ana Perez",
        role: "ADMIN",
        active: true,
        organizationId: "org-a",
      },
      logout: vi.fn(),
      switchOrganization: switchOrganizationMock,
    });
  });

  it("renders the organization switcher for multi-org users", async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { organizations },
    });

    render(<Sidebar />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Org A")).toBeInTheDocument();
    });

    expect(
      screen.getByLabelText(/Cambiar organizacion/i)
    ).toBeInTheDocument();
  });

  it("hides the organization switcher for single-org users", async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { organizations: [organizations[0]] },
    });

    render(<Sidebar />, { wrapper });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/auth/organizations");
    });

    expect(
      screen.queryByLabelText(/Cambiar organizacion/i)
    ).not.toBeInTheDocument();
  });

  it("shows the Salidas nav item for ADMIN users", async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { organizations },
    });

    render(<Sidebar />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("Org A")).toBeInTheDocument();
    });

    const link = screen.getByRole("link", { name: "Salidas" });
    expect(link).toHaveAttribute("href", "/expenses");
  });

  it("uses the approved operational order and keeps users out of the main sidebar", async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { organizations },
    });

    render(<Sidebar />, { wrapper });

    await waitFor(() => expect(screen.getByText("Org A")).toBeInTheDocument());

    const links = screen.getAllByRole("link").map((link) => link.textContent?.trim());
    expect(links).toEqual([
      "Dashboard",
      "POS",
      "Ventas",
      "Clientes",
      "Inventario",
      "Importar",
      "Categorías",
      "Proveedores",
      "Compras",
      "Salidas",
      "Reportes",
      "Tareas",
      "Mi perfil",
      "Configuración",
    ]);
    expect(screen.queryByRole("link", { name: "Usuarios" })).not.toBeInTheDocument();
  });

  it("shows the Importar nav item for ADMIN users", async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { organizations },
    });

    render(<Sidebar />, { wrapper });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/auth/organizations");
    });

    const link = screen.getByRole("link", { name: "Importar" });
    expect(link).toHaveAttribute("href", "/imports");
  });

  it("shows the Importar nav item for CASHIER users", async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: "user-cash",
        name: "Carlos Cajero",
        role: "CASHIER",
        active: true,
        organizationId: "org-a",
      },
      logout: vi.fn(),
      switchOrganization: switchOrganizationMock,
    });
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { organizations: [organizations[0]] },
    });

    render(<Sidebar />, { wrapper });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/auth/organizations");
    });

    expect(screen.getByRole("link", { name: "Importar" })).toHaveAttribute("href", "/imports");
  });

  it("hides the Importar nav item for INVENTORY_USER users", async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: "user-inv",
        name: "Inventario User",
        role: "INVENTORY_USER",
        active: true,
        organizationId: "org-a",
      },
      logout: vi.fn(),
      switchOrganization: switchOrganizationMock,
    });
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { organizations: [organizations[0]] },
    });

    render(<Sidebar />, { wrapper });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/auth/organizations");
    });

    expect(screen.queryByRole("link", { name: "Importar" })).not.toBeInTheDocument();
  });

  it("hides the Salidas nav item for CASHIER users", async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: "user-2",
        name: "Carlos Cajero",
        role: "CASHIER",
        active: true,
        organizationId: "org-a",
      },
      logout: vi.fn(),
      switchOrganization: switchOrganizationMock,
    });
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { organizations: [organizations[0]] },
    });

    render(<Sidebar />, { wrapper });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/auth/organizations");
    });

    expect(
      screen.queryByRole("link", { name: "Salidas" })
    ).not.toBeInTheDocument();
  });

  it("hides the Salidas nav item for INVENTORY_USER users", async () => {
    useAuthMock.mockReturnValue({
      user: {
        id: "user-3",
        name: "Inventario User",
        role: "INVENTORY_USER",
        active: true,
        organizationId: "org-a",
      },
      logout: vi.fn(),
      switchOrganization: switchOrganizationMock,
    });
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { organizations: [organizations[0]] },
    });

    render(<Sidebar />, { wrapper });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/auth/organizations");
    });

    expect(
      screen.queryByRole("link", { name: "Salidas" })
    ).not.toBeInTheDocument();
  });
});
