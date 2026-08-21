"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { OrganizationSwitcher } from "@/components/auth/OrganizationSwitcher";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ShoppingBasket,
  Package,
  Users,
  Shield,
  TrendingUp,
  FolderTree,
  Receipt,
  Settings,
  LogOut,
  Moon,
  Sun,
  User as UserIcon,
  Menu,
  X,
  Boxes,
  ClipboardList,
  Truck,
  Wallet,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { hasAnyRole, type AppRole } from "@/lib/auth";
import { useState, useCallback, useEffect, useRef } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: AppRole[];
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="w-4 h-4" />,
    roles: ["ADMIN", "INVENTORY_USER"],
  },
  {
    label: "POS",
    href: "/pos",
    icon: <ShoppingBasket className="w-4 h-4" />,
    roles: ["ADMIN", "CASHIER"],
  },
  {
    label: "Ventas",
    href: "/sales",
    icon: <Receipt className="w-4 h-4" />,
    roles: ["ADMIN", "CASHIER"],
  },
  {
    label: "Clientes",
    href: "/customers",
    icon: <Users className="w-4 h-4" />,
    roles: ["ADMIN", "CASHIER"],
  },
  {
    label: "Inventario",
    href: "/inventory",
    icon: <Package className="w-4 h-4" />,
    roles: ["ADMIN", "CASHIER", "INVENTORY_USER"],
  },
  {
    label: "Categorías",
    href: "/categories",
    icon: <FolderTree className="w-4 h-4" />,
    roles: ["ADMIN", "INVENTORY_USER"],
  },
  {
    label: "Proveedores",
    href: "/suppliers",
    icon: <Truck className="w-4 h-4" />,
    roles: ["ADMIN", "INVENTORY_USER"],
  },
  {
    label: "Compras",
    href: "/purchase-orders",
    icon: <ClipboardList className="w-4 h-4" />,
    roles: ["ADMIN", "INVENTORY_USER"],
  },
  {
    label: "Salidas",
    href: "/expenses",
    icon: <Wallet className="w-4 h-4" />,
    roles: ["ADMIN"],
  },
  {
    label: "Reportes",
    href: "/reports",
    icon: <TrendingUp className="w-4 h-4" />,
    roles: ["ADMIN"],
  },
  {
    label: "Tareas",
    href: "/tasks",
    icon: <ClipboardList className="w-4 h-4" />,
    roles: ["ADMIN", "CASHIER", "INVENTORY_USER"],
  },
  {
    label: "Mi perfil",
    href: "/profile",
    icon: <UserIcon className="w-4 h-4" />,
  },
  {
    label: "Configuración",
    href: "/settings",
    icon: <Settings className="w-4 h-4" />,
    roles: ["ADMIN"],
  },
  {
    label: "SuperAdmin",
    href: "/admin",
    icon: <Shield className="w-4 h-4" />,
    roles: ["SUPER_ADMIN"],
  },
];

const roleLabels: Record<string, string> = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  CASHIER: "Cajero",
  INVENTORY_USER: "Inventario",
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout, switchOrganization } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("selectedOrganizationId");
    }
    return null;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const navRef = useRef<HTMLElement>(null);

  const filteredItems = navItems.filter(
    (item) => !item.roles || (user && hasAnyRole(user.role, item.roles))
  );

  const toggleMobileMenu = useCallback(() => setIsMobileMenuOpen((p) => !p), []);
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  // Scroll the active nav item into view on mount / pathname change
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const activeLink = nav.querySelector<HTMLElement>(".sidebar-item.active");
    if (activeLink?.scrollIntoView) {
      activeLink.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }, [pathname]);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  const formattedDate = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);

  const formattedTime = new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
  }).format(now);

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="px-5 py-5 border-b border-border/70 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm shadow-primary/30 shrink-0">
          <Boxes className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-extrabold text-foreground truncate leading-tight tracking-tight">
            {APP_NAME}
          </p>
        </div>
      </div>

      {/* User Bento Card */}
      {user && (
        <div className="p-4 border-b border-border/70">
          <div className="rounded-2xl border border-border/80 bg-muted/30 p-3.5 flex flex-col gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-light border border-primary/30 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground truncate leading-tight">
                  {user.name}
                </p>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-mono text-[10px] font-semibold mt-0.5">
                  {roleLabels[user.role] ?? user.role}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
              <div className="flex items-center bg-muted/80 rounded-lg p-0.5 border border-border/40">
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label="Cambiar a modo claro"
                  className={cn(
                    "p-1 rounded-md transition-colors",
                    theme === "light"
                      ? "bg-card text-primary shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sun className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label="Cambiar a modo oscuro"
                  className={cn(
                    "p-1 rounded-md transition-colors",
                    theme === "dark"
                      ? "bg-card text-primary shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Moon className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={logout}
                className="p-1.5 rounded-lg text-danger hover:bg-danger/10 transition-colors"
                aria-label="Cerrar sesion"
                title="Cerrar sesion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            <div className="font-mono text-[11px] text-muted-foreground text-center bg-muted/60 py-1.5 rounded-lg border border-border/40">
              {formattedDate}, {formattedTime}
            </div>

            {user.isSuperAdmin ? (
              <OrganizationSwitcher
                currentOrganizationId={selectedOrgId}
                onSwitch={async (orgId) => {
                  setSelectedOrgId(orgId);
                  localStorage.setItem("selectedOrganizationId", orgId);
                  queryClient.invalidateQueries();
                }}
                isSuperAdmin
                onSelectAll={() => {
                  setSelectedOrgId(null);
                  localStorage.removeItem("selectedOrganizationId");
                  queryClient.invalidateQueries();
                }}
              />
            ) : (
              <OrganizationSwitcher
                currentOrganizationId={user.organizationId ?? undefined}
                onSwitch={switchOrganization}
              />
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav ref={navRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {filteredItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobileMenu}
              className={cn(
                "sidebar-item flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150",
                isActive
                  ? "active bg-primary-light text-primary relative after:absolute after:left-0 after:w-1 after:h-2/3 after:bg-primary after:rounded-r-full shadow-xs"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "shrink-0 transition-colors duration-150",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 z-50 flex items-center justify-between px-4 bg-card border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white shadow-xs">
            <Boxes className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-bold text-foreground">
            {APP_NAME}
          </span>
        </div>
        <button
          onClick={toggleMobileMenu}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label={isMobileMenuOpen ? "Cerrar menu" : "Abrir menu"}
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-xs z-40"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar (Fixed 320px) */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-screen flex flex-col z-50 w-[320px]",
          "bg-card border-r border-border/80",
          "transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          "lg:mt-0 mt-14"
        )}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {sidebarContent}
        </div>
      </aside>
    </>
  );
}
