import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type {
  ImportFullJobStatus,
  ImportSheetStatus,
  ImportSheetRowError,
} from "@/types";

const useImportMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => ({ success: toastSuccess, error: toastError }),
}));

vi.mock("@/hooks/useImport", () => ({
  useImport: () => useImportMock(),
}));

import ImportDataSettingsPage from "./page";

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

describe("ImportDataSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the importer with the upload zone and the template button before starting", () => {
    useImportMock.mockReturnValue(makeImportResult(undefined));

    render(<ImportDataSettingsPage />);

    expect(screen.getByText("Importar datos")).toBeInTheDocument();
    expect(screen.getByText("Importación Multi-Hoja")).toBeInTheDocument();
    expect(screen.getByText(/Arrastra un archivo o haz click para subir/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Plantilla/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Iniciar importacion/i })).toBeInTheDocument();
  });

  it("requires an .xlsx file before starting", async () => {
    const result = makeImportResult(undefined);
    useImportMock.mockReturnValue(result);

    render(<ImportDataSettingsPage />);

    const file = new File(["xlsx"], "datos.txt", { type: "text/plain" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(toastError).toHaveBeenCalledWith("Formato no soportado. Usa un archivo .xlsx");
    expect(screen.getByRole("button", { name: /Iniciar importacion/i })).toBeDisabled();
  });

  it("starts a full import when a valid .xlsx file is selected and submitted", async () => {
    const result = makeImportResult(undefined);
    useImportMock.mockReturnValue(result);
    const mutateAsync = result.startImport.mutateAsync;

    render(<ImportDataSettingsPage />);

    const file = new File(["xlsx"], "import.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /Iniciar importacion/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(mutateAsync).toHaveBeenCalledWith(file);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Importacion iniciada correctamente"));
  });

  it("renders the per-sheet progress and errors after an import completes", () => {
    useImportMock.mockReturnValue(makeImportResult(makeFullStatus()));

    render(<ImportDataSettingsPage />);

    expect(screen.getAllByText("Productos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Clientes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("COMPLETED").length).toBeGreaterThan(0);
    expect(screen.getByText(/Errores por hoja/)).toBeInTheDocument();
    expect(screen.getByText("Documento invalido")).toBeInTheDocument();
  });

  it("fires the multi-sheet template download", async () => {
    const result = makeImportResult(undefined);
    useImportMock.mockReturnValue(result);

    render(<ImportDataSettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Plantilla/i }));
    await waitFor(() => expect(result.downloadTemplate.mutateAsync).toHaveBeenCalledOnce());
  });
});
