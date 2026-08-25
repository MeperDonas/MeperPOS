"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  CATEGORY_CHART_PALETTE,
  buildCategoryColorMap,
  buildStackedDailySeries,
} from "@/lib/dashboard";
import type { SaleByCategoryDaily } from "@/types";

const EMPTY_SEGMENT_COLOR = "#3D3D4A";

export function CategoryStackedChart({
  data,
  days,
}: {
  data: SaleByCategoryDaily[];
  days: string[];
}) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const series = useMemo(() => buildStackedDailySeries(data, days), [data, days]);
  const colorMap = useMemo(
    () => buildCategoryColorMap(data?.map((row) => row.category)),
    [data],
  );
  const maxDayTotal = useMemo(
    () => Math.max(1, ...series.map((day) => day.total)),
    [series],
  );

  const hoveredIndex = useMemo(
    () => series.findIndex((day) => day.date === hoveredDate),
    [hoveredDate, series],
  );
  const hoveredDay = hoveredIndex >= 0 ? series[hoveredIndex] : null;

  /**
   * Clamps the tooltip horizontally so it never overflows the chart edges on any screen size.
   */
  const ratio = series.length > 1 && hoveredIndex >= 0 ? hoveredIndex / (series.length - 1) : 0.5;
  const tooltipTranslate =
    ratio > 0.65
      ? "-translate-x-full"
      : ratio < 0.35
        ? "translate-x-0"
        : "-translate-x-1/2";

  const slot = series.length > 0 ? 400 / series.length : 0;
  const barWidth = Math.max(3, slot * 0.72);

  const dayLabel = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    const safeDate = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0));
    const weekday = capitalizeLabel(
      new Intl.DateTimeFormat("es-CO", {
        weekday: "short",
        timeZone: "America/Bogota",
      })
        .format(safeDate)
        .replace(".", ""),
    );
    const dayNumber = new Intl.DateTimeFormat("es-CO", {
      day: "numeric",
      timeZone: "America/Bogota",
    }).format(safeDate);
    return `${weekday} ${dayNumber}`;
  };

  return (
    <div className="h-40 w-full relative">
      <svg
        className="w-full h-32"
        preserveAspectRatio="none"
        viewBox="0 0 400 100"
        role="img"
        aria-label="Ventas por categoría del mes"
      >
        {series.map((day, index) => {
          const dayHeight = dayHeightFor(day.total, maxDayTotal);
          const bars = segmentBars(day.segments, dayHeight, colorMap);
          const x = index * slot + (slot - barWidth) / 2;

          return (
            <g key={day.date}>
              {bars.map((bar) => (
                <rect
                  key={`${day.date}:${bar.category}`}
                  data-testid={bar.total > 0 ? "category-segment" : "category-empty-bar"}
                  data-category={bar.category}
                  x={x}
                  y={bar.y}
                  width={barWidth}
                  height={bar.height}
                  rx={1}
                  fill={bar.color}
                  className="transition-opacity"
                  style={hoveredDate && hoveredDate !== day.date ? { opacity: 0.35 } : undefined}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {/* Hover regions per day */}
      <div className="absolute top-0 left-0 h-32 w-full flex">
        {series.map((day) => (
          <div
            key={day.date}
            data-testid="category-daily-bar"
            className="flex-1 cursor-pointer"
            onMouseEnter={() => setHoveredDate(day.date)}
            onMouseLeave={() => setHoveredDate(null)}
            onClick={() => setHoveredDate((curr) => curr === day.date ? null : day.date)}
            onTouchStart={() => setHoveredDate(day.date)}
          />
        ))}
      </div>

      {/* Tooltip with day total + category breakdown */}
      {hoveredDay && (
        <div
          data-testid="category-tooltip"
          className={`pointer-events-none absolute z-30 min-w-[180px] ${tooltipTranslate} rounded-lg border border-white/10 bg-black/90 px-3 py-2 shadow-xl backdrop-blur-sm`}
          style={{
            left: `${hoveredIndex >= 0 ? (hoveredIndex / Math.max(series.length - 1, 1)) * 100 : 50}%`,
            top: "6px",
          }}
        >
          <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-white/60">
            {dayLabel(hoveredDay.date)}
          </p>
          <p className="mt-1 text-center text-lg font-bold text-white tabular-nums">
            {formatCurrency(hoveredDay.total)}
          </p>
          {hoveredDay.segments.length > 0 && (
            <ul className="mt-2 divide-y divide-white/10">
              {hoveredDay.segments.map((segment) => (
                <li
                  key={segment.category}
                  className="flex items-center justify-between gap-3 py-1 text-[11px]"
                >
                  <span className="flex items-center gap-1.5 font-medium text-white/70">
                    <span
                      className="inline-block h-2 w-2 rounded-[2px]"
                      style={{ backgroundColor: colorMap.get(segment.category) }}
                    />
                    {segment.category}
                  </span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {formatCurrency(segment.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Date labels — spaced across the month so ~30 days don't crowd */}
      <div className="mt-2 flex px-1 text-[8px] uppercase tracking-wider text-muted-foreground/60">
        {series.map((day) => {
          const dayNumber = Number(day.date.split("-")[2]);
          const showLabel = dayNumber === 1 || dayNumber % 5 === 0;

          return (
            <span
              key={day.date}
              data-testid="category-day-label"
              className="flex-1 text-center leading-none"
            >
              {showLabel ? dayNumber : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function capitalizeLabel(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

/**
 * Visible bar height for a day against the series max, mirroring `chartHeight`
 * so the dashboard stays visually consistent with the simple revenue bars.
 */
function dayHeightFor(total: number, max: number): number {
  if (total <= 0 || max <= 0) return 18;
  const scaled = Math.round((total / max) * 100);
  return Math.max(18, Math.min(scaled, 100));
}

interface SegmentBar {
  y: number;
  height: number;
  color: string;
  category: string;
  total: number;
}

/**
 * Splits a day's visible height into proportional segment bars, stacking them
 * from the baseline (y=100) upward. Days without sales render a single muted
 * placeholder segment so the day still has a visible bar.
 */
function segmentBars(
  segments: Array<{ category: string; total: number; quantity: number }>,
  dayHeight: number,
  colorMap: Map<string, string>,
): SegmentBar[] {
  const visible = segments.filter((segment) => segment.total > 0);
  if (visible.length === 0) {
    return [
      {
        y: 100 - dayHeight,
        height: dayHeight,
        color: EMPTY_SEGMENT_COLOR,
        category: "Sin ventas",
        total: 0,
      },
    ];
  }

  const totalVisible = visible.reduce((sum, segment) => sum + segment.total, 0);
  const top = 100 - dayHeight;
  let cursor = 100;
  const bars: SegmentBar[] = [];

  visible.forEach((segment, index) => {
    const isLast = index === visible.length - 1;
    let height =
      totalVisible > 0
        ? (segment.total / totalVisible) * dayHeight
        : dayHeight / visible.length;

    if (isLast) {
      height = Math.max(2, cursor - top);
    } else {
      height = Math.max(2, Math.min(dayHeight, height));
    }

    bars.push({
      y: cursor - height,
      height,
      color: colorMap.get(segment.category) ?? CATEGORY_CHART_PALETTE[0],
      category: segment.category,
      total: segment.total,
    });
    cursor -= height;
  });

  return bars;
}
