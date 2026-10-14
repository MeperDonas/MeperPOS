"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis } from "recharts";
import { X } from "lucide-react";
import { useSalesByCategoryDaily } from "@/hooks/useReports";
import { formatCurrency } from "@/lib/utils";
import {
  buildCategoryColorMap,
  buildDateWindow,
  buildStackedDailySeries,
  countDaysInclusive,
  formatCategoryAxisTick,
  formatCategoryTooltipDate,
  type StackedDay,
} from "@/lib/dashboard";

/** One chart row: the day's total plus one numeric field per category. */
interface CategoryChartRow {
  date: string;
  total: number;
  [category: string]: number | string;
}

/** Shape Recharts hands to a custom tooltip content component. */
interface CategoryTooltipEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: CategoryChartRow;
}

interface CategoryTooltipContentProps {
  active?: boolean;
  payload?: CategoryTooltipEntry[];
  coordinate?: { x?: number; y?: number };
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
}

/**
 * Recharts tooltip content: the hovered day's total plus its per-category
 * breakdown in a dark-glass card that follows the active bar dynamically.
 */
export function CategoryTooltipContent({
  active,
  payload,
}: CategoryTooltipContentProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const row = payload[0]?.payload;
  const total =
    typeof row?.total === "number"
      ? row.total
      : payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
  const segments = payload.filter((entry) => Number(entry.value) > 0);

  return (
    <div
      data-testid="category-tooltip"
      className="pointer-events-none min-w-[175px] rounded-xl border border-white/10 bg-black/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-md"
    >
      <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-white/60">
        {formatCategoryTooltipDate(typeof row?.date === "string" ? row.date : "")}
      </p>
      <p className="mt-1 text-center text-lg font-bold text-white tabular-nums">
        {formatCurrency(total)}
      </p>
      {segments.length > 0 && (
        <ul className="mt-2.5 divide-y divide-white/10">
          {segments.map((entry) => (
            <li
              key={String(entry.dataKey)}
              className="flex items-center justify-between gap-3 py-1.5 text-[11px]"
            >
              <span className="flex items-center gap-1.5 font-medium text-white/70">
                <span
                  className="inline-block h-2 w-2 rounded-[2px]"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name ?? entry.dataKey}
              </span>
              <span className="font-mono font-bold text-white tabular-nums">
                {formatCurrency(Number(entry.value))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface CategoryDayDetailModalProps {
  day: StackedDay | null;
  onClose: () => void;
  colorMap: Map<string, string>;
}

/**
 * Modal triggered when clicking a day on the bar chart.
 * Uses createPortal to render outside any parent container transforms,
 * locks body scroll, and offers a spacious, detailed dark-glass breakdown.
 */
export function CategoryDayDetailModal({
  day,
  onClose,
  colorMap,
}: CategoryDayDetailModalProps) {
  useEffect(() => {
    if (!day) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [day, onClose]);

  if (!day || typeof document === "undefined") return null;

  const totalQuantity = day.segments.reduce((sum, s) => sum + s.quantity, 0);
  const activeSegments = day.segments.filter((s) => s.total > 0);

  return createPortal(
    <div
      data-testid="category-day-detail-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 sm:p-6 backdrop-blur-md overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="category-day-detail-modal"
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-3xl border border-white/15 bg-zinc-950/95 p-6 sm:p-7 shadow-2xl backdrop-blur-xl text-white my-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Detalle del día
              </span>
            </div>
            <h3 className="text-xl font-bold text-white capitalize mt-2 tracking-tight">
              {formatCategoryTooltipDate(day.date)}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle"
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white/60 hover:bg-white/15 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Highlight KPI metrics */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 block">
              Total Recaudado
            </span>
            <p className="mt-1 text-2xl sm:text-3xl font-black font-mono text-white tabular-nums tracking-tight">
              {formatCurrency(day.total)}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 block">
              Unidades Vendidas
            </span>
            <p className="mt-1 text-2xl sm:text-3xl font-black font-mono text-white tabular-nums tracking-tight">
              {totalQuantity} {totalQuantity === 1 ? "unidad" : "unidades"}
            </p>
          </div>
        </div>

        {/* Breakdown by category */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-white/70">
              Desglose por categoría
            </span>
            <span className="text-[11px] font-mono text-white/50">
              {activeSegments.length}{" "}
              {activeSegments.length === 1 ? "categoría activa" : "categorías activas"}
            </span>
          </div>

          {activeSegments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-white/40 italic">
              Sin ventas registradas en esta fecha.
            </div>
          ) : (
            <ul className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {activeSegments.map((segment) => {
                const color = colorMap.get(segment.category) ?? "#C25E36";
                const percentage =
                  day.total > 0 ? Math.round((segment.total / day.total) * 100) : 0;

                return (
                  <li
                    key={segment.category}
                    className="rounded-2xl border border-white/10 bg-white/5 p-3.5 space-y-2 hover:bg-white/[0.08] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2.5 font-medium text-sm text-white truncate">
                        <span
                          className="inline-block h-3 w-3 rounded-[4px] shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate">{segment.category}</span>
                      </span>
                      <span className="font-mono font-bold text-sm text-white tabular-nums shrink-0">
                        {formatCurrency(segment.total)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%`, backgroundColor: color }}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-xs font-mono text-white/60 shrink-0">
                        <span>
                          {segment.quantity} {segment.quantity === 1 ? "ud" : "uds"}
                        </span>
                        <span>·</span>
                        <span className="text-white/80 font-bold">{percentage}%</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl border border-white/10 bg-white/10 hover:bg-white/15 py-3 text-sm font-semibold text-white transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Stacked daily revenue by category, rebuilt on Recharts. It fetches its own
 * window (`useSalesByCategoryDaily`) and derives the title, axis and series from
 * `startDate`/`endDate`, so it no longer hardcodes a month.
 */
export function CategoryStackedChart({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const { data } = useSalesByCategoryDaily(startDate, endDate);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState<number>(500);
  const [selectedDay, setSelectedDay] = useState<StackedDay | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (el.clientWidth > 0) {
      setChartWidth(el.clientWidth);
    }

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.contentRect.width > 0) {
        setChartWidth(Math.round(entry.contentRect.width));
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const days = useMemo(
    () => buildDateWindow(endDate, countDaysInclusive(startDate, endDate)),
    [startDate, endDate],
  );

  const rows = data?.data;
  const series = useMemo(() => buildStackedDailySeries(rows, days), [rows, days]);
  const colorMap = useMemo(
    () => buildCategoryColorMap(rows?.map((row) => row.category)),
    [rows],
  );
  const categories = useMemo(() => Array.from(colorMap.keys()), [colorMap]);

  const chartData = useMemo<CategoryChartRow[]>(
    () =>
      series.map((day) => {
        const row: CategoryChartRow = { date: day.date, total: day.total };
        for (const segment of day.segments) {
          row[segment.category] = segment.total;
        }
        return row;
      }),
    [series],
  );

  const tickInterval = days.length <= 7 ? 0 : days.length <= 15 ? 1 : 4;
  const barSize = days.length <= 7 ? 32 : days.length <= 15 ? 20 : 10;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-2">
        <p
          data-testid="category-chart-title"
          className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground"
        >
          Ingresos por categoría
        </p>
        <span
          data-testid="category-chart-range"
          className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-primary"
        >
          Últimos {days.length} días
        </span>
      </div>

      <div
        ref={containerRef}
        data-testid="category-stacked-chart"
        data-day-count={series.length}
        data-start-date={startDate}
        data-end-date={endDate}
        className="mt-4 min-h-0 w-full flex-1"
      >
        <BarChart
          width={chartWidth}
          height={300}
          data={chartData}
          barSize={barSize}
          margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
          className="cursor-pointer"
          onClick={(state) => {
            const index =
              typeof state?.activeTooltipIndex === "number"
                ? state.activeTooltipIndex
                : typeof state?.activeIndex === "number"
                ? state.activeIndex
                : -1;
            if (index >= 0 && series[index]) {
              setSelectedDay(series[index]);
            }
          }}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 3"
            strokeOpacity={0.4}
          />
          <XAxis
            dataKey="date"
            interval={tickInterval}
            tickFormatter={formatCategoryAxisTick}
            tickLine={false}
            axisLine={{ stroke: "var(--border)", strokeOpacity: 0.5 }}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            offset={12}
            allowEscapeViewBox={{ x: false, y: true }}
            cursor={{ fill: "var(--primary)", fillOpacity: 0.07, rx: 6, ry: 6 }}
            content={<CategoryTooltipContent />}
          />
          {categories.map((category) => (
            <Bar
              key={category}
              dataKey={category}
              stackId="revenue"
              fill={colorMap.get(category)}
              stroke="var(--card)"
              strokeWidth={1.5}
              isAnimationActive={false}
              cursor="pointer"
              onClick={(barData) => {
                const date = (barData?.payload as CategoryChartRow | undefined)?.date;
                const match = series.find((s) => s.date === date);
                if (match) setSelectedDay(match);
              }}
            />
          ))}
        </BarChart>
      </div>

      {/* Day Detail Mini Modal */}
      <CategoryDayDetailModal
        day={selectedDay}
        onClose={() => setSelectedDay(null)}
        colorMap={colorMap}
      />
    </div>
  );
}
