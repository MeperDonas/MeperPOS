import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CategoryProductsModal } from "./CategoryProductsModal";
import type { Category, Product } from "@/types";

const useProductsMock = vi.fn();

vi.mock("@/hooks/useProducts", () => ({
  useProducts: (...args: unknown[]) => useProductsMock(...args),
}));

const category: Category = {
  id: "cat-1",
  name: "Abarrotes",
  description: null,
  defaultTaxRate: null,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p-1",
    name: "Arroz Diana",
    sku: "ARR-1",
    barcode: null,
    description: null,
    costPrice: 3000,
    salePrice: 4500,
    taxRate: 0,
    stock: 20,
    minStock: 5,
    isLowStock: false,
    imageUrl: null,
    categoryId: "cat-1",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

function setProducts(products: Product[]) {
  useProductsMock.mockReturnValue({
    data: { data: products, meta: { total: products.length, page: 1, limit: 200, totalPages: 1 } },
    isLoading: false,
    isError: false,
  });
}

/** The badge colours are the only visible signal, so assert on the class, not the text. */
const badgeClasses = (productName: string) => {
  const row = screen.getByText(productName).closest("li")!;
  return Array.from(row.querySelectorAll("span"))
    .map((node) => node.className)
    .join(" ");
};

beforeEach(() => {
  vi.clearAllMocks();
  setProducts([]);
});

afterEach(() => {
  cleanup();
});

describe("CategoryProductsModal stock badge — server low-stock flag", () => {
  it("badges a healthy product as neither low nor out of stock", () => {
    setProducts([buildProduct({ stock: 20, minStock: 5, isLowStock: false })]);
    render(<CategoryProductsModal category={category} onClose={vi.fn()} />);

    expect(screen.getByText("20 uds.")).toBeInTheDocument();
    expect(badgeClasses("Arroz Diana")).toContain("emerald-500/10");
  });

  it("badges a tracked product at or below minStock as low, using the server flag", () => {
    setProducts([buildProduct({ stock: 3, minStock: 5, isLowStock: true })]);
    render(<CategoryProductsModal category={category} onClose={vi.fn()} />);

    expect(badgeClasses("Arroz Diana")).toContain("amber-500/10");
  });

  it("does NOT badge an untracked product as low on stock (the regression this fixes)", () => {
    // This modal used to gate on `isService`, so an untracked PRODUCT carrying stale
    // numbers (stock 2 <= minStock 5) was badged "low on stock" while the server's own
    // rule said false. The server flag is the only signal now.
    setProducts([
      buildProduct({ id: "p-2", name: "Papel sin conteo", type: "PRODUCT", tracksStock: false, stock: 2, minStock: 5, isLowStock: false }),
    ]);
    render(<CategoryProductsModal category={category} onClose={vi.fn()} />);

    expect(screen.getByText("Papel sin conteo")).toBeInTheDocument();
    expect(badgeClasses("Papel sin conteo")).toContain("emerald-500/10");
    expect(badgeClasses("Papel sin conteo")).not.toContain("amber-500/10");
  });

  it("does NOT badge a service as low on stock whatever its numbers say", () => {
    setProducts([
      buildProduct({ id: "p-3", name: "Mantenimiento", type: "SERVICE", tracksStock: false, stock: 0, minStock: 5, isLowStock: false }),
    ]);
    render(<CategoryProductsModal category={category} onClose={vi.fn()} />);

    expect(screen.getByText("Servicio")).toBeInTheDocument();
    expect(badgeClasses("Mantenimiento")).not.toContain("amber-500/10");
  });

  it("badges a depleted tracked product as out of stock, ahead of the low flag", () => {
    // A tracked product at zero is low on stock server-side too, but "out of stock"
    // must keep the higher-severity colour.
    setProducts([buildProduct({ stock: 0, minStock: 5, isLowStock: true })]);
    render(<CategoryProductsModal category={category} onClose={vi.fn()} />);

    expect(badgeClasses("Arroz Diana")).toContain("rose-500/10");
    expect(badgeClasses("Arroz Diana")).not.toContain("amber-500/10");
  });
});
