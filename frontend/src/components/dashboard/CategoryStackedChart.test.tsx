import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CategoryStackedChart } from "./CategoryStackedChart";
import type { SaleByCategoryDaily } from "@/types";

const days = ["2026-08-20", "2026-08-21", "2026-08-22"];

const data: SaleByCategoryDaily[] = [
  { date: "2026-08-21", category: "Bebidas", total: 100000, quantity: 2 },
  { date: "2026-08-21", category: "Snacks", total: 50000, quantity: 1 },
  { date: "2026-08-22", category: "Bebidas", total: 25000, quantity: 1 },
];

describe("CategoryStackedChart (daily stacked by category)", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders one bar per day", () => {
    render(<CategoryStackedChart data={data} days={days} />);

    expect(screen.getAllByTestId("category-daily-bar")).toHaveLength(3);
  });

  it("renders a segment per category sold that day", () => {
    render(<CategoryStackedChart data={data} days={days} />);

    // Day 21 has two categories, day 22 has one, day 20 has none.
    expect(screen.getAllByTestId("category-segment")).toHaveLength(3);
  });

  it("assigns each category a stable, distinct color", () => {
    const { container } = render(
      <CategoryStackedChart data={data} days={days} />,
    );

    const bebidas = container.querySelector(
      '[data-testid="category-segment"][data-category="Bebidas"]',
    );
    const snacks = container.querySelector(
      '[data-testid="category-segment"][data-category="Snacks"]',
    );

    expect(bebidas).toBeTruthy();
    expect(snacks).toBeTruthy();
    expect(bebidas?.getAttribute("fill")).not.toBe(snacks?.getAttribute("fill"));
  });

  it("shows a tooltip with the day total and category breakdown on hover", () => {
    render(<CategoryStackedChart data={data} days={days} />);

    // Day 21 (index 1) is the first bar with data.
    fireEvent.mouseEnter(screen.getAllByTestId("category-daily-bar")[1]);

    expect(screen.getByText(/\$\s150\.000/)).toBeTruthy();
    expect(screen.getByText("Bebidas")).toBeTruthy();
    expect(screen.getByText("Snacks")).toBeTruthy();
  });

  it("does not surface a tooltip until a day is hovered", () => {
    render(<CategoryStackedChart data={data} days={days} />);

    expect(screen.queryByText(/\$\s150\.000/)).toBeNull();
    expect(screen.queryByText("Bebidas")).toBeNull();
  });
});
