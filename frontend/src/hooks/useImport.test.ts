import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { api } from "@/lib/api";
import type {
  ImportFullJobStatus,
  ImportSheetStatus,
  ImportSheetRowError,
  ImportStartResponse,
} from "@/types";
import { useImport } from "./useImport";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    postWithFormData: vi.fn(),
    downloadData: vi.fn(),
  },
}));

type MockApi = {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  postWithFormData: ReturnType<typeof vi.fn>;
  downloadData: ReturnType<typeof vi.fn>;
};

const apiMock = api as unknown as MockApi;

function makeRowError(
  overrides: Partial<ImportSheetRowError> = {},
): ImportSheetRowError {
  return {
    rowIndex: 5,
    sheetId: "productos",
    errorCode: "INVALID_PRICE",
    message: "Precio de venta invalido",
    mappedData: { name: "Coca Cola", salePrice: "abc" },
    editableFields: ["name", "salePrice"],
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
    imported: 9,
    skipped: 0,
    errors: 1,
    warnings: 0,
    rowErrors: [makeRowError()],
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
    processedRows: 20,
    importedCount: 18,
    skippedCount: 1,
    errorCount: 1,
    warningCount: 0,
    sheets: [makeSheet(), makeSheet({ sheetId: "clientes", errors: 0, rowErrors: [] })],
    errors: [makeRowError({ sheetId: "clientes" })],
    ...overrides,
  };
}

function makeStart(jobId = "job-1"): ImportStartResponse {
  return { jobId, totalRows: 20, detectedColumns: ["name", "salePrice"], columnMapping: {} };
}

function wrapperWith(queryClient: QueryClient) {
  return function wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("useImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.postWithFormData.mockResolvedValue({ data: makeStart() });
    apiMock.get.mockResolvedValue({ data: makeFullStatus() });
    apiMock.post.mockResolvedValue({ data: makeFullStatus() });
    apiMock.downloadData.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("full mode", () => {
    it("starts a full import by posting FormData to /imports/full", async () => {
      const { result } = renderHook(() => useImport({ mode: "full" }), {
        wrapper: wrapperWith(makeQueryClient()),
      });

      const file = new File(["xlsx"], "import.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      await result.current.startImport.mutateAsync(file);

      expect(apiMock.postWithFormData).toHaveBeenCalledOnce();
      const [url, formData] = apiMock.postWithFormData.mock.calls[0] as [
        string,
        FormData,
      ];
      expect(url).toBe("/imports/full");
      expect(formData).toBeInstanceOf(FormData);
      expect(formData.get("file")).toBe(file);
      await waitFor(() => expect(result.current.jobId).toBe("job-1"));
    });

    it("polls the sheet-aware status from /imports/:jobId/status and exposes the sheet breakdown", async () => {
      const queryClient = makeQueryClient();
      const { result } = renderHook(() => useImport({ mode: "full" }), {
        wrapper: wrapperWith(queryClient),
      });

      await result.current.startImport.mutateAsync(new File(["x"], "import.xlsx"));

      await waitFor(() => expect(result.current.statusQuery.data?.sheets).toHaveLength(2));
      expect(apiMock.get).toHaveBeenCalledWith("/imports/job-1/status");
      expect(result.current.statusQuery.data?.sheets[0].sheetId).toBe("productos");
      expect(result.current.statusQuery.data?.sheets[0].imported).toBe(9);
      expect(result.current.statusQuery.data?.errors[0].sheetId).toBe("clientes");
    });

    it("retries a failed row sending its sheetId to /imports/:jobId/retry-row", async () => {
      const { result } = renderHook(() => useImport({ mode: "full" }), {
        wrapper: wrapperWith(makeQueryClient()),
      });

      await result.current.startImport.mutateAsync(new File(["x"], "import.xlsx"));
      await waitFor(() => expect(result.current.jobId).toBe("job-1"));
      await result.current.retryRow.mutateAsync({
        rowIndex: 5,
        sheetId: "clientes",
        correctedData: { name: "Cliente A" },
      });

      expect(apiMock.post).toHaveBeenCalledWith("/imports/job-1/retry-row", {
        rowIndex: 5,
        sheetId: "clientes",
        correctedData: { name: "Cliente A" },
      });
    });

    it("downloads the full template from /imports/full-template", async () => {
      const { result } = renderHook(() => useImport({ mode: "full" }), {
        wrapper: wrapperWith(makeQueryClient()),
      });

      await result.current.downloadTemplate.mutateAsync();
      expect(apiMock.downloadData).toHaveBeenCalledWith("/imports/full-template");
    });
  });

  describe("products mode (backward compatible)", () => {
    it("posts to /imports/products by default", async () => {
      const { result } = renderHook(() => useImport(), {
        wrapper: wrapperWith(makeQueryClient()),
      });

      await result.current.startImport.mutateAsync(new File(["x"], "products.xlsx"));
      expect(apiMock.postWithFormData).toHaveBeenCalledWith(
        "/imports/products",
        expect.any(FormData),
      );
    });

    it("downloads the products template from /imports/products/template", async () => {
      const { result } = renderHook(() => useImport(), {
        wrapper: wrapperWith(makeQueryClient()),
      });

      await result.current.downloadTemplate.mutateAsync();
      expect(apiMock.downloadData).toHaveBeenCalledWith("/imports/products/template");
    });

    it("retries a product row without sending a sheetId", async () => {
      const { result } = renderHook(() => useImport(), {
        wrapper: wrapperWith(makeQueryClient()),
      });

      await result.current.startImport.mutateAsync(new File(["x"], "products.xlsx"));
      await waitFor(() => expect(result.current.jobId).toBe("job-1"));
      await result.current.retryRow.mutateAsync({
        rowIndex: 3,
        correctedData: { name: "Coca Cola" },
      });

      const payload = apiMock.post.mock.calls[0][1] as Record<string, unknown>;
      expect(payload.sheetId).toBeUndefined();
    });
  });
});
