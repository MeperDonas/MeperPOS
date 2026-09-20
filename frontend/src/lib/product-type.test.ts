import { describe, expect, it } from "vitest";
import { effectiveStock, isService, UNLIMITED_STOCK } from "./product-type";

/**
 * Frontend twin of the backend stock rule in
 * backend/src/products/product-type.logic.ts. This module is the single
 * frontend authority for stock decisions: the POS, the inventory list and the
 * product card must ask these helpers instead of re-deriving the rule, so the
 * behaviour cannot diverge between the two sides of the app.
 */

describe("product-type (frontend twin of the backend stock rule)", () => {
  it("treats an explicit SERVICE as a service", () => {
    expect(isService({ type: "SERVICE" })).toBe(true);
  });

  it("treats an explicit PRODUCT as merchandise", () => {
    expect(isService({ type: "PRODUCT" })).toBe(false);
  });

  it("treats an item without a type as merchandise", () => {
    expect(isService({})).toBe(false);
  });

  it("reports unlimited stock for a service and pins the sentinel value", () => {
    expect(effectiveStock({ type: "SERVICE", stock: 0 })).toBe(UNLIMITED_STOCK);
    expect(UNLIMITED_STOCK).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("ignores the stored stock number for a service", () => {
    expect(effectiveStock({ type: "SERVICE", stock: 9996 })).toBe(
      UNLIMITED_STOCK,
    );
  });

  it("keeps the stored stock for a product", () => {
    expect(effectiveStock({ type: "PRODUCT", stock: 7 })).toBe(7);
  });

  it("keeps a real zero stock for an untyped item", () => {
    expect(effectiveStock({ stock: 0 })).toBe(0);
  });
});
