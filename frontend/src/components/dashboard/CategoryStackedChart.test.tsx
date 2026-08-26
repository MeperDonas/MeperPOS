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

  it("projects the tooltip towards the side furthest from the chart edge", () => {
    render(<CategoryStackedChart data={data} days={days} />);
    const bars = screen.getAllByTestId("category-daily-bar");

    // First day (left side) → projects to the right (translate-x-0).
    fireEvent.mouseEnter(bars[0]);
    expect(screen.getByTestId("category-tooltip").className).toContain("translate-x-0");

    // Last day (right side) → projects to the left (-translate-x-full).
    fireEvent.mouseEnter(bars[bars.length - 1]);
    expect(screen.getByTestId("category-tooltip").className).toContain("-translate-x-full");
  });
});

describe("CategoryStackedChart full-month behavior", () => {
  const monthDays = Array.from(
    { length: 30 },
    (_, index) => `2026-08-${String(index + 1).padStart(2, "0")}`,
  );

  it("renders one bar per day across the full month", () => {
    render(<CategoryStackedChart data={data} days={monthDays} />);

    expect(screen.getAllByTestId("category-daily-bar")).toHaveLength(30);
  });

  it("spaces the day-number labels so a full month does not crowd", () => {
    render(<CategoryStackedChart data={data} days={monthDays} />);

    const labels = screen.getAllByTestId("category-day-label");
    expect(labels).toHaveLength(30);

    const visibleLabels = labels
      .map((label) => label.textContent?.trim())
      .filter((text) => text);
    expect(visibleLabels).toEqual(["1", "5", "10", "15", "20", "25", "30"]);
  });

  it("leaves a clear thin-bar gap between adjacent bars", () => {
    const { container } = render(
      <CategoryStackedChart data={data} days={monthDays} />,
    );

    const slot = 400 / 30;
    const bars = container.querySelectorAll(
      '[data-testid="category-segment"], [data-testid="category-empty-bar"]',
    );
    const width = Number(bars[0].getAttribute("width"));

    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThan(slot * 0.8);
  });

  it("handles a 31-day month without dropping the last day or overflowing labels", () => {
    const november = Array.from(
      { length: 31 },
      (_, index) => `2026-11-${String(index + 1).padStart(2, "0")}`,
    );

    render(<CategoryStackedChart data={data} days={november} />);

    // Day 31 is still rendered as a bar.
    expect(screen.getAllByTestId("category-daily-bar")).toHaveLength(31);

    // Only the stepped days get a numeric label; day 31 stays unlabeled.
    const labels = screen.getAllByTestId("category-day-label");
    const visibleLabels = labels
      .map((label) => label.textContent?.trim())
      .filter((text) => text);
    expect(visibleLabels).toEqual(["1", "5", "10", "15", "20", "25", "30"]);
  });
});
