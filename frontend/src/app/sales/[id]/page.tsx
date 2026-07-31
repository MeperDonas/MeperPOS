"use client";

import axios from "axios";
import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Receipt } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { useSale } from "@/hooks/useSales";
import { printReceipt } from "@/hooks/useReceipt";
import { useToast } from "@/contexts/ToastContext";
import { getApiErrorMessage } from "@/lib/api";
import { chipStyles } from "@/lib/chipStyles";
import { formatCurrency, formatDateTime } from "@/lib/utils";

function getStatusBadge(status: string) {
  switch (status) {
    case "COMPLETED":
      return <Badge variant="success">Completada</Badge>;
    case "CANCELLED":
      return <Badge variant="danger">Cancelada</Badge>;
    case "RETURNED_PARTIAL":
      return <Badge variant="warning">Parcial</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
}

function getPaymentMethodLabel(method: string) {
  switch (method) {
    case "CASH":
      return "Efectivo";
    case "CARD":
      return "Tarjeta";
    case "TRANSFER":
      return "Transferencia";
    default:
      return method;
  }
}

export default function SaleDetailPage() {
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ id: string | string[] }>();
  const saleId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { data: sale, isLoading, error } = useSale(saleId ?? "");

  const errorMessage = useMemo(() => {
    if (!error) {
      return null;
    }

    if (axios.isAxiosError(error)) {
      if (error.response?.status === 403) {
        return "No tenes permisos para ver esta venta.";
      }

      if (error.response?.status === 404) {
        return "La venta no existe o fue eliminada.";
      }
    }

    return getApiErrorMessage(error, "No se pudo cargar el detalle de la venta.");
  }, [error]);

  const handlePrintReceipt = async () => {
    if (!sale) {
      return;
    }

    try {
      await printReceipt(sale.id);
    } catch (receiptError) {
      toast.error(
        getApiErrorMessage(receiptError, "Error al generar el comprobante"),
      );
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 lg:space-y-7">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-1 h-7 rounded-full bg-primary shrink-0" />
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
              Detalle de venta
            </h1>
          </div>
          <Button variant="secondary" onClick={() => router.push("/sales") }>
            <ArrowLeft className="w-4 h-4" /> Volver
          </Button>
        </div>

        {isLoading ? (
          <LoadingState icon={<Receipt className="w-4 h-4 text-primary/50" />} message="Cargando venta..." />
        ) : errorMessage || !sale ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-sm font-semibold text-foreground">No se pudo abrir la venta</p>
              <p className="text-xs text-muted-foreground">{errorMessage ?? "La venta solicitada no esta disponible."}</p>
              <div className="pt-1">
                <Button variant="secondary" onClick={() => router.push("/sales") }>
                  Ir a Ventas
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden">
              <div className="card-top-rail card-top-rail--primary" />
              <CardContent className="space-y-5 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      Venta
                    </p>
                    <p className="text-xl font-bold text-primary font-mono">
                      #{sale.saleNumber}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(sale.status)}
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${chipStyles.primary}`}
                    >
                      {formatDateTime(sale.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Cliente
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {sale.customer?.name || "Cliente General"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Vendedor
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {sale.user?.name || "N/A"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/50 md:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Metodos de pago
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {sale.payments?.length ? (
                        sale.payments.map((payment) => (
                          <Badge key={payment.id} variant="secondary">
                            {getPaymentMethodLabel(payment.method)}: {formatCurrency(payment.amount)}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Sin pago</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Items
                  </p>
                  <div className="space-y-1.5 max-h-72 overflow-y-auto scrollbar-hide">
                    {sale.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {item.product?.name || "Producto eliminado"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(item.unitPrice)} x {item.quantity}
                          </p>
                        </div>
                        <span className="stat-number text-sm font-bold text-foreground ml-4">
                          {formatCurrency(item.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-border/60 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium text-foreground">
                      {formatCurrency(sale.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Impuestos</span>
                    <span className="font-medium text-foreground">
                      {formatCurrency(sale.taxAmount)}
                    </span>
                  </div>
                  {sale.discountAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Descuento</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        -{formatCurrency(sale.discountAmount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-border/60">
                    <span className="font-bold text-foreground">Total</span>
                    <span className="stat-number text-xl font-bold text-primary">
                      {formatCurrency(sale.total)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handlePrintReceipt}>
                    <Download className="w-4 h-4" /> Descargar comprobante
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
