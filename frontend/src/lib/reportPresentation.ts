import { formatCurrency } from "@/lib/utils";

export type ReportGranularity = "day" | "month";

export function safeDecimalNumber(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatReportMoney(value: string | number | null | undefined) {
  return formatCurrency(safeDecimalNumber(value));
}

export function adaptiveReportGranularity(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): ReportGranularity {
  if (!startDate || !endDate) return "month";
  const start = Date.parse(`${startDate}T12:00:00Z`);
  const end = Date.parse(`${endDate}T12:00:00Z`);
  const days = Math.max(1, Math.round((end - start) / 86_400_000) + 1);
  return days <= 31 ? "day" : "month";
}
