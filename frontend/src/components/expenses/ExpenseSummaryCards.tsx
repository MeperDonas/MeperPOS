import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";
import { Wallet } from "lucide-react";
import type { ExpenseMonthlySummary } from "@/types";

interface Props {
  month?: string;
  summary?: ExpenseMonthlySummary;
}

export function ExpenseSummaryCards({ month, summary }: Props) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="p-5 border-primary/25 bg-primary/5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Total del mes
          </p>
          <Wallet className="w-4 h-4 text-primary" />
        </div>
        <p className="mt-2 text-2xl font-bold text-foreground stat-number">
          {formatCurrency(Number(summary?.total ?? 0))}
        </p>
        {month && (
          <p className="mt-1 text-xs text-muted-foreground font-mono">
            {month}
          </p>
        )}
      </Card>

      {(summary?.categories ?? []).map((category) => (
        <Card key={category.categoryId} className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
            {category.name}
          </p>
          <p className="mt-2 text-2xl font-bold text-foreground stat-number">
            {formatCurrency(Number(category.total ?? 0))}
          </p>
        </Card>
      ))}
    </section>
  );
}
