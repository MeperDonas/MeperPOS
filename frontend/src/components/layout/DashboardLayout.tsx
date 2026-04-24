"use client";

import { useAuth } from "@/contexts/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, memo } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

type UserRole = "ADMIN" | "CASHIER" | "INVENTORY_USER" | "SUPER_ADMIN";

const routeRoleMap: Array<{ prefix: string; roles: UserRole[] }> = [
  { prefix: "/dashboard", roles: ["ADMIN", "INVENTORY_USER"] },
  { prefix: "/pos", roles: ["ADMIN", "CASHIER"] },
  { prefix: "/inventory", roles: ["ADMIN", "CASHIER", "INVENTORY_USER"] },
  { prefix: "/suppliers", roles: ["ADMIN", "INVENTORY_USER"] },
  { prefix: "/purchase-orders", roles: ["ADMIN", "INVENTORY_USER"] },
  { prefix: "/sales", roles: ["ADMIN", "CASHIER"] },
  { prefix: "/customers", roles: ["ADMIN", "CASHIER"] },
  { prefix: "/reports", roles: ["ADMIN"] },
  { prefix: "/users", roles: ["ADMIN"] },
  { prefix: "/tasks", roles: ["ADMIN", "CASHIER", "INVENTORY_USER"] },
  { prefix: "/categories", roles: ["ADMIN", "INVENTORY_USER"] },
  { prefix: "/settings", roles: ["ADMIN"] },
  { prefix: "/profile", roles: ["ADMIN", "CASHIER", "INVENTORY_USER"] },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout = memo(function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const userRole = user?.role;

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (loading || !isAuthenticated || !userRole) return;

    if (userRole === "SUPER_ADMIN") {
      router.replace("/admin");
      return;
    }

    const routeConfig = routeRoleMap.find(
      (route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)
    );

    if (!routeConfig) return;

    if (!routeConfig.roles.includes(userRole)) {
      router.replace(userRole === "CASHIER" ? "/pos" : "/dashboard");
    }
  }, [isAuthenticated, loading, pathname, router, userRole]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center animate-pulse">
            <div className="w-4 h-4 rounded-sm bg-primary/60" />
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="px-4 pb-6 pt-20 lg:ml-64 lg:px-8 lg:pb-8 lg:pt-8">
        <div className="mx-auto w-full max-w-[1500px]">{children}</div>
      </main>
    </div>
  );
});
