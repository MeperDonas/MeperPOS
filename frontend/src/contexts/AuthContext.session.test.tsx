import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./AuthContext";
import { api } from "@/lib/api";
import { ToastProvider } from "./ToastContext";
import {
  getAccessToken,
  clearAccessToken,
} from "@/lib/session";

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

const testUser = {
  id: "user-1",
  email: "ana@example.com",
  name: "Ana Perez",
  role: "ADMIN",
  active: true,
  organizationId: "org-b",
};

function TestHarness() {
  const { user, loading, login, logout, switchOrganization, isAuthenticated } =
    useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? user.email : "anonymous"}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <button onClick={() => void login("ana@example.com", "secret123")}>
        Iniciar Sesion
      </button>
      <button onClick={logout}>Cerrar Sesion</button>
      <button
        onClick={() =>
          void switchOrganization("org-b").catch(() => undefined)
        }
      >
        Cambiar organizacion
      </button>
    </div>
  );
}

function renderHarness() {
  const queryClient = new QueryClient();
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <TestHarness />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
  return { invalidateSpy };
}

/** Route api.post calls by URL so every test can control refresh/login/org flows. */
function routePostBy(
  handler: (
    url: string,
    body?: unknown
  ) => Promise<{ data: unknown }> | Promise<never>
) {
  (api.post as ReturnType<typeof vi.fn>).mockImplementation((url: string, body?: unknown) =>
    handler(url, body)
  );
}

