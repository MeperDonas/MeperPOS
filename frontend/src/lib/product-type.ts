import type { ProductType } from "@/types";

/**
 * Frontend twin of the backend stock rule in
 * `backend/src/products/product-type.logic.ts`, and the single frontend
 * authority for stock decisions: the POS, the inventory list and the product
 * card must ask these helpers instead of re-deriving the rule, so the
 * behaviour cannot diverge between the two sides of the app.
 *
 * The rule reads two facts: what the item is, and whether its stock is
 * managed. A service and an untracked product are both invisible to stock.
 */

/** A service is sold labour with nothing to run out of, so its stock is unbounded. */
export const UNLIMITED_STOCK = Number.MAX_SAFE_INTEGER;

/**
 * Minimal structural shape the helpers read. `type` also accepts a plain
 * `string` so raw API payloads and structural card props stay assignable
 * without a cast: only this module decides what the value means. An absent
 * `tracksStock` means tracked, matching the database default.
 */
export type StockSubject = {
  type?: ProductType | string | null;
  tracksStock?: boolean | null;
  stock?: number;
};

/** True only for sold labour. An item with no type is merchandise. */
export function isService(item: StockSubject): boolean {
  return item.type === "SERVICE";
}

/**
 * Mirrors the backend rule in backend/src/products/product-type.logic.ts. An absent flag means
 * tracked, matching the database default, and a service is never tracked whatever the flag says.
 */
export function tracksStock(item: StockSubject): boolean {
  return item.tracksStock !== false && item.type !== "SERVICE";
}

/**
 * The stock every stock decision must use: unlimited for a service or any
 * untracked item whatever number it stores, the stored stock otherwise (a
 * missing stock means zero).
 */
export function effectiveStock(item: StockSubject): number {
  if (!tracksStock(item)) return UNLIMITED_STOCK;
  return item.stock ?? 0;
}
