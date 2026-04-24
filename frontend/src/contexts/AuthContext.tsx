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

export interface User {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "CASHIER" | "INVENTORY_USER" | "SUPER_ADMIN";
  active: boolean;
  isSuperAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
        const response = await api.post<{ accessToken: string }>("/auth/login", {
          email,
          password,
        });

        const token = response.data.accessToken;
        safeSetItem("token", token);

        const profileResponse = await api.get<User>("/auth/profile");
        setUser(profileResponse.data);
        safeSetItem("user", JSON.stringify(profileResponse.data));

        if (profileResponse.data.role === "SUPER_ADMIN") {
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

  const logout = useCallback(() => {
    safeRemoveItem("token");
    safeRemoveItem("user");
    setUser(null);
    router.push("/login");
  }, [router]);


  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      isAuthenticated: !!user,
    }),
    [user, loading, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
