"use client";

import { useMemo } from "react";
import { useDashboard, useDailySales } from "@/hooks/useReports";
import { useExpenses } from "@/hooks/useExpenses";
import { formatCurrency, getBogotaDateInputValue } from "@/lib/utils";
import { computeTodayMetrics, sumExpensesOnDate } from "@/lib/dashboard";
import { MetricCard } from "@/components/ui/MetricCard";

export function TodayStats() {
  return <TodayStatsInner today={getBogotaDateInputValue()} />;
}

export function TodayStatsInner({ today }: { today: string }) {
  const { data: todaySales } = useDailySales(today, today);
  const { data: dashboard } = useDashboard();
  const todayMonth = useMemo(() => today.slice(0, 7), [today]);
  const { data: expensesResponse } = useExpenses({ month: todayMonth, limit: 100 });

  const rec =
    todaySales?.data?.find((entry) => entry.date === today) ?? { total: 0, count: 0 };
  const metric = computeTodayMetrics(rec);
  const expensesToday = sumExpensesOnDate(expensesResponse?.data, today);

  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-7">
      <MetricCard
        label="Ventas hoy"
        value={formatCurrency(metric.sales)}
        helper="del día"
        tone="primary"
      />
      <MetricCard
        label="Salidas hoy"
        value={formatCurrency(expensesToday)}
        helper="gastos"
        tone="rose"
      />
      <MetricCard
        label="Transacciones"
        value={String(metric.transactions)}
        helper="hoy"
        tone="accent"
      />
      <MetricCard
        label="Ventas completadas"
        value={(dashboard?.totalSales ?? 0).toLocaleString("es-CO")}
        helper="total"
        tone="primary"
      />
      <MetricCard
        label="Productos totales"
        value={(dashboard?.totalProducts ?? 0).toLocaleString("es-CO")}
        helper="catálogo"
        tone="accent"
      />
      <MetricCard
        label="Clientes totales"
        value={(dashboard?.totalCustomers ?? 0).toLocaleString("es-CO")}
        helper="registrados"
        tone="primary"
      />
      <MetricCard
        label="Stock crítico"
        value={String(dashboard?.lowStockProducts ?? 0)}
        helper="por reordenar"
        tone="rose"
      />
    </div>
  );
}
