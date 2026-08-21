"use client";

import Image from "next/image";
import { Modal } from "@/components/ui/Modal";
import { ExpenseStatusBadge } from "@/components/expenses/ExpenseStatusBadge";
import { useExpenseHistory } from "@/hooks/useExpenses";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { History, Wallet, FileText, Image as ImageIcon } from "lucide-react";
import type { Expense, ExpensePayment } from "@/types";

interface Props {
  expense: Expense;
  isOpen: boolean;
  onClose: () => void;
}

const PAYMENT_METHOD_LABELS: Record<ExpensePayment["method"], string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
};

const ACTION_LABELS: Record<string, string> = {
  EXPENSE_CREATED: "Gasto creado",
  EXPENSE_UPDATED: "Gasto actualizado",
  EXPENSE_PAYMENT_ADDED: "Pago agregado",
  EXPENSE_DUPLICATED: "Gasto duplicado",
  EXPENSE_RECEIPT_UPLOADED: "Comprobante subido",
  EXPENSE_DELETED: "Gasto eliminado",
};

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 px-3.5 py-2.5">
      <p className="text-[10px] font-mono font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-xs font-bold text-foreground truncate">{value}</p>
    </div>
  );
}

export function ExpenseDetailModal({ expense, isOpen, onClose }: Props) {
  const { data: entries = [], isLoading } = useExpenseHistory(expense.id);

  const payments = expense.payments ?? [];
  const paidSum = payments.reduce(
    (acc, payment) => acc + (Number(payment.amount) || 0),
    0
  );
  const remaining = Math.max(Number(expense.total) - paidSum, 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalle del Gasto" size="xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left Column: Info, Amounts and Payments */}
        <div className="space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header / Summary Card */}
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono font-semibold uppercase tracking-wide text-muted-foreground">
                  Total Registrado
                </p>
                <p className="font-mono text-2xl font-extrabold text-foreground tracking-tight">
                  {formatCurrency(Number(expense.total))}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground font-mono">
                  Fecha: {formatDate(expense.date)}
                </p>
              </div>
              <ExpenseStatusBadge status={expense.status} />
            </div>

            {/* Grid Details */}
            <div className="grid grid-cols-2 gap-2.5">
              <InfoItem label="Categoría" value={expense.category?.name ?? "—"} />
              <InfoItem label="Proveedor" value={expense.supplier?.name ?? "—"} />
              <InfoItem
                label="Orden de Compra"
                value={
                  expense.purchaseOrder
                    ? `OC-${expense.purchaseOrder.orderNumber}`
                    : "—"
                }
              />
              <InfoItem label="Descripción" value={expense.description ?? "—"} />
            </div>

            {/* Payments List */}
            <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">
                  Abonos y Pagos ({payments.length})
                </span>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  Pagado: {formatCurrency(paidSum)}
                </span>
              </div>

              {payments.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-1">
                  No hay pagos registrados.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-muted/40 text-xs font-mono"
                    >
                      <span className="font-semibold text-foreground">
                        {PAYMENT_METHOD_LABELS[p.method] || p.method}
                      </span>
                      <span className="font-bold text-primary">
                        {formatCurrency(Number(p.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {remaining > 0 && (
                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground font-medium">Pendiente:</span>
                  <span className="font-bold text-danger">
                    {formatCurrency(remaining)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Receipt / Invoice Preview (Zero scroll) */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 flex flex-col shadow-xs">
          <div className="flex items-center gap-2 pb-2.5 border-b border-border/60 mb-3">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-foreground">
              Comprobante / Factura Adjunta
            </span>
          </div>

          <div className="flex-1 min-h-[260px] rounded-xl border border-border/60 bg-muted/20 relative overflow-hidden flex items-center justify-center">
            {expense.receiptUrl ? (
              <Image
                src={expense.receiptUrl}
                alt="Comprobante del gasto"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                unoptimized
                className="object-contain p-2"
              />
            ) : (
              <div className="text-center p-4">
                <ImageIcon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  Sin factura o comprobante adjunto
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
