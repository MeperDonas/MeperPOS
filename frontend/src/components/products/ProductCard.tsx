"use client";

import Image from "next/image";
import { cn, formatCurrency } from "@/lib/utils";
import { isService, tracksStock } from "@/lib/product-type";
import { AlertTriangle, Edit3, Package, Plus, Power, RotateCcw, Star, Wrench } from "lucide-react";

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

type StatusKey = "inactive" | "service" | "untracked" | "depleted" | "low" | "healthy";

const STATUS_LABEL: Record<StatusKey, string> = {
  inactive: "Inactivo",
  service: "Servicio",
  untracked: "Sin inventario",
  depleted: "Agotado",
  low: "Stock bajo",
  healthy: "Activo",
};

const STATUS_TONE: Record<StatusKey, string> = {
  inactive: "border-border/70 bg-muted text-muted-foreground",
  service: "border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  untracked: "border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  depleted: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  low: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  healthy: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

/**
 * The single status chain. Deactivation and service type both outrank stock facts:
 * a service is sold labour that can never be depleted, and an untracked good is real
 * merchandise nobody counts, so neither may read as "Agotado".
 */
function resolveStatus(product: ProductCardData, isInactive: boolean): StatusKey {
  if (isInactive) return "inactive";
  if (isService(product)) return "service";
  if (!tracksStock(product)) return "untracked";
  if (product.stock === 0) return "depleted";
  // The flag is the server's answer (see backend isLowStock): an untracked item is never low
  // on stock whatever its stored numbers say, so re-deriving it here could only drift.
  return product.isLowStock === true ? "low" : "healthy";
}

function statusTestId(status: StatusKey): string | undefined {
  if (status === "service") return "service-chip";
  if (status === "untracked") return "untracked-chip";
  if (status === "depleted" || status === "low") return "stock-alert-icon";
  return undefined;
}

function StatusChip({ status }: { status: StatusKey }) {
  return (
    <span
      data-testid={statusTestId(status)}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-1 font-mono text-[10px] font-bold leading-none",
        STATUS_TONE[status],
      )}
    >
      {status === "service" ? (
        <Wrench className="h-3 w-3 shrink-0" aria-hidden="true" />
      ) : status === "depleted" || status === "low" ? (
        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
      ) : (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}

function OfferBadge({ discount }: { discount: number }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-1 font-mono text-[10px] font-bold leading-none text-rose-700 dark:text-rose-300">
      Oferta{discount > 0 ? ` -${discount}%` : ""}
    </span>
  );
}

/**
 * Full-bleed media layer: the photo IS the card, not a framed thumbnail inside it.
 * Absolute so the content sheet, not the image, decides the card height — a card with
 * a second text line grows the sheet and crops the photo instead of resizing it.
 */
function ProductMedia({ product }: { product: ProductCardData }) {
  return (
    <div data-testid="product-media" className="absolute inset-0 bg-muted/40">
      {product.imageUrl ? (
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
        />
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-muted to-muted/60" />
          {/* Centred in the visible photo band, not in the card, which the sheet covers. */}
          <div className="absolute inset-x-0 top-0 flex aspect-[16/10] items-center justify-center">
            <Package className="h-9 w-9 text-muted-foreground/40" aria-hidden="true" />
          </div>
        </>
      )}
      {/* Depth under the sheet, and contrast behind the control rail on a pale photo. */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/20 via-black/5 to-transparent"
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * One quiet control in the card's top-right rail: a 44px hit target wrapping a small
 * glass disc, so management and cart controls never become a heavy toolbar.
 */
function RailButton({
  label,
  tone,
  onClick,
  disabled,
  children,
}: {
  label: string;
  tone?: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="group/rail flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white shadow-sm backdrop-blur-md transition-colors",
          tone,
        )}
      >
        {children}
      </span>
    </button>
  );
}

export function ProductCard({ product, mode, onClick, onDelete, onReactivate, isFavorite = false, onToggleFavorite }: ProductCardProps) {
  const isInactive = product.active === false;
  const cannotAdd = isInactive || (tracksStock(product) && product.stock <= 0);
  const isInventory = mode === "inventory";
  const footerHandler = isInactive ? onReactivate : onDelete;
  const status = resolveStatus(product, isInactive);

  const hasPromo =
    typeof product.effectiveSalePrice === "number" &&
    Number(product.effectiveSalePrice) !== Number(product.salePrice);
  const discount =
    hasPromo && Number(product.salePrice) > 0
      ? Math.max(0, Math.round(100 - (Number(product.effectiveSalePrice) / Number(product.salePrice)) * 100))
      : 0;
  const sellingPrice = Number(hasPromo ? product.effectiveSalePrice : product.salePrice);

  const service = isService(product);
  const stockLabel = service ? "Servicio" : !tracksStock(product) ? "Sin inventario" : `${product.stock} uds.`;
  const categoryName = product.category?.name || (isInventory ? "Sin categoría" : "General");
  const inventoryActions = isInventory && (onClick || footerHandler);
  const railVisible = isInventory ? Boolean(inventoryActions) : Boolean(onClick || onToggleFavorite);

  return (
    <div
      className={cn(
        "group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg",
        isInactive && "bg-muted/20 opacity-60",
      )}
    >
      <ProductMedia product={product} />

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

      {/* Controls live in one corner of the photo, never over its subject. */}
      {(railVisible) && (
        <div className="absolute right-1.5 top-1.5 z-20 flex flex-col items-center gap-1.5">
          {!isInventory && onToggleFavorite && (
            <RailButton
              label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
              tone={
                isFavorite
                  ? "border-amber-300/70 bg-amber-400/30 text-amber-100"
                  : "group-hover/rail:bg-black/55 group-hover/rail:text-amber-300"
              }
              onClick={onToggleFavorite}
            >
              <Star className={cn("h-4 w-4", isFavorite && "fill-current")} aria-hidden="true" />
            </RailButton>
          )}
          {!isInventory && onClick && (
            <RailButton
              label="+ Agregar"
              tone="border-white/30 bg-primary/85 group-hover/rail:bg-primary"
              onClick={onClick}
              disabled={cannotAdd}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </RailButton>
          )}
          {inventoryActions && (
            <>
              {onClick && (
                <RailButton label="Editar producto" onClick={onClick}>
                  <Edit3 className="h-4 w-4" aria-hidden="true" />
                </RailButton>
              )}
              {footerHandler && (
                <RailButton
                  label={isInactive ? "Reactivar producto" : "Desactivar producto"}
                  tone={isInactive ? "group-hover/rail:bg-emerald-600/70" : "group-hover/rail:bg-rose-600/70"}
                  onClick={footerHandler}
                >
                  {isInactive ? <RotateCcw className="h-4 w-4" aria-hidden="true" /> : <Power className="h-4 w-4" aria-hidden="true" />}
                </RailButton>
              )}
            </>
          )}
        </div>
      )}

      {/*
        Photo reserve: the picture keeps a share of the card proportional to its width, and a
        card stretched taller by its grid row shows more photo instead of a gap — the media
        layer is the card itself, so this spacer never paints.
      */}
      <div aria-hidden="true" className="aspect-[16/10] w-full" />

      {/*
        The sheet is a separate, non-interactive glass layer plus a relative content block.
        Keeping the blur off the content block leaves the card's stacking order untouched,
        so the sheet paints under the full-card click surface while its controls sit above it,
        and every pixel of the sheet still clicks through to edit or add.
      */}
      <div data-testid="product-sheet" className="relative mt-auto w-full">
        <div
          className="absolute inset-0 border-t border-white/40 bg-card/90 backdrop-blur-xl dark:border-white/10 dark:bg-card/85"
          aria-hidden="true"
        />
        <div className="relative px-3 pb-3 pt-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <StatusChip status={status} />
            {hasPromo && <OfferBadge discount={discount} />}
          </div>

          <div className="mt-2 min-w-0">
            <h3 className="line-clamp-2 min-w-0 break-words text-sm font-bold leading-snug tracking-tight text-foreground">
              {product.name}
            </h3>
            {product.sku && (
              <span className="mt-0.5 block min-w-0 truncate font-mono text-[10px] text-muted-foreground">
                {product.sku}
              </span>
            )}
          </div>

          {/* Wraps instead of sharing the row when the card is too narrow for both: the
              price keeps its full width and the stock pill drops to its own line. */}
          <div className="mt-2.5 flex min-w-0 flex-wrap items-end gap-2">
            <div
              data-testid="product-price-panel"
              className="min-w-[8.5rem] flex-[1_1_8.5rem] rounded-xl border border-border/60 bg-background/80 px-2.5 py-1.5 shadow-xs"
            >
              <div className="flex min-w-0 items-center justify-between gap-1.5">
                <span className="min-w-0 truncate rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-primary">
                  {categoryName}
                </span>
                <span className="shrink-0 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Precio
                </span>
              </div>
              <div className="mt-1.5 min-w-0">
                <span
                  data-testid={hasPromo ? "offer-effective-price" : undefined}
                  className="block min-w-0 whitespace-nowrap font-mono text-lg font-extrabold leading-none tracking-tight text-foreground"
                >
                  {formatCurrency(sellingPrice)}
                </span>
                {hasPromo && (
                  <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <s
                      data-testid="offer-list-price"
                      className="min-w-0 whitespace-nowrap font-mono text-[11px] text-muted-foreground line-through"
                    >
                      {formatCurrency(Number(product.salePrice))}
                    </s>
                  </div>
                )}
              </div>
            </div>
            <span
              data-testid="product-stock"
              className="ml-auto shrink-0 rounded-lg border border-border/60 bg-background/80 px-1.5 py-1 font-mono text-[10px] font-semibold leading-none text-muted-foreground"
            >
              {stockLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
