"use client";

import { useDailySales } from "@/hooks/useReports";
import { formatCurrency, getBogotaDateInputValue } from "@/lib/utils";
import { computeTodayMetrics } from "@/lib/dashboard";
import { MetricCard } from "@/components/ui/MetricCard";

export function TodayStats() {
  return <TodayStatsInner today={getBogotaDateInputValue()} />;
}

export function TodayStatsInner({ today }: { today: string }) {
  const { data: todaySales } = useDailySales(today, today);
  const rec =
    todaySales?.data?.find((entry) => entry.date === today) ?? { total: 0, count: 0 };
  const metric = computeTodayMetrics(rec);

  return (
    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
      <MetricCard
        label="Ventas hoy"
        value={formatCurrency(metric.sales)}
        helper="del día"
        tone="primary"
      />
      <MetricCard
        label="Ticket promedio"
        value={formatCurrency(metric.ticket)}
        helper="por transacción"
        tone="accent"
      />
      <MetricCard
        label="Transacciones"
        value={String(metric.transactions)}
        helper="hoy"
        tone="rose"
      />
    </div>
  );
}
