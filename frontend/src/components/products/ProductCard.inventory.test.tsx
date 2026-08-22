import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductCard } from "@/components/products/ProductCard";

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
