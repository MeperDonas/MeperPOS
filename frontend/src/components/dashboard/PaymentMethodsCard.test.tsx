import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PaymentMethodsCard } from "./PaymentMethodsCard";
import { formatCurrency } from "@/lib/utils";
import type { SaleByPaymentMethod } from "@/types";

const useSalesByPaymentMethodMock = vi.fn();

vi.mock("@/hooks/useReports", () => ({
  useSalesByPaymentMethod: (startDate: string, endDate: string) =>
    useSalesByPaymentMethodMock(startDate, endDate),
}));

const rows: SaleByPaymentMethod[] = [
  { paymentMethod: "CASH", total: 50000, subtotal: 0, count: 2 },
  { paymentMethod: "CARD", total: 30000, subtotal: 0, count: 1 },
  { paymentMethod: "TRANSFER", total: 20000, subtotal: 0, count: 1 },
];

describe("PaymentMethodsCard (Recharts donut)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSalesByPaymentMethodMock.mockReturnValue({ data: { data: rows } });
  });

  afterEach(() => {
    cleanup();
  });

  it("fetches its own window from the range props", () => {
    render(<PaymentMethodsCard startDate="2026-08-16" endDate="2026-08-22" />);

    expect(useSalesByPaymentMethodMock).toHaveBeenCalledWith(
      "2026-08-16",
      "2026-08-22",
    );
  });

  it("renders exactly the three real methods with their share percentages", () => {
    render(<PaymentMethodsCard startDate="2026-08-16" endDate="2026-08-22" />);

    const methodRows = screen.getAllByTestId("payment-method-row");
    expect(methodRows).toHaveLength(3);

    expect(screen.getByText("Efectivo")).toBeTruthy();
    expect(screen.getByText("Tarjeta")).toBeTruthy();
    expect(screen.getByText("Transferencia")).toBeTruthy();

    const percentages = screen
      .getAllByTestId("payment-method-percentage")
      .map((node) => node.textContent);
    expect(percentages).toEqual(["50%", "30%", "20%"]);
  });

  it("shows the window total in the centre of the donut", () => {
    render(<PaymentMethodsCard startDate="2026-08-16" endDate="2026-08-22" />);

    expect(screen.getByTestId("payment-methods-chart")).toBeTruthy();
    expect(screen.getByTestId("payment-methods-total").textContent).toBe(
      formatCurrency(100000),
    );
  });

  it("never fabricates an 'Otros' bucket", () => {
    render(<PaymentMethodsCard startDate="2026-08-16" endDate="2026-08-22" />);

    expect(screen.queryByText(/Otros/)).toBeNull();
    expect(screen.getAllByTestId("payment-method-row")).toHaveLength(3);
  });
});
