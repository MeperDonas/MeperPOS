"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  itemLabel?: string;
  isDisabled?: boolean;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  itemLabel = "elemento",
  isDisabled = false,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const clamped = Math.max(1, Math.min(currentPage, totalPages));
  const prev = () => onPageChange(Math.max(1, clamped - 1));
  const next = () => onPageChange(Math.min(totalPages, clamped + 1));

  const hasTotal = typeof totalItems === "number";
  const hasRange = hasTotal && typeof pageSize === "number" && pageSize > 0;
  const rangeStart = hasRange ? (clamped - 1) * pageSize + 1 : 0;
  const rangeEnd = hasRange
    ? Math.min(clamped * pageSize, totalItems as number)
    : 0;
  const pluralSuffix = totalItems !== 1 ? "s" : "";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 font-mono text-xs",
        className,
      )}
    >
      {hasRange ? (
        <p className="text-muted-foreground">
          Mostrando <span className="font-bold text-foreground">{rangeStart} - {rangeEnd}</span> de <span className="font-bold text-foreground">{totalItems}</span>
        </p>
      ) : hasTotal ? (
        <p className="text-muted-foreground">
          <span className="font-bold text-foreground">{totalItems}</span> {itemLabel}
          {pluralSuffix}
        </p>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-1.5 font-mono">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={prev}
          disabled={clamped <= 1 || isDisabled}
          className="px-2.5 rounded-xl font-mono text-xs"
        >
          <ChevronLeft className="h-3.5 w-3.5 mr-1" />
          Anterior
        </Button>
        <span className="px-3 py-1 rounded-xl bg-muted border border-border/60 text-xs font-bold text-foreground">
          {clamped} / {totalPages}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={next}
          disabled={clamped >= totalPages || isDisabled}
          className="px-2.5 rounded-xl font-mono text-xs"
        >
          Siguiente
          <ChevronRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
