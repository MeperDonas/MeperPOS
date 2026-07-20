import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { printThermalReceipt } from "./useReceipt";
import type { Sale, SaleItem, Payment, Product } from "@/types";

function makeProduct(name: string): Product {
  return {
    id: `prod-${name}`,
    name,
    sku: `sku-${name}`,
    barcode: null,
    description: null,
    costPrice: 1000,
    salePrice: 5000,
    taxRate: 19,
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

function makeItem(product: Product, quantity: number, unitPrice: number): SaleItem {
  const subtotal = quantity * unitPrice;
  return {
    id: `item-${product.id}`,
    saleId: "sale-1",
    productId: product.id,
    product,
    quantity,
    unitPrice,
    taxRate: product.taxRate,
    discountAmount: 0,
    subtotal,
    total: subtotal,
  };
}

function makePayment(method: Payment["method"], amount: number): Payment {
  return {
    id: `pay-${method}-${amount}`,
    saleId: "sale-1",
    method,
    amount,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeSale(overrides: Partial<Sale> = {}): Sale {
  const product = makeProduct("Producto A");
  return {
    id: "sale-1",
    saleNumber: 101,
    customerId: null,
    subtotal: 10000,
    taxAmount: 1900,
    discountAmount: 0,
    total: 11900,
    amountPaid: 11900,
    change: 0,
    status: "COMPLETED",
    userId: "user-1",
    items: [makeItem(product, 2, 5000)],
    payments: [makePayment("CASH", 11900)],
    createdAt: "2026-01-15T14:30:00.000Z",
    updatedAt: "2026-01-15T14:30:00.000Z",
    ...overrides,
  };
}

describe("printThermalReceipt", () => {
  const writeMock = vi.fn();
  const closeMock = vi.fn();
  const printMock = vi.fn();
  const focusMock = vi.fn();

  function mockPrintWindow() {
    return {
      document: { write: writeMock, close: closeMock },
      print: printMock,
      focus: focusMock,
    } as unknown as Window;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens a print window with the receipt content and triggers print", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(mockPrintWindow());
    const sale = makeSale();

    printThermalReceipt(sale, "Mi Tienda");

    expect(openSpy).toHaveBeenCalledWith(
      "",
      "_blank",
      expect.stringContaining("width=320"),
    );
    expect(writeMock).toHaveBeenCalledTimes(1);

    const writtenHtml = writeMock.mock.calls[0]?.[0] as string;
    expect(writtenHtml).toContain("Mi Tienda");
    expect(writtenHtml).toContain("Comprobante #101");
    expect(writtenHtml).toContain("Producto A");
    expect(writtenHtml).toContain("2 x");
    expect(writtenHtml).toContain("Total");
    expect(writtenHtml).toContain("Efectivo");
    expect(writtenHtml).toContain("@media print");
    expect(writtenHtml).toContain("80mm");
    expect(writtenHtml).toContain("window.print()");
    expect(printMock).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it("includes custom header and footer when provided", () => {
    vi.spyOn(window, "open").mockReturnValue(mockPrintWindow());
    const sale = makeSale();

    printThermalReceipt(sale, "Mi Tienda", {
      header: "Bienvenidos",
      footer: "Vuelva pronto",
    });

    const writtenHtml = writeMock.mock.calls[0]?.[0] as string;
    expect(writtenHtml).toContain("Bienvenidos");
    expect(writtenHtml).toContain("Vuelva pronto");
  });

  it("does not throw when the browser blocks the popup", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const sale = makeSale();

    expect(() => printThermalReceipt(sale, "Mi Tienda")).not.toThrow();
  });
});
