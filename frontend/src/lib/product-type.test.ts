import { describe, expect, it } from "vitest";
import {
  effectiveStock,
  isService,
  tracksStock,
  UNLIMITED_STOCK,
} from "./product-type";

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

describe("tracksStock", () => {
  it("tracks stock for merchandise that declares it", () => {
    expect(tracksStock({ type: "PRODUCT", tracksStock: true })).toBe(true);
  });

  it("does not track stock for merchandise nobody counts", () => {
    expect(tracksStock({ type: "PRODUCT", tracksStock: false })).toBe(false);
  });

  it("never tracks stock for a service", () => {
    expect(tracksStock({ type: "SERVICE", tracksStock: false })).toBe(false);
  });

  it("refuses to track a service even when its row claims it does", () => {
    expect(tracksStock({ type: "SERVICE", tracksStock: true })).toBe(false);
  });

  it("tracks stock when the flag is absent, matching the database default", () => {
    expect(tracksStock({})).toBe(true);
  });

  it("reports unlimited stock for untracked merchandise, which is sellable without a ceiling", () => {
    expect(
      effectiveStock({ type: "PRODUCT", tracksStock: false, stock: 9991 }),
    ).toBe(UNLIMITED_STOCK);
  });

  it("keeps the stored stock for tracked merchandise with an explicit flag", () => {
    expect(effectiveStock({ type: "PRODUCT", tracksStock: true, stock: 7 })).toBe(
      7,
    );
  });
});
