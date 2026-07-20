"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useDashboard,
  useSalesByPaymentMethod,
  useSalesByCategory,
  useTopSellingProducts,
  useCustomerStatistics,
  useUserPerformance,
} from "@/hooks/useReports";
import { useUsers } from "@/hooks/useUsers";
import { api, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  Download,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Info,
} from "lucide-react";
import {
  formatCurrency,
  getBogotaDateInputValue,
  shiftDateInputValue,
} from "@/lib/utils";
import { chipStyles } from "@/lib/chipStyles";
import { useToast } from "@/contexts/ToastContext";
import { ImportSection } from "@/components/reports/ImportSection";
import { LoadingState } from "@/components/ui/LoadingState";
import { Table, TableHeader, TableRow, TableCell } from "@/components/ui/Table";
import type { AppliedRange } from "@/types";

type CategoryArcSegment = {
  category: string;
  total: number;
  quantity: number;
  color: string;
  pct: number;
  startAngle: number;
  endAngle: number;
  midAngle: number;
};

const DONUT_CENTER = 120;
const DONUT_OUTER_RADIUS = 96;
const DONUT_INNER_RADIUS = 58;

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function buildDonutPath(startAngle: number, endAngle: number) {
  const sweep = Math.max(0, endAngle - startAngle);
  const largeArcFlag = sweep > 180 ? 1 : 0;

  const outerStart = polarToCartesian(
    DONUT_CENTER,
    DONUT_CENTER,
    DONUT_OUTER_RADIUS,
    startAngle,
  );
  const outerEnd = polarToCartesian(
    DONUT_CENTER,
    DONUT_CENTER,
    DONUT_OUTER_RADIUS,
    endAngle,
  );
  const innerEnd = polarToCartesian(
    DONUT_CENTER,
    DONUT_CENTER,
    DONUT_INNER_RADIUS,
    endAngle,
  );
  const innerStart = polarToCartesian(
    DONUT_CENTER,
    DONUT_CENTER,
    DONUT_INNER_RADIUS,
    startAngle,
  );

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${DONUT_OUTER_RADIUS} ${DONUT_OUTER_RADIUS} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${DONUT_INNER_RADIUS} ${DONUT_INNER_RADIUS} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function formatRangeDateLabel(value: string | null) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Bogota",
  }).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
}

function formatAppliedRangeLabel(appliedRange?: AppliedRange) {
  if (!appliedRange) {
    return "Período completo";
  }

  const startLabel = formatRangeDateLabel(appliedRange.startDate);
  const endLabel = formatRangeDateLabel(appliedRange.endDate);

  if (startLabel && endLabel) {
    return `${startLabel} - ${endLabel}`;
  }
  if (startLabel) {
    return `Desde ${startLabel}`;
  }
  if (endLabel) {
    return `Hasta ${endLabel}`;
  }

  return "Período completo";
}

