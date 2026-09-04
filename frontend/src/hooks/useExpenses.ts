"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Expense,
  ExpenseAuditEntry,
  ExpenseGroup,
  ExpenseLabel,
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
  labelId: string;
  supplierId?: string;
  purchaseOrderId?: string;
  description?: string;
  date: string;
  total: number;
  payments: ExpensePaymentPayload[];
}

export interface UpdateExpensePayload {
  labelId?: string;
  supplierId?: string | null;
  purchaseOrderId?: string | null;
  description?: string | null;
  date?: string;
  total?: number;
}

export interface ExpenseTaxonomyPayload {
  name: string;
}

function invalidateExpenseData(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["expense-groups"] });
  void queryClient.invalidateQueries({ queryKey: ["expenses"] });
  void queryClient.invalidateQueries({ queryKey: ["expenses", "summary"] });
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

export function useExpenseGroups() {
  return useQuery({
    queryKey: ["expense-groups"],
    queryFn: () =>
      api.get<ExpenseGroup[]>("/expense-groups").then((res) => res.data),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateExpensePayload) =>
      api.post<Expense>("/expenses", data).then((res) => res.data),
    onSuccess: () => {
      invalidateExpenseData(queryClient);
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExpensePayload }) =>
      api.patch<Expense>(`/expenses/${id}`, data).then((res) => res.data),
    onSuccess: () => {
      invalidateExpenseData(queryClient);
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<Expense>(`/expenses/${id}`).then((res) => res.data),
    onSuccess: () => {
      invalidateExpenseData(queryClient);
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
      invalidateExpenseData(queryClient);
    },
  });
}

export function useDuplicateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<Expense>(`/expenses/${id}/duplicate`).then((res) => res.data),
    onSuccess: () => {
      invalidateExpenseData(queryClient);
    },
  });
}

export function useUploadExpenseReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      api.upload<Expense>(`/expenses/${id}/upload`, file).then((res) => res.data),
    onSuccess: () => {
      invalidateExpenseData(queryClient);
    },
  });
}

export function useCreateExpenseGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ExpenseTaxonomyPayload) =>
      api.post<ExpenseGroup>("/expense-groups", data).then((res) => res.data),
    onSuccess: () => {
      invalidateExpenseData(queryClient);
    },
  });
}

export function useUpdateExpenseGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ExpenseTaxonomyPayload }) =>
      api.patch<ExpenseGroup>(`/expense-groups/${id}`, data).then((res) => res.data),
    onSuccess: () => {
      invalidateExpenseData(queryClient);
    },
  });
}

export function useDeleteExpenseGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<ExpenseGroup>(`/expense-groups/${id}`).then((res) => res.data),
    onSuccess: () => {
      invalidateExpenseData(queryClient);
    },
  });
}

export function useCreateExpenseLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, data }: { groupId: string; data: ExpenseTaxonomyPayload }) =>
      api.post<ExpenseLabel>(`/expense-groups/${groupId}/labels`, data).then((res) => res.data),
    onSuccess: () => invalidateExpenseData(queryClient),
  });
}

export function useUpdateExpenseLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, id, data }: { groupId: string; id: string; data: ExpenseTaxonomyPayload }) =>
      api.patch<ExpenseLabel>(`/expense-groups/${groupId}/labels/${id}`, data).then((res) => res.data),
    onSuccess: () => invalidateExpenseData(queryClient),
  });
}

export function useDeleteExpenseLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, id }: { groupId: string; id: string }) =>
      api.delete<ExpenseLabel>(`/expense-groups/${groupId}/labels/${id}`).then((res) => res.data),
    onSuccess: () => invalidateExpenseData(queryClient),
  });
}
