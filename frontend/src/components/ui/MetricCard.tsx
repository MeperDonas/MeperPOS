import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type MetricCardTone = "primary" | "accent" | "rose";

export interface MetricCardDelta {
  percentage: number | null;
  label?: string;
}

interface MetricCardProps {
  label: string;
  value: string;
  helper: string;
  delta?: MetricCardDelta;
  tone?: MetricCardTone;
}

const toneCardClasses: Record<MetricCardTone, string> = {
  primary: "border-primary/25 bg-card hover:border-primary/45 transition-colors",
  accent: "border-accent/25 bg-card hover:border-accent/45 transition-colors",
  rose: "border-rose-500/25 bg-card hover:border-rose-500/45 transition-colors",
};

const toneValueClasses: Record<MetricCardTone, string> = {
  primary: "text-primary",
  accent: "text-accent",
  rose: "text-rose-500",
};

/**
 * Shared MetricCard for reports and dashboard. Matches the canonical
 * Kinetic Bento pattern: mono uppercase label + JetBrains Mono extrabold
 * value + helper + optional delta pill, with tone alternation.
 *
 * When no `tone` is provided it renders exactly like the historical reports
 * MetricCard (neutral card surface), so refactors are behavior-preserving.
 */
export function MetricCard({
  label,
  value,
  helper,
  delta,
  tone,
}: MetricCardProps) {
  const positive = (delta?.percentage ?? 0) >= 0;

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
      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        {delta ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-bold",
              positive
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
            )}
          >
            <span aria-hidden="true">
              {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            </span>
            {delta.label ??
              (delta.percentage === null
                ? "Sin base"
                : `${positive ? "+" : ""}${delta.percentage.toFixed(1)}%`)}
          </span>
        ) : (
          <span />
        )}
        <span className="text-right text-[11px] text-muted-foreground">{helper}</span>
      </div>
    </div>
  );
}
