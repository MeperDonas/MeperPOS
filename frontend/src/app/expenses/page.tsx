"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useSuppliers } from "@/hooks/useSuppliers";
import {
  useDeleteExpense,
  useDuplicateExpense,
  useExpenseCategories,
  useExpenses,
  useExpenseSummary,
  useUploadExpenseReceipt,
} from "@/hooks/useExpenses";
import { useToast } from "@/contexts/ToastContext";
import { api, getApiErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate, getBogotaDateInputValue } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { FilterBar } from "@/components/ui/FilterBar";
import { Table, TableHeader, TableRow, TableCell } from "@/components/ui/Table";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ExpenseStatusBadge } from "@/components/expenses/ExpenseStatusBadge";
import { ExpenseSummaryCards } from "@/components/expenses/ExpenseSummaryCards";
import { ExpenseFormModal } from "@/components/expenses/ExpenseFormModal";
import { AddPaymentModal } from "@/components/expenses/AddPaymentModal";
import { HistoryModal } from "@/components/expenses/HistoryModal";
import { ExpenseDetailModal } from "@/components/expenses/ExpenseDetailModal";
import {
  Copy,
  Eye,
  History,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Wallet,
  Download,
} from "lucide-react";
import { chipStyles } from "@/lib/chipStyles";
import type { Expense, ExpenseStatus } from "@/types";

const STATUS_OPTIONS: Array<{ value: "" | ExpenseStatus; label: string }> = [
  { value: "", label: "Todos los estados" },
  { value: "PARTIAL", label: "Parcial" },
  { value: "PAID", label: "Pagado" },
];

