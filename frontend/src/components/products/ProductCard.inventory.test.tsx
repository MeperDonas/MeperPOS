import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductCard } from "@/components/products/ProductCard";
import { formatCurrency } from "@/lib/utils";

const baseProduct = {
  id: "p-1",
  name: "Camisa de lino natural",
  sku: "SKU-0001",
  imageUrl: null,
  stock: 20,
  salePrice: 45000,
  minStock: 5,
  category: { name: "Ropa" },
  active: true,
};

describe("ProductCard inventory mode — status chip", () => {
  it("shows 'Activo' chip with a luminous dot when stock is healthy", () => {
    render(<ProductCard product={baseProduct} mode="inventory" />);

    const chip = screen.getByText("Activo");
    expect(chip).toBeInTheDocument();
    // single dot, no duplicate bullet char
    expect(screen.queryByText("•")).toBeNull();
  });

  it("shows 'Stock bajo' chip with alert dot when stock <= minStock", () => {
    render(
      <ProductCard
        product={{ ...baseProduct, stock: 3, minStock: 5 }}
        mode="inventory"
      />,
    );

    expect(screen.getByText("Stock bajo")).toBeInTheDocument();
    expect(screen.getByTestId("stock-alert-icon")).toBeInTheDocument();
  });

  it("shows 'Agotado' chip when stock is 0", () => {
    render(
      <ProductCard
        product={{ ...baseProduct, stock: 0 }}
        mode="inventory"
      />,
    );

    expect(screen.getByText("Agotado")).toBeInTheDocument();
    expect(screen.getByTestId("stock-alert-icon")).toBeInTheDocument();
  });

  it("shows a 'Servicio' chip instead of an 'Agotado' chip when the item is a service", () => {
    render(
      <ProductCard
        product={{ ...baseProduct, type: "SERVICE", stock: 0, minStock: 5 }}
        mode="inventory"
      />,
    );

    const chip = screen.getByTestId("service-chip");
    expect(chip.textContent?.trim()).toBe("Servicio");

    // A service is sold labour: it can never be out of stock, so neither the out-of-stock
    // nor the low-stock chip may appear, and the stock badge must not read "0 uds.".
    expect(screen.queryByText("Agotado")).toBeNull();
    expect(screen.queryByText("Stock bajo")).toBeNull();
    expect(screen.queryByTestId("stock-alert-icon")).toBeNull();

    // The dual-metrics stock badge is the sibling of the "Precio" label.
    const stockBadge = screen.getByText("Precio").parentElement?.lastElementChild;
    expect(stockBadge?.textContent?.trim()).toBe("Servicio");
    expect(screen.queryByText("0 uds.")).toBeNull();
  });

  it("shows a 'Sin inventario' chip instead of an 'Agotado' chip when the product is untracked", () => {
    render(
      <ProductCard
        product={{
          ...baseProduct,
          type: "PRODUCT",
          tracksStock: false,
          stock: 0,
          minStock: 5,
        }}
        mode="inventory"
      />,
    );

    const chip = screen.getByTestId("untracked-chip");
    expect(chip.textContent?.trim()).toBe("Sin inventario");

    // An untracked product is real merchandise nobody counts: it can never be out of
    // stock nor low on stock, so no stock alert chip may appear, and the stock badge
    // must not read the stored "0 uds.".
    expect(screen.queryByText("Agotado")).toBeNull();
    expect(screen.queryByText("Stock bajo")).toBeNull();
    expect(screen.queryByTestId("stock-alert-icon")).toBeNull();

    // The dual-metrics stock badge is the sibling of the "Precio" label.
    const stockBadge = screen.getByText("Precio").parentElement?.lastElementChild;
    expect(stockBadge?.textContent?.trim()).toBe("Sin inventario");
    expect(screen.queryByText("0 uds.")).toBeNull();
  });

  it("still shows the stock count for an explicitly tracked product", () => {
    render(
      <ProductCard
        product={{ ...baseProduct, tracksStock: true, stock: 7, minStock: 5 }}
        mode="inventory"
      />,
    );

    // The untracked branch must not swallow normal merchandise.
    expect(screen.getByText("7 uds.")).toBeInTheDocument();
    expect(screen.queryByTestId("untracked-chip")).toBeNull();
  });

  it("shows 'Inactivo' rather than 'Servicio' when a service has been deactivated", () => {
    render(
      <ProductCard
        product={{
          ...baseProduct,
          type: "SERVICE",
          stock: 0,
          minStock: 5,
          active: false,
        }}
        mode="inventory"
      />,
    );

    // Deactivating a service must stay visible: a service is sold labour that can never be
    // out of stock, but the inactive state still wins over the type, so the state chip is
    // neither the service chip nor an out-of-stock chip.
    expect(screen.getByText("Inactivo")).toBeInTheDocument();
    expect(screen.queryByTestId("service-chip")).toBeNull();
    expect(screen.queryByTestId("stock-alert-icon")).toBeNull();
  });
});

describe("ProductCard inventory mode — stock block (dual metrics)", () => {
  it("renders stock count in the dual metrics block", () => {
    render(<ProductCard product={baseProduct} mode="inventory" />);
    expect(screen.getByText("20 uds.")).toBeInTheDocument();
  });

  it("renders the formatted COP price", () => {
    render(<ProductCard product={baseProduct} mode="inventory" />);
    expect(screen.getByText("$ 45.000")).toBeInTheDocument();
  });
});

