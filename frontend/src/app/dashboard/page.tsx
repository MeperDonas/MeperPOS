"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDashboard, useSalesByCategoryDaily } from "@/hooks/useReports";
import { LayoutDashboard } from "lucide-react";
import { getBogotaDateInputValue, shiftDateInputValue } from "@/lib/utils";
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
    () => shiftDateInputValue(chartEndDate, -6),
    [chartEndDate],
  );

  const { data: categoryDaily } = useSalesByCategoryDaily(chartStartDate, chartEndDate);

  const dateRange = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        shiftDateInputValue(chartStartDate, index),
      ),
    [chartStartDate],
  );

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
        <div className="min-w-0 overflow-hidden rounded-3xl border border-border/80 bg-card px-6 py-6 text-foreground">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Ingresos últimos 7 días
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
