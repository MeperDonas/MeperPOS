import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThermalReceipt } from "./ThermalReceipt";
import type { Sale, SaleItem, Payment, Product } from "@/types";

function amountPattern(amount: number): RegExp {
  const formatted = amount.toLocaleString("es-CO");
  return new RegExp(`\\$\\s*${formatted.replace(/\./g, "\\.")}`);
}

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

function makeItem(product: Product, quantity: number, unitPrice: number, discountAmount = 0): SaleItem {
  const subtotal = quantity * unitPrice - discountAmount;
  return {
    id: `item-${product.id}`,
    saleId: "sale-1",
    productId: product.id,
    product,
    quantity,
    unitPrice,
    taxRate: product.taxRate,
    discountAmount,
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
    items: [],
    payments: [],
    createdAt: "2026-01-15T14:30:00.000Z",
    updatedAt: "2026-01-15T14:30:00.000Z",
    ...overrides,
  };
}

describe("ThermalReceipt", () => {
  it("renders organization name, sale number and date", () => {
    const sale = makeSale();
    render(<ThermalReceipt sale={sale} organizationName="Mi Tienda" />);

    expect(screen.getByText("Mi Tienda")).toBeInTheDocument();
    expect(screen.getByText(/#101/)).toBeInTheDocument();
    expect(screen.getByText(/15 de enero de 2026/)).toBeInTheDocument();
  });

  it("renders sale items with quantity, unit price and line total", () => {
    const productA = makeProduct("Producto A");
    const productB = makeProduct("Producto B");
    const sale = makeSale({
      items: [
        makeItem(productA, 2, 5000),
        makeItem(productB, 1, 3000),
      ],
      subtotal: 13000,
      taxAmount: 2470,
      total: 15470,
      amountPaid: 15470,
    });

    render(<ThermalReceipt sale={sale} organizationName="Mi Tienda" />);
    const receipt = screen.getByTestId("thermal-receipt");

    expect(receipt).toHaveTextContent("Producto A");
    expect(receipt).toHaveTextContent(/2 x \$\s*5\.000/);
    expect(receipt).toHaveTextContent(amountPattern(10000));

    expect(receipt).toHaveTextContent("Producto B");
    expect(receipt).toHaveTextContent(/1 x \$\s*3\.000/);
    expect(receipt).toHaveTextContent(amountPattern(3000));
  });

  it("renders subtotal, tax, discount, total and change for a cash sale", () => {
    const product = makeProduct("Producto C");
    const sale = makeSale({
      items: [makeItem(product, 1, 10000, 1000)],
      subtotal: 9000,
      taxAmount: 1710,
      discountAmount: 1000,
      total: 10710,
      amountPaid: 15000,
      change: 4290,
      payments: [makePayment("CASH", 15000)],
    });

    render(<ThermalReceipt sale={sale} organizationName="Mi Tienda" />);
    const receipt = screen.getByTestId("thermal-receipt");

    expect(receipt).toHaveTextContent("Subtotal");
    expect(receipt).toHaveTextContent(amountPattern(9000));
    expect(receipt).toHaveTextContent("Impuestos");
    expect(receipt).toHaveTextContent(amountPattern(1710));
    expect(receipt).toHaveTextContent(/Descuento/i);
    expect(receipt).toHaveTextContent(/-\$\s*1\.000/);
    expect(receipt).toHaveTextContent("Total");
    expect(receipt).toHaveTextContent(amountPattern(10710));
    expect(receipt).toHaveTextContent("Cambio");
    expect(receipt).toHaveTextContent(amountPattern(4290));
  });

  it("renders multiple payment methods and no change for exact card payment", () => {
    const product = makeProduct("Producto D");
    const sale = makeSale({
      items: [makeItem(product, 1, 20000)],
      subtotal: 20000,
      taxAmount: 3800,
      total: 23800,
      amountPaid: 23800,
      change: 0,
      payments: [makePayment("CARD", 13800), makePayment("TRANSFER", 10000)],
    });

    render(<ThermalReceipt sale={sale} organizationName="Mi Tienda" />);
    const receipt = screen.getByTestId("thermal-receipt");

    expect(receipt).toHaveTextContent("Tarjeta");
    expect(receipt).toHaveTextContent(amountPattern(13800));
    expect(receipt).toHaveTextContent("Transferencia");
    expect(receipt).toHaveTextContent(amountPattern(10000));
    expect(receipt).not.toHaveTextContent("Cambio");
  });

  it("renders custom header and footer when provided", () => {
    const sale = makeSale();
    render(
      <ThermalReceipt
        sale={sale}
        organizationName="Mi Tienda"
        header="Bienvenidos"
        footer="Vuelva pronto"
      />,
    );

    expect(screen.getByText("Bienvenidos")).toBeInTheDocument();
    expect(screen.getByText("Vuelva pronto")).toBeInTheDocument();
  });

  it("renders default thank-you footer when no custom footer is provided", () => {
    const sale = makeSale();
    render(<ThermalReceipt sale={sale} organizationName="Mi Tienda" />);

    expect(screen.getByText("Gracias por su compra")).toBeInTheDocument();
  });
});
