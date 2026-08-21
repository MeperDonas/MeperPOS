import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";
import { Wallet, TrendingDown } from "lucide-react";
import type { ExpenseMonthlySummary } from "@/types";

interface Props {
  month?: string;
  summary?: ExpenseMonthlySummary;
}

export function ExpenseSummaryCards({ month, summary }: Props) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Total Card */}
      <div className="rounded-3xl border border-primary/40 bg-primary-light p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
            Total del Mes
          </p>
          <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center shadow-xs">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <p className="mt-3 text-2xl lg:text-3xl font-extrabold font-mono text-foreground tracking-tight">
          {formatCurrency(Number(summary?.total ?? 0))}
        </p>
        {month && (
          <p className="mt-1 text-[11px] text-muted-foreground font-mono">
            Período: {month}
          </p>
        )}
      </div>

      {(summary?.categories ?? []).slice(0, 2).map((category) => (
        <div
          key={category.categoryId}
          className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
              {category.name}
            </p>
            <div className="w-8 h-8 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-primary" />
            </div>
          </div>
          <p className="mt-3 text-2xl lg:text-3xl font-extrabold font-mono text-foreground tracking-tight">
            {formatCurrency(Number(category.total ?? 0))}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground font-mono">
            Gasto acumulado
          </p>
        </div>
      ))}
    </section>
  );
}
