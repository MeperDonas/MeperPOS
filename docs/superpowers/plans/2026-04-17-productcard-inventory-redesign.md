# ProductCard inventory redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar el branch `mode === "inventory"` de `ProductCard` siguiendo la estética editorial cálida definida en `docs/superpowers/specs/2026-04-17-productcard-inventory-redesign-design.md`, usando exclusivamente tokens del sistema.

**Architecture:** Cambio contenido en un solo archivo (`frontend/src/components/products/ProductCard.tsx`) — solo la rama `mode === "inventory"`. La rama `mode === "pos"` y la API del componente (`ProductCardProps`, `ProductCardData`) no se modifican. Tres bandas horizontales: imagen 4:3 limpia / meta (nombre + chip categoría + precio + stock chip) / pie dedicado con `Desactivar` o `Reactivar`. Se añade un test de comportamiento (`ProductCard.inventory.test.tsx`) que cubre las reglas con lógica: variantes del stock chip, badge `Inactivo`, ausencia de botón cuando no hay permisos, `stopPropagation` del pie y activación por teclado.

**Tech Stack:** React 19, Next.js 16, TypeScript, TailwindCSS v4 (con tokens CSS de `globals.css`), `lucide-react` (íconos), `next/image`, Vitest + `@testing-library/react` + `@testing-library/user-event`.

---

## File structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `frontend/src/components/products/ProductCard.tsx` | **Modify** (solo el branch `mode === "inventory"`) | Renderizado de la card de producto en modo inventario |
| `frontend/src/components/products/ProductCard.inventory.test.tsx` | **Create** | Tests de comportamiento (variantes de estado, a11y, stopPropagation) |

Todas las rutas se resuelven contra la raíz del repo: `C:\Users\meper\Desktop\Proyecto de Grado\MeperPOS`.

---

### Task 1: Tests de comportamiento para `ProductCard` en modo `inventory`

**Files:**
- Create: `frontend/src/components/products/ProductCard.inventory.test.tsx`

- [ ] **Step 1: Escribir el test file completo (failing)**

Contenido exacto de `frontend/src/components/products/ProductCard.inventory.test.tsx`:

```tsx
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

describe("ProductCard inventory mode — stock chip variants", () => {
  it("shows neutral '{n} uds.' chip when stock is healthy", () => {
    render(<ProductCard product={baseProduct} mode="inventory" />);

    const chip = screen.getByText("20 uds.");
    expect(chip.className).toContain("bg-muted/60");
    expect(chip.className).toContain("text-foreground");
    expect(screen.queryByTestId("stock-alert-icon")).toBeNull();
  });

  it("shows terracotta chip with alert icon when stock <= minStock", () => {
    render(
      <ProductCard
        product={{ ...baseProduct, stock: 3, minStock: 5 }}
        mode="inventory"
      />,
    );

    const chip = screen.getByText("3 uds.");
    expect(chip.className).toContain("text-primary");
    expect(chip.className).toContain("border-primary/30");
    expect(screen.getByTestId("stock-alert-icon")).toBeInTheDocument();
  });

  it("shows 'Agotado' chip when stock is 0", () => {
    render(
      <ProductCard
        product={{ ...baseProduct, stock: 0 }}
        mode="inventory"
      />,
    );

    const chip = screen.getByText("Agotado");
    expect(chip.className).toContain("text-primary");
    expect(chip.className).toContain("border-primary/40");
    expect(screen.getByTestId("stock-alert-icon")).toBeInTheDocument();
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
```

- [ ] **Step 2: Verificar que los tests fallan contra el componente actual**

Run: `cd frontend && npm run test -- ProductCard.inventory`

