"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { api } from "@/lib/api";
import { safeGetItem, safeSetItem, safeRemoveItem } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { OrganizationSelectModal } from "@/components/auth/OrganizationSelectModal";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "CASHIER" | "INVENTORY_USER" | "SUPER_ADMIN";
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

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
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

  useEffect(() => {
    const validateSession = async () => {
      const token = safeGetItem("token");
      const savedUser = safeGetItem("user");

      if (!token || !savedUser) {
        setLoading(false);
        return;
      }

      try {
        JSON.parse(savedUser);
        const profileResponse = await api.get<User>("/auth/profile");
        setUser(profileResponse.data);
        safeSetItem("user", JSON.stringify(profileResponse.data));
      } catch {
        safeRemoveItem("token");
        safeRemoveItem("user");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void validateSession();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const response = await api.post<
          | { accessToken: string; refreshToken: string; user: User }
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

        const token = data.accessToken;
        safeSetItem("token", token);
        safeSetItem("refreshToken", data.refreshToken);

        setUser(data.user);
        safeSetItem("user", JSON.stringify(data.user));

        if (data.user.role === "SUPER_ADMIN") {
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

      const response = await api.post<{
        accessToken: string;
        refreshToken: string;
        user: User;
      }>("/auth/select-organization", {
        preAuthToken: pendingSelection.preAuthToken,
        organizationId,
      });

      const { accessToken, refreshToken, user: selectedUser } = response.data;

      safeSetItem("token", accessToken);
      safeSetItem("refreshToken", refreshToken);
      setUser(selectedUser);
      safeSetItem("user", JSON.stringify(selectedUser));
      setPendingSelection(null);

      if (selectedUser.role === "SUPER_ADMIN") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    },
    [pendingSelection, router]
  );

  const logout = useCallback(() => {
    safeRemoveItem("token");
    safeRemoveItem("refreshToken");
    safeRemoveItem("user");
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
      isAuthenticated: !!user,
      needsOrganizationSelection: !!pendingSelection,
    }),
    [user, loading, login, logout, pendingSelection]
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
