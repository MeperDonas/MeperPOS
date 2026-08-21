"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import { safeSetItem, safeRemoveItem } from "@/lib/utils";
import {
  setAccessToken,
  clearAccessToken,
} from "@/lib/session";
import { useRouter } from "next/navigation";
import { OrganizationSelectModal } from "@/components/auth/OrganizationSelectModal";
import { useToast } from "@/contexts/ToastContext";
import { useQueryClient } from "@tanstack/react-query";
import type { AppRole } from "@/lib/auth";

export interface User {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  active: boolean;
  isSuperAdmin?: boolean;
  organizationId?: string | null;
  organization?: Organization | null;
}

export interface Organization {
  id: string;
  plan: "BASIC" | "PRO";
  status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED";
  trialEndsAt: string | null;
  billingStatus: "PENDING" | "PAID" | "OVERDUE";
}

interface PendingOrganizationSelection {
  preAuthToken: string;
  organizations: Array<{ id: string; name: string; role: string; plan: string }>;
}

/**
 * Auth responses keep returning tokens in the JSON body (dual-mode backend)
 * while also setting httpOnly cookies. Only the access token is consumed and
 * it is stored in memory only — the refresh token is never kept client-side.
 */
interface AuthTokenResponse {
  accessToken?: string;
  /** Legacy alias still accepted by some endpoints. */
  token?: string;
  refreshToken?: string;
  user?: User;
}

/** localStorage key for the user object. Display cache only, NOT auth material. */
const USER_DISPLAY_CACHE_KEY = "user";

function extractAccessToken(payload: {
  accessToken?: string;
  token?: string;
}): string | null {
  const token = payload.accessToken ?? payload.token ?? null;
  return token && token.trim() ? token : null;
}

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchOrganization: (organizationId: string) => Promise<void>;
  isAuthenticated: boolean;
  needsOrganizationSelection: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingSelection, setPendingSelection] =
    useState<PendingOrganizationSelection | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { error: showError } = useToast();

  useEffect(() => {
    const restoreSession = async () => {
      // Migration scrub: legacy localStorage tokens are no longer read by the
      // request layer, so remove any leftovers from previous versions.
      safeRemoveItem("token");
      safeRemoveItem("refreshToken");

      // Silent restore: the httpOnly refresh_token cookie is the only
      // persisted credential. Refresh -> in-memory token -> revalidate user.
      try {
        const response = await api.post<AuthTokenResponse>("/auth/refresh", {});
        const accessToken = extractAccessToken(response.data);
        if (!accessToken) {
          throw new Error("No access token in refresh response");
        }
        setAccessToken(accessToken);

        const profileResponse = await api.get<User>("/auth/profile");
        setUser(profileResponse.data);
        safeSetItem(USER_DISPLAY_CACHE_KEY, JSON.stringify(profileResponse.data));
      } catch {
        clearAccessToken();
        safeRemoveItem(USER_DISPLAY_CACHE_KEY);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void restoreSession();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const response = await api.post<
          | AuthTokenResponse
          | {
              requiresOrganizationSelection: true;
              preAuthToken: string;
              organizations: Array<{
                id: string;
                name: string;
                role: string;
                plan: string;
              }>;
            }
        >("/auth/login", {
          email,
          password,
        });

        const data = response.data;

        if ("requiresOrganizationSelection" in data) {
          setPendingSelection({
            preAuthToken: data.preAuthToken,
            organizations: data.organizations,
          });
          return;
        }

        // Access token in memory only — never persisted.
        const accessToken = extractAccessToken(data);
        const authenticatedUser = data.user;
        if (!accessToken || !authenticatedUser) {
          throw new Error("Invalid login response");
        }
        setAccessToken(accessToken);

        setUser(authenticatedUser);
        safeSetItem(USER_DISPLAY_CACHE_KEY, JSON.stringify(authenticatedUser));

        if (authenticatedUser.role === "SUPER_ADMIN") {
          router.push("/admin");
        } else {
          router.push("/dashboard");
        }
      } catch (error) {
        console.error("Login error:", error);
        throw error;
      }
    },
    [router]
  );

  const selectOrganization = useCallback(
    async (organizationId: string) => {
      if (!pendingSelection) return;

      const response = await api.post<AuthTokenResponse>(
        "/auth/select-organization",
        {
          preAuthToken: pendingSelection.preAuthToken,
          organizationId,
        }
      );

      // New token pair goes to memory only — never persisted.
      const accessToken = extractAccessToken(response.data);
      const selectedUser = response.data.user;
      if (!accessToken || !selectedUser) {
        throw new Error("Invalid select-organization response");
      }
      setAccessToken(accessToken);
      setUser(selectedUser);
      safeSetItem(USER_DISPLAY_CACHE_KEY, JSON.stringify(selectedUser));
      setPendingSelection(null);

      if (selectedUser.role === "SUPER_ADMIN") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    },
    [pendingSelection, router]
  );

  const switchOrganization = useCallback(
    async (organizationId: string) => {
      try {
        const response = await api.post<AuthTokenResponse>("/auth/select-org", {
          organizationId,
        });

        // New token pair goes to memory only — never persisted.
        const accessToken = extractAccessToken(response.data);
        const switchedUser = response.data.user;
        if (!accessToken || !switchedUser) {
          throw new Error("Invalid select-org response");
        }
        setAccessToken(accessToken);
        safeSetItem(USER_DISPLAY_CACHE_KEY, JSON.stringify(switchedUser));
        setUser(switchedUser);

        queryClient.invalidateQueries({
          predicate: (query) => !query.queryKey.includes("admin"),
        });

        router.push("/dashboard");
      } catch (error) {
        showError(
          getApiErrorMessage(
            error,
            "No se pudo cambiar de organizacion. Intenta de nuevo."
          )
        );
        throw error;
      }
    },
    [queryClient, router, showError]
  );

  const logout = useCallback(() => {
    // Best-effort server logout: revokes the refresh token and clears the
    // httpOnly cookies. Errors are ignored — local cleanup happens anyway.
    void api.post("/auth/logout").catch(() => undefined);
    clearAccessToken();
    safeRemoveItem(USER_DISPLAY_CACHE_KEY);
    setUser(null);
    setPendingSelection(null);
    router.push("/login");
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      organization: user?.organization ?? null,
      loading,
      login,
      logout,
      switchOrganization,
      isAuthenticated: !!user,
      needsOrganizationSelection: !!pendingSelection,
    }),
    [user, loading, login, logout, switchOrganization, pendingSelection]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {pendingSelection && (
        <OrganizationSelectModal
          organizations={pendingSelection.organizations}
          onSelect={selectOrganization}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
