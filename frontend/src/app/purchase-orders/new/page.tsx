"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useProducts } from "@/hooks/useProducts";
import {
  useCreatePurchaseOrder,
  type CreatePurchaseOrderItemPayload,
} from "@/hooks/usePurchaseOrders";
import { Button } from "@/components/ui/Button";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { ArrowLeft, Plus, Trash2, ClipboardList } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { useToast } from "@/contexts/ToastContext";
import { getApiErrorMessage } from "@/lib/api";
import type { Product } from "@/types";

interface DraftItem extends CreatePurchaseOrderItemPayload {
  tempId: string;
  productName?: string;
  productSku?: string;
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const toast = useToast();

  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const { data: suppliersData } = useSuppliers({ limit: 200, status: "active" });
  const { data: productsData } = useProducts({
    limit: 25,
    search: productSearch || undefined,
    status: "active",
  });
  const createPO = useCreatePurchaseOrder();

  const suppliers = suppliersData?.data ?? [];
  const products = productsData?.data ?? [];

  const totals = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;
    for (const it of items) {
      const line = it.qtyOrdered * it.unitCost;
      subtotal += line;
      taxAmount += (line * it.taxRate) / 100;
    }
    return {
      subtotal,
      taxAmount,
      total: subtotal + taxAmount,
    };
  }, [items]);

  const addProduct = (product: Product) => {
    if (items.some((it) => it.productId === product.id)) {
      toast.error("Ese producto ya está en la orden");
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        tempId: genId(),
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        qtyOrdered: 1,
        unitCost: product.costPrice,
        taxRate: product.taxRate,
      },
    ]);
    setShowPicker(false);
    setProductSearch("");
  };

  const updateItem = (tempId: string, patch: Partial<DraftItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.tempId === tempId ? { ...it, ...patch } : it)),
    );
  };

  const removeItem = (tempId: string) => {
    setItems((prev) => prev.filter((it) => it.tempId !== tempId));
  };

  const canSubmit =
    !!supplierId &&
    items.length > 0 &&
    items.every(
      (it) =>
        it.qtyOrdered > 0 &&
        it.unitCost >= 0 &&
        it.taxRate >= 0 &&
        it.taxRate <= 100,
    );

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      const created = await createPO.mutateAsync({
        supplierId,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          qtyOrdered: it.qtyOrdered,
          unitCost: it.unitCost,
          taxRate: it.taxRate,
        })),
      });
      toast.success(`OC-${created.orderNumber} creada como borrador`);
      router.push(`/purchase-orders/${created.id}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear la orden"));
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 lg:space-y-7">
        <div className="flex items-center gap-3">
          <Link
            href="/purchase-orders"
            className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Volver
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <div className="w-1 h-7 rounded-full bg-primary shrink-0" />
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                Nueva orden de compra
              </h1>
            </div>
            <p className="text-sm text-muted-foreground ml-4">
              Crea un borrador para confirmar más tarde
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Proveedor
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  required
                >
                  <option value="">Selecciona un proveedor...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.documentNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Notas (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Observaciones sobre la orden..."
                  className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
                <h2 className="text-sm font-semibold text-foreground">Items</h2>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowPicker((s) => !s)}
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar producto
                </Button>
              </div>

              {showPicker && (
                <div className="px-5 py-3 border-b border-border/60 bg-muted/40 space-y-2">
                  <input
                    autoFocus
                    placeholder="Buscar producto por nombre o SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
                  />
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-border/60 bg-card divide-y divide-border/60">
                    {products.length === 0 ? (
                      <p className="p-3 text-xs text-muted-foreground text-center">
                        Sin resultados
                      </p>
                    ) : (
                      products.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addProduct(p)}
                          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-primary/5 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {p.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono">
                              {p.sku} · Costo {formatCurrency(p.costPrice)}
                            </p>
                          </div>
                          <Plus className="w-4 h-4 text-primary shrink-0" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {items.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-muted flex items-center justify-center mb-3">
                    <ClipboardList className="w-5 h-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Agrega productos a la orden
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/40">
                        <th className="text-left py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Producto
                        </th>
                        <th className="text-right py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-24">
                          Cant.
                        </th>
                        <th className="text-right py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-32">
                          Costo Unit.
                        </th>
                        <th className="text-right py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-20">
                          IVA %
                        </th>
                        <th className="text-right py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-32">
                          Subtotal
                        </th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => {
                        const lineSubtotal = it.qtyOrdered * it.unitCost;
                        return (
                          <tr
                            key={it.tempId}
                            className="border-b border-border/40 last:border-b-0"
                          >
                            <td className="py-2 px-4">
                              <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
                                {it.productName}
                              </p>
                              <p className="text-[11px] text-muted-foreground font-mono">
                                {it.productSku}
                              </p>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min={1}
                                value={it.qtyOrdered}
                                onChange={(e) =>
                                  updateItem(it.tempId, {
                                    qtyOrdered: Number(e.target.value) || 0,
                                  })
                                }
                                className="w-full rounded-md border border-border bg-card px-2 py-1 text-right text-sm focus:outline-none focus:border-primary/50"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <CurrencyInput
                                value={it.unitCost}
                                onChange={(value) =>
                                  updateItem(it.tempId, { unitCost: value })
                                }
                                className="text-right"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.1"
                                value={it.taxRate}
                                onChange={(e) =>
                                  updateItem(it.tempId, {
                                    taxRate: Number(e.target.value) || 0,
                                  })
                                }
                                className="w-full rounded-md border border-border bg-card px-2 py-1 text-right text-sm focus:outline-none focus:border-primary/50"
                              />
                            </td>
                            <td className="py-2 px-4 text-right text-sm font-semibold text-foreground whitespace-nowrap">
                              {formatCurrency(lineSubtotal)}
                            </td>
                            <td className="py-2 pr-3">
                              <button
                                type="button"
                                onClick={() => removeItem(it.tempId)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-5 space-y-3 sticky top-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Resumen
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(totals.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Impuestos</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(totals.taxAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-primary/20">
                  <span className="font-bold text-foreground">Total</span>
                  <span className="stat-number text-xl font-bold text-primary">
                    {formatCurrency(totals.total)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  loading={createPO.isPending}
                  className={cn("w-full", !canSubmit && "opacity-60")}
                >
                  Guardar borrador
                </Button>
                <Link href="/purchase-orders" className="w-full">
                  <Button type="button" variant="secondary" className="w-full">
                    Cancelar
                  </Button>
                </Link>
              </div>

              {!supplierId && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Selecciona un proveedor
                </p>
              )}
              {supplierId && items.length === 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Agrega al menos un item
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
