"use client";

import Image from "next/image";
import { cn, formatCurrency } from "@/lib/utils";
import { isService, tracksStock } from "@/lib/product-type";
import { AlertTriangle, Package, Power, RotateCcw, Star, Edit3, Wrench } from "lucide-react";

type ProductCardData = {
  id: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  stock: number;
  salePrice: number;
  costPrice?: number;
  type?: string | null;
  tracksStock?: boolean | null;
  category?: { name: string } | null;
  active?: boolean;
  /** Active promotion — when present, effectiveSalePrice is the selling price */
  promotionType?: string | null;
  promotionValue?: number | null;
  effectiveSalePrice?: number | null;
  /** Backend-computed low-stock flag; the client must not re-derive it. */
  isLowStock?: boolean;
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

function StatusChip({ product, isInactive }: { product: ProductCardData; isInactive: boolean }) {
  const service = isService(product);
  const depleted = product.stock === 0;
  // The flag is the server's answer (see backend isLowStock): an untracked item is never low
  // on stock whatever its stored numbers say, so re-deriving it here could only drift.
  const low = product.isLowStock === true;
  const status = isInactive ? "inactive" : service ? "service" : !tracksStock(product) ? "untracked" : depleted ? "depleted" : low ? "low" : "healthy";
  const colors = {
    inactive: "text-muted-foreground",
    service: "text-indigo-600 dark:text-indigo-400",
    untracked: "text-indigo-600 dark:text-indigo-400",
    depleted: "text-rose-600 dark:text-rose-400",
    low: "text-amber-700 dark:text-amber-400",
    healthy: "text-emerald-700 dark:text-emerald-400",
  };

  return (
    <span
      data-testid={status === "service" ? "service-chip" : status === "untracked" ? "untracked-chip" : status === "depleted" || status === "low" ? "stock-alert-icon" : undefined}
      className={cn("inline-flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-background/95 px-2 py-1 font-mono text-[10px] font-bold shadow-xs backdrop-blur-sm dark:bg-card/95", colors[status])}
    >
      {status === "service" ? <Wrench className="h-3 w-3 shrink-0" aria-hidden="true" /> : status === "depleted" ? <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />}
      {status === "inactive" ? "Inactivo" : status === "service" ? "Servicio" : status === "untracked" ? "Sin inventario" : status === "depleted" ? "Agotado" : status === "low" ? "Stock bajo" : "Activo"}
    </span>
  );
}

function ProductMedia({ product, isInactive, favorite }: {
  product: ProductCardData;
  isInactive: boolean;
  favorite?: React.ReactNode;
}) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-[15px] bg-muted/20">
      {product.imageUrl ? (
        <Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-muted/10 to-muted/30">
          <Package className="h-9 w-9 text-muted-foreground/40" aria-hidden="true" />
        </div>
      )}
      <div className="absolute left-2 top-2 max-w-[calc(100%-4rem)]">
        <StatusChip product={product} isInactive={isInactive} />
      </div>
      {favorite}
    </div>
  );
}

function ProductDetails({ product, mode }: { product: ProductCardData; mode: "pos" | "inventory" }) {
  const hasPromo = typeof product.effectiveSalePrice === "number" && Number(product.effectiveSalePrice) !== Number(product.salePrice);
  const discount = hasPromo && Number(product.salePrice) > 0
    ? Math.max(0, Math.round(100 - Number(product.effectiveSalePrice) / Number(product.salePrice) * 100))
    : 0;
  const service = isService(product);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2.5 px-3">
      <div className="min-w-0 space-y-1">
        <span className="block truncate font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
          {product.category?.name || (mode === "pos" ? "General" : "Sin categoría")}
        </span>
        <h3 className="line-clamp-2 min-w-0 break-words text-sm font-bold leading-snug text-foreground">
          {product.name}
        </h3>
        {product.sku && <span className="block min-w-0 break-all font-mono text-[10px] text-muted-foreground">{product.sku}</span>}
      </div>
      <div className="min-w-0 space-y-2">
        <div className="min-w-0 rounded-lg bg-primary/5 px-2.5 py-2">
          <span className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Precio</span>
          <div className="mt-1 min-w-0">
            <span data-testid={hasPromo ? "offer-effective-price" : undefined} className="block min-w-0 break-words font-mono text-base font-extrabold leading-tight tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-lg">
              {formatCurrency(Number(hasPromo ? product.effectiveSalePrice : product.salePrice))}
            </span>
            {hasPromo && (
              <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <s data-testid="offer-list-price" className="min-w-0 break-words font-mono text-[11px] text-muted-foreground line-through [overflow-wrap:anywhere]">
                  {formatCurrency(Number(product.salePrice))}
                </s>
                <span className="rounded-md bg-rose-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-700 dark:text-rose-400">
                  Oferta{discount > 0 ? ` -${discount}%` : ""}
                </span>
              </div>
            )}
          </div>
        </div>
        <span data-testid="product-stock" className="inline-flex max-w-full rounded-md border border-border/60 bg-background px-2 py-1 font-mono text-[11px] font-medium text-muted-foreground">
          {service ? "Servicio" : !tracksStock(product) ? "Sin inventario" : `${product.stock} uds.`}
        </span>
      </div>
    </div>
  );
}

