import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RevenueChart, type RevenueBarPoint } from "./RevenueChart";

const twoDayData: RevenueBarPoint[] = [
  {
    key: "2026-08-21",
    total: 0,
    count: 0,
    isToday: false,
    detailDate: "Viernes 21",
    dayAbbreviation: "Vie",
    monthLabel: "AGO",
    height: 18,
  },
  {
    key: "2026-08-22",
    total: 200000,
    count: 4,
    isToday: true,
    detailDate: "Sábado 22",
    dayAbbreviation: "Sáb",
    monthLabel: "AGO",
    height: 100,
  },
];

describe("RevenueChart (DIA-11..13)", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders bars with heights driven by the real revenue data", () => {
    const { container } = render(<RevenueChart data={twoDayData} />);

    const bars = screen.getAllByTestId("revenue-bar");
    expect(bars).toHaveLength(2);

    // Zero-total day gets the minimum visible height; the max day gets 100%.
    expect(bars[0].getAttribute("height")).toBe("18");
    expect(bars[0].getAttribute("y")).toBe("82");
    expect(bars[1].getAttribute("height")).toBe("100");
    expect(bars[1].getAttribute("y")).toBe("0");

    // No hardcoded/decorative SVG area path.
    expect(container.querySelectorAll("path").length).toBe(0);
  });

  it("shows an exact tooltip on hover with COP total, count and date", () => {
    render(<RevenueChart data={twoDayData} />);

    fireEvent.mouseEnter(screen.getAllByTestId("revenue-day")[1]);

    expect(screen.getByText(/\$\s200\.000/)).toBeTruthy();
    expect(screen.getByText("4 transacciones")).toBeTruthy();
    expect(screen.getByText("Sábado 22")).toBeTruthy();
  });

  it("does not surface a tooltip until a day is hovered", () => {
    render(<RevenueChart data={twoDayData} />);

    expect(screen.queryByText(/\$\s200\.000/)).toBeNull();
    expect(screen.queryByText("4 transacciones")).toBeNull();
  });
});
