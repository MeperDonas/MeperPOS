"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Expense,
  ExpenseAuditEntry,
  ExpenseCategory,
  ExpenseMonthlySummary,
  ExpenseQueryParams,
  PaginatedResponse,
} from "@/types";

export interface ExpensePaymentPayload {
  amount: number;
  method: "CASH" | "CARD" | "TRANSFER";
  date: string;
}

export interface CreateExpensePayload {
  categoryId: string;
  supplierId?: string;
  purchaseOrderId?: string;
  description?: string;
  date: string;
  total: number;
  payments: ExpensePaymentPayload[];
}

export interface UpdateExpensePayload {
  categoryId?: string;
  supplierId?: string | null;
  purchaseOrderId?: string | null;
  description?: string | null;
  date?: string;
  total?: number;
}

export interface ExpenseCategoryPayload {
  name: string;
}

export function useExpenses(params?: ExpenseQueryParams) {
  return useQuery({
    queryKey: ["expenses", params],
    queryFn: () =>
      api
        .get<PaginatedResponse<Expense>>("/expenses", params)
        .then((res) => res.data),
  });
}

export function useExpense(id: string) {
  return useQuery({
    queryKey: ["expense", id],
    queryFn: () => api.get<Expense>(`/expenses/${id}`).then((res) => res.data),
    enabled: !!id,
  });
}

export function useExpenseSummary(month: string) {
  return useQuery({
    queryKey: ["expenses", "summary", month],
    queryFn: () =>
      api
        .get<ExpenseMonthlySummary>("/expenses/summary/monthly", { month })
        .then((res) => res.data),
    enabled: !!month,
  });
}

export function useExpenseHistory(id: string) {
  return useQuery({
    queryKey: ["expenses", "history", id],
    queryFn: () =>
      api
        .get<ExpenseAuditEntry[]>(`/expenses/${id}/history`)
        .then((res) => res.data),
    enabled: !!id,
  });
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: ["expense-categories"],
    queryFn: () =>
      api
        .get<ExpenseCategory[]>("/expense-categories")
        .then((res) => res.data),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateExpensePayload) =>
      api.post<Expense>("/expenses", data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExpensePayload }) =>
      api.patch<Expense>(`/expenses/${id}`, data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<Expense>(`/expenses/${id}`).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

export function useAddExpensePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: ExpensePaymentPayload;
    }) =>
      api.post<Expense>(`/expenses/${id}/payments`, data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

export function useDuplicateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<Expense>(`/expenses/${id}/duplicate`).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

export function useUploadExpenseReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      api.upload<Expense>(`/expenses/${id}/upload`, file).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

export function useCreateExpenseCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ExpenseCategoryPayload) =>
      api
        .post<ExpenseCategory>("/expense-categories", data)
        .then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
    },
  });
}

export function useUpdateExpenseCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ExpenseCategoryPayload }) =>
      api
        .patch<ExpenseCategory>(`/expense-categories/${id}`, data)
        .then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
    },
  });
}

export function useDeleteExpenseCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api
        .delete<ExpenseCategory>(`/expense-categories/${id}`)
        .then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
    },
  });
}
