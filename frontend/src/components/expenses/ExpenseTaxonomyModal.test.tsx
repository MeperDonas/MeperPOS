import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({ children, title, size }: { children: React.ReactNode; title: string; size?: string }) => (
    <section data-modal-size={size}><h2>{title}</h2>{children}</section>
  ),
}));
vi.mock("@/hooks/useExpenses", () => ({
  useExpenseGroups: () => ({ data: [{ id: "g1", name: "Gastos del local", active: true, labels: [{ id: "l1", name: "Arriendo", active: true }] }] }),
  useCreateExpenseGroup: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpenseGroup: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteExpenseGroup: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateExpenseLabel: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpenseLabel: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteExpenseLabel: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { role: "ADMIN" } }) }));
vi.mock("@/contexts/ToastContext", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

import { ExpenseTaxonomyModal } from "./ExpenseTaxonomyModal";

describe("ExpenseTaxonomyModal", () => {
  it("renders groups and nested labels for an administrator", () => {
    render(<ExpenseTaxonomyModal isOpen onClose={vi.fn()} />);
    expect(screen.getByText("Gastos del local")).toBeInTheDocument();
    expect(screen.getByText("Arriendo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /nuevo grupo/i })).toBeInTheDocument();
  });

  it("uses a wide modal and responsive group layout", () => {
    render(<ExpenseTaxonomyModal isOpen onClose={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Gestionar categorías" }).closest("section"),
    ).toHaveAttribute("data-modal-size", "xl");
    expect(screen.getByText("Gastos del local").closest(".grid")).toHaveClass(
      "md:grid-cols-2",
    );
    expect(screen.getByLabelText("Nuevo grupo").closest(".flex")).toHaveClass(
      "flex-col",
      "sm:flex-row",
    );
  });
});
