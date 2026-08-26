"use client";

import Image from "next/image";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
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
  /** Active promotion — when present, effectiveSalePrice is the selling price */
  promotionType?: string | null;
  promotionValue?: number | null;
  effectiveSalePrice?: number | null;
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
 * Status chip (single luminous dot) that renders on top of the image.
 */
function StatusChip({ product, isInactive }: { product: ProductCardData; isInactive: boolean }) {
  const isOutOfStock = product.stock === 0;
  const hasMinStock = typeof product.minStock === "number";
  const isLowStock = hasMinStock && product.stock > 0 && product.stock <= (product.minStock as number);

  if (isInactive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/90 dark:bg-card/90 px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground shadow-xs backdrop-blur-md">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        Inactivo
      </span>
    );
  }

  if (isOutOfStock) {
    return (
      <span
        data-testid="stock-alert-icon"
        className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 dark:border-rose-900/60 bg-background/90 dark:bg-card/90 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-600 dark:text-rose-400 shadow-xs backdrop-blur-md"
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
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 dark:border-amber-900/60 bg-background/90 dark:bg-card/90 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-700 dark:text-amber-400 shadow-xs backdrop-blur-md"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Stock bajo
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-900/60 bg-background/90 dark:bg-card/90 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-400 shadow-xs backdrop-blur-md">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Activo
    </span>
  );
}

/**
 * Modern responsive metrics strip: PRECIO (prominent left) + STOCK status badge (right).
 * Prevents text overlap and truncation at any card width.
 */
function DualMetrics({ product }: { product: ProductCardData }) {
  const isOutOfStock = product.stock === 0;
  const hasMinStock = typeof product.minStock === "number";
  const isLowStock = hasMinStock && product.stock > 0 && product.stock <= (product.minStock as number);

  const hasPromo =
    typeof product.effectiveSalePrice === "number" &&
    Number(product.effectiveSalePrice) !== Number(product.salePrice);

  // Approximate discount as a whole percentage (rounded) of the list price.
  const discountPercent = hasPromo
    ? Math.max(
        0,
        Math.round(
          100 -
            (Number(product.effectiveSalePrice) / Number(product.salePrice)) *
              100,
        ),
      )
    : 0;

  const stockBadgeClass = isOutOfStock
    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
    : isLowStock
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border/50 bg-muted/30 p-2 sm:p-2.5">
      {/* Header: PRECIO (left) + Stock badge (right) */}
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          Precio
        </span>
        <span
          className={cn(
            "inline-flex shrink-0 items-center font-mono text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded-md border leading-none",
            stockBadgeClass,
          )}
        >
          {product.stock} uds.
        </span>
      </div>

      {/* Pricing: Effective price + right-aligned Oferta badge */}
      {hasPromo ? (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-1.5">
            <span
              data-testid="offer-effective-price"
              className="font-mono text-sm sm:text-base font-extrabold leading-none tracking-tight text-foreground truncate"
            >
              {formatCurrency(Number(product.effectiveSalePrice))}
            </span>
            <Badge
              variant="danger"
              className="shrink-0 text-[8px] sm:text-[9px] px-1.5 py-0.5 font-mono uppercase leading-none"
            >
              Oferta{discountPercent > 0 ? ` -${discountPercent}%` : ""}
            </Badge>
          </div>
          <s
            data-testid="offer-list-price"
            className="font-mono text-[10px] sm:text-[11px] font-semibold text-muted-foreground line-through"
          >
            {formatCurrency(Number(product.salePrice))}
          </s>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm sm:text-base font-extrabold leading-none tracking-tight text-foreground">
            {formatCurrency(Number(product.salePrice))}
          </span>
        </div>
      )}
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
          "group relative flex flex-col justify-between gap-2.5 rounded-2xl border border-border/70 bg-card p-3 shadow-xs transition-all duration-200",
          "hover:border-primary/40 hover:shadow-md",
          !isActive && "opacity-60 bg-muted/20",
        )}
      >
        {/* Image frame */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border/40 bg-muted/20">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-muted/10 to-muted/30">
              <Package className="h-9 w-9 text-muted-foreground/30 transition-transform duration-300 group-hover:scale-110" />
            </div>
          )}
          <div className="absolute left-2 top-2">
            <StatusChip product={product} isInactive={isInactive} />
          </div>
        </div>

        {/* Info body (category, name, sku below name) */}
        <div className="flex flex-col gap-1 px-0.5">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary truncate">
            {hasCategory ? categoryLabel : "Sin categoría"}
          </span>
          <h3 className="line-clamp-2 min-h-[36px] text-[13px] sm:text-[14px] font-bold leading-snug text-foreground">
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
        <div className="flex items-center gap-2 pt-0.5">
          {onClick && (
            <button
              type="button"
              onClick={onClick}
              aria-label={`Editar producto: ${product.name}`}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-primary-dark active:scale-95"
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
              aria-label={isReactivate ? "Reactivar producto" : "Desactivar producto"}
              className={cn(
                "inline-flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-xl border shadow-xs transition-all active:scale-90",
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
        "group relative flex flex-col justify-between gap-2.5 rounded-2xl border border-border/70 bg-card p-3 shadow-xs transition-all duration-200 cursor-pointer",
        "hover:border-primary/40 hover:shadow-md active:scale-[0.98]",
        !isActive && "opacity-60 pointer-events-none",
      )}
    >
      {/* Image frame — status chip + favorite star only */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border/40 bg-muted/20">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-muted/10 to-muted/30">
            <Package className="h-9 w-9 text-muted-foreground/30 transition-transform duration-300 group-hover:scale-110" />
          </div>
        )}

        <div className="absolute left-2 top-2">
          <StatusChip product={product} isInactive={isInactive} />
        </div>

        {/* Favorite star */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            aria-label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
            className={cn(
              "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-background/90 shadow-xs backdrop-blur-md transition-all hover:scale-105 active:scale-90",
              isFavorite
                ? "border-amber-300 text-amber-500 bg-amber-50/90 dark:bg-amber-950/80"
                : "text-muted-foreground hover:text-amber-500",
            )}
          >
            <Star className={cn("h-3.5 w-3.5", isFavorite && "fill-current")} />
          </button>
        )}
      </div>

      {/* Info body (category, name, sku below name) */}
      <div className="flex flex-col gap-1 px-0.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary truncate">
          {hasCategory ? categoryLabel : "General"}
        </span>
        <h3 className="line-clamp-2 min-h-[36px] text-[13px] sm:text-[14px] font-bold leading-snug text-foreground">
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
      <div className="flex items-center pt-0.5">
        <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-primary-dark hover:shadow-primary/20 active:scale-95">
          + Agregar
        </span>
      </div>
    </div>
  );
}
