import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { CreatePosLoanInput, PosLoanInitiation } from "@/types";
import { useCreatePosLoan } from "./useLoans";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

const apiMock = api as unknown as { post: ReturnType<typeof vi.fn> };

const initiation: PosLoanInitiation = {
  intentId: "intent-1",
  loanId: "loan-1",
  organizationId: "org-1",
  customerId: "customer-1",
  agreedCustomerTotal: "12345.00",
  quoteSnapshot: {},
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

function baseInput(
  overrides: Partial<CreatePosLoanInput> = {},
): CreatePosLoanInput {
  return {
    customerId: "customer-1",
    reason: "Venta financiada",
    items: [{ productId: "product-1", quantity: 2 }],
    ...overrides,
  };
}

/** The body sent on the first POST to /loans/pos-initiation. */
function postedBody() {
  return apiMock.post.mock.calls[0]?.[1] as {
    requestKey?: string;
    issuedAt?: string;
    reason?: string;
    customerId?: string;
    discountAmount?: number;
    items: Array<Record<string, unknown>>;
  };
}

describe("useCreatePosLoan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.post.mockResolvedValue({ data: initiation });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts the initiation to /loans/pos-initiation and exposes the server agreed total", async () => {
    const { result } = renderHook(() => useCreatePosLoan(), { wrapper });

    await expect(result.current.mutateAsync(baseInput())).resolves.toEqual(
      initiation,
    );

    expect(apiMock.post).toHaveBeenCalledWith(
      "/loans/pos-initiation",
      expect.any(Object),
    );
    // React Query v5 notifies observers on a `setTimeout(0)` task, so the
    // settled value must be awaited rather than read synchronously.
    await waitFor(() =>
      expect(result.current.data?.agreedCustomerTotal).toBe("12345.00"),
    );
  });

  it("generates a non-empty requestKey and defaults issuedAt to a YYYY-MM-DD date", async () => {
    const { result } = renderHook(() => useCreatePosLoan(), { wrapper });

    await result.current.mutateAsync(baseInput());

    const body = postedBody();
    expect(body.customerId).toBe("customer-1");
    expect(body.reason).toBe("Venta financiada");
    expect(typeof body.requestKey).toBe("string");
    expect(body.requestKey?.length).toBeGreaterThan(0);
    expect(body.issuedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("passes ids, quantities and the line discount through, keeping unitPrice only for a deliberate override", async () => {
    const { result } = renderHook(() => useCreatePosLoan(), { wrapper });

    await result.current.mutateAsync(
      baseInput({
        discountAmount: 5000,
        items: [
          { productId: "p-a", quantity: 3, discountAmount: 500 },
          { productId: "p-b", quantity: 1, unitPrice: 45000 },
        ],
      }),
    );

    const body = postedBody();
    expect(body.discountAmount).toBe(5000);
    expect(body.items).toEqual([
      { productId: "p-a", quantity: 3, discountAmount: 500 },
      { productId: "p-b", quantity: 1, unitPrice: 45000 },
    ]);
    expect(body.items[0]).not.toHaveProperty("unitPrice");
  });
});
