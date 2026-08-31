import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickAmountButtons } from "./QuickAmountButtons";

/**
 * S4 task 4.1 characterization baseline: locks the CURRENT currency output
 * before the formatCurrency unification (task 4.2). The bill buttons used to
 * render a raw, browser-locale dependent amount — this file documented the
 * before-value ("$10.000" under the es-CO runtime default) and task 4.2
 * updated the expectations to the deterministic es-CO formatCurrency output
 * (accepted presentation delta, amendment #404-3).
 * The exact-amount button already used formatCurrency and must not change.
 *
 * Note on exact strings: formatCurrency inserts a no-break space (U+00A0)
 * after the "$" symbol. The accessible name used by getByRole preserves it,
 * so role-name matchers below use NBSP. (getByText collapses node whitespace
 * instead — see PaymentConfirmationModal.test.tsx.)
 */

const NBSP = "\u00A0";

describe("QuickAmountButtons", () => {
  it("renders bill amounts through formatCurrency (deterministic es-CO)", () => {
    render(<QuickAmountButtons total={50000} onAmountSelect={vi.fn()} />);

    // After-value (formatCurrency, deterministic es-CO, amendment #404-3):
    // "$ 10.000" with a no-break space between symbol and amount.
    expect(
      screen.getByRole("button", { name: `$${NBSP}10.000` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `$${NBSP}20.000` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `$${NBSP}50.000` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `$${NBSP}100.000` }),
    ).toBeInTheDocument();
  });

  it("renders the exact-amount button through formatCurrency", () => {
    render(<QuickAmountButtons total={50000} onAmountSelect={vi.fn()} />);

    expect(
      screen.getByRole("button", {
        name: `Exacto ($${NBSP}50.000)`,
      }),
    ).toBeInTheDocument();
  });

  it("selects a bill amount on click", async () => {
    const user = userEvent.setup();
    const onAmountSelect = vi.fn();
    render(
      <QuickAmountButtons total={50000} onAmountSelect={onAmountSelect} />,
    );

    await user.click(screen.getByRole("button", { name: `$${NBSP}20.000` }));

    expect(onAmountSelect).toHaveBeenCalledWith(20000);
  });
});
