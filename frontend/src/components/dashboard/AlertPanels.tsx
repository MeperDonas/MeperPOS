"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, ListTodo, Receipt, ShoppingBag } from "lucide-react";
import { useLowStockProducts } from "@/hooks/useProducts";
import { useExpenses } from "@/hooks/useExpenses";
import { useTasks } from "@/hooks/useTasks";
import { computePendingAmount, filterOpenTasks } from "@/lib/dashboard";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Product, Expense } from "@/types";

const VISIBLE_CAP = 4;

function PanelHeader({
  icon,
  title,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  tone: "rose" | "accent" | "primary";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${tone === "rose" ? "bg-rose-500/20" : tone === "accent" ? "bg-accent/20" : "bg-primary/20"}`}>
          {icon}
        </div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      </div>
    </div>
  );
}

type ExpenseLike = Pick<Expense, "id" | "description" | "total" | "status"> & {
  payments?: Array<{ amount: number }>;
};

export function AlertPanels() {
  const router = useRouter();
  const { data: lowStock } = useLowStockProducts();
  const { data: expensesResponse } = useExpenses({ status: "PARTIAL" });
  const { data: tasksResponse } = useTasks();

  const lowStockProducts = (lowStock ?? []) as Product[];
  const partialExpenses = (expensesResponse?.data ?? []) as ExpenseLike[];
  const openTasks = filterOpenTasks(tasksResponse?.tasks ?? [], VISIBLE_CAP);

  const totalPending = partialExpenses.reduce(
    (sum, expense) => sum + computePendingAmount(expense),
    0,
  );

  const visibleLowStock = lowStockProducts.slice(0, VISIBLE_CAP);
  const visibleExpenses = partialExpenses.slice(0, VISIBLE_CAP);

  return (
    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
      {/* Low stock panel */}
      <div className="min-w-0 rounded-3xl border border-rose-500/25 bg-card px-6 py-5 text-foreground hover:border-rose-500/40 transition-colors">
        <PanelHeader
          icon={<AlertTriangle className="h-5 w-5 text-rose-500" />}
          title="Stock bajo"
          tone="rose"
        />
        <div className="mt-4">
          {lowStockProducts.length === 0 ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-rose-500" />
              <span>Stock OK</span>
            </div>
          ) : (
            <ul className="space-y-2">
              {visibleLowStock.map((product) => (
                <li
                  key={product.id}
                  className="flex items-center justify-between rounded-xl bg-muted px-3 py-2"
                >
                  <span className="truncate text-sm font-medium text-foreground">
                    {product.name}
                  </span>
                  <span className="shrink-0 font-mono text-xs font-bold text-rose-500">
                    {product.stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {lowStockProducts.length > VISIBLE_CAP && (
          <button
            type="button"
            onClick={() => router.push("/inventory?filter=lowStock")}
            className="mt-3 text-[12px] font-bold text-foreground/70 hover:text-primary"
          >
            Ver {lowStockProducts.length - VISIBLE_CAP} más
          </button>
        )}
        {lowStockProducts.length > 0 && (
          <button
            type="button"
            onClick={() => router.push("/inventory?filter=lowStock")}
            className="mt-4 inline-flex items-center gap-1 text-[12px] font-bold text-rose-500 hover:text-rose-400"
          >
            REORDENAR
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Partial expenses panel */}
      <div className="min-w-0 rounded-3xl border border-primary/25 bg-card px-6 py-5 text-foreground hover:border-primary/40 transition-colors">
        <PanelHeader
          icon={<Receipt className="h-5 w-5 text-primary" />}
          title="Gastos por pagar"
          tone="primary"
        />
        <div className="mt-4">
          {partialExpenses.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin gastos pendientes</p>
          ) : (
            <>
              <ul className="space-y-2">
                {visibleExpenses.map((expense) => (
                  <li
                    key={expense.id}
                    className="flex items-center justify-between rounded-xl bg-muted px-3 py-2"
                  >
                    <span className="truncate text-sm font-medium text-foreground">
                      {expense.description || "Gasto"}
                    </span>
                    <span className="shrink-0 font-mono text-xs font-bold text-primary">
                      {formatCurrency(computePendingAmount(expense))}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-muted px-3 py-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Total pendiente
                </span>
                <span className="font-mono text-sm font-extrabold text-primary">
                  {formatCurrency(totalPending)}
                </span>
              </div>
            </>
          )}
        </div>
        {partialExpenses.length > VISIBLE_CAP && (
          <button
            type="button"
            onClick={() => router.push("/expenses")}
            className="mt-3 text-[12px] font-bold text-foreground/70 hover:text-primary"
          >
            Ver {partialExpenses.length - VISIBLE_CAP} más
          </button>
        )}
        {partialExpenses.length > 0 && (
          <button
            type="button"
            onClick={() => router.push("/expenses")}
            className="mt-4 inline-flex items-center gap-1 text-[12px] font-bold text-primary hover:text-primary/80"
          >
            Ver gastos
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Open tasks panel */}
      <div className="min-w-0 rounded-3xl border border-accent/25 bg-card px-6 py-5 text-foreground hover:border-accent/40 transition-colors">
        <PanelHeader
          icon={<ListTodo className="h-5 w-5 text-accent" />}
          title="Tareas abiertas"
          tone="accent"
        />
        <div className="mt-4">
          {openTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin tareas abiertas</p>
          ) : (
            <ul className="space-y-2">
              {openTasks.map((task) => {
                const Icon = task.status === "IN_PROGRESS" ? ShoppingBag : ListTodo;
                return (
                  <li
                    key={task.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                      <span className="truncate text-sm font-medium text-foreground">
                        {task.title}
                      </span>
                    </div>
                    {task.dueDate && (
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {formatDate(task.dueDate)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
