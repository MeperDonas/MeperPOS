import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BentoSelect } from "@/components/ui/BentoSelect";

const baseOptions = [
  { value: "a", label: "Opción A" },
  { value: "b", label: "Opción B" },
];

describe("BentoSelect", () => {
  it("shows the placeholder when no option is selected", () => {
    const onChange = vi.fn();
    render(
      <BentoSelect
        value="x"
        placeholder="Elige algo"
        options={baseOptions}
        onChange={onChange}
      />
    );

    expect(screen.getByText("Elige algo")).toBeInTheDocument();
  });

  it("renders the label prop above the trigger", () => {
    const onChange = vi.fn();
    render(
      <BentoSelect
        value=""
        label="Categoría"
        options={baseOptions}
        onChange={onChange}
      />
    );

    expect(screen.getByText("Categoría")).toBeInTheDocument();
  });

  it("opens the popover and lists the options when the trigger is clicked", () => {
    const onChange = vi.fn();
    render(<BentoSelect value="" options={baseOptions} onChange={onChange} />);

    expect(screen.queryByText("Opción A")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("Opción A")).toBeInTheDocument();
    expect(screen.getByText("Opción B")).toBeInTheDocument();
  });

  it("calls onChange with the selected value and closes the popover", () => {
    const onChange = vi.fn();
    render(<BentoSelect value="" options={baseOptions} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("Opción A"));

    expect(onChange).toHaveBeenCalledWith("a");
    expect(screen.queryByText("Opción B")).not.toBeInTheDocument();
  });

  it("highlights the selected option with a check icon and selected classes", () => {
    const onChange = vi.fn();
    render(<BentoSelect value="b" options={baseOptions} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button"));

    // The trigger first renders the selected label, then the option list echo.
    const selectedOptionLabel = screen.getAllByText("Opción B")[1];
    const selectedRow = selectedOptionLabel.closest("div")!.parentElement!;
    expect(selectedRow.className).toContain("bg-primary-light");
    expect(selectedRow.className).toContain("text-primary");
    expect(selectedRow.className).toContain("font-bold");
    expect(selectedRow.querySelector("svg")).toBeInTheDocument();

    const unselectedRow = screen
      .getByText("Opción A")
      .closest("div")!.parentElement!;
    expect(unselectedRow.querySelector("svg")).toBeNull();
  });

  it("renders an option badge when one is provided", () => {
    const onChange = vi.fn();
    render(
      <BentoSelect
        value=""
        options={[{ value: "a", label: "Opción A", badge: "NUEVO" }]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("NUEVO")).toBeInTheDocument();
  });

  it("closes the popover when a mousedown happens outside the container", () => {
    const onChange = vi.fn();
    render(<BentoSelect value="" options={baseOptions} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Opción A")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByText("Opción A")).not.toBeInTheDocument();
  });
});
