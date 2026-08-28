"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { UseQueryResult } from "@tanstack/react-query";
import type {
  ImportFullJobStatus,
  ImportJobStatus,
  ImportSheetId,
  ImportStartResponse,
} from "@/types";

export type ImportMode = "products" | "full";

export type RetryRowPayload = {
  rowIndex: number;
  correctedData: Record<string, unknown>;
  /** Required for multi-sheet imports; omitted for product-only retries. */
  sheetId?: ImportSheetId;
};

/**
 * Generalizes the product-only importer to the multi-sheet importer.
 * Pass `{ mode: "full" }` to use `POST /imports/full`, the sheet-aware
 * `/imports/:jobId/status` and `/imports/:jobId/retry-row` (sending `sheetId`),
 * and `GET /imports/full-template`. The default `"products"` mode preserves the
 * legacy product-import endpoints and query keys (the product-only UI was
 * folded into the multi-sheet importer, which now lives under `/settings`).
 */
export function useImport<TMode extends ImportMode = "products">(
  options: { mode?: TMode } = {},
) {
  const mode: ImportMode = options.mode ?? "products";
  const isFull = mode === "full";
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [startData, setStartData] = useState<ImportStartResponse | null>(null);

  const startUrl = isFull ? "/imports/full" : "/imports/products";
  const templateUrl = isFull ? "/imports/full-template" : "/imports/products/template";
  const statusQueryKey = ["imports", isFull ? "full" : "products", jobId];

  const startImport = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      return api
        .postWithFormData<ImportStartResponse>(startUrl, formData)
        .then((res) => res.data);
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
      setStartData(data);
    },
  });

  const statusQuery = useQuery<ImportJobStatus | ImportFullJobStatus>({
    queryKey: statusQueryKey,
    queryFn: () =>
      api
        .get<ImportJobStatus | ImportFullJobStatus>(`/imports/${jobId}/status`)
        .then((res) => res.data),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "PARSING" || status === "PROCESSING") {
        return 1000;
      }

      return false;
    },
  });

  const retryRow = useMutation({
    mutationFn: (payload: RetryRowPayload) => {
      if (!jobId) {
        throw new Error("No hay un trabajo de importacion activo");
      }

      return api
        .post<ImportJobStatus | ImportFullJobStatus>(
          `/imports/${jobId}/retry-row`,
          payload,
        )
        .then((res) => res.data);
    },
    onSuccess: (data) => {
      if (!jobId) {
        return;
      }

      queryClient.setQueryData(statusQueryKey, data);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const downloadTemplate = useMutation({
    mutationFn: () => api.downloadData(templateUrl),
  });

  const reset = () => {
    if (jobId) {
      queryClient.removeQueries({ queryKey: statusQueryKey });
    }

    setJobId(null);
    setStartData(null);
    startImport.reset();
    retryRow.reset();
  };

  return {
    jobId,
    startData,
    startImport,
    statusQuery: statusQuery as UseQueryResult<
      TMode extends "full" ? ImportFullJobStatus : ImportJobStatus
    >,
    retryRow,
    downloadTemplate,
    reset,
  };
}
