"use client";

import Image from "next/image";
import { Modal } from "@/components/ui/Modal";
import { ExpenseStatusBadge } from "@/components/expenses/ExpenseStatusBadge";
import { useExpenseHistory } from "@/hooks/useExpenses";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { History, Wallet } from "lucide-react";
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
    <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function ExpenseDetailModal({ expense, isOpen, onClose }: Props) {
  const { data: entries = [], isLoading } = useExpenseHistory(expense.id);

  const payments = expense.payments ?? [];
  const paidSum = payments.reduce(
    (acc, payment) => acc + (Number(payment.amount) || 0),
    0,
  );
  const remaining = Math.max(Number(expense.total) - paidSum, 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalle del gasto" size="lg">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Total
            </p>
            <p className="stat-number text-2xl font-bold text-foreground">
              {formatCurrency(Number(expense.total))}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDate(expense.date)}
            </p>
          </div>
          <ExpenseStatusBadge status={expense.status} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InfoItem
            label="Categoría"
            value={expense.category?.name ?? "—"}
          />
          <InfoItem label="Proveedor" value={expense.supplier?.name ?? "—"} />
          <InfoItem
            label="Orden de compra"
            value={
              expense.purchaseOrder
                ? `OC-${expense.purchaseOrder.orderNumber}`
                : "—"
            }
          />
          <InfoItem label="Descripción" value={expense.description ?? "—"} />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Comprobante
          </p>
          {expense.receiptUrl ? (
            <div className="relative h-64 max-w-md rounded-lg border border-border/60 bg-muted/20 overflow-hidden">
              <Image
                src={expense.receiptUrl}
                alt="Comprobante del gasto"
                fill
                sizes="(max-width: 768px) 100vw, 448px"
                unoptimized
                className="object-contain"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin comprobante</p>
          )}
        </div>

        <div className="rounded-xl border border-border/60 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60 bg-muted/30">
            <Wallet className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Pagos</span>
          </div>
          <div className="p-4">
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin pagos registrados
              </p>
            ) : (
              <ul className="space-y-2">
                {payments.map((payment) => (
                  <li
                    key={payment.id}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-2",
                      "rounded-lg border border-border/60 bg-muted/20 px-4 py-3",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="stat-number text-sm font-bold text-foreground">
                        {formatCurrency(Number(payment.amount))}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}{" "}
                        · {formatDate(payment.date)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
              <span className="text-xs font-semibold text-muted-foreground">
                Saldo pendiente
              </span>
              <span className="stat-number text-sm font-bold text-foreground">
                {formatCurrency(remaining)}
              </span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <History className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">
              Historial
            </span>
          </div>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="text-xs text-muted-foreground">
                Cargando historial...
              </p>
            </div>
          ) : entries.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sin movimientos registrados
            </p>
          ) : (
            <ol className="space-y-3">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {entry.user?.name ?? "—"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Modal>
  );
}
