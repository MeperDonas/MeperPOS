import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ImportSheetErrors } from "./ImportSheetErrors";
import type { ImportSheetRowError } from "@/types";

function makeError(overrides: Partial<ImportSheetRowError> = {}): ImportSheetRowError {
  return {
    rowIndex: 5,
    sheetId: "clientes",
    errorCode: "DUPLICATE_DOCUMENT",
    message: "Documento duplicado",
    mappedData: { name: "Ana Perez", documentNumber: "1010101" },
    editableFields: ["name", "documentNumber"],
    retried: false,
    retriedSuccess: false,
    ...overrides,
  };
}

describe("ImportSheetErrors", () => {
  it("does not render anything when there are no errors", () => {
    render(<ImportSheetErrors errors={[]} onRetry={vi.fn()} />);
    expect(screen.queryByText(/Fila/)).not.toBeInTheDocument();
  });

  it("groups errors by their originating sheet", () => {
    render(
      <ImportSheetErrors
        errors={[
          makeError({ sheetId: "clientes" }),
          makeError({ rowIndex: 9, sheetId: "productos", errorCode: "INVALID_PRICE" }),
        ]}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Clientes")).toBeInTheDocument();
    expect(screen.getByText("Productos")).toBeInTheDocument();
    expect(screen.getByText("Fila 5")).toBeInTheDocument();
    expect(screen.getByText("Fila 9")).toBeInTheDocument();
  });

  it("renders the error message and editable fields", () => {
    render(<ImportSheetErrors errors={[makeError()]} onRetry={vi.fn()} />);

    expect(screen.getByText("Documento duplicado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
    expect(screen.getByLabelText("N° documento")).toBeInTheDocument();
  });

  it("calls onRetry with the error and the edited corrected data", () => {
    const onRetry = vi.fn();
    render(<ImportSheetErrors errors={[makeError()]} onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Ana Maria Perez" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Reintentar fila/i }));

    expect(onRetry).toHaveBeenCalledOnce();
    const [error, correctedData] = onRetry.mock.calls[0] as [
      ImportSheetRowError,
      Record<string, unknown>,
    ];
    expect(error.rowIndex).toBe(5);
    expect(error.sheetId).toBe("clientes");
    expect(correctedData.name).toBe("Ana Maria Perez");
  });
});
