"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/utils";

export interface RevenueBarPoint {
  key: string;
  total: number;
  count: number;
  isToday: boolean;
  detailDate: string;
  dayAbbreviation: string;
  monthLabel: string;
  height: number;
}

const TODAY_COLOR = "#C25E36";
const BAR_COLOR = "#E2A685";

export function RevenueChart({ data }: { data: RevenueBarPoint[] }) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const hoveredIndex = useMemo(
    () => data.findIndex((bar) => bar.key === hoveredKey),
    [hoveredKey, data],
  );

  const hoveredBar = hoveredIndex >= 0 ? data[hoveredIndex] : null;

  const hoveredPoint = useMemo(() => {
    if (!hoveredBar) {
      return null;
    }

    const xPct =
      data.length > 1 ? (hoveredIndex / (data.length - 1)) * 100 : 50;

    // Marker sits on top of the real consumed bar height for the hovered day.
    const yPct = 100 - hoveredBar.height;

    return { xPct, yPct };
  }, [hoveredBar, hoveredIndex, data.length]);

  const slot = data.length > 0 ? 400 / data.length : 0;
  const barWidth = Math.max(4, slot * 0.5);

  return (
    <div className="h-40 w-full relative">
      <svg
        className="w-full h-32"
        preserveAspectRatio="none"
        viewBox="0 0 400 100"
        role="img"
        aria-label="Ingresos de los últimos días"
      >
        {data.map((bar, index) => {
          const x = index * slot + (slot - barWidth) / 2;
          const y = 100 - bar.height;

          return (
            <rect
              key={bar.key}
              data-testid="revenue-bar"
              x={x}
              y={y}
              width={barWidth}
              height={bar.height}
              rx={2}
              fill={bar.isToday ? TODAY_COLOR : BAR_COLOR}
            />
          );
        })}
      </svg>

      {/* Hover regions for each day */}
      <div className="absolute top-0 left-0 h-32 w-full flex">
        {data.map((bar) => (
          <div
            key={bar.key}
            data-testid="revenue-day"
            className="flex-1"
            onMouseEnter={() => setHoveredKey(bar.key)}
            onMouseLeave={() => setHoveredKey(null)}
          />
        ))}
      </div>

      {/* Marker + exact tooltip */}
      {hoveredBar && hoveredPoint && (
        <div className="pointer-events-none absolute left-0 top-0 h-32 w-full">
          <div
            className="absolute z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
            style={{
              left: `${hoveredPoint.xPct}%`,
              top: `${hoveredPoint.yPct}%`,
            }}
          />

          <div
            className="absolute z-30 min-w-[110px] -translate-x-1/2 -translate-y-full rounded-lg border border-primary/30 bg-card px-3 py-2 shadow-lg"
            style={{
              left: `${hoveredPoint.xPct}%`,
              top: `calc(${hoveredPoint.yPct}% - 12px)`,
            }}
          >
            <p className="text-center text-[10px] font-semibold text-muted-foreground">
              {hoveredBar.detailDate}
            </p>
            <p className="mt-0.5 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {hoveredBar.monthLabel}
            </p>
            <p className="mt-1 text-center text-sm font-bold text-accent">
              {formatCurrency(hoveredBar.total)}
            </p>
            <p className="mt-0.5 text-center text-[10px] font-medium text-muted-foreground">
              {hoveredBar.count} transacciones
            </p>
          </div>
        </div>
      )}

      {/* Date labels */}
      <div className="flex justify-between mt-2 text-[10px] uppercase tracking-wider text-muted-foreground/60 px-1">
        {data.map((bar) => (
          <span key={bar.key}>{bar.dayAbbreviation}</span>
        ))}
      </div>
    </div>
  );
}
