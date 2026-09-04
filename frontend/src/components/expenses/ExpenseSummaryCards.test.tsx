import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExpenseSummaryCards } from "./ExpenseSummaryCards";

describe("ExpenseSummaryCards", () => {
  it("shows the total and the highest-level expense groups", () => {
    render(<ExpenseSummaryCards month="2026-08" summary={{ month: "2026-08", total: 500000, groups: [{ groupId: "g1", name: "Gastos del local", total: 500000, labels: [{ labelId: "l1", name: "Arriendo", total: 500000 }] }] }} />);
    expect(screen.getByText("Gastos del local")).toBeInTheDocument();
    expect(screen.getByText(/Arriendo/)).toBeInTheDocument();
    expect(screen.getByText(/Período: 2026-08/)).toBeInTheDocument();
  });
});
