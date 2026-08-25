import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileCartFloatingBar } from "./MobileCartFloatingBar";
import type { CartItem } from "@/types";

const mockCartItem: CartItem = {
  productId: "prod-1",
  product: {
    id: "prod-1",
    name: "Aceite 4T",
    sku: "OIL-4T",
    salePrice: 35000,
    stock: 5,
    active: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    organizationId: "org-1",
  },
  quantity: 3,
  unitPrice: 35000,
  originalUnitPrice: 35000,
  availableStock: 5,
  discountAmount: 0,
};

describe("MobileCartFloatingBar", () => {
  it("renders nothing when cart is empty", () => {
    const { container } = render(
      <MobileCartFloatingBar cart={[]} total={0} onClick={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders floating bar with total items and sum, and triggers onClick when tapped", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <MobileCartFloatingBar
        cart={[mockCartItem]}
        total={105000}
        onClick={handleClick}
      />,
    );

    expect(screen.getByText("Ver Carrito")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Abrir")).toBeInTheDocument();

    const barButton = screen.getByRole("button", { name: /Ver carrito/i });
    await user.click(barButton);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
