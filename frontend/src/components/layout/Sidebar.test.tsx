import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "./Sidebar";
import { api } from "@/lib/api";

const pushMock = vi.fn();
const switchOrganizationMock = vi.fn();

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
  useAuth: () => ({
    user: {
      id: "user-1",
      name: "Ana Perez",
      role: "ADMIN",
      active: true,
      organizationId: "org-a",
    },
    logout: vi.fn(),
    switchOrganization: switchOrganizationMock,
  }),
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
});
