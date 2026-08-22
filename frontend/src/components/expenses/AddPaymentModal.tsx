"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { BentoSelect } from "@/components/ui/BentoSelect";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { useAddExpensePayment } from "@/hooks/useExpenses";
import { useToast } from "@/contexts/ToastContext";
import { getApiErrorMessage } from "@/lib/api";
import { formatCurrency, getBogotaDateInputValue } from "@/lib/utils";
import type { Expense, ExpensePayment } from "@/types";

interface Props {
  expense: Expense;
  isOpen: boolean;
  onClose: () => void;
}

const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Efectivo" },
  { value: "CARD", label: "Tarjeta" },
  { value: "TRANSFER", label: "Transferencia" },
];

export function AddPaymentModal({ expense, isOpen, onClose }: Props) {
  const toast = useToast();
  const addPayment = useAddExpensePayment();

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<ExpensePayment["method"]>("CASH");
  const [date, setDate] = useState(getBogotaDateInputValue());

  const paidSum = (expense.payments ?? []).reduce(
    (acc, p) => acc + (Number(p.amount) || 0),
    0,
  );
  const remaining = Number(expense.total) - paidSum;

  const numericAmount = Number(amount) || 0;
  const error =
    numericAmount <= 0
      ? "Ingresa un valor válido"
      : numericAmount > remaining
        ? "El pago supera el saldo pendiente"
        : null;

  const handleSubmit = async () => {
    if (error) return;
    try {
      await addPayment.mutateAsync({
        id: expense.id,
        data: { amount: numericAmount, method, date },
      });
      toast.success("Pago registrado");
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "No se pudo registrar el pago"));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Agregar pago"
      size="sm"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">
            Saldo pendiente
          </span>
          <span className="text-sm font-bold text-foreground stat-number">
            {formatCurrency(remaining)}
          </span>
        </div>

        <div>
          <CurrencyInput
            label="Valor"
            placeholder="Valor del pago"
            value={amount}
            onChange={(value) => setAmount(value === 0 ? "" : String(value))}
          />
        </div>

        <BentoSelect
          label="Método de pago"
          value={method}
          onChange={(value) =>
            setMethod(value as ExpensePayment["method"])
          }
          options={PAYMENT_METHOD_OPTIONS}
        />

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fecha
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
          />
        </div>

        {error && (
          <p className="text-xs font-medium text-red-500">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!!error}
            loading={addPayment.isPending}
          >
            Registrar pago
          </Button>
        </div>
      </div>
    </Modal>
  );
}
