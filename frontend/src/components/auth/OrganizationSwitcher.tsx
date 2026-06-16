"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Shield,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/auth";

export interface SwitcherOrganization {
  id: string;
  name: string;
  role: AppRole;
  plan: "BASIC" | "PRO";
  status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED";
}

interface OrganizationSwitcherProps {
  currentOrganizationId?: string;
  onSwitch: (organizationId: string) => Promise<void>;
}

const planLabels: Record<string, string> = {
  BASIC: "Basico",
  PRO: "Pro",
};

const roleLabels: Record<string, string> = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  MEMBER: "Miembro",
  CASHIER: "Cajero",
  INVENTORY_USER: "Inventario",
};

export function OrganizationSwitcher({
  currentOrganizationId,
  onSwitch,
}: OrganizationSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<{
    organizations: SwitcherOrganization[];
  }>({
    queryKey: ["auth", "organizations"],
    queryFn: () =>
      api
        .get<{ organizations: SwitcherOrganization[] }>("/auth/organizations")
        .then((res) => res.data),
  });

  const organizations = data?.organizations ?? [];

  if (isLoading) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 p-2.5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando organizaciones...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
        No se pudieron cargar las organizaciones.
      </div>
    );
  }

  if (organizations.length <= 1) {
    return null;
  }

  const currentOrg =
    organizations.find((org) => org.id === currentOrganizationId) ??
    organizations[0];

  const handleSelect = async (organizationId: string) => {
    setSwitchingId(organizationId);
    try {
      await onSwitch(organizationId);
    } finally {
      setSwitchingId(null);
      setIsOpen(false);
    }
  };

  return (
    <div className="mt-3">
      <div className="overflow-hidden rounded-xl border border-primary/40 bg-primary/5">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
          aria-expanded={isOpen}
          aria-label="Cambiar organizacion"
        >
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Organizacion</p>
            <p className="truncate text-sm font-semibold text-foreground">
              {currentOrg?.name}
            </p>
            {currentOrg && (
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Shield className="h-3 w-3" />
                {roleLabels[currentOrg.role] ?? currentOrg.role}
                <span className="text-muted-foreground/60">·</span>
                {planLabels[currentOrg.plan] ?? currentOrg.plan}
              </p>
            )}
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </button>

        {isOpen && (
          <div className="space-y-1 border-t border-primary/20 p-2">
            {organizations.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => void handleSelect(org.id)}
                disabled={
                  switchingId === org.id || org.id === currentOrganizationId
                }
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                  org.id === currentOrganizationId
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border/60 bg-card hover:bg-muted"
                )}
              >
                <Building2 className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{org.name}</p>
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Shield className="h-3 w-3" />
                    {roleLabels[org.role] ?? org.role}
                    <span className="text-muted-foreground/60">·</span>
                    {planLabels[org.plan] ?? org.plan}
                  </p>
                </div>
                {switchingId === org.id && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
