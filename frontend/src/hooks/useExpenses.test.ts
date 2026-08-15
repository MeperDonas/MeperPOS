import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { api } from "@/lib/api";
import type {
  Expense,
  ExpenseAuditEntry,
  ExpenseCategory,
  ExpenseMonthlySummary,
  ExpensePayment,
  PaginatedResponse,
} from "@/types";
import {
  useAddExpensePayment,
  useCreateExpense,
  useCreateExpenseCategory,
  useDeleteExpense,
  useDeleteExpenseCategory,
  useDuplicateExpense,
  useExpense,
  useExpenseCategories,
  useExpenseHistory,
  useExpenses,
  useExpenseSummary,
  useUpdateExpense,
  useUpdateExpenseCategory,
  useUploadExpenseReceipt,
} from "./useExpenses";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  },
}));

type MockApi = {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  upload: ReturnType<typeof vi.fn>;
};

const apiMock = api as unknown as MockApi;

function makeCategory(overrides: Partial<ExpenseCategory> = {}): ExpenseCategory {
  return {
    id: "cat-1",
    organizationId: "org-a",
    name: "Arriendo",
    active: true,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function makePayment(overrides: Partial<ExpensePayment> = {}): ExpensePayment {
  return {
    id: "pay-1",
    expenseId: "exp-1",
    organizationId: "org-a",
    amount: 500000,
    method: "CASH",
    date: "2026-08-01T00:00:00.000Z",
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "exp-1",
    organizationId: "org-a",
    categoryId: "cat-1",
    category: makeCategory(),
    supplierId: null,
    purchaseOrderId: null,
    description: "Arriendo agosto",
    date: "2026-08-01T00:00:00.000Z",
    total: 500000,
    status: "PAID",
    receiptUrl: null,
    active: true,
    createdById: "user-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    payments: [makePayment()],
    ...overrides,
  };
}

function makePage(items: Expense[]): PaginatedResponse<Expense> {
  return {
    data: items,
    meta: { total: items.length, page: 1, limit: 10, totalPages: 1 },
  };
}

function makeSummary(): ExpenseMonthlySummary {
  return {
    month: "2026-08",
    total: 500000,
    categories: [{ categoryId: "cat-1", name: "Arriendo", total: 500000 }],
  };
}

function makeAuditEntry(): ExpenseAuditEntry {
  return {
    id: "audit-1",
    userId: "user-1",
    action: "EXPENSE_CREATED",
    resource: "Expense",
    resourceId: "exp-1",
    metadata: { summary: "Salida creada" },
    createdAt: "2026-08-01T00:00:00.000Z",
    organizationId: "org-a",
    user: { name: "Ana Perez", email: "ana@example.com" },
  };
}

function wrapperWith(queryClient: QueryClient) {
  return function wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

describe("useExpenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("queries", () => {
    it("fetches the paginated list with query params under the expenses key", async () => {
      const params = { page: 1, limit: 10, month: "2026-08" };
      const page = makePage([makeExpense()]);
      apiMock.get.mockResolvedValue({ data: page });

      const { result } = renderHook(() => useExpenses(params), {
        wrapper: wrapperWith(makeQueryClient()),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(apiMock.get).toHaveBeenCalledWith("/expenses", params);
      expect(result.current.data).toEqual(page);
    });

    it("fetches a single expense by id", async () => {
      const expense = makeExpense();
      apiMock.get.mockResolvedValue({ data: expense });

      const { result } = renderHook(() => useExpense("exp-1"), {
        wrapper: wrapperWith(makeQueryClient()),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(apiMock.get).toHaveBeenCalledWith("/expenses/exp-1");
      expect(result.current.data).toEqual(expense);
    });

    it("does not fetch a single expense without an id", () => {
      renderHook(() => useExpense(""), {
        wrapper: wrapperWith(makeQueryClient()),
      });

      expect(apiMock.get).not.toHaveBeenCalled();
    });

    it("fetches the monthly summary for the requested month", async () => {
      const summary = makeSummary();
      apiMock.get.mockResolvedValue({ data: summary });

      const { result } = renderHook(() => useExpenseSummary("2026-08"), {
        wrapper: wrapperWith(makeQueryClient()),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(apiMock.get).toHaveBeenCalledWith("/expenses/summary/monthly", {
        month: "2026-08",
      });
      expect(result.current.data).toEqual(summary);
    });

    it("fetches the audit history of an expense", async () => {
      const entries = [makeAuditEntry()];
      apiMock.get.mockResolvedValue({ data: entries });

      const { result } = renderHook(() => useExpenseHistory("exp-1"), {
        wrapper: wrapperWith(makeQueryClient()),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(apiMock.get).toHaveBeenCalledWith("/expenses/exp-1/history");
      expect(result.current.data).toEqual(entries);
    });

    it("fetches the expense categories", async () => {
      const categories = [makeCategory()];
      apiMock.get.mockResolvedValue({ data: categories });

      const { result } = renderHook(() => useExpenseCategories(), {
        wrapper: wrapperWith(makeQueryClient()),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(apiMock.get).toHaveBeenCalledWith("/expense-categories");
      expect(result.current.data).toEqual(categories);
    });
  });

  describe("mutations", () => {
    it("creates an expense and invalidates expense queries", async () => {
      const queryClient = makeQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const expense = makeExpense();
      apiMock.post.mockResolvedValue({ data: expense });

      const { result } = renderHook(() => useCreateExpense(), {
        wrapper: wrapperWith(queryClient),
      });

      const payload = {
        categoryId: "cat-1",
        description: "Arriendo agosto",
        date: "2026-08-01",
        total: 500000,
        payments: [
          { amount: 500000, method: "CASH", date: "2026-08-01" },
        ],
      };

      await result.current.mutateAsync(payload);

      expect(apiMock.post).toHaveBeenCalledWith("/expenses", payload);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["expenses"] });
    });

    it("updates an expense and invalidates expense queries", async () => {
      const queryClient = makeQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      apiMock.patch.mockResolvedValue({ data: makeExpense() });

      const { result } = renderHook(() => useUpdateExpense(), {
        wrapper: wrapperWith(queryClient),
      });

      const payload = { description: "Arriendo septiembre" };
      await result.current.mutateAsync({ id: "exp-1", data: payload });

      expect(apiMock.patch).toHaveBeenCalledWith("/expenses/exp-1", payload);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["expenses"] });
    });

    it("deletes an expense and invalidates expense queries", async () => {
      const queryClient = makeQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      apiMock.delete.mockResolvedValue({ data: makeExpense() });

      const { result } = renderHook(() => useDeleteExpense(), {
        wrapper: wrapperWith(queryClient),
      });

      await result.current.mutateAsync("exp-1");

      expect(apiMock.delete).toHaveBeenCalledWith("/expenses/exp-1");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["expenses"] });
    });

    it("adds a payment and invalidates expense queries", async () => {
      const queryClient = makeQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      apiMock.post.mockResolvedValue({ data: makeExpense() });

      const { result } = renderHook(() => useAddExpensePayment(), {
        wrapper: wrapperWith(queryClient),
      });

      const payload = { amount: 100000, method: "TRANSFER", date: "2026-08-10" };
      await result.current.mutateAsync({ id: "exp-1", data: payload });

      expect(apiMock.post).toHaveBeenCalledWith("/expenses/exp-1/payments", payload);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["expenses"] });
    });

    it("duplicates an expense and invalidates expense queries", async () => {
      const queryClient = makeQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      apiMock.post.mockResolvedValue({ data: makeExpense() });

      const { result } = renderHook(() => useDuplicateExpense(), {
        wrapper: wrapperWith(queryClient),
      });

      await result.current.mutateAsync("exp-1");

      expect(apiMock.post).toHaveBeenCalledWith("/expenses/exp-1/duplicate");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["expenses"] });
    });

    it("uploads a receipt via multipart and invalidates expense queries", async () => {
      const queryClient = makeQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      apiMock.upload.mockResolvedValue({ data: makeExpense() });

      const { result } = renderHook(() => useUploadExpenseReceipt(), {
        wrapper: wrapperWith(queryClient),
      });

      const file = new File(["receipt"], "comprobante.jpg", {
        type: "image/jpeg",
      });
      await result.current.mutateAsync({ id: "exp-1", file });

      expect(apiMock.upload).toHaveBeenCalledWith("/expenses/exp-1/upload", file);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["expenses"] });
    });

    it("creates a category and invalidates category queries", async () => {
      const queryClient = makeQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      apiMock.post.mockResolvedValue({ data: makeCategory() });

      const { result } = renderHook(() => useCreateExpenseCategory(), {
        wrapper: wrapperWith(queryClient),
      });

      await result.current.mutateAsync({ name: "Impuestos" });

      expect(apiMock.post).toHaveBeenCalledWith("/expense-categories", {
        name: "Impuestos",
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["expense-categories"],
      });
    });

    it("updates a category and invalidates category queries", async () => {
      const queryClient = makeQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      apiMock.patch.mockResolvedValue({ data: makeCategory() });

      const { result } = renderHook(() => useUpdateExpenseCategory(), {
        wrapper: wrapperWith(queryClient),
      });

      await result.current.mutateAsync({ id: "cat-1", data: { name: "Seguros" } });

      expect(apiMock.patch).toHaveBeenCalledWith("/expense-categories/cat-1", {
        name: "Seguros",
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["expense-categories"],
      });
    });

    it("deletes a category and invalidates category queries", async () => {
      const queryClient = makeQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      apiMock.delete.mockResolvedValue({ data: makeCategory() });

      const { result } = renderHook(() => useDeleteExpenseCategory(), {
        wrapper: wrapperWith(queryClient),
      });

      await result.current.mutateAsync("cat-1");

      expect(apiMock.delete).toHaveBeenCalledWith("/expense-categories/cat-1");
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["expense-categories"],
      });
    });
  });
});
