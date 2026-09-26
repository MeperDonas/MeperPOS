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
  // The server ships the low-stock flag; the card renders it and never re-derives it.
  isLowStock: false,
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

  it("shows 'Stock bajo' chip with alert dot when the server flags low stock", () => {
    render(
      <ProductCard
        product={{ ...baseProduct, stock: 3, isLowStock: true }}
        mode="inventory"
      />,
    );

    expect(screen.getByText("Stock bajo")).toBeInTheDocument();
    expect(screen.getByTestId("stock-alert-icon")).toBeInTheDocument();
  });

  it("does not show 'Stock bajo' when the numbers would qualify but the server flag is false", () => {
    // The drift this guards: an untracked product can carry stale stock/minStock. The
    // server rule says false, so the card must read the flag, not the arithmetic.
    render(
      <ProductCard
        product={{ ...baseProduct, stock: 1, isLowStock: false }}
        mode="inventory"
      />,
    );

    expect(screen.queryByText("Stock bajo")).toBeNull();
    expect(screen.getByText("Activo")).toBeInTheDocument();
  });

  it("shows 'Agotado' chip when stock is 0", () => {
    render(
      <ProductCard
        // A tracked product at zero IS low on stock server-side, so the flag is true here:
        // "Agotado" must still win the status chain over the lower-severity low stock.
        product={{ ...baseProduct, stock: 0, isLowStock: true }}
        mode="inventory"
      />,
    );

    expect(screen.getByText("Agotado")).toBeInTheDocument();
    expect(screen.getByTestId("stock-alert-icon")).toBeInTheDocument();
  });

  it("shows a 'Servicio' chip instead of an 'Agotado' chip when the item is a service", () => {
    render(
      <ProductCard
        product={{ ...baseProduct, type: "SERVICE", stock: 0 }}
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

    expect(screen.getByTestId("product-stock")).toHaveTextContent("Servicio");
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

    const stockBadge = screen.getByTestId("product-stock");
    expect(stockBadge).toHaveTextContent("Sin inventario");
    expect(screen.getByText("Precio").parentElement).not.toContainElement(stockBadge);
    expect(screen.queryByText("0 uds.")).toBeNull();
  });

  it("does not show stock alerts for untracked goods even when stored stock is low", () => {
    render(
      <ProductCard product={{ ...baseProduct, tracksStock: false, stock: 3 }} mode="inventory" />,
    );

    expect(screen.getByTestId("untracked-chip")).toHaveTextContent("Sin inventario");
    expect(screen.getByTestId("product-stock")).toHaveTextContent("Sin inventario");
    expect(screen.queryByText("3 uds.")).toBeNull();
    expect(screen.queryByTestId("stock-alert-icon")).toBeNull();
  });

  it.each([true, null, undefined])("shows stored stock for tracked goods with tracksStock=%s", (flag) => {
    render(
      <ProductCard product={{ ...baseProduct, tracksStock: flag, stock: 7 }} mode="inventory" />,
    );

    expect(screen.getByText("7 uds.")).toBeInTheDocument();
    expect(screen.queryByTestId("untracked-chip")).toBeNull();
  });

  it("keeps service status ahead of the untracked flag", () => {
    render(
      <ProductCard product={{ ...baseProduct, type: "SERVICE", tracksStock: false, stock: 0 }} mode="inventory" />,
    );

    expect(screen.getByTestId("service-chip")).toHaveTextContent("Servicio");
    expect(screen.getByTestId("product-stock")).toHaveTextContent("Servicio");
    expect(screen.queryByTestId("untracked-chip")).toBeNull();
  });

  it("keeps inactive status ahead of the untracked flag", () => {
    render(
      <ProductCard product={{ ...baseProduct, tracksStock: false, stock: 0, active: false }} mode="inventory" />,
    );

    expect(screen.getByText("Inactivo")).toBeInTheDocument();
    expect(screen.queryByTestId("untracked-chip")).toBeNull();
    expect(screen.queryByTestId("stock-alert-icon")).toBeNull();
  });

  it("shows 'Inactivo' rather than 'Servicio' when a service has been deactivated", () => {
    render(
      <ProductCard
        product={{
          ...baseProduct,
          type: "SERVICE",
          stock: 0,
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

describe("ProductCard inventory mode — separate price and stock", () => {
  it("renders stock count apart from the price panel", () => {
    render(<ProductCard product={baseProduct} mode="inventory" />);
    expect(screen.getByText("20 uds.")).toBeInTheDocument();
    expect(screen.getByText("Precio").parentElement).not.toContainElement(screen.getByTestId("product-stock"));
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

describe("ProductCard inventory mode — full-card edit target", () => {
  it("exposes an edge-to-edge edit button over the media, details, and empty card space", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <ProductCard product={baseProduct} mode="inventory" onClick={onEdit} />,
    );

    const card = container.firstElementChild;
    const editTarget = screen.getAllByRole("button", { name: /editar producto: camisa de lino natural/i })
      .find((button) => button.classList.contains("inset-0"));
    // JSDOM cannot hit-test CSS. An absolute inset-0 button is the full-card
    // interaction surface, including blank space that has no content element.
    expect(card).toHaveClass("relative");
    expect(editTarget).toHaveClass("absolute", "inset-0");
    expect(editTarget?.parentElement).toBe(card);
    await user.click(editTarget!);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("keeps deactivation outside the full-card edit target", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <ProductCard product={baseProduct} mode="inventory" onClick={onEdit} onDelete={onDelete} />,
    );

    const editTarget = screen.getAllByRole("button", { name: /editar producto: camisa de lino natural/i })
      .find((button) => button.classList.contains("inset-0"));
    const deactivate = screen.getByRole("button", { name: /desactivar producto/i });
    expect(editTarget).toBeDefined();
    expect(editTarget).not.toContainElement(deactivate);
    expect(container.querySelector("button button")).toBeNull();
    await user.click(deactivate);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
    await user.click(editTarget!);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("keeps reactivation outside the full-card edit target for inactive products", async () => {
    const onEdit = vi.fn();
    const onReactivate = vi.fn();
    const user = userEvent.setup();
    render(
      <ProductCard product={{ ...baseProduct, active: false }} mode="inventory" onClick={onEdit} onReactivate={onReactivate} />,
    );

    const editTarget = screen.getAllByRole("button", { name: /editar producto: camisa de lino natural/i })
      .find((button) => button.classList.contains("inset-0"));
    const reactivate = screen.getByRole("button", { name: /reactivar producto/i });
    expect(editTarget).toHaveClass("absolute", "inset-0");
    expect(editTarget).not.toContainElement(reactivate);
    await user.click(reactivate);
    expect(onReactivate).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
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

describe("ProductCard — responsive action and price hierarchy", () => {
  it("gives POS a dedicated add button that invokes the cart action once", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(<ProductCard product={baseProduct} mode="pos" onClick={onAdd} />);

    const add = screen.getByRole("button", { name: /^\+ agregar$/i });
    expect(add.tagName).toBe("BUTTON");
    expect(screen.queryByRole("button", { name: /editar producto/i })).toBeNull();
    await user.click(add);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("keeps the POS media/body clickable and keyboard-operable without nesting action buttons", async () => {
    const onAdd = vi.fn();
    const onToggleFavorite = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <ProductCard product={baseProduct} mode="pos" onClick={onAdd} onToggleFavorite={onToggleFavorite} />,
    );

    const cardAction = screen.getByRole("button", { name: /agregar al carrito: camisa de lino natural/i });
    expect(cardAction.tagName).toBe("BUTTON");
    expect(container.querySelector("button button")).toBeNull();
    await user.click(cardAction);
    cardAction.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onAdd).toHaveBeenCalledTimes(3);
    expect(onToggleFavorite).not.toHaveBeenCalled();
  });

  it("keeps inventory management actions separate from POS add", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <ProductCard
        product={baseProduct}
        mode="inventory"
        onClick={onEdit}
        onDelete={onDelete}
      />,
    );

    expect(screen.queryByRole("button", { name: /^\+ agregar$/i })).toBeNull();
    expect(screen.getByRole("button", { name: /editar producto: camisa de lino natural/i })).toBeInTheDocument();
    const edit = screen.getByRole("button", { name: /^editar producto$/i });
    expect(edit).toHaveAttribute("title", "Editar producto");
    expect(edit).toHaveClass("h-11", "w-11");
    expect(edit).not.toHaveTextContent("Editar");
    expect(screen.getByRole("button", { name: /desactivar producto/i })).toHaveClass("h-11", "w-11");
    await user.click(edit);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it.each(["pos", "inventory"] as const)(
    "prioritizes the promotional selling price before quiet stock in %s mode",
    (mode) => {
      render(
        <ProductCard
          product={{
            ...baseProduct,
            salePrice: 10000,
            effectiveSalePrice: 8000,
            promotionType: "PERCENTAGE",
            promotionValue: 20,
          }}
          mode={mode}
        />,
      );

      const sellingPrice = screen.getByTestId("offer-effective-price");
      const listPrice = screen.getByTestId("offer-list-price");
      const stock = screen.getByText("20 uds.");
      // Keep the actual NBSP emitted by Intl.NumberFormat; the matcher normalizes it.
      expect(sellingPrice.textContent).toContain(formatCurrency(8000));
      expect(listPrice.textContent).toContain(formatCurrency(10000));
      expect(listPrice.tagName).toBe("S");
      expect(sellingPrice.compareDocumentPosition(listPrice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(listPrice.compareDocumentPosition(stock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      // A two-column phone card must not clip the actual selling price.
      expect(sellingPrice).not.toHaveClass("truncate");
    },
  );

  it.each(["pos", "inventory"] as const)(
    "allows a long SKU to wrap or ellipsize inside a narrow %s card",
    (mode) => {
      const longSku = "CAMISA-LINO-NATURAL-EXTRA-LARGA-SKU-000001";
      render(
        <ProductCard product={{ ...baseProduct, sku: longSku }} mode={mode} />,
      );

      const sku = screen.getByText(longSku);
      // JSDOM has no layout engine: assert the intrinsic overflow guard, not pixels.
      expect(sku.className).toMatch(/(?:^|\s)(?:break-all|break-words|truncate|overflow-hidden|\[overflow-wrap:anywhere\])(?=\s|$)/);
    },
  );

  it("toggles a POS favorite by keyboard without adding the product", async () => {
    const onAdd = vi.fn();
    const onToggleFavorite = vi.fn();
    const user = userEvent.setup();
    render(
      <ProductCard
        product={baseProduct}
        mode="pos"
        onClick={onAdd}
        onToggleFavorite={onToggleFavorite}
      />,
    );

    const favorite = screen.getByRole("button", { name: /agregar a favoritos/i });
    favorite.focus();
    await user.keyboard("{Enter}");
    await user.click(favorite);
    expect(onToggleFavorite).toHaveBeenCalledTimes(2);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("does not add inactive POS products on click or keyboard activation", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(
      <ProductCard
        product={{ ...baseProduct, active: false }}
        mode="pos"
        onClick={onAdd}
      />,
    );

    const card = screen.getByRole("button", { name: /agregar al carrito: camisa de lino natural/i });
    expect(card).toHaveAttribute("aria-disabled", "true");
    await user.click(card);
    card.focus();
    await user.keyboard("{Enter}");
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("allows untracked goods at zero stock through both POS add actions", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(
      <ProductCard product={{ ...baseProduct, tracksStock: false, stock: 0 }} mode="pos" onClick={onAdd} />,
    );

    const add = screen.getByRole("button", { name: /^\+ agregar$/i });
    const card = screen.getByRole("button", { name: /agregar al carrito/i });
    expect(add).not.toBeDisabled();
    expect(card).toHaveAttribute("aria-disabled", "false");
    expect(screen.getByTestId("untracked-chip")).toHaveTextContent("Sin inventario");
    expect(screen.getByTestId("product-stock")).toHaveTextContent("Sin inventario");
    expect(screen.queryByText("0 uds.")).toBeNull();
    expect(screen.queryByTestId("stock-alert-icon")).toBeNull();
    await user.click(add);
    await user.click(card);
    expect(onAdd).toHaveBeenCalledTimes(2);
  });

  it("disables both POS add actions for inactive untracked goods", () => {
    render(
      <ProductCard product={{ ...baseProduct, tracksStock: false, stock: 0, active: false }} mode="pos" onClick={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: /^\+ agregar$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /agregar al carrito/i })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Inactivo")).toBeInTheDocument();
    expect(screen.queryByTestId("untracked-chip")).toBeNull();
  });

  it("disables cart addition for depleted goods but not stockless services", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <ProductCard product={{ ...baseProduct, stock: 0 }} mode="pos" onClick={onAdd} />,
    );

    expect(screen.getByRole("button", { name: /^\+ agregar$/i })).toHaveAttribute("disabled");
    const depletedCard = screen.getByRole("button", { name: /agregar al carrito/i });
    expect(depletedCard).toHaveAttribute("aria-disabled", "true");
    await user.click(depletedCard);
    expect(onAdd).not.toHaveBeenCalled();
    rerender(
      <ProductCard
        product={{ ...baseProduct, type: "SERVICE", stock: 0 }}
        mode="pos"
        onClick={onAdd}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^\+ agregar$/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
