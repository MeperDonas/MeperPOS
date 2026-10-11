"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart } from "recharts";
import { useSalesByPaymentMethod } from "@/hooks/useReports";
import { formatCurrency, formatPaymentMethod } from "@/lib/utils";

/**
 * The dashboard only ever reports three payment methods. There is no "Otros"
 * bucket: an unknown method is simply not invented here.
 */
const PAYMENT_METHODS = [
  { method: "CASH", label: formatPaymentMethod("CASH"), color: "#C25E36" },
  { method: "CARD", label: formatPaymentMethod("CARD"), color: "#3B82F6" },
  { method: "TRANSFER", label: formatPaymentMethod("TRANSFER"), color: "#22C55E" },
] as const;

interface PaymentSlice {
  method: string;
  name: string;
  value: number;
  color: string;
  percentage: number;
  [key: string]: string | number;
}

/**
 * Donut of revenue by payment method for the selected window. The legend shows
 * each method's share and the centre shows the window total.
 */
export function PaymentMethodsCard({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const { data } = useSalesByPaymentMethod(startDate, endDate);

  const { slices, total } = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of data?.data ?? []) {
      const key = row.paymentMethod?.toUpperCase().trim();
      if (!key) continue;
      totals.set(key, (totals.get(key) ?? 0) + (row.total ?? 0));
    }

    const grandTotal = PAYMENT_METHODS.reduce(
      (sum, entry) => sum + (totals.get(entry.method) ?? 0),
      0,
    );

    const built: PaymentSlice[] = PAYMENT_METHODS.map((entry) => {
      const value = totals.get(entry.method) ?? 0;
      return {
        method: entry.method,
        name: entry.label,
        value,
        color: entry.color,
        percentage: grandTotal > 0 ? Math.round((value / grandTotal) * 100) : 0,
      };
    });

    return { slices: built, total: grandTotal };
  }, [data]);

  return (
    <div
      data-testid="payment-methods-card"
      className="flex h-full min-h-0 flex-col"
    >
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
        Métodos de pago
      </p>

      <div className="mt-3 flex min-h-0 flex-1 items-center gap-4">
        <div
          data-testid="payment-methods-chart"
          className="relative h-[132px] w-[132px] shrink-0"
        >
          <PieChart width={132} height={132}>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={40}
              outerRadius={62}
              paddingAngle={2}
              isAnimationActive={false}
            >
              {slices.map((slice) => (
                <Cell key={slice.method} fill={slice.color} />
              ))}
            </Pie>
          </PieChart>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total
            </span>
            <span
              data-testid="payment-methods-total"
              className="font-mono text-sm font-extrabold text-foreground tabular-nums"
            >
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-1.5">
          {slices.map((slice) => (
            <li
              key={slice.method}
              data-testid="payment-method-row"
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="truncate font-medium text-foreground">
                  {slice.name}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span
                  data-testid="payment-method-percentage"
                  className="font-mono text-[11px] font-bold text-muted-foreground tabular-nums"
                >
                  {slice.percentage}%
                </span>
                <span className="font-mono text-[11px] font-bold text-foreground tabular-nums">
                  {formatCurrency(slice.value)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
