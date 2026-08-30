import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DynamicFallback } from "@/components/ui/DynamicFallback";

describe("DynamicFallback", () => {
  it("renders a loading skeleton with status semantics while a chunk loads", () => {
    render(<DynamicFallback />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("data-testid", "dynamic-fallback");
    expect(status).toHaveTextContent("Cargando...");
  });

  it("renders a custom label when one is provided", () => {
    render(<DynamicFallback label="Cargando pago..." />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Cargando pago...");
    expect(status).not.toHaveTextContent("Cargando...");
  });

  it("merges extra className through cn()", () => {
    render(<DynamicFallback className="py-4" />);

    const status = screen.getByRole("status");
    expect(status.className).toContain("py-4");
    expect(status.className).toContain("items-center");
  });
});
