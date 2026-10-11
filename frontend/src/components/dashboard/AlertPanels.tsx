"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, ListTodo, Receipt, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useExpenses } from "@/hooks/useExpenses";
import { useTasks } from "@/hooks/useTasks";
import { computePendingAmount, filterOpenTasks } from "@/lib/dashboard";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Expense } from "@/types";

/** Compact cap: the panels are a peek, not a list page. */
const VISIBLE_CAP = 2;

function PanelHeader({
  icon,
  title,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  tone: "accent" | "primary";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${tone === "accent" ? "bg-accent/20" : "bg-primary/20"}`}>
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

/**
 * Two compact operational panels side by side. Low-stock now lives on the
 * "Stock crítico" KPI card in `TodayStats` (it owns the Reordenar action), so
 * it is intentionally not duplicated here.
 */
export function AlertPanels() {
  const router = useRouter();
  const { data: expensesResponse } = useExpenses({ status: "PARTIAL" });
  const { data: tasksResponse } = useTasks();

  const partialExpenses = (expensesResponse?.data ?? []) as ExpenseLike[];
  const openTasks = filterOpenTasks(tasksResponse?.tasks ?? [], VISIBLE_CAP);

  const totalPending = partialExpenses.reduce(
    (sum, expense) => sum + computePendingAmount(expense),
    0,
  );

  const visibleExpenses = partialExpenses.slice(0, VISIBLE_CAP);

  return (
    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
      {/* Partial expenses panel */}
      <div className="min-w-0 rounded-3xl border border-primary/25 bg-card px-5 py-4 text-foreground hover:border-primary/40 transition-colors">
        <PanelHeader
          icon={<Receipt className="h-5 w-5 text-primary" />}
          title="Gastos por pagar"
          tone="primary"
        />
        <div className="mt-3">
          {partialExpenses.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin gastos pendientes</p>
          ) : (
            <>
              <ul className="space-y-1.5">
                {visibleExpenses.map((expense) => (
                  <li
                    key={expense.id}
                    className="flex items-center justify-between rounded-xl bg-muted px-3 py-1.5"
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
              <div className="mt-3 flex items-center justify-between rounded-xl bg-muted px-3 py-1.5">
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
            className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-primary hover:text-primary/80"
          >
            Ver gastos
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Open tasks panel */}
      <div className="min-w-0 rounded-3xl border border-accent/25 bg-card px-5 py-4 text-foreground hover:border-accent/40 transition-colors">
        <PanelHeader
          icon={<ListTodo className="h-5 w-5 text-accent" />}
          title="Tareas abiertas"
          tone="accent"
        />
        <div className="mt-3">
          {openTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin tareas abiertas</p>
          ) : (
            <ul className="space-y-1.5">
              {openTasks.map((task) => {
                const Icon = task.status === "IN_PROGRESS" ? ShoppingBag : ListTodo;
                return (
                  <li
                    key={task.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-muted px-3 py-1.5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                      <span className="truncate text-sm font-medium text-foreground">
                        {task.title}
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant={task.status === "IN_PROGRESS" ? "primary" : "warning"}>
                        {task.status === "IN_PROGRESS" ? "En progreso" : "Pendiente"}
                      </Badge>
                      {task.dueDate && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                    </div>
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