describe("ProductCard inventory mode — inactive state", () => {
  it("renders 'Inactivo' badge and dims the card when product.active === false", () => {
    const { container } = render(
      <ProductCard
        product={{ ...baseProduct, active: false }}
        mode="inventory"
      />,
    );

    expect(screen.getByText("Inactivo")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("opacity-60");
  });

  it("does NOT render 'Inactivo' badge when product is active", () => {
    render(<ProductCard product={baseProduct} mode="inventory" />);
    expect(screen.queryByText("Inactivo")).toBeNull();
  });
});

describe("ProductCard inventory mode — sku below the name", () => {
  it("renders the SKU under the product name", () => {
    render(<ProductCard product={baseProduct} mode="inventory" />);
    expect(screen.getByText("SKU-0001")).toBeInTheDocument();
  });
});

describe("ProductCard inventory mode — footer action", () => {
  it("does NOT render any footer button when neither onDelete nor onReactivate is provided", () => {
    render(<ProductCard product={baseProduct} mode="inventory" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders 'Desactivar' when onDelete is provided and calls it without propagating the click", async () => {
    const onClick = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();

    render(
      <ProductCard
        product={baseProduct}
        mode="inventory"
        onClick={onClick}
        onDelete={onDelete}
      />,
    );

    const button = screen.getByRole("button", { name: /desactivar producto/i });
    await user.click(button);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders 'Reactivar' when onReactivate is provided (and onDelete is not)", async () => {
    const onReactivate = vi.fn();
    const user = userEvent.setup();

    render(
      <ProductCard
        product={{ ...baseProduct, active: false }}
        mode="inventory"
        onReactivate={onReactivate}
      />,
    );

    const button = screen.getByRole("button", { name: /reactivar producto/i });
    await user.click(button);

    expect(onReactivate).toHaveBeenCalledTimes(1);
  });
});

describe("ProductCard inventory mode — keyboard accessibility", () => {
  it("activates onClick with Enter key when focused", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(
      <ProductCard product={baseProduct} mode="inventory" onClick={onClick} />,
    );

    const card = screen.getByRole("button", {
      name: /editar producto: camisa de lino natural/i,
    });
    card.focus();
    await user.keyboard("{Enter}");

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("activates onClick with Space key when focused", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(
      <ProductCard product={baseProduct} mode="inventory" onClick={onClick} />,
    );

    const card = screen.getByRole("button", {
      name: /editar producto: camisa de lino natural/i,
    });
    card.focus();
    await user.keyboard(" ");

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("ProductCard inventory mode — category chip", () => {
  it("renders the category name when provided", () => {
    render(<ProductCard product={baseProduct} mode="inventory" />);
    expect(screen.getByText("Ropa")).toBeInTheDocument();
  });

  it("renders 'Sin categoría' when category is null", () => {
    render(
      <ProductCard
        product={{ ...baseProduct, category: null }}
        mode="inventory"
      />,
    );
    expect(screen.getByText("Sin categoría")).toBeInTheDocument();
  });
});

describe("ProductCard — offer badge and strikethrough (#74)", () => {
  it("renders an 'Oferta' badge and strikes through the list price when a promo is active", () => {
    render(
      <ProductCard
        product={{
          ...baseProduct,
          salePrice: 10000,
          effectiveSalePrice: 8000,
          promotionType: "PERCENTAGE",
          promotionValue: 20,
        }}
        mode="inventory"
      />,
    );

    expect(screen.getByText(/Oferta/)).toBeInTheDocument();
    // The tag carries the approximate discount %.
    expect(screen.getByText(/Oferta/).textContent).toContain("-20%");

    const listPrice = screen.getByTestId("offer-list-price");
    expect(listPrice).toHaveClass("line-through");
    expect(listPrice.textContent).toContain(formatCurrency(10000));
    expect(screen.getByTestId("offer-effective-price").textContent).toContain(
      formatCurrency(8000),
    );
  });

  it("detects the offer even when salePrice arrives as a numeric string (Decimal)", () => {
    render(
      <ProductCard
        product={{
          ...baseProduct,
          salePrice: "10000" as unknown as number,
          effectiveSalePrice: 8000,
          promotionType: "PERCENTAGE",
          promotionValue: 20,
        }}
        mode="inventory"
      />,
    );

    expect(screen.getByText(/Oferta/)).toBeInTheDocument();
    expect(screen.getByText(/Oferta/).textContent).toContain("-20%");
    expect(screen.getByTestId("offer-list-price").textContent).toContain(
      formatCurrency(10000),
    );
    expect(screen.getByTestId("offer-effective-price").textContent).toContain(
      formatCurrency(8000),
    );
  });

  it("renders neither the 'Oferta' badge nor a strikethrough without an active promo", () => {
    render(
      <ProductCard
        product={{ ...baseProduct, salePrice: 45000 }}
        mode="inventory"
      />,
    );

    expect(screen.queryByText(/Oferta/)).toBeNull();
    expect(screen.queryByTestId("offer-list-price")).toBeNull();
    expect(screen.queryByTestId("offer-effective-price")).toBeNull();
  });

  it("shows the offer price and badge in POS mode too", () => {
    render(
      <ProductCard
        product={{
          ...baseProduct,
          salePrice: 19900,
          effectiveSalePrice: 16915,
          promotionType: "PERCENTAGE",
          promotionValue: 15,
        }}
        mode="pos"
        onClick={() => {}}
      />,
    );

    expect(screen.getByText(/Oferta/)).toBeInTheDocument();
    expect(screen.getByText(/Oferta/).textContent).toContain("-15%");
    expect(screen.getByTestId("offer-list-price").textContent).toContain(
      formatCurrency(19900),
    );
    expect(screen.getByTestId("offer-effective-price").textContent).toContain(
      formatCurrency(16915),
    );
  });
});