Expected: los tests FALLAN porque:
- el componente actual muestra `20` (no `20 uds.`),
- no existe `data-testid="stock-alert-icon"`,
- no renderiza `role="button"` en el card,
- no usa las clases `bg-muted/60` / `text-primary` / `border-primary/30` del spec,
- no muestra texto `Sin categoría` (hoy escribe `Sin categoria` sin tilde),
- no renderiza label `Desactivar` / `Reactivar` (hoy son íconos solos con tooltip).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/products/ProductCard.inventory.test.tsx
git commit -m "test(ProductCard): add behavior tests for inventory mode redesign"
```

---

### Task 2: Reescribir el branch `mode === "inventory"` del `ProductCard`

**Files:**
- Modify: `frontend/src/components/products/ProductCard.tsx` (únicamente las líneas del bloque `if (mode === "inventory") { ... return (...); }` — aproximadamente 46–196 del archivo actual. La rama `mode === "pos"` y los imports se preservan salvo lo indicado abajo).

- [ ] **Step 1: Ajustar imports**

Al principio del archivo, donde hoy dice:

```ts
import { Package, Power, RotateCcw, Star } from "lucide-react";
```

Dejarlo **igual**. `Package`, `Power`, `RotateCcw` siguen usándose en la rama nueva; `Star` se sigue usando en la rama `mode === "pos"`. Añadir `AlertTriangle`:

```ts
import { AlertTriangle, Package, Power, RotateCcw, Star } from "lucide-react";
```

- [ ] **Step 2: Reescribir el bloque `if (mode === "inventory")` completo**

Reemplazar todo el contenido entre `if (mode === "inventory") {` y el `}` que cierra antes de `const categoryLabel = product.category?.name || "Sin categoria";` (la línea que inicia la rama POS) por:

```tsx
  if (mode === "inventory") {
    const categoryLabel = product.category?.name ?? null;
    const hasCategory = categoryLabel !== null && categoryLabel.length > 0;
    const hasMinStock = typeof product.minStock === "number";
    const isOutOfStock = product.stock === 0;
    const isLowStockStrict =
      hasMinStock && product.stock > 0 && product.stock <= (product.minStock as number);
    const showStockAlert = isOutOfStock || isLowStockStrict;

    const stockChipClasses = cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold font-mono tabular-nums",
      isOutOfStock
        ? "bg-primary/15 border-primary/40 text-primary"
        : isLowStockStrict
          ? "bg-primary/10 border-primary/30 text-primary"
          : "bg-muted/60 border-border/60 text-foreground",
    );

    const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!onClick) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onClick();
      }
    };

    const showFooter = Boolean(onDelete || onReactivate);
    const isReactivate = !onDelete && Boolean(onReactivate);

    return (
      <div
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={onClick ? `Editar producto: ${product.name}` : undefined}
        onClick={onClick ? () => onClick() : undefined}
        onKeyDown={onClick ? handleCardKeyDown : undefined}
        className={cn(
          "group flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-all duration-200 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          onClick && isActive
            ? "cursor-pointer hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
            : onClick
              ? "cursor-pointer"
              : "cursor-default",
          !isActive && "opacity-60",
        )}
      >
        {/* Banda 1 — Imagen */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-t-2xl bg-muted">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              aria-hidden="true"
            >
              <Package className="h-10 w-10 text-muted-foreground/40" />
            </div>
          )}
          {!isActive && (
            <span className="absolute right-2.5 top-2.5 inline-flex items-center rounded-full border border-border/60 bg-card/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-md">
              Inactivo
            </span>
          )}
        </div>

        {/* Banda 2 — Meta */}
        <div className="flex flex-1 flex-col px-4 py-3.5">
          <p className="line-clamp-2 min-h-[38px] text-[15px] font-bold leading-tight text-foreground">
            {product.name}
          </p>
          <div className="mt-1.5">
            <span
              className={cn(
                "inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium",
                hasCategory ? "text-muted-foreground" : "text-muted-foreground/60",
              )}
            >
              {hasCategory ? categoryLabel : "Sin categoría"}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
            <p className="text-xl font-black leading-none tracking-tight text-primary tabular-nums">
              {formatCurrency(product.salePrice)}
            </p>
            <span className={stockChipClasses}>
              {showStockAlert && (
                <AlertTriangle
                  data-testid="stock-alert-icon"
                  className="h-3 w-3"
                  aria-hidden="true"
                />
              )}
              {isOutOfStock ? "Agotado" : `${product.stock} uds.`}
            </span>
          </div>
        </div>

        {/* Banda 3 — Pie de acción */}
        {showFooter && (
          <button
            type="button"
            aria-label={
              isReactivate ? "Reactivar producto" : "Desactivar producto"
            }
            onClick={(event) => {
              event.stopPropagation();
              if (onDelete) {
                onDelete();
                return;
              }
              onReactivate?.();
            }}
            className={cn(
              "flex w-full items-center gap-2 border-t border-border/60 px-4 py-2.5 text-xs font-semibold",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset",
              isReactivate
                ? "text-accent hover:bg-accent/10 opacity-100"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {isReactivate ? (
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Power className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{isReactivate ? "Reactivar" : "Desactivar"}</span>
          </button>
        )}
      </div>
    );
  }
```

Nota: este bloque usa `isActive`, que hoy ya existe en el componente como `const isInactive = product.active === false;`. Cambiar esa línea justo arriba del `if (mode === "inventory")` (línea ~40) para que quede:

```ts
  const isInactive = product.active === false;
  const isActive = !isInactive;
  const isLowStock =
    typeof product.minStock === "number"
      ? product.stock <= product.minStock
      : false;
```

Mantener `isLowStock` porque se sigue usando en el branch `mode === "pos"`.

- [ ] **Step 3: Eliminar el componente `Card`/`CardContent` del branch inventory**

El branch nuevo devuelve directamente un `<div>` (con toda la semántica y estilos), sin envolver en `Card` ni `CardContent`. Verificar que no queda ninguna referencia a `<Card>` ni `<CardContent>` dentro del branch inventory. El `import { Card, CardContent } from "@/components/ui/Card";` se mantiene porque sigue siendo usado por el branch `mode === "pos"`.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd frontend && npm run test -- ProductCard.inventory`

Expected: los 10 tests del archivo `ProductCard.inventory.test.tsx` pasan.

Si algún test falla, leer el mensaje, corregir el componente (no el test — el test refleja el spec), re-ejecutar.

- [ ] **Step 5: Correr lint para asegurar que el archivo cumple ESLint**

Run: `cd frontend && npm run lint`

Expected: sin errores en `frontend/src/components/products/ProductCard.tsx`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/products/ProductCard.tsx
git commit -m "refactor(ProductCard): rediseño editorial del modo inventory"
```

---

### Task 3: Verificación visual manual y ajustes finos

**Files:**
- No hay archivos a modificar obligatoriamente. Solo se modifica el componente si aparece algún issue visual durante la verificación.

- [ ] **Step 1: Levantar el dev server del frontend**

Run: `cd frontend && npm run dev`

Expected: servidor corriendo en `http://localhost:3000`.

- [ ] **Step 2: Abrir la página de inventario y verificar escenarios en modo claro y oscuro**

Navegar a `http://localhost:3000/inventory` (autenticado como ADMIN o INVENTORY_USER).

Checklist visual:
- [ ] Card con producto activo y stock OK: imagen limpia, nombre + chip categoría + precio terracota + chip neutro `N uds.`, pie con `Desactivar` en gris.
- [ ] Filtrar "Stock bajo": el chip del stock se ve con fondo terracota claro y ícono `AlertTriangle`.
- [ ] Producto con `stock === 0`: chip dice `Agotado`.
- [ ] Filtrar "Inactivos": la card se ve al 60 %, badge `Inactivo` arriba-derecha, pie con `Reactivar` en sage a opacidad 100 %.
- [ ] Alternar tema (claro / oscuro desde el toggle del header): ninguna card queda oscura en modo claro; los colores respetan la paleta.
- [ ] Hover sobre una card: la card eleva levemente, la imagen hace scale muy sutil.
- [ ] Tab con teclado hasta una card: aparece ring de foco visible; Enter abre el modal.
- [ ] Click en el botón `Desactivar` del pie: abre el diálogo de desactivación (no el modal de edición).
- [ ] Rol CASHIER (si se puede simular): la banda 3 no aparece.

- [ ] **Step 3: Si hay issues visuales, ajustar `ProductCard.tsx` y commitear**

Solo si hay problemas reales durante el checklist. Si algo se ajusta:

```bash
git add frontend/src/components/products/ProductCard.tsx
git commit -m "style(ProductCard): ajuste tras verificación visual"
```

Si la verificación pasa sin cambios, no hay commit en este paso.

- [ ] **Step 4: Detener el dev server**

Ctrl+C en la terminal donde corre `npm run dev`.

---

## Resumen de commits esperados

1. `test(ProductCard): add behavior tests for inventory mode redesign`
2. `refactor(ProductCard): rediseño editorial del modo inventory`
3. (opcional) `style(ProductCard): ajuste tras verificación visual`

## Self-review

- **Spec coverage**: cada sección del spec está cubierta por al menos una tarea:
  - §4.2 (anatomía 3 bandas) → Task 2 steps 2–3.
  - §4.3 (contenedor y hover) → Task 2 step 2 (clases en el `<div>` raíz).
  - §4.4 (imagen, badge inactivo, fallback) → Task 2 step 2 (banda 1).
  - §4.5 (meta, chip categoría, precio, stock chip con 3 variantes) → Task 2 step 2 (banda 2) + Task 1 tests de variantes + categoría.
  - §4.6 (pie condicional, desactivar/reactivar, stopPropagation, focus ring, opacity override) → Task 2 step 2 (banda 3) + Task 1 tests de footer.
  - §4.7 (matriz de estados) → cubierta combinadamente por Task 1 (variantes de chip + inactive) y Task 2 (clases `opacity-60` y override en pie).
  - §4.8 (a11y: role, tabIndex, aria-label, keyboard Enter/Space, focus ring, alt) → Task 2 step 2 + Task 1 tests de teclado y ARIA.
  - §4.9 (API sin cambios) → Task 2 no toca `ProductCardProps` ni `ProductCardData`.
  - §5 (eliminaciones) → Task 2 step 2 reemplaza el bloque completo, removiendo hex hardcodeados, fuente fantasma, gradientes, duplicados, radios asimétricos y botón flotante.
  - §7 (plan de verificación) → Task 3.
- **Placeholder scan**: ningún `TBD`, `TODO`, ni código ausente. Todos los bloques de código son literales a copiar.
- **Type consistency**: `onDelete`, `onReactivate`, `onClick`, `product`, `mode` se usan con las mismas firmas que `ProductCardProps` del archivo actual. `AlertTriangle`, `Package`, `Power`, `RotateCcw` provienen todos de `lucide-react`.
