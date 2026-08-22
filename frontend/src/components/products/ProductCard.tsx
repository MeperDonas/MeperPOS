"use client";

import Image from "next/image";
import { cn, formatCurrency } from "@/lib/utils";
import { AlertTriangle, Package, Power, RotateCcw, Star, Edit3 } from "lucide-react";

type ProductCardData = {
  id: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  stock: number;
  salePrice: number;
  costPrice?: number;
  minStock?: number;
  category?: { name: string } | null;
  active?: boolean;
};

interface ProductCardProps {
  product: ProductCardData;
  mode: "pos" | "inventory";
  onClick?: () => void;
  onDelete?: () => void;
  onReactivate?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

/**
 * Status chip (single luminous dot) that renders ON the image only.
 * Only the status chip + (POS) the favorite star live on top of the photo.
 */
function StatusChip({ product, isInactive }: { product: ProductCardData; isInactive: boolean }) {
  const isOutOfStock = product.stock === 0;
  const hasMinStock = typeof product.minStock === "number";
  const isLowStock = hasMinStock && product.stock > 0 && product.stock <= (product.minStock as number);

  if (isInactive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-white/95 px-2 py-0.5 font-mono text-[10px] font-bold text-foreground shadow-xs backdrop-blur-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        Inactivo
      </span>
    );
  }

  if (isOutOfStock) {
    return (
      <span
        data-testid="stock-alert-icon"
        className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white/95 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-600 shadow-xs backdrop-blur-xs"
      >
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        Agotado
      </span>
    );
  }

  if (isLowStock) {
    return (
      <span
        data-testid="stock-alert-icon"
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white/95 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-700 shadow-xs backdrop-blur-xs"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Stock bajo
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/95 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700 shadow-xs backdrop-blur-xs">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Activo
    </span>
  );
}

/** Dual Bento metrics: PRECIO (COP, JetBrains Mono) + STOCK with bar. */
function DualMetrics({ product }: { product: ProductCardData }) {
  const isOutOfStock = product.stock === 0;
  const hasMinStock = typeof product.minStock === "number";
  const isLowStock = hasMinStock && product.stock > 0 && product.stock <= (product.minStock as number);

  const stockPercentage = Math.min(
    100,
    Math.max(8, (product.stock / Math.max(1, (product.minStock ?? 5) * 3)) * 100),
  );

  const barClass = isOutOfStock
    ? "bg-rose-500"
    : isLowStock
      ? "bg-amber-500"
      : "bg-emerald-500";

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="flex flex-col justify-center rounded-xl border border-border/40 bg-muted/40 p-2">
        <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          Precio
        </span>
        <span className="truncate font-mono text-[13px] font-extrabold text-foreground">
          {formatCurrency(product.salePrice)}
        </span>
      </div>
      <div className="flex flex-col justify-center rounded-xl border border-border/40 bg-muted/40 p-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            Stock
          </span>
          <span className="font-mono text-[11px] font-bold text-foreground">
            {product.stock} uds.
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all duration-300", barClass)}
            style={{ width: `${stockPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function ProductCard({
  product,
  mode,
  onClick,
  onDelete,
  onReactivate,
  isFavorite = false,
  onToggleFavorite,
}: ProductCardProps) {
  const isInactive = product.active === false;
  const isActive = !isInactive;

  const categoryLabel = product.category?.name ?? null;
  const hasCategory = categoryLabel !== null && categoryLabel.length > 0;

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  if (mode === "inventory") {
    const isReactivate = isInactive;
    const footerHandler = isReactivate ? onReactivate : onDelete;

    return (
      <div
        className={cn(
          "group relative flex flex-col justify-between gap-3 rounded-3xl border border-border/80 bg-card p-3.5 shadow-xs transition-all duration-200",
          "hover:border-primary/40 hover:shadow-md",
          !isActive && "opacity-60 bg-muted/20",
        )}
      >
        {/* Image frame — only the status chip sits on it */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border/50 bg-muted/20">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-10 w-10 text-muted-foreground/40" />
            </div>
          )}
          <div className="absolute left-2 top-2">
            <StatusChip product={product} isInactive={isInactive} />
          </div>
        </div>

        {/* Info body (category, name, sku below name) */}
        <div className="flex flex-col gap-1 px-1">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
            {hasCategory ? categoryLabel : "Sin categoría"}
          </span>
          <h3 className="line-clamp-2 min-h-[40px] text-[14px] font-bold leading-snug text-foreground">
            {product.name}
          </h3>
          {product.sku && (
            <span className="font-mono text-[10px] font-medium text-muted-foreground">
              {product.sku}
            </span>
          )}
        </div>

        {/* Dual metrics PRECIO + STOCK */}
        <DualMetrics product={product} />

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          {onClick && (
            <button
              type="button"
              onClick={onClick}
              aria-label={`Editar producto: ${product.name}`}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-dark active:scale-95"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Editar</span>
            </button>
          )}

          {footerHandler && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                footerHandler();
              }}
              title={isReactivate ? "Reactivar producto" : "Desactivar producto"}
              className={cn(
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-xs transition active:scale-90",
                isReactivate
                  ? "border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  : "border-border/80 text-muted-foreground hover:border-danger/40 hover:bg-rose-50 hover:text-danger dark:hover:bg-rose-950/40",
              )}
            >
              {isReactivate ? (
                <RotateCcw className="h-4 w-4" />
              ) : (
                <Power className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  // POS Mode
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleCardKeyDown}
      className={cn(
        "group relative flex flex-col justify-between gap-3 rounded-3xl border border-border/80 bg-card p-3.5 shadow-xs transition-all duration-200 cursor-pointer",
        "hover:border-primary/40 hover:shadow-md active:scale-[0.98]",
        !isActive && "opacity-60 pointer-events-none",
      )}
    >
      {/* Image frame — status chip + favorite star only */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border/50 bg-muted/20">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}

        <div className="absolute left-2 top-2">
          <StatusChip product={product} isInactive={isInactive} />
        </div>

        {/* Favorite star — the only other element allowed on the image */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={cn(
              "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-white/95 shadow-xs backdrop-blur-xs transition-all",
              isFavorite
                ? "border-amber-300 text-amber-500"
                : "text-muted-foreground hover:text-amber-500",
            )}
          >
            <Star className={cn("h-3.5 w-3.5", isFavorite && "fill-current")} />
          </button>
        )}
      </div>

      {/* Info body (category, name, sku below name) */}
      <div className="flex flex-col gap-1 px-1">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
          {hasCategory ? categoryLabel : "General"}
        </span>
        <h3 className="line-clamp-2 min-h-[40px] text-[14px] font-bold leading-snug text-foreground">
          {product.name}
        </h3>
        {product.sku && (
          <span className="font-mono text-[10px] font-medium text-muted-foreground">
            {product.sku}
          </span>
        )}
      </div>

      {/* Dual metrics PRECIO + STOCK */}
      <DualMetrics product={product} />

      {/* Add button */}
      <div className="flex items-center pt-1">
        <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-dark active:scale-95">
          + Agregar
        </span>
      </div>
    </div>
  );
}
