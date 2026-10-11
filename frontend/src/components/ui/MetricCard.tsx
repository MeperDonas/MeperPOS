import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Area, AreaChart } from "recharts";
import { cn } from "@/lib/utils";

export type MetricCardTone = "primary" | "accent" | "rose" | "green" | "blue";

export interface MetricCardDelta {
  percentage: number | null;
  label?: string;
}

export interface MetricCardAction {
  label: string;
  onClick: () => void;
}

interface MetricCardProps {
  label: string;
  value: string;
  helper: string;
  delta?: MetricCardDelta;
  tone?: MetricCardTone;
  /** Last 7 daily values (oldest → newest) rendered as an inline sparkline. */
  sparkline?: number[];
  /** Optional CTA rendered at the card footer (e.g. "Reordenar"). */
  action?: MetricCardAction;
}

const toneCardClasses: Record<MetricCardTone, string> = {
  primary: "border-primary/25 bg-card hover:border-primary/45 transition-colors",
  accent: "border-accent/25 bg-card hover:border-accent/45 transition-colors",
  rose: "border-rose-500/25 bg-card hover:border-rose-500/45 transition-colors",
  green: "border-green-500/25 bg-card hover:border-green-500/45 transition-colors",
  blue: "border-blue-500/25 bg-card hover:border-blue-500/45 transition-colors",
};

const toneValueClasses: Record<MetricCardTone, string> = {
  primary: "text-primary",
  accent: "text-accent",
  rose: "text-rose-500",
  green: "text-green-500",
  blue: "text-blue-500",
};

const toneSparkColor: Record<MetricCardTone, string> = {
  primary: "#C25E36",
  accent: "#C25E36",
  rose: "#F43F5E",
  green: "#22C55E",
  blue: "#3B82F6",
};

const toneActionClasses: Record<MetricCardTone, string> = {
  primary: "border-primary/30 text-primary hover:bg-primary/10",
  accent: "border-accent/30 text-accent hover:bg-accent/10",
  rose: "border-rose-500/30 text-rose-500 hover:bg-rose-500/10",
  green: "border-green-500/30 text-green-500 hover:bg-green-500/10",
  blue: "border-blue-500/30 text-blue-500 hover:bg-blue-500/10",
};

const NEUTRAL_SPARK_COLOR = "#94A3B8";

/**
 * Tiny axis-less area chart used as a KPI sparkline. It sets a percentage width
 * directly on the chart (instead of wrapping it in a ResponsiveContainer) so it
 * stays fluid without needing a ResizeObserver — which jsdom does not provide.
 */
function MetricSparkline({ values, color }: { values: number[]; color: string }) {
  const data = values.map((value, index) => ({ index, value }));

  return (
    <div data-testid="metric-sparkline" className="mt-2 h-8 w-full">
      <AreaChart
        width="100%"
        height={32}
        data={data}
        margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
      >
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={color}
          fillOpacity={0.15}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </div>
  );
}

/**
 * Shared MetricCard for reports and dashboard. Matches the canonical
 * Kinetic Bento pattern: mono uppercase label + JetBrains Mono extrabold
 * value + helper + optional delta pill, with tone alternation.
 *
 * When no `tone` is provided it renders exactly like the historical reports
 * MetricCard (neutral card surface), so refactors are behavior-preserving.
 * `sparkline` and `action` are additive and optional; omitting both keeps the
 * original markup unchanged.
 */
export function MetricCard({
  label,
  value,
  helper,
  delta,
  tone,
  sparkline,
  action,
}: MetricCardProps) {
  const percentage = delta?.percentage ?? null;
  const hasBaseline = percentage !== null;
  const positive = (percentage ?? 0) >= 0;
  const deltaLabel =
    delta?.label ??
    (percentage === null
      ? "Sin base"
      : `${positive ? "+" : ""}${percentage.toFixed(1)}%`);

  return (
    <div
      data-tone={tone ?? "neutral"}
      className={
        tone
          ? cn(
              "rounded-3xl border p-5 shadow-xs flex flex-col justify-between",
              toneCardClasses[tone],
            )
          : "rounded-3xl border border-border/80 bg-card p-5 shadow-xs flex flex-col justify-between"
      }
    >
      <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-2xl font-extrabold font-mono text-foreground tracking-tight",
          tone && toneValueClasses[tone],
        )}
      >
        {value}
      </p>
      {sparkline && sparkline.length > 0 && (
        <MetricSparkline
          values={sparkline}
          color={tone ? toneSparkColor[tone] : NEUTRAL_SPARK_COLOR}
        />
      )}
      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        {delta ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-bold",
              !hasBaseline
                ? "bg-muted text-muted-foreground border border-border"
                : positive
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
            )}
          >
            {hasBaseline && (
              <span aria-hidden="true">
                {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              </span>
            )}
            {deltaLabel}
          </span>
        ) : (
          <span />
        )}
        <span className="text-right text-[11px] text-muted-foreground">{helper}</span>
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={cn(
            "mt-3 inline-flex items-center gap-1 self-start rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors",
            tone
              ? toneActionClasses[tone]
              : "border-border/60 text-foreground hover:bg-muted",
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
