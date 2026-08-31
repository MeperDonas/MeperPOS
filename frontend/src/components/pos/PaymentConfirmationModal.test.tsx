import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentConfirmationModal } from "./PaymentConfirmationModal";
import type { CartItem, PaymentMethod } from "@/types";

/**
 * S4 task 4.1 characterization baseline: locks the CURRENT currency output of
 * the payment confirmation modal before routing the quick-cash buttons through
 * formatCurrency (task 4.2). The summary rows already use formatCurrency, so
 * their assertions must stay IDENTICAL across 4.1 and 4.2 — any change there
 * is drift beyond the user-accepted quick-amount delta (amendment #404-3).
 * The quick-cash buttons render raw `${amount.toLocaleString()}` today;
 * this file documents the before-value ("$10.000" under the es-CO runtime).
 */

const mockCartItem: CartItem = {
  productId: "prod-1",
  product: {
    id: "prod-1",
    name: "Aceite motor 1L",
    sku: "ACE-001",
    barcode: null,
    description: null,
    costPrice: 9000,
    salePrice: 15000,
    taxRate: 19,
    stock: 10,
    minStock: 2,
    imageUrl: null,
    categoryId: "cat-1",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    organizationId: "org-1",
    version: 1,
  },
  quantity: 2,
  unitPrice: 15000,
  originalUnitPrice: 15000,
  availableStock: 10,
  discountAmount: 0,
};

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  cart: [mockCartItem],
  subtotal: 45000,
  taxAmount: 8550,
  total: 53550,
  selectedMethod: "CASH" as const,
  paymentMethods: [{ type: "CASH", amount: 5000 }] as PaymentMethod[],
  onPaymentMethodChange: vi.fn(),
};

// formatCurrency inserts a no-break space (U+00A0) after the "$" symbol.
// Testing Library collapses node whitespace before matching string matchers,
// so getByText queries use regular spaces. getByRole name matchers preserve
// the exact accessible name and need the literal NBSP instead.
const fmtText = (amount: string) => `$ ${amount}`;
const NBSP = "\u00A0";

describe("PaymentConfirmationModal currency output", () => {
  it("renders summary amounts through formatCurrency (pre/post invariant)", () => {
    render(<PaymentConfirmationModal {...baseProps} />);

    // These strings are identical before and after task 4.2 — formatCurrency
    // output with the es-CO no-break space after the symbol.
    expect(screen.getByText(fmtText("45.000"))).toBeInTheDocument(); // Subtotal
    expect(screen.getByText(fmtText("8.550"))).toBeInTheDocument(); // Impuestos
    expect(screen.getByText(`-${fmtText("0")}`)).toBeInTheDocument(); // Descuentos
    expect(screen.getByText(fmtText("53.550"))).toBeInTheDocument(); // Total
    expect(screen.getByText(fmtText("5.000"))).toBeInTheDocument(); // Pagado
    expect(screen.getByText(fmtText("48.550"))).toBeInTheDocument(); // Faltante
    expect(
      screen.getByRole("button", {
        name: `Completar con Efectivo ($${NBSP}48.550)`,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(fmtText("30.000"))).toBeInTheDocument(); // Cart line total (2 x 15.000)
    // change = 0 with these props → row absent
    expect(screen.queryByText("Cambio")).not.toBeInTheDocument();
  });

  it("renders quick cash amounts with the current raw locale output", () => {
    render(<PaymentConfirmationModal {...baseProps} />);

    // Before-value (raw toLocaleString, runtime default locale): "$10.000"
    expect(screen.getByRole("button", { name: "$10.000" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "$20.000" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "$50.000" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "$100.000" }),
    ).toBeInTheDocument();
  });
});
