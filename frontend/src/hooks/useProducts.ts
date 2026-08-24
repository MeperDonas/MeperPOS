"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Product, PaginatedResponse, SearchProductResult } from "@/types";

export function useProducts(params?: {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  status?: "active" | "inactive" | "all";
  enabled?: boolean;
}) {
  const { enabled = true, ...rest } = params ?? {};
  return useQuery({
    queryKey: ["products", rest],
    queryFn: () =>
      api.get<PaginatedResponse<Product>>("/products", rest).then(
        (res) => res.data
      ),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ["product", id],
    queryFn: () =>
      api.get<Product>(`/products/${id}`).then((res) => res.data),
    enabled: !!id,
  });
}

export function useLowStockProducts() {
  return useQuery({
    queryKey: ["products", "low-stock"],
    queryFn: () =>
      api.get<Product[]>("/products/low-stock").then((res) => res.data),
  });
}

export function useSearchProducts(query: string, limit = 20) {
  return useQuery({
    queryKey: ["products", "search", query, limit],
    queryFn: () =>
      api
        .get<SearchProductResult[]>("/products/search", { q: query, limit })
        .then((res) => res.data),
    enabled: query.length > 2,
  });
}

export function useQuickSearch(code: string) {
  return useQuery({
    queryKey: ["products", "quick-search", code],
    queryFn: () =>
      api.get<Product | null>("/products/quick-search", { code }).then(
        (res) => res.data
      ),
    enabled: code.length > 0,
  });
}

export function useQuickSearchProduct() {
  return useMutation({
    mutationFn: (code: string) =>
      api.get<Product | null>("/products/quick-search", { code }).then(
        (res) => res.data
      ),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Product>) =>
      api.post<Product>("/products", data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) =>
      api.put<Product>(`/products/${id}`, data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/products/${id}`).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeactivateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.put<Product>(`/products/${id}/deactivate`).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useReactivateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.put<Product>(`/products/${id}/reactivate`).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useUploadProductImage() {
  return useMutation({
    mutationFn: (file: File) =>
      api.upload<{ imageUrl: string }>("/products/upload", file).then(
        (res) => res.data
      ),
  });
}

export function useUploadProductImageById(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) =>
      api.upload<Product>(`/products/${productId}/upload`, file).then(
        (res) => res.data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
    },
  });
}
