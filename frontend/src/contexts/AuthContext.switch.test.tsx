import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./AuthContext";
import { api } from "@/lib/api";
import { ToastProvider } from "./ToastContext";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/",
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  getApiErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

function SwitchButton() {
  const { switchOrganization } = useAuth();
  return (
    <button
      onClick={() =>
        void switchOrganization("org-b").catch(() => {
          /* expected in failure test */
        })
      }
    >
      Cambiar organizacion
    </button>
  );
}

describe("AuthContext - switchOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("calls POST /auth/select-org, stores tokens/user, invalidates non-admin queries, and redirects to /dashboard", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        user: {
          id: "user-1",
          email: "ana@example.com",
          name: "Ana Perez",
          role: "ADMIN",
          active: true,
          organizationId: "org-b",
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <SwitchButton />
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: /Cambiar/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/auth/select-org", {
        organizationId: "org-b",
      });
    });

    expect(localStorage.getItem("token")).toBe("new-access-token");
    expect(localStorage.getItem("refreshToken")).toBe("new-refresh-token");
    expect(JSON.parse(localStorage.getItem("user") ?? "{}").organizationId).toBe(
      "org-b"
    );

    expect(invalidateSpy).toHaveBeenCalledWith({
      predicate: expect.any(Function),
    });

    const predicate = invalidateSpy.mock.calls[0][0].predicate as (query: {
      queryKey: unknown[];
    }) => boolean;

    expect(predicate({ queryKey: ["products"] })).toBe(true);
    expect(predicate({ queryKey: ["sales"] })).toBe(true);
    expect(predicate({ queryKey: ["customers"] })).toBe(true);
    expect(predicate({ queryKey: ["admin", "organizations"] })).toBe(false);

    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("does not invalidate queries, store tokens, or redirect when the switch fails", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Organization is suspended")
    );

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <SwitchButton />
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: /Cambiar/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });

    expect(localStorage.getItem("token")).toBeNull();
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText(/Organization is suspended/i)).toBeInTheDocument();
    });
  });
});
