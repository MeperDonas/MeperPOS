"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
 * breakdown. Centers smoothly above the active bar with a downward pointer caret,
 * clamped within the chart bounds so it never overflows left or right edges.
 */
export function CategoryTooltipContent({
  active,
  payload,
  coordinate,
  viewBox,
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

  // Position math: center on coordinate.x, clamping within chart width
  const x = coordinate?.x;
  const chartWidth = viewBox?.width ?? 0;
  const estimatedHalfWidth = 85;
  const minMargin = 8;

  let clampPx = 0;
  if (typeof x === "number" && chartWidth > 0) {
    if (x - estimatedHalfWidth < minMargin) {
      clampPx = minMargin - (x - estimatedHalfWidth);
    } else if (x + estimatedHalfWidth > chartWidth - minMargin) {
      clampPx = chartWidth - minMargin - (x + estimatedHalfWidth);
    }
  }

  return (
    <div
      data-testid="category-tooltip"
      className="relative min-w-[170px] rounded-xl border border-white/10 bg-black/90 px-3.5 py-2.5 shadow-2xl backdrop-blur-md"
      style={{
        transform: `translateX(calc(-50% + ${clampPx}px))`,
      }}
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
 * Mini-modal triggered when clicking a day on the bar chart.
 * Follows the dark-glass theme of the tooltip with complete category breakdown,
 * units sold, and proportion progress bars.
 */
export function CategoryDayDetailModal({
  day,
  onClose,
  colorMap,
}: CategoryDayDetailModalProps) {
  useEffect(() => {
    if (!day) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [day, onClose]);

  if (!day) return null;

  const totalQuantity = day.segments.reduce((sum, s) => sum + s.quantity, 0);
  const activeSegments = day.segments.filter((s) => s.total > 0);

  return (
    <div
      data-testid="category-day-detail-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="category-day-detail-modal"
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-black/95 p-5 shadow-2xl backdrop-blur-md text-white"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
              Detalle del día
            </span>
            <h3 className="text-base font-bold text-white capitalize mt-0.5">
              {formatCategoryTooltipDate(day.date)}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle"
            className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Total Highlight */}
        <div className="mt-3.5 rounded-xl border border-white/10 bg-white/5 p-3.5 text-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
            Total recaudado
          </span>
          <p className="mt-0.5 text-2xl font-black font-mono text-white tabular-nums tracking-tight">
            {formatCurrency(day.total)}
          </p>
          <div className="mt-1 flex items-center justify-center gap-2 text-[11px] text-white/60">
            <span>
              {totalQuantity} {totalQuantity === 1 ? "unidad" : "unidades"}
            </span>
            <span>·</span>
            <span>
              {activeSegments.length}{" "}
              {activeSegments.length === 1 ? "categoría activa" : "categorías activas"}
            </span>
          </div>
        </div>

        {/* Breakdown by category */}
        <div className="mt-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-2">
            Desglose por categoría
          </span>

          {activeSegments.length === 0 ? (
            <p className="py-4 text-center text-xs text-white/40 italic">
              Sin ventas registradas en esta fecha.
            </p>
          ) : (
            <ul className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {activeSegments.map((segment) => {
                const color = colorMap.get(segment.category) ?? "#C25E36";
                const percentage =
                  day.total > 0 ? Math.round((segment.total / day.total) * 100) : 0;

                return (
                  <li
                    key={segment.category}
                    className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-medium text-white/90 truncate">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-[3px] shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate">{segment.category}</span>
                      </span>
                      <span className="font-mono font-bold text-white tabular-nums shrink-0">
                        {formatCurrency(segment.total)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${percentage}%`, backgroundColor: color }}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/60 shrink-0">
                        <span>{segment.quantity} u</span>
                        <span>({percentage}%)</span>
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
          className="mt-4 w-full rounded-xl border border-white/10 bg-white/10 hover:bg-white/15 py-2 text-xs font-semibold text-white transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
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
            offset={0}
            position={{ y: 8 }}
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