export default function ReportsPage() {
  const toast = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [hoveredCategory, setHoveredCategory] =
    useState<CategoryArcSegment | null>(null);

  const setToday = () => {
    const today = getBogotaDateInputValue();
    setStartDate(today);
    setEndDate(today);
  };

  const setThisWeek = () => {
    const today = getBogotaDateInputValue();
    setStartDate(shiftDateInputValue(today, -6));
    setEndDate(today);
  };

  const { data: dashboard } = useDashboard(startDate, endDate);
  const { data: paymentMethodsResponse, isLoading: paymentLoading } =
    useSalesByPaymentMethod(startDate, endDate);
  const { data: salesByCategoryResponse, isLoading: categoryLoading } =
    useSalesByCategory(startDate, endDate);
  const { data: topProductsResponse, isLoading: topProductsLoading } =
    useTopSellingProducts(startDate, endDate, 5);
  const { data: customerStats, isLoading: customerLoading } =
    useCustomerStatistics(startDate, endDate);
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const {
    data: userPerformanceResponse,
    isLoading: userPerformanceLoading,
    error: userPerformanceError,
  } = useUserPerformance(
    startDate,
    endDate,
    true,
    selectedUserIds.length > 0 ? selectedUserIds : undefined,
  );

  const paymentMethods = useMemo(
    () => paymentMethodsResponse?.data ?? [],
    [paymentMethodsResponse?.data],
  );
  const salesByCategory = useMemo(
    () => salesByCategoryResponse?.data ?? [],
    [salesByCategoryResponse?.data],
  );
  const topProducts = useMemo(
    () => topProductsResponse?.data ?? [],
    [topProductsResponse?.data],
  );

  const handleExport = async (
    type: "sales" | "products" | "customers" | "inventory",
    format: "pdf" | "excel" | "csv",
  ) => {
    try {
      await api.exportData(`/exports/${type}`, {
        format,
        type,
        startDate,
        endDate,
      });
      toast.success(
        `Exportación ${format.toUpperCase()} generada correctamente`,
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Error al exportar datos"));
    }
  };

  const stats = dashboard || {
    totalSales: 0,
    totalRevenue: 0,
    totalProducts: 0,
    totalCustomers: 0,
    lowStockProducts: 0,
    trends: {
      totalSales: 0,
      totalRevenue: 0,
      totalCustomers: 0,
    },
    recentSales: [],
  };

  const avgTicket =
    stats.totalSales > 0 ? stats.totalRevenue / stats.totalSales : 0;

  const dashboardRangeLabel = useMemo(
    () => formatAppliedRangeLabel(dashboard?.appliedRange),
    [dashboard?.appliedRange],
  );
  const paymentRangeLabel = useMemo(
    () => formatAppliedRangeLabel(paymentMethodsResponse?.appliedRange),
    [paymentMethodsResponse?.appliedRange],
  );
  const categoryRangeLabel = useMemo(
    () => formatAppliedRangeLabel(salesByCategoryResponse?.appliedRange),
    [salesByCategoryResponse?.appliedRange],
  );
  const topProductsRangeLabel = useMemo(
    () => formatAppliedRangeLabel(topProductsResponse?.appliedRange),
    [topProductsResponse?.appliedRange],
  );
  const customerRangeLabel = useMemo(
    () => formatAppliedRangeLabel(customerStats?.appliedRange),
    [customerStats?.appliedRange],
  );
  const userPerformance = useMemo(
    () => userPerformanceResponse?.data ?? [],
    [userPerformanceResponse?.data],
  );
  const userPerformanceRangeLabel = useMemo(
    () => formatAppliedRangeLabel(userPerformanceResponse?.appliedRange),
    [userPerformanceResponse?.appliedRange],
  );
  const userPerformanceComparisonRangeLabel = useMemo(
    () => formatAppliedRangeLabel(userPerformanceResponse?.comparisonRange),
    [userPerformanceResponse?.comparisonRange],
  );
  const selectableUsers = useMemo(
    () => users.toSorted((a, b) => a.name.localeCompare(b.name, "es")),
    [users],
  );

  const selectedUsersLabel = useMemo(() => {
    if (selectedUserIds.length === 0) {
      return "Todos los usuarios";
    }

    return `${selectedUserIds.length} seleccionado${selectedUserIds.length === 1 ? "" : "s"}`;
  }, [selectedUserIds.length]);

  const toggleSelectedUser = (userId: string) => {
    setSelectedUserIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  };

  const formatTrendLabel = (value: number | null | undefined) => {
    const safeValue = value ?? 0;
    const rounded = Math.abs(safeValue) < 0.05 ? 0 : safeValue;
    const sign = rounded > 0 ? "+" : "";
    return `${sign}${rounded.toFixed(1)}%`;
  };

  const statCards = [
    {
      label: "Ingresos netos",
      value: formatCurrency(stats.totalRevenue),
      helper: "vs. periodo anterior",
      trend: stats.trends?.totalRevenue ?? 0,
      icon: DollarSign,
    },
    {
      label: "Pedidos",
      value: stats.totalSales.toLocaleString("es-CO"),
      helper: `ticket promedio ${formatCurrency(avgTicket)}`,
      trend: stats.trends?.totalSales ?? 0,
      icon: ShoppingCart,
    },
    {
      label: "Clientes activos",
      value: (customerStats?.activeCustomers ?? stats.totalCustomers).toLocaleString(
        "es-CO",
      ),
      helper: `${customerStats?.totalCustomers ?? stats.totalCustomers} clientes registrados`,
      trend: stats.trends?.totalCustomers ?? 0,
      icon: Users,
    },
    {
      label: "Rotación inventario",
      value:
        stats.totalProducts > 0
          ? `${(
              ((stats.totalProducts - stats.lowStockProducts) / stats.totalProducts) *
              100
            ).toFixed(1)}%`
          : "0.0%",
      helper: `${stats.lowStockProducts} con stock bajo`,
      trend: stats.lowStockProducts > 0 ? -Math.min(100, stats.lowStockProducts * 2) : 0,
      icon: Package,
    },
  ] as const;

  const paymentMethodItems = useMemo(() => {
    const map = {
      CASH: { label: "Efectivo", dot: "#10b981" },
      CARD: { label: "Tarjeta", dot: "#0ea5e9" },
      TRANSFER: { label: "Transferencia", dot: "#f59e0b" },
    } as const;

    const totalCount = paymentMethods.reduce((sum, item) => sum + item.count, 0);
    const totalAmount = paymentMethods.reduce((sum, item) => sum + item.total, 0);

    return {
      totalCount,
      totalAmount,
      avgTicket: totalCount > 0 ? totalAmount / totalCount : 0,
      items: paymentMethods
        .map((item) => ({
          ...item,
          label: map[item.paymentMethod as keyof typeof map]?.label ?? item.paymentMethod,
          dot: map[item.paymentMethod as keyof typeof map]?.dot ?? "#64748b",
          pct: totalCount > 0 ? (item.count / totalCount) * 100 : 0,
        }))
        .toSorted((a, b) => b.total - a.total),
    };
  }, [paymentMethods]);

  const categoryChart = useMemo(() => {
    const palette = ["#14b8a6", "#f97316", "#0ea5e9", "#84cc16", "#f43f5e", "#8b5cf6", "#f59e0b"];
    const totalQuantity = salesByCategory.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = salesByCategory.reduce((sum, item) => sum + item.total, 0);

    const baseSegments = salesByCategory
      .map((item, index) => ({
        ...item,
        color: palette[index % palette.length],
        pct: totalQuantity > 0 ? (item.quantity / totalQuantity) * 100 : 0,
      }))
      .toSorted((a, b) => b.quantity - a.quantity);

    const segments = baseSegments.reduce<{
      cursor: number;
      segments: CategoryArcSegment[];
    }>(
      (acc, segment) => {
        const rawSweep = (segment.pct / 100) * 360;
        const gap = rawSweep > 6 ? 1.4 : 0;
        const startAngle = acc.cursor + gap / 2;
        const endAngle = acc.cursor + rawSweep - gap / 2;
        const midAngle = (startAngle + endAngle) / 2;

        return {
          cursor: acc.cursor + rawSweep,
          segments: [
            ...acc.segments,
            {
              ...segment,
              startAngle,
              endAngle: Math.max(endAngle, startAngle),
              midAngle,
            },
          ],
        };
      },
      {
        cursor: -90,
        segments: [],
      },
    ).segments;

    return {
      segments,
      totalQuantity,
      totalAmount,
    };
  }, [salesByCategory]);

  const getClientSegment = (salesCount: number) => {
    if (salesCount >= 12) return "VIP";
    if (salesCount >= 6) return "Frecuente";
    if (salesCount >= 3) return "Recurrente";
    return "Potencial";
  };

  // LoadingSpinner hoisted to module level as <LoadingState icon={<BarChart3 className="w-4 h-4 text-primary/50" />} message="Cargando..." />

  return (
    <DashboardLayout>
      <div className="space-y-5 lg:space-y-7">
        {/* Page Header */}
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-7 rounded-full bg-primary shrink-0" />
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
              Reportes
            </h1>
          </div>
          <p className="text-sm text-muted-foreground ml-4">
            Analiza el rendimiento de tu negocio
          </p>
        </div>

        {/* Date Filter */}
        <div className="rounded-3xl border border-primary/30 bg-primary/10 overflow-hidden">
          {/* Quick selects */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-primary/20 bg-primary/5">
            <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mr-0.5">
              Período
            </span>
            <button
              onClick={setToday}
              className="h-7 px-3 rounded-full text-xs font-semibold bg-background/60 border border-primary/30 text-muted-foreground hover:text-primary hover:bg-primary/15 transition-all"
            >
              Hoy
            </button>
            <button
              onClick={setThisWeek}
              className="h-7 px-3 rounded-full text-xs font-semibold bg-background/60 border border-primary/30 text-muted-foreground hover:text-primary hover:bg-primary/15 transition-all whitespace-nowrap"
            >
              Esta semana
            </button>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="ml-auto flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background/80 border border-primary/20 transition-colors"
              >
                <X className="w-3 h-3" /> Limpiar
              </button>
            )}
            <span className="rounded-full border border-primary/30 bg-background/60 px-2.5 py-1 text-[11px] font-semibold text-primary">
              {dashboardRangeLabel}
            </span>
          </div>
          {/* Custom date range */}
          <div className="flex items-center gap-2 px-4 py-3 flex-wrap sm:flex-nowrap">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              Desde
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 min-w-[130px] h-9 px-3 rounded-xl border border-primary/20 bg-background/60 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-colors cursor-pointer"
            />
            <span className="text-muted-foreground/40 font-mono hidden sm:block">
              →
            </span>
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              Hasta
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 min-w-[130px] h-9 px-3 rounded-xl border border-primary/20 bg-background/60 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-colors cursor-pointer"
            />
            {startDate && endDate && (
              <div className="shrink-0 h-9 flex items-center px-3 rounded-xl bg-primary/15 border border-primary/30">
                <span className="text-xs font-bold text-primary font-mono">
                  {Math.max(
                    1,
                    Math.round(
                      (new Date(endDate).getTime() -
                        new Date(startDate).getTime()) /
                        (1000 * 60 * 60 * 24) +
                        1,
                    ),
                  )}
                  d
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
          {statCards.map((card, index) => {
            const Icon = card.icon;
            const isPrimary = index % 2 === 0;
            const trendUp = card.trend >= 0;
            return (
              <div
                key={card.label}
                className={`relative overflow-hidden rounded-3xl border p-5 transition-all duration-200 ${
                  isPrimary
                    ? "border-primary/30 bg-primary/10 hover:border-primary/50"
                    : "border-accent/30 bg-accent/10 hover:border-accent/50"
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] truncate">
                      {card.label}
                    </p>
                    <p
                      className={`stat-number mt-2 text-2xl lg:text-3xl font-bold leading-none ${
                        isPrimary ? "text-primary" : "text-accent"
                      }`}
                    >
                      {card.value}
                    </p>
                  </div>
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isPrimary ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      trendUp
                        ? "bg-accent/20 text-accent"
                        : "bg-rose-500/20 text-rose-500"
                    }`}
                  >
                    {trendUp ? (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                    {formatTrendLabel(card.trend)}
                  </span>
                  <span
                    className={`text-[11px] text-right ${
                      isPrimary ? "text-primary/70" : "text-accent/70"
                    }`}
                  >
                    {card.helper}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-3xl border border-primary/30 bg-primary/10">
          <div className="border-b border-primary/20 px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="p-1.5 bg-primary/20 rounded-lg">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Rendimiento por vendedor</h3>
              <span className="ml-auto rounded-full border border-primary/30 bg-background/60 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {userPerformanceRangeLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Comparación de KPIs por usuario usando el mismo rango de fechas.
              {userPerformanceComparisonRangeLabel
                ? ` vs. ${userPerformanceComparisonRangeLabel}`
                : ""}
            </p>
          </div>

          <div className="border-b border-primary/20 bg-primary/5 px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Subconjunto
              </span>
              <button
                type="button"
                onClick={() => setSelectedUserIds([])}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                  selectedUserIds.length === 0
                    ? "border-primary/40 bg-primary/20 text-primary"
                    : "border-primary/20 bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-primary"
                }`}
              >
                Todos
              </button>
              {usersLoading ? (
                <span className="text-[11px] text-muted-foreground">Cargando usuarios...</span>
              ) : (
                selectableUsers.map((user) => {
                  const selected = selectedUserIds.includes(user.id);

                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => toggleSelectedUser(user.id)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                        selected
                          ? "border-primary/40 bg-primary/20 text-primary"
                          : "border-primary/20 bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-primary"
                      }`}
                      aria-pressed={selected}
                    >
                      {user.name}
                    </button>
                  );
                })
              )}
              <span className="ml-auto rounded-full border border-primary/30 bg-background/60 px-2.5 py-1 text-[10px] font-semibold text-primary">
                {selectedUsersLabel}
              </span>
            </div>
          </div>

          <div className="border-b border-primary/20 bg-primary/5 px-5 py-3">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 text-primary" />
              <p className="text-[11px] text-muted-foreground">
                KPI: <strong>Ventas</strong> = cantidad de ventas completadas, <strong>Ingresos</strong> = suma total vendida, <strong>Ticket</strong> = ingresos/ventas, <strong>Clientes</strong> = clientes unicos atendidos.
              </p>
            </div>
          </div>

          <div className="p-5">
            {userPerformanceLoading ? (
              <LoadingState icon={<BarChart3 className="w-4 h-4 text-primary/50" />} message="Cargando..." />
            ) : userPerformanceError ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                {getApiErrorMessage(userPerformanceError, "No se pudo cargar la comparación de vendedores")}
              </p>
            ) : userPerformance.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sin datos para este período.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-primary/20 bg-background/40">
                <Table variant="primary" className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableCell as="th" className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Usuario</TableCell>
                      <TableCell as="th" className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Ventas</TableCell>
                      <TableCell as="th" className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Ingresos</TableCell>
                      <TableCell as="th" className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Ticket</TableCell>
                      <TableCell as="th" className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Clientes</TableCell>
                      <TableCell as="th" className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Comparación</TableCell>
                    </TableRow>
                  </TableHeader>
                  <tbody>
                    {userPerformance.map((row) => (
                      <TableRow key={row.userId}>
                        <TableCell className="px-4 py-3">
                          <p className="text-sm font-semibold text-foreground">{row.userName}</p>
                          <p className="text-xs text-muted-foreground">{row.role}</p>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right text-sm text-foreground">{row.salesCount.toLocaleString("es-CO")}</TableCell>
                        <TableCell className="px-4 py-3 text-right text-sm font-bold text-primary">{formatCurrency(row.revenue)}</TableCell>
                        <TableCell className="px-4 py-3 text-right text-sm text-muted-foreground">{formatCurrency(row.avgTicket)}</TableCell>
                        <TableCell className="px-4 py-3 text-right text-sm text-muted-foreground">{row.uniqueCustomers.toLocaleString("es-CO")}</TableCell>
                        <TableCell className="px-4 py-3 text-right text-xs text-muted-foreground">
                          {row.comparison
                            ? `${formatTrendLabel(row.comparison.revenuePct)} ingresos / ${formatTrendLabel(row.comparison.salesPct)} ventas`
                            : "Sin comparación"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
        </div>

        {/* Main Analytics */}
        <div className="grid grid-cols-1 gap-4 lg:gap-5 xl:grid-cols-2">
          {/* Category Distribution */}
          <div className="rounded-3xl border border-accent/30 bg-accent/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-accent/20">
              <h3 className="text-sm font-semibold text-foreground">
                Composición por Categoría
              </h3>
              <div className="mt-0.5 flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  Participación por cantidad y aporte en ingresos
                </p>
                <span className="rounded-full border border-accent/30 bg-background/60 px-2 py-0.5 text-[10px] font-semibold text-accent">
                  {categoryRangeLabel}
                </span>
              </div>
            </div>
            <div className="p-5">
              {categoryLoading ? <LoadingState icon={<BarChart3 className="w-4 h-4 text-primary/50" />} message="Cargando..." /> : categoryChart.segments.length > 0 ? (
                <div className="grid gap-5 md:grid-cols-[250px_minmax(0,1fr)] md:items-center">
                  <div className="flex justify-center">
                    <div className="relative w-[240px] h-[240px]">
                      <svg viewBox="0 0 240 240" className="w-full h-full">
                        <circle
                          cx={DONUT_CENTER}
                          cy={DONUT_CENTER}
                          r={DONUT_OUTER_RADIUS}
                          fill="none"
                          stroke="rgba(148,163,184,0.20)"
                          strokeWidth={1}
                        />
                        {categoryChart.segments.map((segment) => (
                          <path
                            key={segment.category}
                            d={buildDonutPath(segment.startAngle, segment.endAngle)}
                            fill={segment.color}
                            opacity={hoveredCategory && hoveredCategory.category !== segment.category ? 0.45 : 1}
                            className="transition-opacity duration-150 cursor-pointer"
                            onMouseEnter={() => setHoveredCategory(segment)}
                            onMouseLeave={() => setHoveredCategory(null)}
                          />
                        ))}
                        <circle
                          cx={DONUT_CENTER}
                          cy={DONUT_CENTER}
                          r={DONUT_INNER_RADIUS}
                          fill="var(--card)"
                          stroke="var(--border)"
                        />
                      </svg>

                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Items</span>
                        <span className="stat-number text-xl font-bold text-foreground mt-0.5">
                          {categoryChart.totalQuantity.toLocaleString("es-CO")}
                        </span>
                        <span className="text-[11px] text-muted-foreground mt-0.5">vendidos</span>
                      </div>

                      {hoveredCategory && (
                        <div className="absolute left-1/2 -translate-x-1/2 -bottom-4 z-10 rounded-xl border border-accent/30 bg-card px-3 py-2 shadow-lg">
                          <p className="text-xs font-semibold text-foreground">
                            {hoveredCategory.category}
                          </p>
                          <div className="mt-1 flex items-center justify-between gap-5 text-[11px] text-muted-foreground">
                            <span>{hoveredCategory.pct.toFixed(1)}%</span>
                            <span>{hoveredCategory.quantity} prod.</span>
                            <span className="font-semibold text-accent">
                              {formatCurrency(hoveredCategory.total)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="max-h-[352px] overflow-y-auto pr-1 space-y-3 scrollbar-app">
                      {categoryChart.segments.map((item) => (
                        <div key={item.category} className="rounded-2xl border border-accent/20 bg-background/40 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                              <span className="text-sm font-medium text-foreground truncate">{item.category}</span>
                            </div>
                            <span className="text-xs font-semibold text-muted-foreground">{item.pct.toFixed(1)}%</span>
                          </div>
                          <div className="mt-2 h-1.5 rounded-full bg-accent/10 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{item.quantity} productos</span>
                            <span className="stat-number font-bold text-foreground">{formatCurrency(item.total)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">Sin datos para este período</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Products */}
          <div className="rounded-3xl border border-primary/30 bg-primary/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-primary/20 flex items-center gap-2">
              <div className="p-1.5 bg-primary/20 rounded-lg">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Productos Más Vendidos
              </h3>
              <span className="ml-auto rounded-full border border-primary/30 bg-background/60 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {topProductsRangeLabel}
              </span>
            </div>
            <div className="p-5">
              {topProductsLoading ? <LoadingState icon={<BarChart3 className="w-4 h-4 text-primary/50" />} message="Cargando..." /> : topProducts.length > 0 ? (
                <div className="space-y-3">
                  {topProducts.map((product, index) => (
                    <div
                      key={product.productId}
                      className="flex flex-col gap-3 p-3.5 rounded-2xl bg-background/40 border border-primary/20 hover:bg-primary/5 transition-colors md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">#{index + 1}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {product.productName}
                          </p>
                          <div className="mt-1 flex items-center flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>{product.quantity} vendidos</span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${
                                product.stock <= 10
                                  ? chipStyles.danger
                                  : chipStyles.success
                              }`}
                            >
                              stock {product.stock}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-left md:text-right shrink-0">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Vendido</p>
                        <p className="stat-number text-sm font-bold text-accent shrink-0">
                          {formatCurrency(product.total)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    Sin datos para este período
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Secondary Analytics */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_360px]">
          {/* Top Customers */}
          <div className="rounded-3xl border border-accent/30 bg-accent/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-accent/20 flex items-center gap-2">
              <div className="p-1.5 bg-accent/20 rounded-lg">
                <Users className="w-4 h-4 text-accent" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Top Clientes
              </h3>
              <span className="ml-auto rounded-full border border-accent/30 bg-background/60 px-2 py-0.5 text-[10px] font-semibold text-accent">
                {customerRangeLabel}
              </span>
            </div>
            <div className="p-5">
              {customerLoading ? <LoadingState icon={<BarChart3 className="w-4 h-4 text-primary/50" />} message="Cargando..." /> : customerStats?.topCustomers &&
                customerStats.topCustomers.length > 0 ? (
                <div className="space-y-3">
                  {customerStats.topCustomers.map((customer, index) => (
                    <div
                      key={customer.customerId}
                      className="flex flex-col gap-3 p-3.5 rounded-2xl bg-background/40 border border-accent/20 hover:bg-accent/5 transition-colors md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-accent">#{index + 1}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {customer.customerName}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{customer.totalSales} compras</span>
                            <span className="text-muted-foreground/40">-</span>
                            <span className="font-semibold text-muted-foreground">
                              {getClientSegment(customer.totalSales)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total comprado</p>
                        <span className="stat-number text-sm font-bold text-primary shrink-0">
                          {formatCurrency(customer.totalRevenue)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    Sin datos para este período
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Methods Summary */}
          <div className="rounded-3xl border border-primary/30 bg-primary/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-primary/20">
              <h3 className="text-sm font-semibold text-foreground">Métodos de Pago</h3>
              <div className="mt-0.5 flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Resumen compacto del período</p>
                <span className="rounded-full border border-primary/30 bg-background/60 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {paymentRangeLabel}
                </span>
              </div>
            </div>
            <div className="p-5">
              {paymentLoading ? <LoadingState icon={<BarChart3 className="w-4 h-4 text-primary/50" />} message="Cargando..." /> : paymentMethodItems.items.length > 0 ? (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl border border-primary/20 bg-background/40 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ventas</p>
                      <p className="stat-number text-sm font-bold text-foreground">
                        {paymentMethodItems.totalCount.toLocaleString("es-CO")}
                      </p>
                    </div>
                    <div className="rounded-xl border border-primary/20 bg-background/40 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ticket prom.</p>
                      <p className="stat-number text-sm font-bold text-foreground">
                        {formatCurrency(paymentMethodItems.avgTicket)}
                      </p>
                    </div>
                  </div>

                  {paymentMethodItems.items.map((item) => (
                    <div key={item.paymentMethod} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.dot }} />
                          <span className="font-medium text-foreground">{item.label}</span>
                        </div>
                        <span className="text-muted-foreground">{item.pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-primary/10 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.dot }} />
                      </div>
                    </div>
                  ))}

                  <div className="pt-2 border-t border-primary/20 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Ingresos por pagos</span>
                    <span className="stat-number font-bold text-primary">{formatCurrency(paymentMethodItems.totalAmount)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">Sin datos para este período</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-5 items-start">
          {/* Export */}
          <div className="rounded-3xl border border-primary/30 bg-primary/10 overflow-hidden transition-all duration-300 hover:border-primary/50">
            <div className="px-5 py-4 border-b border-primary/20 flex items-center gap-2">
              <div className="p-1.5 bg-primary/20 rounded-lg">
                <Download className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Exportar Datos
              </h3>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: "sales", label: "Ventas" },
                  { key: "products", label: "Productos" },
                  { key: "customers", label: "Clientes" },
                  { key: "inventory", label: "Inventario" },
                ].map(({ key, label }) => (
                  <div
                    key={key}
                    className="p-4 rounded-2xl bg-background/40 border border-primary/20"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground mb-3">
                      {label}
                    </p>
                    <div className="flex gap-1.5">
                      {["pdf", "excel", "csv"].map((format) => (
                        <Button
                          key={format}
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            handleExport(
                              key as
                                | "sales"
                                | "products"
                                | "customers"
                                | "inventory",
                              format as "pdf" | "excel" | "csv",
                            )
                          }
                          className="flex-1 text-xs font-mono"
                        >
                          {format.toUpperCase()}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <ImportSection />
        </div>
      </div>
    </DashboardLayout>
  );
}
