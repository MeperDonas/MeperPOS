"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDailySales, useDashboard } from "@/hooks/useReports";
import { useCategories } from "@/hooks/useCategories";
import { Package, LayoutDashboard, CheckCircle2, AlertTriangle, Users } from "lucide-react";
import { getBogotaDateInputValue, shiftDateInputValue } from "@/lib/utils";
import { chartHeight } from "@/lib/dashboard";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingState } from "@/components/ui/LoadingState";
import { TodayStats } from "@/components/dashboard/TodayStats";
import { AlertPanels } from "@/components/dashboard/AlertPanels";
import { QuickActions } from "@/components/dashboard/QuickActions";
import {
  RevenueChart,
  type RevenueBarPoint,
} from "@/components/dashboard/RevenueChart";

function capitalizeLabel(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: dashboard, isLoading } = useDashboard();
  const { data: categoriesResponse } = useCategories({ page: 1, limit: 1 });
  const { user } = useAuth();
  const [now] = useState(() => new Date());

  const chartEndDate = useMemo(() => getBogotaDateInputValue(now), [now]);
  const chartStartDate = useMemo(
    () => shiftDateInputValue(chartEndDate, -6),
    [chartEndDate],
  );

  const { data: dailySales } = useDailySales(chartStartDate, chartEndDate);

  const stats = {
    totalSales: dashboard?.totalSales ?? 0,
    totalProducts: dashboard?.totalProducts ?? 0,
    totalCustomers: dashboard?.totalCustomers ?? 0,
    lowStockProducts: dashboard?.lowStockProducts ?? 0,
    trends: dashboard?.trends ?? {
      totalSales: null,
      totalRevenue: null,
      totalCustomers: null,
    },
  };

  const revenueBarData = useMemo<RevenueBarPoint[]>(() => {
    const weekdayFormatter = new Intl.DateTimeFormat("es-CO", {
      weekday: "long",
      timeZone: "America/Bogota",
    });
    const dayFormatter = new Intl.DateTimeFormat("es-CO", {
      day: "numeric",
      timeZone: "America/Bogota",
    });
    const monthFormatter = new Intl.DateTimeFormat("es-CO", {
      month: "short",
      timeZone: "America/Bogota",
    });

    const dailyMap = new Map(
      (dailySales?.data ?? []).map((item) => [
        item.date,
        { total: item.total, count: item.count },
      ]),
    );

    const dateRange = Array.from({ length: 7 }, (_, index) =>
      shiftDateInputValue(chartStartDate, index),
    );

    const maxValue = Math.max(
      ...dateRange.map((dateKey) => dailyMap.get(dateKey)?.total ?? 0),
      1,
    );

    return dateRange.map((dateKey) => {
      const daily = dailyMap.get(dateKey) ?? { total: 0, count: 0 };
      const [year, month, day] = dateKey.split("-").map(Number);
      const safeDate = new Date(
        Date.UTC(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0),
      );
      const weekdayLabel = capitalizeLabel(
        weekdayFormatter.format(safeDate).replace(".", ""),
      );
      const monthLabel = monthFormatter
        .format(safeDate)
        .replace(".", "")
        .toUpperCase();
      const dayNumber = dayFormatter.format(safeDate);

      return {
        key: dateKey,
        total: daily.total,
        count: daily.count,
        isToday: dateKey === chartEndDate,
        detailDate: `${weekdayLabel} ${dayNumber}`,
        dayAbbreviation: weekdayLabel.slice(0, 3),
        monthLabel,
        height: chartHeight(daily.total, maxValue),
      };
    });
  }, [chartEndDate, chartStartDate, dailySales?.data]);

  const totalCategories = categoriesResponse?.meta.total ?? 0;

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingState icon={<LayoutDashboard className="w-5 h-5 text-primary/50" />} message="Cargando dashboard..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-3 overflow-x-hidden lg:space-y-4">
        {/* Page Header */}
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-3">
            <div className="w-1 h-7 rounded-full bg-primary shrink-0" />
            <h1 className="text-2xl lg:text-4xl font-bold text-foreground">
              Bienvenido, {user?.name?.split(" ")[0]}
            </h1>
          </div>
        </div>

        {/*
          Today KPIs (Ventas hoy / Ticket promedio / Transacciones) —
          source of truth is useDailySales(today, today), never the full-range
          aggregate from useDashboard().totalRevenue (DIA-1..3, DIA-5).
        */}
        <TodayStats />

        {/* Revenue chart — data-driven, no fake curve (DIA-11..13) */}
        <div className="min-w-0 overflow-hidden rounded-3xl border border-primary/30 bg-primary/10 px-6 py-6 text-foreground">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Ingresos últimos 7 días
          </p>
          <div className="mt-6">
            <RevenueChart data={revenueBarData} />
          </div>
        </div>

        {/* Secondary summary cards */}
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-6 xl:grid-cols-12 stagger-children">
          {/* Ventas Completadas */}
          <div className="min-w-0 rounded-3xl border border-accent/30 bg-accent/10 px-6 py-5 text-foreground md:col-span-3 xl:col-span-3">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-accent/20 rounded-xl">
                <CheckCircle2 className="h-5 w-5 text-accent" />
              </div>
              <span className="text-[10px] font-bold bg-accent/20 text-accent px-2 py-1 rounded-md uppercase tracking-wider">
                Completado
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Ventas Completadas
            </p>
            <p className="text-3xl font-bold mt-1">
              {stats.totalSales.toLocaleString("es-CO")}
            </p>
          </div>

          {/* Productos en Catálogo */}
          <div className="min-w-0 rounded-3xl border border-primary/30 bg-primary/10 px-6 py-5 text-foreground md:col-span-3 xl:col-span-3">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-primary/20 rounded-xl">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <span className="text-[10px] font-bold bg-primary/20 text-primary px-2 py-1 rounded-md uppercase tracking-wider">
                Activo
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Productos en Catálogo
            </p>
            <p className="text-3xl font-bold mt-1">
              {stats.totalProducts.toLocaleString("es-CO")}
            </p>
            <div className="mt-4 bg-primary/5 p-2 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">
                Promedio:{" "}
                <span className="font-bold text-primary">
                  {Math.round(
                    stats.totalProducts / Math.max(totalCategories, 1),
                  )}
                </span>{" "}
                productos/cat
              </p>
            </div>
          </div>

          {/* Stock Crítico */}
          <div className="min-w-0 rounded-3xl border border-rose-500/30 bg-rose-500/10 px-6 py-5 text-foreground md:col-span-3 xl:col-span-3">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-rose-500/20 rounded-xl">
                <AlertTriangle className="h-5 w-5 text-rose-500" />
              </div>
              <span className="text-[10px] font-bold bg-rose-500/20 text-rose-500 px-2 py-1 rounded-md uppercase tracking-wider">
                Alerta
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Stock Crítico
            </p>
            <p className="text-3xl font-bold mt-1 text-rose-500">
              {stats.lowStockProducts}
            </p>
            {stats.lowStockProducts > 0 ? (
              <div className="mt-4 bg-rose-500/5 p-1 rounded-lg text-center">
                <button
                  type="button"
                  onClick={() => router.push("/inventory?filter=lowStock")}
                  className="text-[12px] font-bold text-rose-500 hover:text-rose-400"
                >
                  REORDENAR
                </button>
              </div>
            ) : (
              <div className="mt-4 bg-rose-500/5 p-3 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Stock OK</p>
              </div>
            )}
          </div>

          {/* Clientes Totales */}
          <div className="min-w-0 rounded-3xl border border-accent/30 bg-accent/10 px-6 py-5 text-foreground md:col-span-3 xl:col-span-3">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-accent/20 rounded-xl">
                <Users className="h-5 w-5 text-accent" />
              </div>
              <span className="text-[10px] font-bold bg-accent/20 text-accent px-2 py-1 rounded-md uppercase tracking-wider">
                Registrados
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Clientes Totales
            </p>
            <p className="text-3xl font-bold mt-1">
              {stats.totalCustomers.toLocaleString("es-CO")}
            </p>
            <div className="mt-4 bg-accent/5 p-1 rounded-lg text-center">
              <span className="text-xs text-muted-foreground">
                <span className="text-accent font-bold">
                  {(stats.trends.totalCustomers ?? 0) >= 0
                    ? `+${stats.trends.totalCustomers}`
                    : stats.trends.totalCustomers}
                  %
                </span>{" "}
                vs mes anterior
              </span>
            </div>
          </div>
        </div>

        {/* Quick actions by role (DIA-9) */}
        <QuickActions />

        {/* Operational alert panels (DIA-6..8) — replaces the reports-duplicating table */}
        <AlertPanels />
      </div>
    </DashboardLayout>
  );
}
