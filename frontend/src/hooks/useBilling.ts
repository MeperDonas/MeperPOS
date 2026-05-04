"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BillingStatus, PaymentRecord } from "@/types";

export function useBillingStatus() {
  return useQuery({
    queryKey: ["billing", "status"],
    queryFn: () =>
      api.get<BillingStatus & { settings?: Record<string, unknown> }>("/billing/status").then(
        (res) => res.data
      ),
    staleTime: 60_000,
  });
}

export function useBillingPayments() {
  return useQuery({
    queryKey: ["billing", "payments"],
    queryFn: () =>
      api.get<PaymentRecord[]>("/billing/payments").then((res) => res.data),
    staleTime: 60_000,
  });
}

export function useRegisterPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      organizationId: string;
      amount: number;
      method: "CASH" | "CARD" | "TRANSFER";
      date?: string;
      status?: "PENDING" | "PAID" | "FAILED";
    }) => api.post<PaymentRecord>("/billing/payments", data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "payments"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "status"] });
    },
  });
}
