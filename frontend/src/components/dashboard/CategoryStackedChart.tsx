"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis } from "recharts";
import { useSalesByCategoryDaily } from "@/hooks/useReports";
import { formatCurrency } from "@/lib/utils";
import {
  buildCategoryColorMap,
  buildDateWindow,
  buildStackedDailySeries,
  countDaysInclusive,
  formatCategoryAxisTick,
  formatCategoryTooltipDate,
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
            />
          ))}
        </BarChart>
      </div>
    </div>
  );
}
