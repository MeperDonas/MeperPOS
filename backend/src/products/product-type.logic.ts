import { MovementType, ProductType } from '@prisma/client';

/**
 * The single authority for every stock decision.
 *
 * A service is sold labour, and an untracked product is merchandise nobody counts. Both are
 * invisible to stock: never guarded, never decremented, never valued, never alerted on. Every
 * consumer must call these functions instead of re-deriving the rule, so the behaviour cannot
 * diverge between the POS, the products module, the reports, the purchase orders and the cards.
 */

/** The two facts every stock decision needs: what the item is, and whether its stock is managed. */
export type StockSubject = {
  type: ProductType;
  tracksStock: boolean;
};

/**
 * An item is stock-controlled when it declares it AND it is merchandise. An absent flag counts as
 * tracked, which is what the column default says and what the frontend twin does, so the two sides
 * can never disagree. The write boundary keeps a service at `tracksStock = false`; the type clause
 * makes the rule total even if a row ever disagrees, so a service can never be treated as stocked
 * whatever the flag says.
 */
export function tracksStock(item: StockSubject): boolean {
  return item.tracksStock !== false && item.type !== ProductType.SERVICE;
}

/** Stored stock is meaningless for anything untracked, so it is normalised to zero. */
export function normalizeStock(item: StockSubject, stock: number): number {
  return tracksStock(item) ? stock : 0;
}

/**
 * The opening stock movement an item is created with. An untracked item records none, and neither
 * does a tracked product created with zero stock, so no phantom PURCHASE is ever written.
 */
export function resolveInitialStockMovement(
  item: StockSubject,
  stock: number,
): { type: MovementType; quantity: number } | null {
  if (!tracksStock(item) || stock === 0) {
    return null;
  }
  return { type: MovementType.PURCHASE, quantity: stock };
}

/** The low-stock rule. An untracked item is never low on stock, whatever the numbers say. */
export function isLowStock(
  item: StockSubject,
  stock: number,
  minStock: number,
): boolean {
  if (!tracksStock(item)) {
    return false;
  }
  return stock <= minStock;
}

/** The adjustment a manual stock edit produces, or null when nothing moved. */
export function resolveStockDeltaMovement(
  item: StockSubject,
  previousStock: number,
  nextStock: number,
): MovementType | null {
  if (!tracksStock(item) || previousStock === nextStock) {
    return null;
  }
  return nextStock > previousStock
    ? MovementType.ADJUSTMENT_IN
    : MovementType.ADJUSTMENT_OUT;
}
