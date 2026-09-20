import { MovementType, ProductType } from '@prisma/client';

/**
 * The single authority for every stock decision.
 *
 * A service is sold labour, not merchandise: it is never counted as stocked, never
 * blocked by a stock rule, never reported as low on stock, and never moves the kárdex.
 * Every consumer must call these functions instead of re-deriving the rule, so the
 * behaviour cannot diverge between the POS, the products module, the reports and the
 * purchase orders.
 */

/** A service does not carry inventory; a product does. */
export function tracksStock(type: ProductType): boolean {
  return type !== ProductType.SERVICE;
}

/** Stored stock is meaningless for a service, so it is normalised to zero. */
export function normalizeStockForType(
  type: ProductType,
  stock: number,
): number {
  return tracksStock(type) ? stock : 0;
}

/**
 * The opening stock movement a product is created with. A service records none, and a
 * product created with zero stock records none either, so no phantom PURCHASE is ever
 * written for an item that was not physically received.
 */
export function resolveInitialStockMovement(
  type: ProductType,
  stock: number,
): { type: MovementType; quantity: number } | null {
  if (!tracksStock(type) || stock === 0) {
    return null;
  }
  return { type: MovementType.PURCHASE, quantity: stock };
}

/** The low-stock rule. A service is never low on stock, whatever the numbers say. */
export function isLowStock(
  type: ProductType,
  stock: number,
  minStock: number,
): boolean {
  if (!tracksStock(type)) {
    return false;
  }
  return stock <= minStock;
}

/** The adjustment a manual stock edit produces, or null when nothing moved. */
export function resolveStockDeltaMovement(
  type: ProductType,
  previousStock: number,
  nextStock: number,
): MovementType | null {
  if (!tracksStock(type) || previousStock === nextStock) {
    return null;
  }
  return nextStock > previousStock
    ? MovementType.ADJUSTMENT_IN
    : MovementType.ADJUSTMENT_OUT;
}