export default function ExpensesPage() {
  const toast = useToast();
  const [month, setMonth] = useState(() =>
    getBogotaDateInputValue().slice(0, 7),
  );
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState<"" | ExpenseStatus>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exportFormat, setExportFormat] = useState<"excel" | "csv">("excel");

  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [paymentExpense, setPaymentExpense] = useState<Expense | null>(null);
  const [historyExpense, setHistoryExpense] = useState<Expense | null>(null);
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<Expense | null>(null);

  const { data: summary } = useExpenseSummary(month);
  const { data: categoriesData } = useExpenseCategories();
  const { data: suppliersData } = useSuppliers({ limit: 200, status: "active" });
  const { data, isLoading } = useExpenses({
    page,
    limit: 15,
    month,
    categoryId: categoryId || undefined,
    supplierId: supplierId || undefined,
    status: status || undefined,
    search: search.trim() || undefined,
  });

  const deleteExpense = useDeleteExpense();
  const duplicateExpense = useDuplicateExpense();
  const uploadReceipt = useUploadExpenseReceipt();

  const expenses = data?.data ?? [];
  const meta = data?.meta;
  const categories = categoriesData ?? [];
  const suppliers = suppliersData?.data ?? [];

  const hasFilters = !!categoryId || !!supplierId || !!status || !!search;

  const clearFilters = () => {
    setPage(1);
    setCategoryId("");
    setSupplierId("");
    setStatus("");
    setSearch("");
  };

  const exportRange = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    if (!year || !monthNumber) {
      return {};
    }
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    return {
      startDate: `${month}-01`,
      endDate: `${month}-${String(lastDay).padStart(2, "0")}`,
    };
  }, [month]);

  const handleExport = async () => {
    try {
      await api.exportData("/exports/expenses", {
        format: exportFormat,
        type: "expenses",
        ...exportRange,
      });
      toast.success("Exportación generada correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Error al exportar gastos"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteExpense.mutateAsync(deleteTarget.id);
      toast.success("Gasto eliminado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar el gasto"));
    }
  };

  const handleDuplicate = async () => {
    if (!duplicateTarget) return;
    try {
      await duplicateExpense.mutateAsync(duplicateTarget.id);
      toast.success("Gasto duplicado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo duplicar el gasto"));
    }
  };

  const handleReceiptUpload = async (expense: Expense, file: File) => {
    try {
      await uploadReceipt.mutateAsync({ id: expense.id, file });
      toast.success("Comprobante subido");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo subir el comprobante"));
    }
  };

  const openCreate = () => {
    setEditingExpense(null);
    setFormOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 lg:space-y-7">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-1 h-7 rounded-full bg-primary shrink-0" />
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                Salidas
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
              Registra los gastos y pagos de tu negocio
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              aria-label="Formato de exportación"
              value={exportFormat}
              onChange={(e) =>
                setExportFormat(e.target.value as "excel" | "csv")
              }
              className="h-8 px-2.5 rounded-lg text-xs font-semibold bg-muted/40 border border-border/60 text-foreground focus:outline-none focus:border-primary/50"
            >
              <option value="excel">Excel</option>
              <option value="csv">CSV</option>
            </select>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={handleExport}
              className="shrink-0"
            >
              <Download className="w-3.5 h-3.5" /> Exportar
            </Button>
            <Button type="button" onClick={openCreate} className="shrink-0">
              <Plus className="w-4 h-4" /> Nuevo gasto
            </Button>
          </div>
        </div>

        <ExpenseSummaryCards month={month} summary={summary} />

        <FilterBar
          searchValue={search}
          onSearchChange={(value) => {
            setPage(1);
            setSearch(value);
          }}
          searchPlaceholder="Buscar por descripción..."
          filterControls={
            <>
              <input
                type="month"
                aria-label="Mes"
                value={month}
                onChange={(e) => {
                  setPage(1);
                  setMonth(e.target.value);
                }}
                className="h-8 px-2 rounded-lg text-xs font-semibold bg-muted/40 border border-border/60 text-foreground focus:outline-none focus:border-primary/50"
              />
              <select
                value={categoryId}
                onChange={(e) => {
                  setPage(1);
                  setCategoryId(e.target.value);
                }}
                className="h-8 px-2.5 rounded-lg text-xs font-semibold bg-muted/40 border border-border/60 text-foreground focus:outline-none focus:border-primary/50 max-w-[180px]"
              >
                <option value="">Todas las categorías</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <select
                value={supplierId}
                onChange={(e) => {
                  setPage(1);
                  setSupplierId(e.target.value);
                }}
                className="h-8 px-2.5 rounded-lg text-xs font-semibold bg-muted/40 border border-border/60 text-foreground focus:outline-none focus:border-primary/50 max-w-[180px]"
              >
                <option value="">Todos los proveedores</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              <select
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value as "" | ExpenseStatus);
                }}
                className="h-8 px-2.5 rounded-lg text-xs font-semibold bg-muted/40 border border-border/60 text-foreground focus:outline-none focus:border-primary/50"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/60 transition-colors"
                >
                  Limpiar
                </button>
              )}
            </>
          }
        />

        {isLoading ? (
          <LoadingState
            icon={<Wallet className="w-4 h-4 text-primary/50" />}
            message="Cargando salidas..."
          />
        ) : (
          <>
            <div className="rounded-3xl border border-accent/30 bg-accent/10 overflow-hidden">
              <div className="overflow-x-auto">
                <Table variant="accent" className="min-w-[860px]">
                  <TableHeader>
                    <TableRow>
                      <TableCell
                        as="th"
                        className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Fecha
                      </TableCell>
                      <TableCell
                        as="th"
                        className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Categoría
                      </TableCell>
                      <TableCell
                        as="th"
                        className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Descripción
                      </TableCell>
                      <TableCell
                        as="th"
                        className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Proveedor
                      </TableCell>
                      <TableCell
                        as="th"
                        className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Estado
                      </TableCell>
                      <TableCell
                        as="th"
                        className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Total
                      </TableCell>
                      <TableCell
                        as="th"
                        className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Acciones
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <tbody>
                    {expenses.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-14">
                          <EmptyState
                            icon={
                              <Wallet className="w-6 h-6 text-muted-foreground/30" />
                            }
                            title="No hay salidas registradas"
                          />
                        </td>
                      </tr>
                    ) : (
                      expenses.map((expense) => {
                        const isPaid = expense.status === "PAID";
                        const paymentButtonLabel = isPaid
                          ? "La salida ya está pagada"
                          : "Agregar pago";

                        return (
                        <TableRow key={expense.id}>
                          <TableCell className="text-muted-foreground whitespace-nowrap font-mono">
                            {formatDate(expense.date)}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-semibold text-foreground">
                              {expense.category?.name ?? "—"}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate">
                            <span className="text-xs text-muted-foreground">
                              {expense.description ?? "—"}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate">
                            <span className="text-xs font-semibold text-foreground">
                              {expense.supplier?.name ?? "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <ExpenseStatusBadge status={expense.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="stat-number text-sm font-bold text-foreground">
                              {formatCurrency(Number(expense.total))}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                type="button"
                                aria-label="Ver detalle"
                                title="Ver detalle"
                                onClick={() => setDetailExpense(expense)}
                                className="p-1.5 h-7 w-7"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                type="button"
                                aria-label={paymentButtonLabel}
                                title={paymentButtonLabel}
                                disabled={isPaid}
                                onClick={() => setPaymentExpense(expense)}
                                className="p-1.5 h-7 w-7"
                              >
                                <Wallet className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                type="button"
                                aria-label="Ver historial"
                                title="Ver historial"
                                onClick={() => setHistoryExpense(expense)}
                                className="p-1.5 h-7 w-7"
                              >
                                <History className="w-3.5 h-3.5" />
                              </Button>
                              <label
                                className="inline-flex items-center justify-center p-1.5 h-7 w-7 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
                                title="Subir comprobante"
                              >
                                <input
                                  type="file"
                                  accept="image/*"
                                  aria-label="Subir comprobante"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleReceiptUpload(expense, file);
                                    }
                                    e.target.value = "";
                                  }}
                                />
                                <Upload className="w-3.5 h-3.5" />
                              </label>
                              <Button
                                size="sm"
                                variant="ghost"
                                type="button"
                                aria-label="Duplicar gasto"
                                title="Duplicar gasto"
                                onClick={() => setDuplicateTarget(expense)}
                                className="p-1.5 h-7 w-7"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                type="button"
                                aria-label="Editar gasto"
                                title="Editar gasto"
                                onClick={() => openEdit(expense)}
                                className="p-1.5 h-7 w-7"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                type="button"
                                aria-label="Eliminar gasto"
                                title="Eliminar gasto"
                                onClick={() => setDeleteTarget(expense)}
                                className="p-1.5 h-7 w-7 hover:text-red-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })
                    )}
                  </tbody>
                </Table>
              </div>
            </div>

            {meta && meta.totalPages > 1 && (
              <Pagination
                currentPage={page}
                totalPages={meta.totalPages}
                onPageChange={setPage}
                totalItems={meta.total}
                itemLabel="salida"
              />
            )}
          </>
        )}
      </div>

      {formOpen && (
        <ExpenseFormModal
          isOpen
          expense={editingExpense}
          onClose={() => {
            setFormOpen(false);
            setEditingExpense(null);
          }}
        />
      )}

      {paymentExpense && (
        <AddPaymentModal
          isOpen
          expense={paymentExpense}
          onClose={() => setPaymentExpense(null)}
        />
      )}

      {historyExpense && (
        <HistoryModal
          isOpen
          expense={historyExpense}
          onClose={() => setHistoryExpense(null)}
        />
      )}

      {detailExpense && (
        <ExpenseDetailModal
          isOpen
          expense={detailExpense}
          onClose={() => setDetailExpense(null)}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar gasto"
        message="El gasto se ocultará de los listados y el resumen del mes. Esta acción no se puede deshacer."
        confirmText="Sí, eliminar"
      />

      <ConfirmDialog
        isOpen={!!duplicateTarget}
        onClose={() => setDuplicateTarget(null)}
        onConfirm={handleDuplicate}
        title="Duplicar gasto"
        message="Se creará una copia del gasto con la fecha de hoy y sus pagos."
        confirmText="Sí, duplicar"
      />
    </DashboardLayout>
  );
}
