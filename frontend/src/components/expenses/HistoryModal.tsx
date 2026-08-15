"use client";

import { Modal } from "@/components/ui/Modal";
import { useExpenseHistory } from "@/hooks/useExpenses";
import { formatDateTime } from "@/lib/utils";
import { History } from "lucide-react";
import type { Expense } from "@/types";

interface Props {
  expense: Expense;
  isOpen: boolean;
  onClose: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  EXPENSE_CREATED: "Gasto creado",
  EXPENSE_UPDATED: "Gasto actualizado",
  EXPENSE_PAYMENT_ADDED: "Pago agregado",
  EXPENSE_DUPLICATED: "Gasto duplicado",
  EXPENSE_RECEIPT_UPLOADED: "Comprobante subido",
  EXPENSE_DELETED: "Gasto eliminado",
};

export function HistoryModal({ expense, isOpen, onClose }: Props) {
  const { data: entries = [], isLoading } = useExpenseHistory(expense.id);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Historial del gasto"
      size="md"
    >
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-xs text-muted-foreground">Cargando historial...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <History className="w-6 h-6 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">
            Sin movimientos registrados
          </p>
        </div>
      ) : (
        <ol className="space-y-4">
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
    </Modal>
  );
}
