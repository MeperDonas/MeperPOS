"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import {
  useBillingStatus,
  useBillingPayments,
  useRegisterPayment,
} from "@/hooks/useBilling";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/contexts/ToastContext";
import { getApiErrorMessage } from "@/lib/api";
import {
  CreditCard,
  TrendingUp,
  AlertTriangle,
  AlertCircle,
  Users,
  Package,
  UserCircle,
  Store,
  Calendar,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

const typeLabels: Record<string, string> = {
  users: "Usuarios",
  products: "Productos",
  customers: "Clientes",
  cashRegisters: "Cajas",
};

const typeIcons: Record<string, React.ReactNode> = {
  users: <Users className="w-4 h-4" />,
  products: <Package className="w-4 h-4" />,
  customers: <UserCircle className="w-4 h-4" />,
  cashRegisters: <Store className="w-4 h-4" />,
};

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "danger"; icon: React.ReactNode }
> = {
  TRIAL: { label: "Prueba", variant: "warning", icon: <Clock className="w-3.5 h-3.5" /> },
  ACTIVE: { label: "Activo", variant: "success", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  PAST_DUE: { label: "Vencido", variant: "danger", icon: <AlertCircle className="w-3.5 h-3.5" /> },
  SUSPENDED: { label: "Suspendido", variant: "danger", icon: <XCircle className="w-3.5 h-3.5" /> },
};

const planConfig: Record<string, { label: string; color: string }> = {
  BASIC: { label: "Básico", color: "text-foreground" },
  PRO: { label: "Profesional", color: "text-accent" },
};

export default function BillingSettingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { data: planLimits, isLoading: limitsLoading } = usePlanLimits();
  const { data: billingStatus, isLoading: statusLoading } = useBillingStatus();
  const { data: payments, isLoading: paymentsLoading } = useBillingPayments();
  const registerPayment = useRegisterPayment();

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "CASH" as "CASH" | "CARD" | "TRANSFER",
    date: new Date().toISOString().split("T")[0],
  });

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isLoading = limitsLoading || statusLoading;

  const downgradeFlags = billingStatus?.settings?.downgradeFlags as
    | {
        usersOverLimit?: boolean;
        productsOverLimit?: boolean;
        customersOverLimit?: boolean;
        cashRegistersDisabled?: string[];
      }
    | undefined;

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingStatus?.id) return;
    try {
      await registerPayment.mutateAsync({
        organizationId: billingStatus.id,
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        date: paymentForm.date,
        status: "PAID",
      });
      toast.success("Pago registrado correctamente");
      setShowPaymentForm(false);
      setPaymentForm({ amount: "", method: "CASH", date: new Date().toISOString().split("T")[0] });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Error al registrar el pago"));
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-pulse">
              <CreditCard className="w-5 h-5 text-primary/50" />
            </div>
            <p className="text-xs text-muted-foreground">Cargando información de suscripción...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5 lg:space-y-7 max-w-3xl">
        {/* Page Header */}
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-7 rounded-full bg-primary shrink-0" />
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Suscripción y Facturación</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-4">
            Gestiona tu plan, límites y pagos
          </p>
        </div>

        {/* Plan Card */}
        <div className="rounded-3xl border border-primary/30 bg-primary/10 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-primary/20">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Plan Actual</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Plan</p>
                <p className={cn("text-xl font-bold", planConfig[billingStatus?.plan ?? "BASIC"]?.color)}>
                  {planConfig[billingStatus?.plan ?? "BASIC"]?.label ?? billingStatus?.plan}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Estado</p>
                <Badge variant={statusConfig[billingStatus?.status ?? "ACTIVE"].variant} className="mt-1">
                  <span className="flex items-center gap-1">
                    {statusConfig[billingStatus?.status ?? "ACTIVE"].icon}
                    {statusConfig[billingStatus?.status ?? "ACTIVE"].label}
                  </span>
                </Badge>
              </div>
            </div>

            {billingStatus?.trialEndsAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>
                  Fin de prueba:{" "}
                  <strong className="text-foreground">
                    {formatDate(billingStatus.trialEndsAt)}
                  </strong>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Downgrade Banner */}
        {downgradeFlags && (
          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-amber-500/20">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-300" />
              </div>
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                Ajuste de plan requerido
              </h3>
            </div>
            <div className="p-5 space-y-2">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Tu plan cambió a <strong>Básico</strong> y algunos recursos exceden los nuevos límites:
              </p>
              <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1 list-disc list-inside">
                {downgradeFlags.usersOverLimit && <li>Usuarios sobre el límite</li>}
                {downgradeFlags.productsOverLimit && <li>Productos sobre el límite</li>}
                {downgradeFlags.customersOverLimit && <li>Clientes sobre el límite</li>}
                {Array.isArray(downgradeFlags.cashRegistersDisabled) &&
                  downgradeFlags.cashRegistersDisabled.length > 0 && (
                    <li>
                      {downgradeFlags.cashRegistersDisabled.length} caja(s) deshabilitada(s)
                    </li>
                  )}
              </ul>
            </div>
          </div>
        )}

        {/* Limits Card */}
        <div className="rounded-3xl border border-accent/30 bg-accent/10 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-accent/20">
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-accent" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Uso y Límites</h3>
          </div>
          <div className="p-5 space-y-3">
            {planLimits?.limits.map((limit) => {
              const pct = limit.limit > 0 ? (limit.current / limit.limit) * 100 : 0;
              const isUnlimited = limit.limit === -1;
              const isWarning = !limit.exceeded && limit.current >= limit.warningAt && !isUnlimited;
              const isExceeded = limit.exceeded && !isUnlimited;

              return (
                <div key={limit.type} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-foreground">
                      {typeIcons[limit.type]}
                      {typeLabels[limit.type]}
                    </span>
                    <span className="font-mono text-xs">
                      {isUnlimited ? (
                        <span className="text-accent">Ilimitado</span>
                      ) : (
                        <span
                          className={cn(
                            isExceeded && "text-red-600 dark:text-red-400 font-semibold",
                            isWarning && "text-amber-700 dark:text-amber-400 font-semibold"
                          )}
                        >
                          {limit.current} / {limit.limit}
                        </span>
                      )}
                    </span>
                  </div>
                  {!isUnlimited && (
                    <div className="h-2 rounded-full bg-background/60 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          isExceeded
                            ? "bg-red-500"
                            : isWarning
                            ? "bg-amber-500"
                            : "bg-accent"
                        )}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Payments History */}
        <div className="rounded-3xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Historial de Pagos</h3>
            </div>
            {isSuperAdmin && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowPaymentForm((s) => !s)}
              >
                {showPaymentForm ? "Cancelar" : "Registrar Pago"}
              </Button>
            )}
          </div>

          {showPaymentForm && isSuperAdmin && (
            <div className="p-5 border-b border-border bg-muted/30">
              <form onSubmit={handleRegisterPayment} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="Monto (COP)"
                    type="number"
                    required
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, amount: e.target.value })
                    }
                  />
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Método
                    </label>
                    <select
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      value={paymentForm.method}
                      onChange={(e) =>
                        setPaymentForm({
                          ...paymentForm,
                          method: e.target.value as "CASH" | "CARD" | "TRANSFER",
                        })
                      }
                    >
                      <option value="CASH">Efectivo</option>
                      <option value="CARD">Tarjeta</option>
                      <option value="TRANSFER">Transferencia</option>
                    </select>
                  </div>
                  <Input
                    label="Fecha"
                    type="date"
                    required
                    value={paymentForm.date}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, date: e.target.value })
                    }
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" loading={registerPayment.isPending} size="sm">
                    Guardar Pago
                  </Button>
                </div>
              </form>
            </div>
          )}

          <div className="p-5">
            {paymentsLoading ? (
              <p className="text-sm text-muted-foreground">Cargando pagos...</p>
            ) : payments && payments.length > 0 ? (
              <div className="space-y-2">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {formatCurrency(Number(payment.amount))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(payment.date)}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        payment.status === "PAID"
                          ? "success"
                          : payment.status === "PENDING"
                          ? "warning"
                          : "danger"
                      }
                    >
                      {payment.status === "PAID"
                        ? "Pagado"
                        : payment.status === "PENDING"
                        ? "Pendiente"
                        : "Fallido"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay pagos registrados.
              </p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
