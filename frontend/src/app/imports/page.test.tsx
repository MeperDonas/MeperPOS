import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type {
  ImportFullJobStatus,
  ImportSheetStatus,
  ImportSheetRowError,
} from "@/types";

const useImportMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/components/layout/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({ success: toastSuccess, error: toastError }),
}));

vi.mock("@/hooks/useImport", () => ({
  useImport: () => useImportMock(),
}));

import ImportsPage from "./page";

function makeRow(overrides: Partial<ImportSheetRowError> = {}): ImportSheetRowError {
  return {
    rowIndex: 5,
    sheetId: "clientes",
    errorCode: "INVALID_DOCUMENT",
    message: "Documento invalido",
    mappedData: { name: "Ana Perez", documentNumber: "1010101" },
    editableFields: ["name", "documentNumber"],
    retried: false,
    retriedSuccess: false,
    ...overrides,
  };
}

function makeSheet(overrides: Partial<ImportSheetStatus> = {}): ImportSheetStatus {
  return {
    sheetId: "productos",
    status: "COMPLETED",
    totalRows: 10,
    processedRows: 10,
    imported: 10,
    skipped: 0,
    errors: 0,
    warnings: 0,
    rowErrors: [],
    ...overrides,
  };
}

function makeFullStatus(
  overrides: Partial<ImportFullJobStatus> = {},
): ImportFullJobStatus {
  return {
    jobId: "job-1",
    status: "COMPLETED",
    fileName: "import.xlsx",
    totalRows: 20,
    processedRows: 19,
    importedCount: 18,
    skippedCount: 0,
    errorCount: 1,
    warningCount: 0,
    sheets: [makeSheet(), makeSheet({ sheetId: "clientes", errors: 1, rowErrors: [makeRow()] })],
    errors: [makeRow()],
    ...overrides,
  };
}

function makeImportResult(status: ImportFullJobStatus | undefined) {
  return {
    startImport: { mutateAsync: vi.fn().mockResolvedValue({ jobId: "job-1" }), isPending: false },
    statusQuery: { data: status, isLoading: false },
    startData: status ? { jobId: status.jobId, totalRows: status.totalRows, detectedColumns: [], columnMapping: {} } : null,
    retryRow: { mutateAsync: vi.fn().mockResolvedValue(status), isPending: false },
    downloadTemplate: { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false },
    reset: vi.fn(),
  };
}

describe("ImportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the upload zone and the template button before starting", () => {
    useImportMock.mockReturnValue(makeImportResult(undefined));

    render(<ImportsPage />);

    expect(screen.getByText("Importar Inventario")).toBeInTheDocument();
    expect(screen.getByText(/Arrastra un archivo o haz click para subir/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Plantilla/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Iniciar importacion/i })).toBeInTheDocument();
  });

  it("starts a full import when a file is selected and submitted", async () => {
    const result = makeImportResult(undefined);
    useImportMock.mockReturnValue(result);
    const mutateAsync = result.startImport.mutateAsync;

    render(<ImportsPage />);

    const file = new File(["xlsx"], "import.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /Iniciar importacion/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(mutateAsync).toHaveBeenCalledWith(file);
  });

  it("renders the per-sheet progress and errors after an import completes", () => {
    useImportMock.mockReturnValue(makeImportResult(makeFullStatus()));

    render(<ImportsPage />);

    expect(screen.getAllByText("Productos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Clientes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("COMPLETED").length).toBeGreaterThan(0);
    expect(screen.getByText(/Errores por hoja/)).toBeInTheDocument();
    expect(screen.getByText("Documento invalido")).toBeInTheDocument();
  });

  it("retries a failed row sending its sheetId", async () => {
    const result = makeImportResult(makeFullStatus());
    useImportMock.mockReturnValue(result);
    const retryMutate = result.retryRow.mutateAsync;

    render(<ImportsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana Maria Perez" } });
    fireEvent.click(screen.getByRole("button", { name: /Reintentar fila/i }));

    await waitFor(() => expect(retryMutate).toHaveBeenCalledOnce());
    expect(retryMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        rowIndex: 5,
        sheetId: "clientes",
        correctedData: expect.objectContaining({ name: "Ana Maria Perez" }),
      }),
    );
  });

  it("downloads the multi-sheet template", async () => {
    const result = makeImportResult(undefined);
    useImportMock.mockReturnValue(result);

    render(<ImportsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Plantilla/i }));
    await waitFor(() => expect(result.downloadTemplate.mutateAsync).toHaveBeenCalledOnce());
  });
});
