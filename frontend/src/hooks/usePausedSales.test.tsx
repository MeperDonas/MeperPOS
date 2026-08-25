import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { usePausedSales } from "./usePausedSales";
import type { CartItem, Product } from "@/types";

function makeProduct(id: string, salePrice: number): Product {
  return {
    id,
    name: `Producto ${id}`,
    sku: `sku-${id}`,
    barcode: null,
    description: null,
    costPrice: 0,
    salePrice,
    taxRate: 0,
    stock: 10,
    minStock: 1,
    imageUrl: null,
    categoryId: "cat-1",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
  };
}

function makeLine(productId: string, unitPrice: number, qty = 1): CartItem {
  return {
    productId,
    product: makeProduct(productId, unitPrice),
    quantity: qty,
    unitPrice,
    originalUnitPrice: unitPrice,
    discountAmount: 0,
    availableStock: 10,
  };
}

describe("usePausedSales — deduplicate identical paused sales", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not add a duplicate paused sale for the same customer + identical cart", () => {
    const { result } = renderHook(() => usePausedSales());
    const cart = [makeLine("p1", 8000)];

    act(() => {
      result.current.pauseSale(cart, "", 0);
    });
    act(() => {
      result.current.pauseSale(cart, "", 0);
    });

    expect(result.current.pausedSales).toHaveLength(1);
  });

  it("keeps distinct carts (different products) separate", () => {
    const { result } = renderHook(() => usePausedSales());

    act(() => {
      result.current.pauseSale([makeLine("p1", 8000)], "", 0);
    });
    act(() => {
      result.current.pauseSale([makeLine("p2", 9000)], "", 0);
    });

    expect(result.current.pausedSales).toHaveLength(2);
  });

  it("normalizes duplicate paused sales already stored in localStorage on load", () => {
    const existing = [
      {
        id: "a",
        customerId: "",
        discountAmount: 0,
        customerName: "Cliente General",
        pausedAt: "2026-08-25T16:29:54.000Z",
        cart: [makeLine("p1", 8000)],
      },
      {
        id: "b",
        customerId: "",
        discountAmount: 0,
        customerName: "Cliente General",
        pausedAt: "2026-08-25T16:37:24.000Z",
        cart: [makeLine("p1", 8000)],
      },
    ];
    localStorage.setItem("paused_sales", JSON.stringify(existing));

    const { result } = renderHook(() => usePausedSales());

    expect(result.current.pausedSales).toHaveLength(1);
    expect(result.current.pausedSales[0].id).toBe("b");
  });

  it("does not collapse sales for different customers", () => {
    const { result } = renderHook(() => usePausedSales());
    const cart = [makeLine("p1", 8000)];

    act(() => {
      result.current.pauseSale(cart, "customer-1", 0);
    });
    act(() => {
      result.current.pauseSale(cart, "customer-2", 0);
    });

    expect(result.current.pausedSales).toHaveLength(2);
  });
});
