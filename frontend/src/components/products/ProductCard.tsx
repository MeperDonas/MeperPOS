"use client";

import Image from "next/image";
import { cn, formatCurrency } from "@/lib/utils";
import { Package, Power, RotateCcw, Star, Edit3 } from "lucide-react";

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
  const hasMinStock = typeof product.minStock === "number";
  const isOutOfStock = product.stock === 0;
  const isLowStock = hasMinStock && product.stock > 0 && product.stock <= (product.minStock as number);

  const stockPercentage = Math.min(100, Math.max(8, (product.stock / Math.max(1, (product.minStock ?? 5) * 3)) * 100));

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
          "group relative flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-3 shadow-xs transition-all duration-200",
          "hover:border-primary/40 hover:shadow-md",
          !isActive && "opacity-60 bg-muted/20"
        )}
      >
        {/* Top Image Frame */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white dark:bg-muted/40 border border-border/60 flex items-center justify-center">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-contain p-2 transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-10 w-10 text-muted-foreground/40" />
            </div>
          )}

          {/* Floating Stock Tag */}
          <div className="absolute top-2.5 left-2.5">
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shadow-xs",
                isOutOfStock
                  ? "bg-rose-500 text-white"
                  : isLowStock
                  ? "bg-amber-500 text-white"
                  : "bg-emerald-500 text-white"
              )}
            >
              {isOutOfStock ? "Agotado" : `${product.stock} en stock`}
            </span>
          </div>

          {/* Floating SKU Tag */}
          <div className="absolute top-2.5 right-2.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-card/90 border border-border/60 text-[10px] font-mono font-semibold text-muted-foreground backdrop-blur-xs">
              {product.sku}
            </span>
          </div>
        </div>

        {/* Info Body */}
        <div className="mt-3 flex-1 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">
              {hasCategory ? categoryLabel : "General"}
            </span>
            <h3 className="mt-0.5 text-xs font-bold text-foreground line-clamp-2 min-h-[34px] leading-snug">
              {product.name}
            </h3>
          </div>

          {/* Price & Stock Progress Bar */}
          <div className="mt-3 pt-2.5 border-t border-border/60">
            <div className="flex items-baseline justify-between font-mono">
              <span className="text-sm font-extrabold text-foreground tracking-tight">
                {formatCurrency(product.salePrice)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {product.stock} uds.
              </span>
            </div>

            <div className="mt-1.5 w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  isOutOfStock
                    ? "bg-rose-500"
                    : isLowStock
                    ? "bg-amber-500"
                    : "bg-primary"
                )}
                style={{ width: `${stockPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-3 pt-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onClick}
            className="flex-1 h-8 rounded-xl bg-primary text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-primary-dark active:scale-95 transition-all shadow-xs"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Editar</span>
          </button>

          {footerHandler && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                footerHandler();
              }}
              title={isReactivate ? "Reactivar producto" : "Desactivar producto"}
              className={cn(
                "w-8 h-8 rounded-xl border flex items-center justify-center active:scale-90 transition-all shadow-xs",
                isReactivate
                  ? "border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  : "border-border/80 text-muted-foreground hover:text-danger hover:border-danger/40 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              )}
            >
              {isReactivate ? (
                <RotateCcw className="w-3.5 h-3.5" />
              ) : (
                <Power className="w-3.5 h-3.5" />
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
        "group relative flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-3 shadow-xs transition-all duration-200 cursor-pointer",
        "hover:border-primary/40 hover:shadow-md active:scale-[0.98]",
        !isActive && "opacity-60 pointer-events-none"
      )}
    >
      {/* Top Image Frame */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white dark:bg-muted/40 border border-border/60 flex items-center justify-center">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain p-2 transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}

        {/* Favorite Star Button */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={cn(
              "absolute top-2 right-2 w-7 h-7 rounded-lg border border-border/60 bg-card/90 flex items-center justify-center backdrop-blur-xs transition-all",
              isFavorite
                ? "text-amber-500 border-amber-300 fill-amber-500"
                : "text-muted-foreground hover:text-amber-500"
            )}
          >
            <Star className={cn("w-3.5 h-3.5", isFavorite && "fill-current")} />
          </button>
        )}

        {/* Stock Badge */}
        <div className="absolute top-2 left-2">
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shadow-xs",
              isOutOfStock
                ? "bg-rose-500 text-white"
                : isLowStock
                ? "bg-amber-500 text-white"
                : "bg-emerald-500 text-white"
            )}
          >
            {isOutOfStock ? "Agotado" : `${product.stock} stock`}
          </span>
        </div>
      </div>

      {/* Info Body */}
      <div className="mt-2.5 flex-1 flex flex-col justify-between">
        <div>
          <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">
            {hasCategory ? categoryLabel : "General"}
          </span>
          <h3 className="mt-0.5 text-xs font-bold text-foreground line-clamp-2 min-h-[34px] leading-snug">
            {product.name}
          </h3>
        </div>

        {/* Price & Add Indicator */}
        <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between font-mono">
          <span className="text-sm font-extrabold text-foreground tracking-tight">
            {formatCurrency(product.salePrice)}
          </span>
          <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg bg-primary-light text-primary text-[11px] font-bold group-hover:bg-primary group-hover:text-white transition-colors">
            + Agregar
          </span>
        </div>
      </div>
    </div>
  );
}
