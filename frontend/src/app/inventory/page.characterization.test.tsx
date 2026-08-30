import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * Characterization (approval) tests for the inventory page.
 *
 * They lock the page's CURRENT behavior BEFORE any S2 pagination change:
 * list rendering, search/category/status/low-stock filters and the
 * client-side name sort. Request-shape specifics (page/limit) are
 * intentionally NOT locked here — pagination behavior is covered by
 * page.pagination.test.tsx.
 */

const useProductsMock = vi.fn();
let productsResponse: {
  data: {
    data: ReturnType<typeof buildProduct>[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  };
  isLoading: boolean;
  isFetching: boolean;
};

const mutationMock = () => ({ mutateAsync: vi.fn(), isPending: false });

vi.mock("@/components/layout/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useProducts", () => ({
  useProducts: (params?: unknown) => useProductsMock(params),
  useCreateProduct: () => mutationMock(),
  useUpdateProduct: () => mutationMock(),
  useDeactivateProduct: () => mutationMock(),
  useDeleteProduct: () => mutationMock(),
  useReactivateProduct: () => mutationMock(),
  useUploadProductImage: () => mutationMock(),
  useUploadProductImageById: () => mutationMock(),
}));

vi.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({
    data: {
      data: [
        { id: "cat-1", name: "General" },
        { id: "cat-2", name: "Dulces" },
      ],
    },
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-1", role: "ADMIN", name: "Admin", email: "a@b.co" },
  }),
}));

vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({
  getApiErrorMessage: () => "Error",
}));

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
    isOpen ? <section>{children}</section> : null,
}));

vi.mock("@/components/ui/ConfirmDialog", () => ({
  ConfirmDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <section data-testid="confirm-dialog" /> : null,
}));

vi.mock("@/components/ui/ImageUpload", () => ({
  ImageUpload: () => <div data-testid="image-upload" />,
}));

vi.mock("@/components/ui/CurrencyInput", () => ({
  CurrencyInput: ({
    label,
    value,
    onChange,
  }: {
    label?: string;
    value?: number | string;
    onChange?: (value: string) => void;
  }) => (
    <input
      aria-label={label}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

vi.mock("@/components/ui/BentoSelect", () => ({
  BentoSelect: ({
    value,
    onChange,
    options,
    label,
    placeholder,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    options?: Array<{ value: string; label: string }>;
    label?: string;
    placeholder?: string;
  }) => (
    <select
      aria-label={label ?? placeholder ?? "select"}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    >
      {options?.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

import InventoryPage from "./page";

function buildProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: `prod-${overrides.name ?? "x"}`,
    name: (overrides.name as string) ?? "Producto",
    sku: "SKU-1",
    barcode: null,
    description: null,
    costPrice: 1000,
    salePrice: 2000,
    stock: 10,
    minStock: 5,
    imageUrl: null,
    categoryId: "cat-1",
    category: { id: "cat-1", name: "General" },
    active: true,
    version: 1,
    ...overrides,
  };
}

function setResponse(
  products: ReturnType<typeof buildProduct>[],
  meta?: Partial<{ total: number; totalPages: number }>,
) {
  productsResponse = {
    data: {
      data: products,
      meta: {
        total: meta?.total ?? products.length,
        page: 1,
        limit: 10,
        totalPages: meta?.totalPages ?? 1,
      },
    },
    isLoading: false,
    isFetching: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setResponse([]);
  useProductsMock.mockImplementation(() => productsResponse);
});

afterEach(() => {
  cleanup();
});

describe("Inventory page — characterization (current behavior)", () => {
  it("renders the fetched products as cards with the total badge", () => {
    setResponse([
      buildProduct({ name: "Panela" }),
      buildProduct({ name: "Arequipe" }),
      buildProduct({ name: "Bocadillo" }),
    ]);

    render(<InventoryPage />);

    expect(screen.getByText("Panela")).toBeInTheDocument();
    expect(screen.getByText("Arequipe")).toBeInTheDocument();
    expect(screen.getByText("Bocadillo")).toBeInTheDocument();
    expect(screen.getByText("3 productos")).toBeInTheDocument();
  });

  it("forwards the search term to the products query", () => {
    render(<InventoryPage />);

    fireEvent.change(screen.getByPlaceholderText("Buscar por nombre, SKU..."), {
      target: { value: "panela" },
    });

    const lastCall = useProductsMock.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(lastCall.search).toBe("panela");
  });

  it("forwards the selected category to the products query", () => {
    render(<InventoryPage />);

    fireEvent.change(screen.getByLabelText("Todas las categorías"), {
      target: { value: "cat-2" },
    });

    const lastCall = useProductsMock.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(lastCall.categoryId).toBe("cat-2");
  });

  it("forwards the status filter to the products query", () => {
    render(<InventoryPage />);

    fireEvent.change(screen.getByLabelText("Estado"), {
      target: { value: "inactive" },
    });

    const lastCall = useProductsMock.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(lastCall.status).toBe("inactive");
  });

  it("low-stock toggle shows only products at or below min stock (client-side)", () => {
    setResponse([
      buildProduct({ name: "Panela Baja", stock: 2, minStock: 5 }),
      buildProduct({ name: "Dulce Sano", stock: 9, minStock: 5 }),
    ]);

    render(<InventoryPage />);

    fireEvent.click(
      screen.getByRole("button", { name: /^Stock Bajo( ?\d+)?$/ }),
    );

    expect(screen.getByText("Panela Baja")).toBeInTheDocument();
    expect(screen.queryByText("Dulce Sano")).not.toBeInTheDocument();
    expect(screen.getByText("stock bajo")).toBeInTheDocument();
  });

  it("sorts the visible products by name regardless of server order", () => {
    setResponse([
      buildProduct({ name: "Zeta" }),
      buildProduct({ name: "Alfa" }),
      buildProduct({ name: "Mango" }),
    ]);

    render(<InventoryPage />);

    const zeta = screen.getByText("Zeta");
    const alfa = screen.getByText("Alfa");
    const mango = screen.getByText("Mango");

    expect(alfa.compareDocumentPosition(mango) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mango.compareDocumentPosition(zeta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
