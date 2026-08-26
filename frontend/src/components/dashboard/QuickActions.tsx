"use client";

import { useRouter } from "next/navigation";
import { Package, Plus, RefreshCw, Receipt, ShoppingCart, type LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { hasAnyRole } from "@/lib/auth";
import type { AppRole } from "@/lib/auth";

interface QuickAction {
  id: string;
  label: string;
  href: string;
  roles: AppRole[];
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  borderHover: string;
}

/**
 * Quick-action map mirroring routeRoleMap semantics (see Sidebar/DashboardLayout).
 * Only actions whose role gates allow the current user are rendered (DIA-9).
 */
const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "new-product",
    label: "Nuevo producto",
    href: "/inventory",
    roles: ["ADMIN", "INVENTORY_USER"],
    icon: Package,
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    borderHover: "hover:border-primary/50 hover:bg-primary/[0.03]",
  },
  {
    id: "new-sale",
    label: "Nueva venta",
    href: "/pos",
    roles: ["ADMIN", "CASHIER"],
    icon: ShoppingCart,
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    borderHover: "hover:border-emerald-500/50 hover:bg-emerald-500/[0.03]",
  },
  {
    id: "reorder",
    label: "Reordenar",
    href: "/inventory?filter=lowStock",
    roles: ["ADMIN", "INVENTORY_USER"],
    icon: RefreshCw,
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-600 dark:text-amber-400",
    borderHover: "hover:border-amber-500/50 hover:bg-amber-500/[0.03]",
  },
  {
    id: "new-expense",
    label: "Nuevo gasto",
    href: "/expenses",
    roles: ["ADMIN"],
    icon: Receipt,
    iconBg: "bg-accent/15",
    iconColor: "text-accent",
    borderHover: "hover:border-accent/50 hover:bg-accent/[0.03]",
  },
];

export function QuickActions() {
  const { user } = useAuth();
  const router = useRouter();

  const visible = QUICK_ACTIONS.filter((action) =>
    hasAnyRole(user?.role, action.roles),
  );

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {visible.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => router.push(action.href)}
            className={`group flex min-w-0 flex-col items-start gap-3 rounded-3xl border border-border/80 bg-card px-5 py-4 text-left text-foreground transition-all ${action.borderHover}`}
          >
            <div className={`p-2.5 rounded-xl ${action.iconBg}`}>
              <Icon className={`h-5 w-5 ${action.iconColor}`} aria-hidden="true" />
            </div>
            <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground">
              <Plus className="h-3 w-3" aria-hidden="true" />
              {action.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
