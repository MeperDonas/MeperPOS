"use client";

import { cn } from "@/lib/utils";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingUp,
  Users,
  Package,
  UserCircle,
  Store,
} from "lucide-react";

interface PlanLimitBannerProps {
  className?: string;
}

const typeLabels: Record<string, string> = {
  users: "Usuarios",
  products: "Productos",
  customers: "Clientes",
  cashRegisters: "Cajas",
};

const typeIcons: Record<string, React.ReactNode> = {
  users: <Users className="w-3.5 h-3.5" />,
  products: <Package className="w-3.5 h-3.5" />,
  customers: <UserCircle className="w-3.5 h-3.5" />,
  cashRegisters: <Store className="w-3.5 h-3.5" />,
};

export function PlanLimitBanner({ className }: PlanLimitBannerProps) {
  const { organization } = useAuth();
  const { data, isLoading } = usePlanLimits();

  if (isLoading || !data || !organization) return null;

  const { limits } = data;
  const { status } = organization;

  const exceeded = limits.filter((l) => l.exceeded);
  const warnings = limits.filter(
    (l) => !l.exceeded && l.current >= l.warningAt && l.limit > 0
  );

  const hasIssues = exceeded.length > 0 || warnings.length > 0;
  const isBillingAlert =
    status === "TRIAL" || status === "PAST_DUE" || status === "SUSPENDED";

  if (!hasIssues && !isBillingAlert) return null;

  return (
    <div
      className={cn(
        "space-y-2 mb-4 animate-fade-in",
        className
      )}
    >
      {isBillingAlert && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 flex items-start gap-3",
            status === "SUSPENDED"
              ? "bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-200"
              : status === "PAST_DUE"
              ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200"
              : "bg-primary/10 border-primary/30 text-foreground"
          )}
        >
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="text-sm">
            {status === "TRIAL" && (
              <span>
                Estás en periodo de prueba.
                {organization.trialEndsAt && (
                  <> Tu prueba finaliza el{" "}
                    <strong>
                      {new Date(organization.trialEndsAt).toLocaleDateString(
                        "es-CO"
                      )}
                    </strong>
                    .
                  </>
                )}{" "}
                Actualiza a PRO para desbloquear todos los límites.
              </span>
            )}
            {status === "PAST_DUE" && (
              <span>
                Tu suscripción está <strong>vencida</strong>. Realiza el pago
                lo antes posible para evitar la suspensión.
              </span>
            )}
            {status === "SUSPENDED" && (
              <span>
                Tu organización está <strong>suspendida</strong>. Solo puedes
                consultar datos. Contacta al administrador para reactivarla.
              </span>
            )}
          </div>
        </div>
      )}

      {exceeded.map((limit) => (
        <div
          key={limit.type}
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-3 text-red-800 dark:text-red-200"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">
              Límite excedido: {typeLabels[limit.type]}
            </p>
            <p className="opacity-90">
              Usas {limit.current} de {limit.limit}. Actualiza tu plan para
              seguir creando {typeLabels[limit.type].toLowerCase()}.
            </p>
          </div>
        </div>
      ))}

      {warnings.map((limit) => (
        <div
          key={limit.type}
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-start gap-3 text-amber-800 dark:text-amber-200"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold flex items-center gap-1.5">
              {typeIcons[limit.type]}
              Acercándote al límite: {typeLabels[limit.type]}
            </p>
            <p className="opacity-90">
              Usas {limit.current} de {limit.limit} (
              {Math.round((limit.current / limit.limit) * 100)}%).
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
