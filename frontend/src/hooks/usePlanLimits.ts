"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PlanLimitsStatus } from "@/types";

export function usePlanLimits() {
  return useQuery({
    queryKey: ["plan-limits"],
    queryFn: () =>
      api.get<PlanLimitsStatus>("/plan-limits/status").then((res) => res.data),
    staleTime: 60_000, // 1 minute
    refetchInterval: 120_000, // refetch every 2 minutes
  });
}