export function ProductCard({ product, mode, onClick, onDelete, onReactivate, isFavorite = false, onToggleFavorite }: ProductCardProps) {
  const isInactive = product.active === false;
  const cannotAdd = isInactive || (tracksStock(product) && product.stock <= 0);
  const isInventory = mode === "inventory";
  const footerHandler = isInactive ? onReactivate : onDelete;
  const actionClass = "inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-2.5 py-2 text-center text-xs font-semibold text-white shadow-xs transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className={cn(
      "group relative flex min-w-0 flex-col gap-2.5 rounded-2xl border border-border/70 bg-card pb-3 shadow-xs transition-colors hover:border-primary/40",
      isInactive && "bg-muted/20 opacity-60",
    )}>
      {/* The card overlay stays below independent management and favorite buttons. */}
      {onClick && (
        <button
          type="button"
          aria-label={isInventory ? `Editar producto: ${product.name}` : `Agregar al carrito: ${product.name}`}
          aria-disabled={isInventory ? undefined : cannotAdd}
          disabled={!isInventory && cannotAdd}
          onClick={onClick}
          className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
      )}
      <ProductMedia product={product} isInactive={isInactive} favorite={!isInventory && onToggleFavorite && (
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
          aria-pressed={isFavorite}
          className={cn(
            "absolute right-1.5 top-1.5 z-20 flex h-11 w-11 items-center justify-center rounded-xl border border-border/70 bg-background/95 text-muted-foreground shadow-xs backdrop-blur-sm transition-colors hover:text-amber-500 dark:bg-card/95",
            isFavorite && "border-amber-300 bg-amber-50/95 text-amber-600 dark:bg-amber-950/90",
          )}
        >
          <Star className={cn("h-4 w-4", isFavorite && "fill-current")} aria-hidden="true" />
        </button>
      )} />
      <ProductDetails product={product} mode={mode} />
      <div className={cn("relative z-20 flex min-w-0 items-center gap-2 px-3", isInventory && "justify-end")}>
        {isInventory ? (
          <>
            {onClick && (
              <button type="button" onClick={onClick} title="Editar producto" aria-label="Editar producto" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/80 text-foreground transition-colors hover:border-primary/50 hover:text-primary">
                <Edit3 className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {footerHandler && (
              <button
                type="button"
                onClick={footerHandler}
                title={isInactive ? "Reactivar producto" : "Desactivar producto"}
                aria-label={isInactive ? "Reactivar producto" : "Desactivar producto"}
                className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/80 text-muted-foreground transition-colors", isInactive ? "text-emerald-600 hover:bg-emerald-500/10" : "hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-600")}
              >
                {isInactive ? <RotateCcw className="h-4 w-4" aria-hidden="true" /> : <Power className="h-4 w-4" aria-hidden="true" />}
              </button>
            )}
          </>
        ) : (
          <button type="button" disabled={cannotAdd} onClick={onClick} className={cn(actionClass, "w-full")}>
            + Agregar
          </button>
        )}
      </div>
    </div>
  );
}
