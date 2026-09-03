import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorState } from "./ErrorState";

describe("ErrorState", () => {
  it("renders the message and a title when provided", () => {
    render(<ErrorState title="No se pudo cargar" message="Intenta de nuevo." />);

    expect(screen.getByText("No se pudo cargar")).toBeInTheDocument();
    expect(screen.getByText("Intenta de nuevo.")).toBeInTheDocument();
  });

  it("renders the message alone when no title is provided", () => {
    render(<ErrorState message="No se pudo cargar la configuración." />);

    expect(
      screen.getByText("No se pudo cargar la configuración."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("renders a retry button only when onRetry and retryLabel are present", () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        message="No se pudo cargar la configuración."
        retryLabel="Reintentar"
        onRetry={onRetry}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
  });

  it("does not render a retry button when handlers are absent", () => {
    render(<ErrorState message="No se pudo cargar la configuración." />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("does not render a retry button when only retryLabel is provided", () => {
    render(
      <ErrorState message="No se pudo cargar la configuración." retryLabel="Reintentar" />,
    );

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("fires onRetry when the retry button is clicked", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <ErrorState
        message="No se pudo cargar la configuración."
        retryLabel="Reintentar"
        onRetry={onRetry}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("merges an extra className through cn()", () => {
    render(<ErrorState message="No se pudo cargar." className="py-4" />);

    const message = screen.getByText("No se pudo cargar.");
    expect(message.closest("div")?.className).toContain("py-4");
  });
});
