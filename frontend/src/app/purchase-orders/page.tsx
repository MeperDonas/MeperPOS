"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { useSuppliers } from "@/hooks/useSuppliers";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { PurchaseOrderStatusBadge } from "@/components/purchase-orders/PurchaseOrderStatusBadge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar } from "@/components/ui/FilterBar";
import { Plus, Eye, ClipboardList, X } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { chipStyles } from "@/lib/chipStyles";
import type { PurchaseOrderStatus } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

const statusOptions: Array<{ value: "" | PurchaseOrderStatus; label: string }> = [
  { value: "", label: "Todos los estados" },
  { value: "DRAFT", label: "Borrador" },
  { value: "PENDING", label: "Pendiente" },
  { value: "PARTIAL_RECEIVED", label: "Recibida parcialmente" },
  { value: "RECEIVED", label: "Recibida" },
  { value: "CANCELLED", label: "Cancelada" },
];

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const canManage = user?.role === "ADMIN" || user?.role === "INVENTORY_USER";

  const [q, setQ] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState<"" | PurchaseOrderStatus>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const { data: suppliersData } = useSuppliers({ limit: 200, status: "active" });
  const { data, isLoading } = usePurchaseOrders({
    page,
    limit: 15,
    q: q.trim() || undefined,
    supplierId: supplierId || undefined,
    status: status || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const orders = data?.data ?? [];
  const meta = data?.meta;
  const suppliers = suppliersData?.data ?? [];

  const hasFilters =
    !!q || !!supplierId || !!status || !!dateFrom || !!dateTo;

  const clearFilters = () => {
    setPage(1);
    setQ("");
    setSupplierId("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 lg:space-y-7">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-1 h-7 rounded-full bg-primary shrink-0" />
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                Órdenes de compra
              </h1>
              {meta && (
                <span
                  className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${chipStyles.primary}`}
                >
                  {meta.total} registros
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground ml-4">
              Gestiona las compras y el abastecimiento
            </p>
          </div>
          {canManage && (
            <Link href="/purchase-orders/new" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto shrink-0">
                <Plus className="w-4 h-4" /> Nueva OC
              </Button>
            </Link>
          )}
        </div>

        <FilterBar
          searchValue={q}
          onSearchChange={(value) => {
            setPage(1);
            setQ(value);
          }}
          searchPlaceholder="Buscar por N° OC o proveedor..."
          filterControls={
            <>
              <select
                value={supplierId}
                onChange={(e) => {
                  setPage(1);
                  setSupplierId(e.target.value);
                }}
                className="h-8 px-2.5 rounded-lg text-xs font-semibold bg-muted/40 border border-border/60 text-foreground focus:outline-none focus:border-primary/50 max-w-[180px]"
              >
                <option value="">Todos los proveedores</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value as "" | PurchaseOrderStatus);
                }}
                className="h-8 px-2.5 rounded-lg text-xs font-semibold bg-muted/40 border border-border/60 text-foreground focus:outline-none focus:border-primary/50"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setPage(1);
                  setDateFrom(e.target.value);
                }}
                className="h-8 px-2 rounded-lg text-xs font-semibold bg-muted/40 border border-border/60 text-foreground focus:outline-none focus:border-primary/50"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setPage(1);
                  setDateTo(e.target.value);
                }}
                className="h-8 px-2 rounded-lg text-xs font-semibold bg-muted/40 border border-border/60 text-foreground focus:outline-none focus:border-primary/50"
              />
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/60 transition-colors"
                >
                  <X className="w-3 h-3" /> Limpiar
                </button>
              )}
            </>
          }
        />

        {isLoading ? (
          <LoadingState icon={<ClipboardList className="w-4 h-4 text-primary/50" />} message="Cargando órdenes..." />
        ) : (
          <>
            <div className="rounded-3xl border border-accent/30 bg-accent/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px]">
                  <thead>
                    <tr className="border-b border-accent/20 bg-accent/10">
                      <th className="text-left py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        N° OC
                      </th>
                      <th className="text-left py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Proveedor
                      </th>
                      <th className="text-left py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Fecha
                      </th>
                      <th className="text-left py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Estado
                      </th>
                      <th className="text-right py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Total
                      </th>
                      <th className="text-right py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-14">
                          <EmptyState icon={<ClipboardList className="w-6 h-6 text-muted-foreground/30" />} title="No hay órdenes de compra" />
                        </td>
                      </tr>
                    ) : (
                      orders.map((order) => (
                        <tr
                          key={order.id}
                          className="border-b border-accent/10 transition-colors hover:bg-accent/[0.06] cursor-pointer last:border-b-0"
                          onClick={() =>
                            router.push(`/purchase-orders/${order.id}`)
                          }
                        >
                          <td className="py-3 px-5">
                            <span className="text-xs font-bold text-primary font-mono">
                              OC-{order.orderNumber}
                            </span>
                          </td>
                          <td className="py-3 px-5 max-w-[200px] truncate">
                            <span className="text-xs font-semibold text-foreground">
                              {order.supplier?.name ?? "—"}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-xs text-muted-foreground whitespace-nowrap font-mono">
                            {formatDate(order.createdAt)}
                          </td>
                          <td className="py-3 px-5">
                            <PurchaseOrderStatusBadge status={order.status} />
                          </td>
                          <td className="py-3 px-5 text-right">
                            <span className="stat-number text-sm font-bold text-foreground">
                              {formatCurrency(order.total)}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/purchase-orders/${order.id}`);
                                }}
                                className="p-1.5 h-7 w-7"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {meta && meta.totalPages > 1 && (
              <Pagination
                currentPage={page}
                totalPages={meta.totalPages}
                onPageChange={setPage}
                totalItems={meta.total}
                itemLabel="orden"
              />
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
