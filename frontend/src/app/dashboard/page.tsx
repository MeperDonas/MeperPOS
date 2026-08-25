"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDashboard, useSalesByCategoryDaily } from "@/hooks/useReports";
import { LayoutDashboard } from "lucide-react";
import { getBogotaDateInputValue } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingState } from "@/components/ui/LoadingState";
import { TodayStats } from "@/components/dashboard/TodayStats";
import { AlertPanels } from "@/components/dashboard/AlertPanels";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { CategoryStackedChart } from "@/components/dashboard/CategoryStackedChart";

export default function DashboardPage() {
  const { isLoading } = useDashboard();
  const { user } = useAuth();
  const [now] = useState(() => new Date());

  const chartEndDate = useMemo(() => getBogotaDateInputValue(now), [now]);
  const chartStartDate = useMemo(
    () => `${chartEndDate.slice(0, 8)}01`,
    [chartEndDate],
  );

  const { data: categoryDaily } = useSalesByCategoryDaily(chartStartDate, chartEndDate);

  const dateRange = useMemo(() => buildMonthRange(chartEndDate), [chartEndDate]);
  const monthLabel = useMemo(() => buildMonthLabel(now), [now]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingState
          icon={<LayoutDashboard className="w-5 h-5 text-primary/50" />}
          message="Cargando dashboard..."
        />
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

        {/* Quick actions (bento 2x2) — placed above the metrics */}
        <QuickActions />

        {/* Compact 7-metric grid (day KPIs + aggregates) */}
        <TodayStats />

        {/* Stacked category chart — replaces the simple revenue bars */}
        <div className="min-w-0 rounded-3xl border border-border/80 bg-card px-4 sm:px-6 py-6 text-foreground relative">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Ingresos de {monthLabel}
          </p>
          <div className="mt-6">
            <CategoryStackedChart data={categoryDaily?.data ?? []} days={dateRange} />
          </div>
        </div>

        {/* Operational alert panels (capped, so the page never grows without bound) */}
        <AlertPanels />
      </div>
    </DashboardLayout>
  );
}

/**
 * Builds the full list of `YYYY-MM-DD` dates for the month that `endDate`
 * (a Bogotá `YYYY-MM-DD` value) belongs to, from the 1st to the last day.
 */
function buildMonthRange(endDate: string): string[] {
  const [year, month] = endDate.split("-").map(Number);
  if (!year || !month) {
    return [endDate];
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from(
    { length: daysInMonth },
    (_, index) => `${endDate.slice(0, 8)}${String(index + 1).padStart(2, "0")}`,
  );
}

/**
 * Spanish month name for the chart title, e.g. "agosto" (Bogotá timezone).
 */
function buildMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    month: "long",
    timeZone: "America/Bogota",
  }).format(date);
}
