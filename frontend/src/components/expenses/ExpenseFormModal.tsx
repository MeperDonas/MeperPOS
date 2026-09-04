"use client";

import { useEffect, useId, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { BentoSelect } from "@/components/ui/BentoSelect";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { ImageUpload } from "@/components/ui/ImageUpload";
import {
  useCreateExpense,
  useExpenseGroups,
  useUpdateExpense,
  useUploadExpenseReceipt,
} from "@/hooks/useExpenses";
import { useSuppliers } from "@/hooks/useSuppliers";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { useToast } from "@/contexts/ToastContext";
import { getApiErrorMessage } from "@/lib/api";
import { formatCurrency, getBogotaDateInputValue } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import type { Expense, ExpensePayment } from "@/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  expense?: Expense | null;
}

interface PaymentRow {
  tempId: string;
  amount: string;
  method: ExpensePayment["method"];
  date: string;
}

const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Efectivo" },
  { value: "CARD", label: "Tarjeta" },
  { value: "TRANSFER", label: "Transferencia" },
];

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function newRow(): PaymentRow {
  return {
    tempId: genId(),
    amount: "",
    method: "CASH",
    date: getBogotaDateInputValue(),
  };
}

export function ExpenseFormModal({ isOpen, onClose, expense }: Props) {
  const toast = useToast();
  const uid = useId();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const uploadReceipt = useUploadExpenseReceipt();

  const { data: groupsData, isLoading: isGroupsLoading } = useExpenseGroups();
  const { data: suppliersData } = useSuppliers({ limit: 200, status: "active" });
  const { data: ordersData } = usePurchaseOrders({ limit: 200 });

  const groups = groupsData ?? [];
  const suppliers = suppliersData?.data ?? [];
  const orders = ordersData?.data ?? [];

  const [groupId, setGroupId] = useState(expense?.label?.groupId ?? "");
  const [labelId, setLabelId] = useState(expense?.labelId ?? "");
  const [supplierId, setSupplierId] = useState(expense?.supplierId ?? "");
  const [purchaseOrderId, setPurchaseOrderId] = useState(
    expense?.purchaseOrderId ?? "",
  );
  const [description, setDescription] = useState(expense?.description ?? "");
  const [date, setDate] = useState(
    expense ? expense.date.slice(0, 10) : getBogotaDateInputValue(),
  );
  const [total, setTotal] = useState(expense ? String(expense.total) : "");
  const [rows, setRows] = useState<PaymentRow[]>(() =>
    expense ? [] : [newRow()],
  );
  const [pendingReceiptFile, setPendingReceiptFile] = useState<File | null>(
    null,
  );

  useEffect(() => {
    if (!groups.length) return;

    const currentLabel = groups
      .flatMap((group) => group.labels ?? [])
      .find((label) => label.id === labelId);

    if (!groupId && currentLabel) {
      setGroupId(currentLabel.groupId);
    } else if (labelId && currentLabel && currentLabel.groupId !== groupId) {
      setLabelId("");
    }
  }, [groupId, groups, labelId]);

  const labelOptions = groupId
    ? (groups.find((group) => group.id === groupId)?.labels ?? [])
        .filter((label) => label.active)
        .map((label) => ({ value: label.id, label: label.name }))
    : [];

  const numericTotal = Number(total) || 0;
  const paymentsSum = rows.reduce(
    (acc, row) => acc + (Number(row.amount) || 0),
    0,
  );
  const hasValidPayment = rows.some((row) => (Number(row.amount) || 0) > 0);
  const existingPaymentsSum = expense
    ? (expense.payments ?? []).reduce(
        (acc, payment) => acc + (Number(payment.amount) || 0),
        0,
      )
    : 0;

  const error = !labelId
    ? "Selecciona una etiqueta de gasto"
    : !date
      ? "Selecciona una fecha"
      : numericTotal <= 0
        ? "Ingresa un total válido"
        : expense
          ? numericTotal < existingPaymentsSum
            ? "El nuevo total no puede ser menor a los pagos registrados"
            : null
          : !hasValidPayment
            ? "Agrega al menos un pago válido"
            : paymentsSum > numericTotal
              ? "El total de pagos supera el total del gasto"
              : null;

  const handleSubmit = async () => {
    if (error) return;
    try {
      if (expense) {
        await updateExpense.mutateAsync({
          id: expense.id,
          data: {
            labelId,
            supplierId: supplierId || null,
            purchaseOrderId: purchaseOrderId || null,
            description: description.trim() || null,
            date,
            total: numericTotal,
          },
        });
        toast.success("Gasto actualizado");
      } else {
        const created = await createExpense.mutateAsync({
          labelId,
          supplierId: supplierId || undefined,
          purchaseOrderId: purchaseOrderId || undefined,
          description: description.trim() || undefined,
          date,
          total: numericTotal,
          payments: rows
            .filter((row) => (Number(row.amount) || 0) > 0)
            .map((row) => ({
              amount: Number(row.amount),
              method: row.method,
              date: row.date,
            })),
        });
        if (pendingReceiptFile) {
          try {
            await uploadReceipt.mutateAsync({
              id: created.id,
              file: pendingReceiptFile,
            });
          } catch (err) {
            toast.error(
              getApiErrorMessage(
                err,
                "El gasto se creó pero no se pudo subir el comprobante",
              ),
            );
          }
        }
        toast.success("Gasto registrado");
      }
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "No se pudo guardar el gasto"));
    }
  };

  const updateRow = (tempId: string, patch: Partial<PaymentRow>) => {
    setRows((prev) =>
      prev.map((row) => (row.tempId === tempId ? { ...row, ...patch } : row)),
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={expense ? "Editar gasto" : "Nuevo gasto"}
      size="lg"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left column: expense data */}
        <div className="space-y-3">
          <BentoSelect
            label="Grupo"
            value={groupId}
            disabled={isGroupsLoading}
            onChange={(value) => {
              setGroupId(value);
              setLabelId("");
            }}
            options={[
              { value: "", label: isGroupsLoading ? "Cargando grupos..." : "Selecciona un grupo" },
              ...groups
                .filter((group) => group.active)
                .map((group) => ({ value: group.id, label: group.name })),
            ]}
          />

          <BentoSelect
            label="Etiqueta"
            value={labelId}
            disabled={isGroupsLoading || !groupId}
            onChange={(value) => {
              const belongsToGroup = labelOptions.some((label) => label.value === value);
              setLabelId(belongsToGroup ? value : "");
            }}
            options={[
              {
                value: "",
                label: isGroupsLoading
                  ? "Cargando etiquetas..."
                  : !groupId
                    ? "Selecciona un grupo primero"
                    : labelOptions.length
                      ? "Selecciona una etiqueta"
                      : "No hay etiquetas disponibles",
              },
              ...labelOptions,
            ]}
          />

          <BentoSelect
            label="Proveedor"
            value={supplierId}
            onChange={(value) => setSupplierId(value)}
            options={[
              { value: "", label: "Sin proveedor" },
              ...suppliers.map((supplier) => ({
                value: supplier.id,
                label: supplier.name,
              })),
            ]}
          />

          <BentoSelect
            label="Orden de compra"
            value={purchaseOrderId}
            onChange={(value) => setPurchaseOrderId(value)}
            options={[
              { value: "", label: "Sin orden de compra" },
              ...orders.map((order) => ({
                value: order.id,
                label: `OC-${order.orderNumber}`,
              })),
            ]}
          />

          <div>
            <label
              htmlFor={`${uid}-date`}
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Fecha
            </label>
            <input
              id={`${uid}-date`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50"
            />
          </div>

          <CurrencyInput
            id={`${uid}-total`}
            label="Total (COP)"
            placeholder="Total del gasto"
            value={total}
            onChange={(value) => setTotal(value === 0 ? "" : String(value))}
          />

          <div>
            <label
              htmlFor={`${uid}-description`}
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Descripción
            </label>
            <textarea
              id={`${uid}-description`}
              rows={3}
              placeholder="Descripción (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none"
            />
          </div>
        </div>

        {/* Right column: payments + receipt */}
        <div className="space-y-3">
          {!expense && (
            <div className="rounded-xl border border-border/60">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-muted/30">
                <span className="text-xs font-semibold text-foreground">
                  Pagos
                </span>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => setRows((prev) => [...prev, newRow()])}
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar pago
                </Button>
              </div>
              <div className="space-y-3 p-4">
                {rows.map((row) => (
                  <div key={row.tempId} className="space-y-2">
                    <CurrencyInput
                      id={`${uid}-amount-${row.tempId}`}
                      label="Valor"
                      placeholder="Valor del pago"
                      value={row.amount}
                      onChange={(value) =>
                        updateRow(row.tempId, {
                          amount: value === 0 ? "" : String(value),
                        })
                      }
                    />
                    <div className="flex items-end gap-2">
                      <BentoSelect
                        label="Método"
                        value={row.method}
                        onChange={(value) =>
                          updateRow(row.tempId, {
                            method: value as ExpensePayment["method"],
                          })
                        }
                        className="flex-1"
                        options={PAYMENT_METHOD_OPTIONS}
                      />
                      <div className="flex-1">
                        <label
                          htmlFor={`${uid}-paydate-${row.tempId}`}
                          className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          Fecha pago
                        </label>
                        <input
                          id={`${uid}-paydate-${row.tempId}`}
                          type="date"
                          aria-label="Fecha del pago"
                          value={row.date}
                          onChange={(e) =>
                            updateRow(row.tempId, { date: e.target.value })
                          }
                          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                        />
                      </div>
                      <button
                        type="button"
                        aria-label="Eliminar pago"
                        onClick={() =>
                          setRows((prev) =>
                            prev.filter((r) => r.tempId !== row.tempId),
                          )
                        }
                        disabled={rows.length === 1}
                        className="p-2 mb-0.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Total de pagos:{" "}
                  <span className="font-bold text-foreground stat-number">
                    {formatCurrency(paymentsSum)}
                  </span>
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Comprobante
            </p>
            <div className="max-w-[200px]">
              {expense ? (
                <ImageUpload
                  value={expense.receiptUrl ?? undefined}
                  onChange={() => {}}
                  onUpload={async (file) => {
                    const updated = await uploadReceipt.mutateAsync({
                      id: expense.id,
                      file,
                    });
                    return updated.receiptUrl ?? "";
                  }}
                />
              ) : (
                <ImageUpload
                  onChange={() => {}}
                  onUpload={(file) => {
                    setPendingReceiptFile(file);
                    return Promise.resolve(URL.createObjectURL(file));
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-xs font-medium text-red-500">{error}</p>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-border/60 mt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!!error}
          loading={createExpense.isPending || updateExpense.isPending}
        >
          {expense ? "Guardar cambios" : "Registrar gasto"}
        </Button>
      </div>
    </Modal>
  );
}
