"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CreatePosLoanInput, PosLoanInitiation } from "@/types";

/** Today as a strict `YYYY-MM-DD` date, the shape the initiation DTO requires. */
function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * POS cart financing (POST /loans/pos-initiation).
 *
 * The server owns every money value: the caller supplies the customer, the cart
 * lines (with `unitPrice` only for a deliberate override) and the optional
 * sale-wide discount. When the caller does not pin a `requestKey` the hook
 * generates one; a page that retries a failed attempt should pin a stable key
 * so the initiation stays idempotent.
 */
export function useCreatePosLoan() {
  const queryClient = useQueryClient();

  return useMutation<PosLoanInitiation, Error, CreatePosLoanInput>({
    mutationFn: (data: CreatePosLoanInput) =>
      api
        .post<PosLoanInitiation>("/loans/pos-initiation", {
          customerId: data.customerId,
          reason: data.reason,
          // Line `unitPrice` is forwarded only when the caller deliberately
          // overrode it; otherwise the server prices the line itself.
          items: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            ...(item.unitPrice !== undefined
              ? { unitPrice: item.unitPrice }
              : {}),
            ...(item.discountAmount !== undefined
              ? { discountAmount: item.discountAmount }
              : {}),
          })),
          issuedAt: data.issuedAt ?? todayIsoDate(),
          ...(data.dueAt !== undefined ? { dueAt: data.dueAt } : {}),
          ...(data.discountAmount !== undefined
            ? { discountAmount: data.discountAmount }
            : {}),
          requestKey: data.requestKey ?? crypto.randomUUID(),
        })
        .then((res) => res.data),
    onSuccess: () => {
      // Mirrors the useSales convention: the initiation moves stock, so the
      // loan list, the product catalogue and the dashboard aggregates all drift.
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
