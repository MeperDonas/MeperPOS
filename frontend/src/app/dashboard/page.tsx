"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDashboard, useDailySales } from "@/hooks/useReports";
import { useCategories } from "@/hooks/useCategories";
import {
  TrendingUp,
  Package,
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
  LayoutDashboard,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Users,
} from "lucide-react";
import {
  formatCurrency,
  getBogotaDateInputValue,
  shiftDateInputValue,
} from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";

function capitalizeLabel(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function evaluateQuadraticY(
  startY: number,
  controlY: number,
  endY: number,
  t: number,
) {
  const invT = 1 - t;
  return invT * invT * startY + 2 * invT * t * controlY + t * t * endY;
}

function getRevenueCurveYByIndex(index: number, pointCount: number) {
  if (pointCount <= 1) {
    return 80;
  }

  const x = (index / (pointCount - 1)) * 400;

  if (x <= 100) {
    return evaluateQuadraticY(80, 70, 85, x / 100);
  }

  if (x <= 200) {
    return evaluateQuadraticY(85, 100, 60, (x - 100) / 100);
  }

  if (x <= 300) {
    return evaluateQuadraticY(60, 20, 75, (x - 200) / 100);
  }

  return evaluateQuadraticY(75, 130, 40, (x - 300) / 100);
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: dashboard, isLoading } = useDashboard();
  const { data: categoriesResponse } = useCategories({ page: 1, limit: 1 });
  const { user } = useAuth();
  const [now] = useState(() => new Date());
  const [hoveredRevenueKey, setHoveredRevenueKey] = useState<string | null>(
    null,
  );
  const [soldProductsPage, setSoldProductsPage] = useState(1);

  const chartEndDate = useMemo(() => getBogotaDateInputValue(now), [now]);
  const chartStartDate = useMemo(
    () => shiftDateInputValue(chartEndDate, -6),
    [chartEndDate],
  );

  const { data: dailySales } = useDailySales(chartStartDate, chartEndDate);

  const stats = {
    totalSales: dashboard?.totalSales ?? 0,
    totalRevenue: dashboard?.totalRevenue ?? 0,
    totalProducts: dashboard?.totalProducts ?? 0,
    totalCustomers: dashboard?.totalCustomers ?? 0,
    lowStockProducts: dashboard?.lowStockProducts ?? 0,
    trends: dashboard?.trends ?? {
      totalSales: null,
      totalRevenue: null,
      totalCustomers: null,
    },
  };

  const revenueBarData = useMemo(() => {
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
        height:
          daily.total === 0
            ? 18
            : Math.max(28, Math.round((daily.total / maxValue) * 100)),
      };
    });
  }, [chartEndDate, chartStartDate, dailySales?.data]);

  const hoveredRevenueIndex = useMemo(
    () => revenueBarData.findIndex((bar) => bar.key === hoveredRevenueKey),
    [hoveredRevenueKey, revenueBarData],
  );

  const hoveredRevenuePoint = useMemo(() => {
    if (hoveredRevenueIndex < 0) {
      return null;
    }

    const xPct = (hoveredRevenueIndex / (revenueBarData.length - 1)) * 100;
    const yPct = getRevenueCurveYByIndex(
      hoveredRevenueIndex,
      revenueBarData.length,
    );

    return {
      xPct,
      yPct,
    };
  }, [hoveredRevenueIndex, revenueBarData.length]);

  const hoveredRevenueBar =
    hoveredRevenueIndex >= 0 ? revenueBarData[hoveredRevenueIndex] : null;

  const totalCategories = categoriesResponse?.meta.total ?? 0;

  const formatTrend = (value: number | null) => {
    const safeValue = value ?? 0;
    const rounded = Math.abs(safeValue) < 0.05 ? 0 : safeValue;
    const sign = rounded > 0 ? "+" : "";
    return `${sign}${rounded.toFixed(1)}%`;
  };

  // Convertir ventas recientes en filas de productos vendidos (1 fila por cada item)
  const soldProductsList = useMemo(() => {
    const sales = dashboard?.recentSales ?? [];
    const items: Array<{
      id: string;
      productName: string;
      quantity: number;
      total: number;
      customerName: string;
      createdAt: string;
    }> = [];

    for (const sale of sales) {
      for (const item of sale.items) {
        items.push({
          id: item.id,
          productName: item.product.name,
          quantity: item.quantity,
          total: item.total,
          customerName: sale.customer?.name || "General",
          createdAt: sale.createdAt,
        });
      }
    }

    // Ordenar por fecha más reciente
    return items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [dashboard?.recentSales]);

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

        {/* Dashboard Cards - Estilo Luminous Analyst */}
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-6 xl:grid-cols-12 stagger-children">
          {/* Ingresos Totales - Grande */}
          <div className="relative min-w-0 overflow-hidden rounded-3xl border border-accent/30 bg-accent/10 px-6 py-6 text-foreground md:col-span-8 xl:col-span-8">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <DollarSign className="text-8xl text-accent" />
            </div>
            <div className="z-10">
              {/* Título y badge en esquina */}
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Ingresos Totales
                </p>
                <span
                  className={`flex items-center text-xs font-bold px-3 py-1 rounded-full ${
                    (stats.trends.totalRevenue ?? 0) >= 0
                      ? "bg-accent/20 text-accent"
                      : "bg-rose-500/20 text-rose-500"
                  }`}
                >
                  {(stats.trends.totalRevenue ?? 0) >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 mr-1" />
                  )}
                  {formatTrend(stats.trends.totalRevenue)} Hoy
                </span>
              </div>
              {/* Valor con moneda COP */}
              <div className="flex items-baseline space-x-3">
                <h3 className="text-5xl md:text-6xl font-bold text-accent">
                  {formatCurrency(stats.totalRevenue)}
                </h3>
                <span className="text-muted-foreground text-lg opacity-60">
                  COP
                </span>
              </div>
            </div>
            {/* Mini gráfico área con tooltip */}
            <div className="mt-8 h-40 w-full relative">
              <svg
                className="w-full h-32"
                preserveAspectRatio="none"
                viewBox="0 0 400 100"
              >
                <defs>
                  <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="#8BB59D"
                      stopOpacity="0.4"
                    ></stop>
                    <stop
                      offset="100%"
                      stopColor="#8BB59D"
                      stopOpacity="0"
                    ></stop>
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <path
                  d="M0,80 Q50,70 100,85 T200,60 T300,75 T400,40 L400,100 L0,100 Z"
                  fill="url(#areaGradient)"
                />
                <path
                  d="M0,80 Q50,70 100,85 T200,60 T300,75 T400,40"
                  fill="none"
                  stroke="#8BB59D"
                  strokeWidth="2.5"
                />
              </svg>
              {/* Áreas de hover para cada punto del gráfico */}
              <div className="absolute top-0 left-0 h-32 w-full flex">
                {revenueBarData.slice(-7).map((bar) => (
                  <div
                    key={bar.key}
                    className="flex-1"
                    onMouseEnter={() => setHoveredRevenueKey(bar.key)}
                    onMouseLeave={() => setHoveredRevenueKey(null)}
                  />
                ))}
              </div>

              {hoveredRevenueBar && hoveredRevenuePoint && (
                <div className="pointer-events-none absolute left-0 top-0 h-32 w-full">
                  <div
                    className="absolute z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
                    style={{
                      left: `${hoveredRevenuePoint.xPct}%`,
                      top: `${hoveredRevenuePoint.yPct}%`,
                      boxShadow: "0 0 8px rgba(139, 181, 157, 0.6)",
                    }}
                  />

                  <div
                    className="absolute z-30 min-w-[110px] -translate-x-1/2 -translate-y-full rounded-lg border border-primary/30 bg-card px-3 py-2 shadow-lg"
                    style={{
                      left: `${hoveredRevenuePoint.xPct}%`,
                      top: `calc(${hoveredRevenuePoint.yPct}% - 12px)`,
                    }}
                  >
                    <p className="text-center text-[10px] font-semibold text-muted-foreground">
                      {hoveredRevenueBar.detailDate}
                    </p>
                    <p className="mt-0.5 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {hoveredRevenueBar.monthLabel}
                    </p>
                    <p className="mt-1 text-center text-sm font-bold text-accent">
                      {formatCurrency(hoveredRevenueBar.total)}
                    </p>
                  </div>
                </div>
              )}

              {/* Etiquetas de fecha */}
              <div className="flex justify-between mt-2 text-[10px] uppercase tracking-wider text-muted-foreground/60 px-1">
                {revenueBarData.slice(-7).map((bar) => (
                  <span key={bar.key}>
                    {bar.dayAbbreviation}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Ayer vs Hoy */}
          <div className="min-w-0 rounded-3xl border border-primary/30 bg-primary/10 px-6 py-6 text-foreground md:col-span-4 xl:col-span-4 flex flex-col justify-center">
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Ayer vs Hoy
              </p>
              <div className="p-1.5 bg-primary/20 rounded-lg">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Hoy
                </span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(stats.totalRevenue)}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: "78%" }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Ayer
                </span>
                <span className="text-lg font-bold text-muted-foreground">
                  {formatCurrency(dashboard?.previousPeriod?.revenue ?? 0)}
                </span>
              </div>
            </div>
          </div>

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
            <div className="mt-4 w-full bg-muted h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-accent h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min((stats.totalSales / 1500) * 100, 100)}%`,
                }}
              />
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground/60 font-medium italic">
              Meta: 1,500 mensual ({Math.round((stats.totalSales / 1500) * 100)}
              %)
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

        {/* Productos Vendidos - Tabla con paginación */}
        <div className="animate-fade-in rounded-3xl border border-primary/30 bg-primary/10 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-primary/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-xl">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                Productos Vendidos
              </h3>
            </div>
            {soldProductsList.length > 0 && (
              <span className="text-[10px] font-bold bg-primary/20 text-primary px-2 py-1 rounded-md uppercase tracking-wider">
                {soldProductsList.length} items
              </span>
            )}
          </div>
          {soldProductsList.length === 0 ? (
            <EmptyState icon={<Package className="w-6 h-6 text-muted-foreground/30" />} title="No hay productos vendidos en este período" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr className="border-b border-primary/20 bg-primary/5">
                      <th className="text-left py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Producto
                      </th>
                      <th className="text-center py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Cantidad
                      </th>
                      <th className="text-left py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Cliente
                      </th>
                      <th className="text-right py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Total
                      </th>
                      <th className="text-right py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Fecha
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-background/50">
                    {soldProductsList
                      .slice((soldProductsPage - 1) * 10, soldProductsPage * 10)
                      .map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-primary/10 last:border-b-0 transition-colors hover:bg-primary/0.05"
                        >
                          <td className="py-3 px-5">
                            <span className="text-sm font-medium text-foreground">
                              {item.productName}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-center">
                            <span className="text-sm font-bold text-primary">
                              {item.quantity}
                            </span>
                          </td>
                          <td className="py-3 px-5">
                            <span className="text-sm text-muted-foreground">
                              {item.customerName}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-right">
                            <span className="text-sm font-bold text-accent">
                              {formatCurrency(item.total)}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-right text-xs text-muted-foreground whitespace-nowrap font-mono">
                            {new Date(item.createdAt).toLocaleDateString(
                              "es-CO",
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {/* Paginación */}
              {soldProductsList.length > 10 && (
                <div className="px-4 py-3 border-t border-primary/20">
                  <Pagination
                    currentPage={soldProductsPage}
                    totalPages={Math.ceil(soldProductsList.length / 10)}
                    onPageChange={setSoldProductsPage}
                    totalItems={soldProductsList.length}
                    pageSize={10}
                    itemLabel="producto"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