describe("AuthContext - in-memory session migration (issue #48 slice C2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearAccessToken();
  });

  afterEach(() => {
    localStorage.clear();
    clearAccessToken();
  });

  describe("login", () => {
    it("stores the access token only in memory and keeps the user object as a display cache", async () => {
      routePostBy(async (url) => {
        if (url === "/auth/refresh") {
          return Promise.reject(new Error("No refresh cookie"));
        }
        if (url === "/auth/login") {
          return Promise.resolve({
            data: { accessToken: "access-1", refreshToken: "refresh-1", user: testUser },
          });
        }
        throw new Error(`Unexpected POST ${url}`);
      });

      renderHarness();

      await userEvent.click(await screen.findByRole("button", { name: /Iniciar Sesion/i }));

      await waitFor(() => {
        expect(getAccessToken()).toBe("access-1");
      });
      await waitFor(() => {
        expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
      });

      // Tokens never touch localStorage — only the display-cache user does.
      expect(localStorage.getItem("token")).toBeNull();
      expect(localStorage.getItem("refreshToken")).toBeNull();

      const cachedUser = JSON.parse(localStorage.getItem("user") ?? "null");
      expect(cachedUser).toMatchObject({ id: "user-1", email: "ana@example.com" });

      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  describe("silent restore on mount", () => {
    it("calls POST /auth/refresh then GET /auth/profile and restores the session in memory", async () => {
      localStorage.setItem("user", JSON.stringify(testUser));

      const callOrder: string[] = [];
      routePostBy(async (url) => {
        if (url === "/auth/refresh") {
          callOrder.push("refresh");
          return Promise.resolve({ data: { accessToken: "restored-token" } });
        }
        throw new Error(`Unexpected POST ${url}`);
      });
      (api.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url === "/auth/profile") {
          callOrder.push("profile");
          return Promise.resolve({
            data: { ...testUser, email: "restored@example.com" },
          });
        }
        throw new Error(`Unexpected GET ${url}`);
      });

      renderHarness();

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("false");
      });
      expect(screen.getByTestId("user")).toHaveTextContent("restored@example.com");
      expect(getAccessToken()).toBe("restored-token");

      // Refresh must run BEFORE the profile revalidation.
      expect(callOrder).toEqual(["refresh", "profile"]);

      // Display cache is refreshed with the validated profile.
      const cachedUser = JSON.parse(localStorage.getItem("user") ?? "null");
      expect(cachedUser).toMatchObject({ email: "restored@example.com" });
    });

    it("clears the display cache and stays logged out when the silent restore fails", async () => {
      localStorage.setItem("user", JSON.stringify(testUser));

      routePostBy(async (url) => {
        if (url === "/auth/refresh") {
          return Promise.reject(new Error("Refresh token expired"));
        }
        throw new Error(`Unexpected POST ${url}`);
      });

      renderHarness();

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("false");
      });

      expect(screen.getByTestId("user")).toHaveTextContent("anonymous");
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
      expect(getAccessToken()).toBeNull();
      // Stale display cache must not survive a dead session.
      expect(localStorage.getItem("user")).toBeNull();
      expect(api.get).not.toHaveBeenCalledWith("/auth/profile");
    });
  });

  describe("logout", () => {
    it("calls POST /auth/logout, clears the in-memory token and the user display cache, and redirects to /login", async () => {
      routePostBy(async (url) => {
        if (url === "/auth/refresh") {
          return Promise.resolve({ data: { accessToken: "restore-token" } });
        }
        if (url === "/auth/logout") {
          return Promise.resolve({ data: {} });
        }
        throw new Error(`Unexpected POST ${url}`);
      });
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: testUser,
      });

      renderHarness();

      // Wait until the restored session is active before logging out.
      await waitFor(() => {
        expect(getAccessToken()).toBe("restore-token");
      });

      await userEvent.click(await screen.findByRole("button", { name: /Cerrar Sesion/i }));

      expect(api.post).toHaveBeenCalledWith("/auth/logout");
      expect(getAccessToken()).toBeNull();
      expect(localStorage.getItem("user")).toBeNull();
      await waitFor(() => {
        expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
      });
      expect(pushMock).toHaveBeenCalledWith("/login");
    });
  });

  describe("switchOrganization", () => {
    it("calls POST /auth/select-org, stores the new token pair only in memory, invalidates non-admin queries, and redirects to /dashboard", async () => {
      routePostBy(async (url) => {
        if (url === "/auth/refresh") {
          return Promise.resolve({ data: { accessToken: "restore-token" } });
        }
        if (url === "/auth/select-org") {
          return Promise.resolve({
            data: {
              accessToken: "new-access-token",
              refreshToken: "new-refresh-token",
              user: { ...testUser, organizationId: "org-b" },
            },
          });
        }
        throw new Error(`Unexpected POST ${url}`);
      });
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: testUser });

      const { invalidateSpy } = renderHarness();

      await waitFor(() => {
        expect(getAccessToken()).toBe("restore-token");
      });

      await userEvent.click(await screen.findByRole("button", { name: /Cambiar organizacion/i }));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith("/auth/select-org", {
          organizationId: "org-b",
        });
      });

      // New tokens live in memory only; nothing sensitive is persisted.
      await waitFor(() => {
        expect(getAccessToken()).toBe("new-access-token");
      });
      expect(localStorage.getItem("token")).toBeNull();
      expect(localStorage.getItem("refreshToken")).toBeNull();

      // The user display cache IS persisted (non-sensitive).
      const cachedUser = JSON.parse(localStorage.getItem("user") ?? "{}");
      expect(cachedUser.organizationId).toBe("org-b");

      expect(invalidateSpy).toHaveBeenCalledWith({
        predicate: expect.any(Function),
      });

      // Cast through unknown: the real Query predicate receives a full Query object.
      const predicate = (
        invalidateSpy.mock.calls[0]?.[0] as unknown as
          | { predicate?: (query: { queryKey: readonly unknown[] }) => boolean }
          | undefined
      )?.predicate;
      expect(predicate).toBeDefined();
      expect(predicate?.({ queryKey: ["products"] })).toBe(true);
      expect(predicate?.({ queryKey: ["sales"] })).toBe(true);
      expect(predicate?.({ queryKey: ["customers"] })).toBe(true);
      expect(predicate?.({ queryKey: ["admin", "organizations"] })).toBe(false);

      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });

    it("does not invalidate queries, store tokens, or redirect when the switch fails", async () => {
      routePostBy(async (url) => {
        if (url === "/auth/refresh") {
          return Promise.resolve({ data: { accessToken: "restore-token" } });
        }
        if (url === "/auth/select-org") {
          return Promise.reject(new Error("Organization is suspended"));
        }
        throw new Error(`Unexpected POST ${url}`);
      });
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: testUser });

      const { invalidateSpy } = renderHarness();

      await waitFor(() => {
        expect(getAccessToken()).toBe("restore-token");
      });

      await userEvent.click(await screen.findByRole("button", { name: /Cambiar organizacion/i }));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith("/auth/select-org", {
          organizationId: "org-b",
        });
      });

      expect(invalidateSpy).not.toHaveBeenCalled();
      expect(pushMock).not.toHaveBeenCalled();

      // Previous session token remains untouched by the failed switch.
      expect(getAccessToken()).toBe("restore-token");
      expect(localStorage.getItem("token")).toBeNull();
      expect(localStorage.getItem("refreshToken")).toBeNull();

      await waitFor(() => {
        expect(screen.getByText(/Organization is suspended/i)).toBeInTheDocument();
      });
    });
  });

  it("scrubs legacy token leftovers from localStorage on mount and never rewrites them", async () => {
    // Simulate pre-migration leftovers: they must be removed, not reused.
    localStorage.setItem("token", "legacy-leftover");
    localStorage.setItem("refreshToken", "legacy-refresh");

    routePostBy(async (url) => {
      if (url === "/auth/refresh") {
        return Promise.reject(new Error("No refresh cookie"));
      }
      if (url === "/auth/login") {
        return Promise.resolve({
          data: { accessToken: "access-1", refreshToken: "refresh-1", user: testUser },
        });
      }
      throw new Error(`Unexpected POST ${url}`);
    });

    renderHarness();

    await waitFor(() => {
      expect(localStorage.getItem("token")).toBeNull();
    });
    expect(localStorage.getItem("refreshToken")).toBeNull();

    await userEvent.click(await screen.findByRole("button", { name: /Iniciar Sesion/i }));

    await waitFor(() => {
      expect(getAccessToken()).toBe("access-1");
    });
    // Login keeps tokens out of localStorage entirely.
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
  });
});
