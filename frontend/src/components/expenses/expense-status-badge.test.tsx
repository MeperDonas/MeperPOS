import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExpenseStatusBadge } from "./ExpenseStatusBadge";

describe("ExpenseStatusBadge", () => {
  it("renders Pagado for PAID", () => {
    render(<ExpenseStatusBadge status="PAID" />);

    expect(screen.getByText("Pagado")).toBeInTheDocument();
  });

  it("renders Parcial for PARTIAL", () => {
    render(<ExpenseStatusBadge status="PARTIAL" />);

    expect(screen.getByText("Parcial")).toBeInTheDocument();
  });
});
