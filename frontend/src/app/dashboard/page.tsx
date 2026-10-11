"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDashboard } from "@/hooks/useReports";
import { LayoutDashboard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingState } from "@/components/ui/LoadingState";
import { TodayStats } from "@/components/dashboard/TodayStats";
import { AlertPanels } from "@/components/dashboard/AlertPanels";
import { RevenueSection } from "@/components/dashboard/RevenueSection";
import { RecentSalesCard } from "@/components/dashboard/RecentSalesCard";

export default function DashboardPage() {
  const { isLoading } = useDashboard();
  const { user } = useAuth();

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

        {/* 8 KPI cards — two rows of four (day KPIs + accumulated totals) */}
        <TodayStats />

        {/* Revenue piece — shared range selector over the category chart,
            payment-method donut and top-products list */}
        <RevenueSection />

        {/* Compact peek at the latest sales */}
        <RecentSalesCard />

        {/* Operational alert panels (capped, so the page never grows without bound) */}
        <AlertPanels />
      </div>
    </DashboardLayout>
  );
}
